"""
Endpoints para salvar rascunhos de contagem de lotes
Permite persistir dados mesmo com limpeza do navegador
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, List
from datetime import datetime
import json
import uuid
import logging
from app.core.exceptions import safe_error_response

from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/inventory/{inventory_id}/items/{item_id}/lot-draft")
async def save_lot_draft(
    inventory_id: str,
    item_id: str,
    draft_data: Dict,
    db: Session = Depends(get_db)
):
    """
    Salva rascunho de contagem de lotes com controle de ciclo
    """
    try:
        # Por enquanto usar um user_id fixo (pode ser obtido do token depois)
        user_id = "a943a88f-8bcc-4f9b-8aa0-21435410ad5a"  # Admin user ID

        # Extrair current_cycle do draft_data ou buscar do inventário
        current_cycle = draft_data.get('current_cycle', 1)

        # Se não veio no draft_data, buscar do inventário
        if 'current_cycle' not in draft_data:
            cycle_query = text("""
                SELECT current_cycle FROM inventario.inventory_lists
                WHERE id = :inventory_id
            """)
            cycle_result = db.execute(cycle_query, {"inventory_id": inventory_id}).fetchone()
            current_cycle = cycle_result[0] if cycle_result else 1

        logger.info(f"Salvando rascunho - Item: {item_id}, Ciclo: {current_cycle}")

        # Verificar se já existe um rascunho para este ciclo
        check_query = text("""
            SELECT id FROM inventario.lot_counting_drafts
            WHERE inventory_item_id = :item_id
            AND counted_by = :user_id
            AND current_cycle = :current_cycle
            LIMIT 1
        """)

        existing = db.execute(check_query, {
            "item_id": item_id,
            "user_id": user_id,
            "current_cycle": current_cycle
        }).fetchone()

        if existing:
            # Atualizar rascunho existente
            update_query = text("""
                UPDATE inventario.lot_counting_drafts
                SET draft_data = :data,
                    updated_at = :updated_at
                WHERE inventory_item_id = :item_id
                AND counted_by = :user_id
                AND current_cycle = :current_cycle
            """)

            db.execute(update_query, {
                "data": json.dumps(draft_data),
                "updated_at": datetime.utcnow(),
                "item_id": item_id,
                "user_id": user_id,
                "current_cycle": current_cycle
            })
        else:
            # Criar novo rascunho
            insert_query = text("""
                INSERT INTO inventario.lot_counting_drafts
                (id, inventory_item_id, counted_by, draft_data, current_cycle, created_at, updated_at)
                VALUES (:id, :item_id, :user_id, :data, :current_cycle, :created_at, :updated_at)
            """)

            db.execute(insert_query, {
                "id": str(uuid.uuid4()),
                "item_id": item_id,
                "user_id": user_id,
                "data": json.dumps(draft_data),
                "current_cycle": current_cycle,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })

        db.commit()

        return {
            "status": "success",
            "message": f"Rascunho salvo com sucesso (Ciclo {current_cycle})",
            "item_id": item_id,
            "current_cycle": current_cycle
        }

    except Exception as e:
        logger.error(f"Erro ao salvar rascunho de lotes: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao salvar rascunho")
        )

@router.get("/inventory/{inventory_id}/items/{item_id}/lot-draft")
async def get_lot_draft(
    inventory_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Recupera rascunho de contagem de lotes do ciclo atual
    """
    try:
        # Por enquanto usar um user_id fixo
        user_id = "a943a88f-8bcc-4f9b-8aa0-21435410ad5a"

        # 🎯 CORREÇÃO: Buscar ciclo da LISTA ESPECÍFICA (não do inventário pai)
        # Sistema multilista: cada counting_list tem seu próprio ciclo independente
        cycle_query = text("""
            SELECT cl.current_cycle
            FROM inventario.counting_list_items cli
            JOIN inventario.counting_lists cl ON cli.counting_list_id = cl.id
            WHERE cli.inventory_item_id = :item_id
            LIMIT 1
        """)
        cycle_result = db.execute(cycle_query, {"item_id": item_id}).fetchone()
        current_cycle = cycle_result[0] if cycle_result else 1

        logger.info(f"Recuperando rascunho - Item: {item_id}, Ciclo: {current_cycle}")

        # Buscar rascunho do ciclo atual
        query = text("""
            SELECT draft_data, updated_at, current_cycle
            FROM inventario.lot_counting_drafts
            WHERE inventory_item_id = :item_id
            AND counted_by = :user_id
            AND current_cycle = :current_cycle
            LIMIT 1
        """)

        result = db.execute(query, {
            "item_id": item_id,
            "user_id": user_id,
            "current_cycle": current_cycle
        }).fetchone()

        if result:
            # result.draft_data já é um dict se for JSONB, ou string se for TEXT
            draft_data = result.draft_data if isinstance(result.draft_data, dict) else json.loads(result.draft_data)
            return {
                "status": "success",
                "draft_data": draft_data,
                "current_cycle": result.current_cycle,
                "updated_at": result.updated_at.isoformat() if result.updated_at else None
            }
        else:
            logger.info(f"Nenhum rascunho encontrado para item {item_id} no ciclo {current_cycle}")
            return {
                "status": "success",
                "draft_data": None,
                "current_cycle": current_cycle,
                "message": f"Nenhum rascunho encontrado para o ciclo {current_cycle}"
            }

    except Exception as e:
        logger.error(f"Erro ao recuperar rascunho de lotes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao recuperar rascunho")
        )

