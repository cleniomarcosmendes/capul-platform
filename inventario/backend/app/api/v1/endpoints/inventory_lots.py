"""
📸 v2.10.0: Router Temporário para Endpoint de Snapshot de Lotes

Este arquivo foi criado como SOLUÇÃO TEMPORÁRIA para contornar o bloqueador
Pydantic que impede o registro do inventory_router principal.

PROBLEMA:
- FastAPI/Pydantic v2 valida TODOS os endpoints de um router durante import
- SQLAlchemy internal types (_SessionBind) não são compatíveis com Pydantic
- ~15 endpoints do inventory.py precisariam ser modificados

SOLUÇÃO:
- Router isolado apenas com endpoint crítico de snapshot de lotes
- Permite testar funcionalidade v2.10.0 imediatamente
- Pode ser mesclado de volta ao inventory.py após refatoração completa

DOCUMENTAÇÃO: Ver SESSAO_16_10_2025_BLOQUEADOR_PYDANTIC.md
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_active_user, verify_store_access
from app.models.models import (
    InventoryItem as InventoryItemModel,
    InventoryList as InventoryListModel,
    User as UserModel,
    InventoryItemSnapshot,
    InventoryLotSnapshot
)

# =================================
# CONFIGURAÇÃO DO ROUTER
# =================================

router = APIRouter()

# =================================
# 📸 v2.10.0: ENDPOINT DE SNAPSHOT DE LOTES
# =================================

@router.get("/items/{item_id}/lots-snapshot", response_model=None, summary="Buscar lotes do snapshot")
async def get_item_lots_snapshot(
    item_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Retorna lotes congelados (snapshot) de um item de inventário

    **v2.10.0 - Sistema de Snapshot Imutável**

    Busca lotes da tabela `inventory_lots_snapshot` em vez de SB8010.
    Garante que os dados de lotes permaneçam consistentes ao longo
    de todo o processo de inventário, independente de mudanças no ERP.

    **Parâmetros:**
    - **item_id**: UUID do item de inventário

    **Retorna:**
    - Lista de lotes congelados no momento da inclusão do produto
    - Formato compatível com modal de contagem do frontend

    **Exemplo de resposta:**
    ```json
    {
        "success": true,
        "data": {
            "has_lots": true,
            "lots": [
                {
                    "lot_number": "000000000019208",
                    "warehouse": "02",
                    "system_qty": 10.0,
                    "counted_qty": null,
                    "barcode": "00015210000000000019208"
                }
            ]
        }
    }
    ```
    """

    logger.info(f"📸 Buscando snapshot de lotes para item {item_id}")

    # Buscar item de inventário
    item = db.query(InventoryItemModel).join(InventoryListModel).filter(
        InventoryItemModel.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )

    # Verificar acesso à loja
    await verify_store_access(item.inventory_list.store_id, current_user, db)

    # Buscar snapshot do item para obter warehouse e código do produto
    item_snapshot = db.query(InventoryItemSnapshot).filter(
        InventoryItemSnapshot.inventory_item_id == item_id
    ).first()

    if not item_snapshot:
        logger.warning(f"⚠️ Snapshot não encontrado para item {item_id}")
        return {
            "success": True,
            "message": "Item snapshot not found",
            "data": {
                "has_lots": False,
                "lots": [],
                "reason": "Item was added before snapshot system (v2.10.0)"
            }
        }

    # Verificar se produto tem rastreamento de lote
    if item_snapshot.b1_rastro != 'L':
        logger.info(f"ℹ️ Produto {item_snapshot.b2_cod} não tem rastreamento de lote (b1_rastro={item_snapshot.b1_rastro})")
        return {
            "success": True,
            "message": "Product does not have lot tracking",
            "data": {
                "has_lots": False,
                "lots": [],
                "reason": f"Product tracking type: {item_snapshot.b1_rastro}"
            }
        }

    # Buscar lotes do snapshot
    lot_snapshots = db.query(InventoryLotSnapshot).filter(
        InventoryLotSnapshot.inventory_item_id == item_id
    ).order_by(InventoryLotSnapshot.b8_lotectl).all()

    if not lot_snapshots:
        logger.warning(f"⚠️ Nenhum lote encontrado no snapshot para item {item_id}")
        return {
            "success": True,
            "message": "No lots found in snapshot",
            "data": {
                "has_lots": False,
                "lots": [],
                "reason": "Product has lot tracking but no lots were found at snapshot time"
            }
        }

    # Formatar lotes para o frontend
    lots_data = []
    for lot_snapshot in lot_snapshots:
        lot_info = {
            "lot_number": lot_snapshot.b8_lotectl,
            "b8_lotectl": lot_snapshot.b8_lotectl,  # ✅ v2.17.1: Lote cliente (explícito)
            "b8_lotefor": lot_snapshot.b8_lotefor or "",  # ✅ v2.17.1: Lote fornecedor
            "warehouse": item_snapshot.b2_local,  # Armazém do snapshot
            "system_qty": float(lot_snapshot.b8_saldo),  # Saldo congelado
            "counted_qty": None,  # Será preenchido na contagem
            "barcode": f"{item_snapshot.b2_cod}{lot_snapshot.b8_lotectl}",  # Código + Lote
            "expiry_date": None,  # SB8 não tem data de validade (está em SB8010.b8_dtvalid)
            "snapshot_created_at": lot_snapshot.created_at.isoformat() if lot_snapshot.created_at else None
        }
        lots_data.append(lot_info)

    logger.info(f"✅ {len(lots_data)} lote(s) encontrado(s) no snapshot para item {item_id}")

    return {
        "success": True,
        "message": f"Found {len(lots_data)} lot(s) in snapshot",
        "data": {
            "has_lots": True,
            "lots": lots_data,
            "product_code": item_snapshot.b2_cod,
            "product_description": item_snapshot.b1_desc,
            "warehouse": item_snapshot.b2_local,
            "snapshot_created_at": item_snapshot.created_at.isoformat() if item_snapshot.created_at else None
        }
    }
