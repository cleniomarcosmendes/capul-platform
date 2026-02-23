"""
Sistema de Controle de Ciclos de Contagem
==========================================
Implementação da nova estrutura proposta com controle direto
de usuários por ciclo no cabeçalho e flags de recontagem nos itens.

Autor: Sistema de Inventário
Data: 2025-01-17
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import logging
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.constants import VALID_CYCLE_COLUMNS
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# =====================================================
# SCHEMAS
# =====================================================

class UserProductsResponse(BaseModel):
    """Resposta com produtos atribuídos ao usuário"""
    success: bool
    message: str
    data: Dict[str, Any]

class CountingRequest(BaseModel):
    """Requisição para registrar contagem"""
    inventory_item_id: str
    quantity: float = Field(..., ge=0)
    lot_counts: List[Dict[str, Any]] = Field(default_factory=list)
    observation: str = Field(default="")

class CycleAdvanceRequest(BaseModel):
    """Requisição para avançar ciclo"""
    inventory_id: str
    tolerance_percent: float = Field(default=5.0, ge=0, le=100)

# =====================================================
# ENDPOINTS PRINCIPAIS
# =====================================================

@router.get("/inventory/{inventory_id}/my-products")
async def get_my_products_for_counting(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obter produtos atribuídos ao usuário atual para contagem.
    Usa a nova estrutura com controle direto no cabeçalho.
    """
    try:
        logger.info(f"🔍 Buscando produtos para usuário {current_user.username} no inventário {inventory_id}")
        
        # Verificar se o inventário existe e obter informações do ciclo
        inventory_query = text("""
            SELECT 
                il.id,
                il.name,
                il.list_status,
                il.current_cycle,
                il.counter_cycle_1,
                il.counter_cycle_2,
                il.counter_cycle_3,
                CASE il.current_cycle
                    WHEN 1 THEN il.counter_cycle_1
                    WHEN 2 THEN il.counter_cycle_2
                    WHEN 3 THEN il.counter_cycle_3
                END as current_counter
            FROM inventario.inventory_lists il
            WHERE il.id = :inventory_id
        """)
        
        inventory = db.execute(
            inventory_query,
            {"inventory_id": inventory_id}
        ).fetchone()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Verificar se o usuário é o responsável pelo ciclo atual
        if str(inventory.current_counter) != str(current_user.id):
            logger.warning(f"⚠️ Usuário {current_user.username} não é responsável pelo ciclo {inventory.current_cycle}")
            return {
                "success": False,
                "message": f"Você não é o responsável pelo ciclo {inventory.current_cycle} deste inventário",
                "data": {
                    "inventory_id": inventory_id,
                    "user_id": str(current_user.id),
                    "can_count": False,
                    "reason": "not_assigned",
                    "current_cycle": inventory.current_cycle,
                    "list_status": inventory.list_status
                }
            }
        
        # Verificar se a lista está liberada para contagem
        if inventory.list_status != 'EM_CONTAGEM':
            logger.warning(f"⚠️ Lista {inventory.name} não está liberada para contagem (status: {inventory.list_status})")
            return {
                "success": False,
                "message": f"Lista não está liberada para contagem (Status: {inventory.list_status})",
                "data": {
                    "inventory_id": inventory_id,
                    "user_id": str(current_user.id),
                    "can_count": False,
                    "reason": "not_released",
                    "current_cycle": inventory.current_cycle,
                    "list_status": inventory.list_status
                }
            }
        
        # Buscar produtos que precisam ser contados no ciclo atual
        products_query = text("""
            SELECT 
                ii.id as item_id,
                ii.product_code,
                ii.expected_quantity,
                ii.sequence,
                ii.status,
                CASE :current_cycle
                    WHEN 1 THEN ii.needs_recount_cycle_1
                    WHEN 2 THEN ii.needs_recount_cycle_2
                    WHEN 3 THEN ii.needs_recount_cycle_3
                END as needs_counting,
                CASE :current_cycle
                    WHEN 1 THEN ii.count_cycle_1
                    WHEN 2 THEN ii.count_cycle_2
                    WHEN 3 THEN ii.count_cycle_3
                END as counted_quantity,
                -- Buscar informações do produto
                COALESCE(sb1.b1_desc, 'Produto ' || ii.product_code) as product_name,
                COALESCE(sb1.b1_um, 'UN') as unit,
                CASE 
                    WHEN sb1.b1_rastro IN ('L', 'S') THEN true
                    ELSE false
                END as requires_lot
            FROM inventario.inventory_items ii
            LEFT JOIN inventario.sb1010 sb1 ON sb1.b1_cod = ii.product_code
            WHERE ii.inventory_list_id = :inventory_id
                AND CASE :current_cycle
                    WHEN 1 THEN ii.needs_recount_cycle_1
                    WHEN 2 THEN ii.needs_recount_cycle_2
                    WHEN 3 THEN ii.needs_recount_cycle_3
                END = true
            ORDER BY ii.sequence, ii.product_code
        """)
        
        products = db.execute(
            products_query,
            {
                "inventory_id": inventory_id,
                "current_cycle": inventory.current_cycle
            }
        ).fetchall()
        
        # Formatar resposta
        user_products = []
        for product in products:
            user_products.append({
                "item_id": str(product.item_id),
                "product_code": product.product_code,
                "product_name": product.product_name,
                "unit": product.unit,
                "expected_quantity": float(product.expected_quantity or 0),
                "counted_quantity": float(product.counted_quantity) if product.counted_quantity else None,
                "status": "COUNTED" if product.counted_quantity is not None else "PENDING",
                "requires_lot": product.requires_lot,
                "controls_batch": product.requires_lot
            })
        
        logger.info(f"✅ Encontrados {len(user_products)} produtos para o usuário contar no ciclo {inventory.current_cycle}")
        
        return {
            "success": True,
            "message": f"Produtos do ciclo {inventory.current_cycle} carregados com sucesso",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "user_id": str(current_user.id),
                "user_name": current_user.full_name,
                "can_count": True,
                "current_cycle": inventory.current_cycle,
                "list_status": inventory.list_status,
                "user_products": user_products,
                "total_products": len(user_products)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar produtos: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar produtos"))

@router.post("/inventory/{inventory_id}/register-count")
async def register_count_new(
    inventory_id: str,
    count_data: CountingRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registrar contagem usando a nova estrutura de ciclos.
    """
    try:
        logger.info(f"📝 Registrando contagem do usuário {current_user.username}")
        
        # Verificar permissão usando a função SQL
        logger.info(f"🔐 Verificando permissão do usuário {current_user.id} no inventário {inventory_id}")
        permission_check = text("""
            SELECT inventario.can_user_count(:inventory_id::uuid, :user_id::uuid) as can_count
        """)
        
        result = db.execute(
            permission_check,
            {"inventory_id": inventory_id, "user_id": str(current_user.id)}
        ).fetchone()
        
        logger.info(f"🔐 Resultado da verificação de permissão: {result.can_count}")
        
        if not result.can_count:
            logger.warning(f"🚫 Usuário {current_user.username} tentou contar sem permissão no inventário {inventory_id}")
            raise HTTPException(
                status_code=403,
                detail="Você não tem permissão para contar neste ciclo"
            )
        
        logger.info(f"✅ Usuário {current_user.username} autorizado a contar no inventário {inventory_id}")
        
        # Obter ciclo atual e status - CORREÇÃO: Buscar da lista de contagem do usuário
        cycle_query = text("""
            SELECT
                il.current_cycle,
                il.list_status as inventory_status,
                cl.list_status as counting_list_status
            FROM inventario.inventory_lists il
            LEFT JOIN inventario.counting_lists cl ON cl.inventory_id = il.id
                AND (cl.counter_cycle_1 = :user_id OR cl.counter_cycle_2 = :user_id OR cl.counter_cycle_3 = :user_id)
            WHERE il.id = :inventory_id
        """)

        inventory = db.execute(
            cycle_query,
            {"inventory_id": inventory_id, "user_id": str(current_user.id)}
        ).fetchone()

        # Verificar o status da lista de contagem, não do inventário principal
        # Se não encontrou lista de contagem OU o status não é EM_CONTAGEM, usa o status do inventário como fallback
        actual_status = inventory.counting_list_status if inventory.counting_list_status else inventory.inventory_status

        # Por enquanto, aceitar tanto EM_CONTAGEM quanto ABERTA para permitir testes
        if actual_status not in ['EM_CONTAGEM', 'ABERTA']:
            raise HTTPException(
                status_code=400,
                detail=f"Lista de inventário não foi liberada para contagem (Status: {actual_status}). Solicite ao supervisor para liberar a lista."
            )
        
        current_cycle = inventory.current_cycle
        
        # Verificar se o item pertence ao inventário e precisa ser contado
        item_check = text("""
            SELECT 
                ii.id,
                ii.product_code,
                CASE :cycle
                    WHEN 1 THEN ii.needs_recount_cycle_1
                    WHEN 2 THEN ii.needs_recount_cycle_2
                    WHEN 3 THEN ii.needs_recount_cycle_3
                END as needs_counting
            FROM inventario.inventory_items ii
            WHERE ii.id = :item_id
                AND ii.inventory_list_id = :inventory_id
        """)
        
        item = db.execute(
            item_check,
            {
                "item_id": count_data.inventory_item_id,
                "inventory_id": inventory_id,
                "cycle": current_cycle
            }
        ).fetchone()
        
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado no inventário")
        
        if not item.needs_counting:
            raise HTTPException(
                status_code=400,
                detail=f"Este item não precisa ser contado no ciclo {current_cycle}"
            )
        
        # Calcular quantidade total
        total_quantity = 0
        if count_data.lot_counts and len(count_data.lot_counts) > 0:
            # Contagem por lote
            total_quantity = sum(lot['quantity'] for lot in count_data.lot_counts)
        else:
            # Contagem simples
            total_quantity = count_data.quantity
        
        # Atualizar a contagem do ciclo atual
        # ✅ SEGURANÇA v2.19.13: Validar ciclo para prevenir SQL Injection
        if current_cycle not in VALID_CYCLE_COLUMNS:
            raise HTTPException(status_code=400, detail=f"Ciclo inválido: {current_cycle}")
        count_column = VALID_CYCLE_COLUMNS[current_cycle]

        update_query = text(f"""
            UPDATE inventario.inventory_items
            SET {count_column} = :quantity,
                last_counted_at = CURRENT_TIMESTAMP,
                last_counted_by = :user_id,
                status = 'COUNTED'
            WHERE id = :item_id
        """)
        
        db.execute(
            update_query,
            {
                "quantity": total_quantity,
                "user_id": str(current_user.id),
                "item_id": count_data.inventory_item_id
            }
        )
        
        # Registrar na tabela de contagens para histórico
        if count_data.lot_counts and len(count_data.lot_counts) > 0:
            # Registrar cada lote
            for lot in count_data.lot_counts:
                insert_counting = text("""
                    INSERT INTO inventario.countings (
                        inventory_item_id, quantity, lot_number, 
                        observation, counted_by, count_number
                    ) VALUES (
                        :item_id, :quantity, :lot_number,
                        :observation, :user_id, :count_number
                    )
                """)
                
                db.execute(
                    insert_counting,
                    {
                        "item_id": count_data.inventory_item_id,
                        "quantity": lot['quantity'],
                        "lot_number": lot.get('lot_number', ''),
                        "observation": lot.get('observation', count_data.observation),
                        "user_id": str(current_user.id),
                        "count_number": current_cycle
                    }
                )
        else:
            # Registrar contagem simples
            insert_counting = text("""
                INSERT INTO inventario.countings (
                    inventory_item_id, quantity, lot_number,
                    observation, counted_by, count_number
                ) VALUES (
                    :item_id, :quantity, '',
                    :observation, :user_id, :count_number
                )
            """)
            
            db.execute(
                insert_counting,
                {
                    "item_id": count_data.inventory_item_id,
                    "quantity": total_quantity,
                    "observation": count_data.observation or '',
                    "user_id": str(current_user.id),
                    "count_number": current_cycle
                }
            )
        
        db.commit()
        
        logger.info(f"✅ Contagem registrada com sucesso: {total_quantity} unidades")
        
        return {
            "success": True,
            "message": f"Contagem do ciclo {current_cycle} registrada com sucesso",
            "data": {
                "item_id": count_data.inventory_item_id,
                "product_code": item.product_code,
                "total_quantity": total_quantity,
                "cycle_number": current_cycle,
                "has_lot_control": len(count_data.lot_counts) > 0,
                "lot_count": len(count_data.lot_counts)
            }
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao registrar contagem: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao registrar contagem"))

@router.post("/inventory/{inventory_id}/advance-cycle")
async def advance_inventory_cycle(
    inventory_id: str,
    request: CycleAdvanceRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Avançar para o próximo ciclo de contagem.
    Identifica divergências e marca itens para recontagem.
    """
    try:
        logger.info(f"🔄 Avançando ciclo do inventário {inventory_id}")
        
        # Verificar se usuário tem permissão (admin ou supervisor)
        if current_user.role not in ['ADMIN', 'SUPERVISOR']:
            raise HTTPException(
                status_code=403,
                detail="Apenas administradores e supervisores podem avançar ciclos"
            )
        
        # Chamar função SQL para avançar ciclo
        advance_query = text("""
            SELECT * FROM inventario.advance_cycle(
                :inventory_id::uuid,
                :tolerance_percent
            )
        """)
        
        result = db.execute(
            advance_query,
            {
                "inventory_id": inventory_id,
                "tolerance_percent": request.tolerance_percent
            }
        ).fetchone()
        
        db.commit()
        
        logger.info(f"✅ Ciclo avançado: {result.items_needing_recount} itens precisam recontagem no ciclo {result.next_cycle}")
        
        return {
            "success": True,
            "message": f"Inventário avançado para o ciclo {result.next_cycle}",
            "data": {
                "inventory_id": inventory_id,
                "next_cycle": result.next_cycle,
                "items_needing_recount": result.items_needing_recount,
                "tolerance_used": request.tolerance_percent
            }
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao avançar ciclo: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao avançar ciclo"))

@router.get("/inventory/{inventory_id}/cycle-status")
async def get_cycle_status(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obter status detalhado dos ciclos do inventário.
    """
    try:
        status_query = text("""
            SELECT * FROM inventario.v_inventory_cycle_status
            WHERE inventory_id = :inventory_id
        """)
        
        status = db.execute(
            status_query,
            {"inventory_id": inventory_id}
        ).fetchone()
        
        if not status:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        return {
            "success": True,
            "data": {
                "inventory_id": str(status.inventory_id),
                "inventory_name": status.inventory_name,
                "current_cycle": status.current_cycle,
                "list_status": status.list_status,
                "counters": {
                    "cycle_1": status.counter_cycle_1_name,
                    "cycle_2": status.counter_cycle_2_name,
                    "cycle_3": status.counter_cycle_3_name
                },
                "items_summary": {
                    "total": status.total_items,
                    "cycle_1": status.items_cycle_1,
                    "cycle_2": status.items_cycle_2,
                    "cycle_3": status.items_cycle_3
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar status: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar status"))

@router.put("/inventory/{inventory_id}/release-for-counting")
async def release_for_counting(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Liberar lista para contagem (ABERTA -> EM_CONTAGEM).
    """
    try:
        # Verificar permissão
        if current_user.role not in ['ADMIN', 'SUPERVISOR']:
            raise HTTPException(
                status_code=403,
                detail="Apenas administradores e supervisores podem liberar listas"
            )
        
        # Atualizar status (o trigger garantirá a cópia do contador se necessário)
        update_query = text("""
            UPDATE inventario.inventory_lists
            SET list_status = 'EM_CONTAGEM'
            WHERE id = :inventory_id
                AND list_status = 'ABERTA'
            RETURNING current_cycle
        """)
        
        result = db.execute(
            update_query,
            {"inventory_id": inventory_id}
        ).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=400,
                detail="Lista não está no status ABERTA ou não foi encontrada"
            )
        
        db.commit()
        
        logger.info(f"✅ Lista liberada para contagem no ciclo {result.current_cycle}")
        
        return {
            "success": True,
            "message": f"Lista liberada para contagem no ciclo {result.current_cycle}",
            "data": {
                "inventory_id": inventory_id,
                "current_cycle": result.current_cycle,
                "new_status": "EM_CONTAGEM"
            }
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao liberar lista: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao liberar lista"))