@router.delete("/inventory/{inventory_id}/items/{item_id}/lot-draft")
async def delete_lot_draft(
    inventory_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove rascunho de contagem de lotes do ciclo atual
    """
    try:
        # Por enquanto usar um user_id fixo
        user_id = "a943a88f-8bcc-4f9b-8aa0-21435410ad5a"

        # Buscar ciclo atual do inventário
        cycle_query = text("""
            SELECT current_cycle FROM inventario.inventory_lists
            WHERE id = :inventory_id
        """)
        cycle_result = db.execute(cycle_query, {"inventory_id": inventory_id}).fetchone()
        current_cycle = cycle_result[0] if cycle_result else 1

        delete_query = text("""
            DELETE FROM inventario.lot_counting_drafts
            WHERE inventory_item_id = :item_id
            AND counted_by = :user_id
            AND current_cycle = :current_cycle
        """)

        result = db.execute(delete_query, {
            "item_id": item_id,
            "user_id": user_id,
            "current_cycle": current_cycle
        })

        db.commit()

        logger.info(f"Rascunho removido - Item: {item_id}, Ciclo: {current_cycle}, Registros: {result.rowcount}")

        return {
            "status": "success",
            "message": f"Rascunho do ciclo {current_cycle} removido ({result.rowcount} registros)",
            "current_cycle": current_cycle
        }

    except Exception as e:
        logger.error(f"Erro ao deletar rascunho de lotes: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao deletar rascunho")
        )

@router.delete("/inventory/{inventory_id}/clear-all-drafts")
async def clear_all_inventory_drafts(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove todos os rascunhos de um inventário (usado ao encerrar ciclo)
    """
    try:
        delete_query = text("""
            DELETE FROM inventario.lot_counting_drafts 
            WHERE inventory_item_id IN (
                SELECT id FROM inventario.inventory_items 
                WHERE inventory_list_id = :inventory_id
            )
        """)
        
        result = db.execute(delete_query, {
            "inventory_id": inventory_id
        })
        
        db.commit()
        
        logger.info(f"Rascunhos limpos para inventário {inventory_id}: {result.rowcount} registros removidos")
        
        return {
            "status": "success",
            "message": f"Todos os rascunhos do inventário foram removidos ({result.rowcount} registros)",
            "inventory_id": inventory_id
        }
        
    except Exception as e:
        logger.error(f"Erro ao limpar rascunhos do inventário {inventory_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao limpar rascunhos do inventário")
        )

@router.get("/inventory/{inventory_id}/items/{item_id}/saved-lots")
async def get_saved_lots(
    inventory_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    🎯 v2.19.18: Busca lotes JÁ SALVOS na tabela countings
    Compatível com MOBILE e DESKTOP (ambos salvam direto em countings)
    """
    try:
        # Buscar ciclo da lista específica (sistema multilista)
        cycle_query = text("""
            SELECT cl.current_cycle
            FROM inventario.counting_list_items cli
            JOIN inventario.counting_lists cl ON cli.counting_list_id = cl.id
            WHERE cli.inventory_item_id = :item_id
            LIMIT 1
        """)
        cycle_result = db.execute(cycle_query, {"item_id": item_id}).fetchone()
        current_cycle = cycle_result[0] if cycle_result else 1

        logger.info(f"🔍 [v2.19.18] Buscando lotes salvos - Item: {item_id}, Ciclo: {current_cycle}")

        # ✅ v2.19.18: Buscar DIRETAMENTE da tabela countings (onde MOBILE e DESKTOP salvam)
        # Cada registro de countings com lot_number representa um lote contado
        lots_query = text("""
            SELECT
                c.lot_number,
                c.quantity,
                c.created_at,
                c.updated_at
            FROM inventario.countings c
            WHERE c.inventory_item_id = :item_id
              AND c.count_number = :cycle
              AND c.lot_number IS NOT NULL
              AND c.lot_number != ''
            ORDER BY c.lot_number
        """)

        lots_result = db.execute(lots_query, {
            "item_id": item_id,
            "cycle": current_cycle
        }).fetchall()

        if lots_result and len(lots_result) > 0:
            lots = [
                {
                    "lot_number": row[0],
                    "counted_qty": float(row[1]) if row[1] else 0,
                    "expiry_date": None  # Não temos essa info na tabela countings
                }
                for row in lots_result
            ]

            # Calcular total
            total_qty = sum(lot["counted_qty"] for lot in lots)

            logger.info(f"✅ [v2.19.18] {len(lots)} lotes salvos encontrados no ciclo {current_cycle}, total: {total_qty}")

            return {
                "status": "success",
                "saved_lots": lots,
                "current_cycle": current_cycle,
                "total_quantity": total_qty,
                "saved_at": lots_result[0][2].isoformat() if lots_result[0][2] else None
            }
        else:
            logger.info(f"ℹ️ [v2.19.18] Nenhum lote salvo encontrado para ciclo {current_cycle}")
            return {
                "status": "success",
                "saved_lots": [],
                "current_cycle": current_cycle,
                "message": f"Nenhum lote salvo no ciclo {current_cycle}"
            }

    except Exception as e:
        logger.error(f"❌ Erro ao buscar lotes salvos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar lotes salvos")
        )