"""
API endpoints para gerenciar múltiplas listas de contagem por inventário
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import logging
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    User, InventoryList, InventoryItem, CountingList, CountingListItem,
    CountingStatus, InventoryStatus, CountingListHandoffHistory
)
from app.schemas.counting_list_schemas import (
    CountingListCreate, CountingListResponse, CountingListUpdate,
    CountingListItemCreate, CountingListItemResponse,
    CountingListWithItems, CountingListAssignment
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _check_not_closed(inventory):
    """Bloqueia operações em inventário efetivado (CLOSED)."""
    if inventory and inventory.status in [InventoryStatus.CLOSED, "CLOSED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventário efetivado. Não é possível realizar alterações após a integração com o Protheus."
        )


@router.get("/inventories/{inventory_id}/lists/{list_id}/products")
async def get_list_products(
    inventory_id: str,
    list_id: str,
    context: str = Query("management", description="Context for the request"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Buscar produtos específicos de uma lista de contagem

    Args:
        inventory_id: ID do inventário
        list_id: ID da lista de contagem
        context: Contexto da requisição (management, counting, etc.)

    Returns:
        Lista de produtos com informações de contagem da lista específica
    """
    try:
        # Verificar se inventário existe
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )

        # Verificar se lista de contagem existe
        counting_list = db.query(CountingList).filter(
            and_(
                CountingList.id == list_id,
                CountingList.inventory_id == inventory_id
            )
        ).first()

        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # Buscar produtos da lista específica com joins necessários
        from sqlalchemy.orm import joinedload
        from sqlalchemy import text

        query = db.query(InventoryItem).join(
            CountingListItem,
            CountingListItem.inventory_item_id == InventoryItem.id
        ).filter(
            and_(
                CountingListItem.counting_list_id == list_id,
                InventoryItem.inventory_list_id == inventory_id
            )
        ).options(
            joinedload(InventoryItem.product)
        )

        products = query.all()

        # Buscar descrições dos produtos da tabela sb1010
        product_descriptions = {}
        # Buscar localizações dos produtos da tabela sbz010 (filial+produto+armazem)
        # Chave: (product_code, warehouse) -> {local1, local2, local3}
        product_locations = {}
        if products:
            product_codes = [p.product_code for p in products if p.product_code]
            if product_codes:
                desc_query = text("""
                    SELECT b1_cod, b1_desc
                    FROM inventario.sb1010
                    WHERE b1_cod = ANY(:codes)
                """)
                desc_results = db.execute(desc_query, {"codes": product_codes}).fetchall()
                product_descriptions = {row[0]: row[1] for row in desc_results}

                loc_query = text("""
                    SELECT bz_cod, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3
                    FROM inventario.sbz010
                    WHERE bz_cod = ANY(:codes)
                """)
                loc_results = db.execute(loc_query, {"codes": product_codes}).fetchall()
                for row in loc_results:
                    key = ((row[0] or '').strip(), (row[1] or '').strip())
                    product_locations[key] = {
                        'local1': (row[2] or '').strip(),
                        'local2': (row[3] or '').strip(),
                        'local3': (row[4] or '').strip(),
                    }

        # Construir response similar ao endpoint original
        result_data = {
            "data": {
                "current_cycle": counting_list.current_cycle,
                "list_id": list_id,
                "list_name": counting_list.list_name,
                "products": []
            }
        }

        # ✅ OTIMIZAÇÃO v2.19.14: Buscar todos os list_items em UMA query (evita N+1)
        if products:
            item_ids = [item.id for item in products]
            list_items_query = db.query(CountingListItem).filter(
                and_(
                    CountingListItem.counting_list_id == list_id,
                    CountingListItem.inventory_item_id.in_(item_ids)
                )
            ).all()

            # Criar dicionário para lookup rápido por inventory_item_id
            list_items_dict = {
                li.inventory_item_id: li
                for li in list_items_query
            }
        else:
            list_items_dict = {}

        for item in products:
            # ✅ OTIMIZAÇÃO v2.19.14: Usar dicionário ao invés de query
            list_item = list_items_dict.get(item.id)

            # Obter descrição do produto da sb1010 ou do produto relacionado
            product_desc = ""
            if item.product_code and item.product_code in product_descriptions:
                product_desc = product_descriptions[item.product_code]
            elif item.product and item.product.description:
                product_desc = item.product.description

            # Localizações (sbz010) por código+armazem
            wh = (item.warehouse or "").strip()
            loc_key = ((item.product_code or '').strip(), wh)
            locs = product_locations.get(loc_key, {'local1': '', 'local2': '', 'local3': ''})

            product_data = {
                "id": str(item.id),
                "product_code": item.product_code or (item.product.code if item.product else ""),
                "product_name": product_desc,
                "product_description": product_desc,
                "warehouse": item.warehouse or "01",
                "product_local1": locs['local1'],
                "product_local2": locs['local2'],
                "product_local3": locs['local3'],
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "system_qty": float(item.system_qty) if item.system_qty else 0.0,

                # Informações de contagem da lista
                "count_cycle_1": float(list_item.count_cycle_1) if list_item and list_item.count_cycle_1 else None,
                "count_cycle_2": float(list_item.count_cycle_2) if list_item and list_item.count_cycle_2 else None,
                "count_cycle_3": float(list_item.count_cycle_3) if list_item and list_item.count_cycle_3 else None,

                "needs_count_cycle_1": list_item.needs_count_cycle_1 if list_item else True,
                "needs_count_cycle_2": list_item.needs_count_cycle_2 if list_item else False,
                "needs_count_cycle_3": list_item.needs_count_cycle_3 if list_item else False,

                "status": list_item.status.value if list_item and list_item.status else "PENDING",
                "last_counted_at": list_item.last_counted_at.isoformat() if list_item and list_item.last_counted_at else None,
                "last_counted_by": str(list_item.last_counted_by) if list_item and list_item.last_counted_by else None,
                # Marcação de revisão (devolução do supervisor) — usado pelo frontend pra
                # filtrar apenas itens que devem ser revistos (devolução parcial).
                "revisar_no_ciclo": bool(list_item.revisar_no_ciclo) if list_item else False,
                "motivo_revisao": (list_item.motivo_revisao or None) if list_item else None,

                # Informações do produto
                "sequence": item.sequence or 1,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }

            # ✅ CORREÇÃO v2.19.41: Calcular finalQuantity tratando NULL como 0 quando ciclo encerrado
            cycle = counting_list.current_cycle
            count1 = product_data["count_cycle_1"]
            count2 = product_data["count_cycle_2"]
            count3 = product_data["count_cycle_3"]
            expected = product_data["expected_quantity"]

            # Calcular valores efetivos (NULL = 0 quando ciclo encerrado e havia divergência)
            effective_count2 = count2
            if cycle >= 2 and count2 is None and count1 is not None and abs(count1 - expected) >= 0.01:
                effective_count2 = 0.0

            effective_count3 = count3
            if cycle >= 3 and count3 is None:
                effective_count3 = 0.0

            # Determinar finalQuantity usando valores efetivos
            if cycle == 1:
                product_data["finalQuantity"] = count1
            elif cycle == 2:
                if effective_count2 is not None:
                    product_data["finalQuantity"] = effective_count2
                else:
                    product_data["finalQuantity"] = count1
            elif cycle == 3:
                if effective_count3 is not None:
                    product_data["finalQuantity"] = effective_count3
                elif effective_count2 is not None:
                    product_data["finalQuantity"] = effective_count2
                else:
                    product_data["finalQuantity"] = count1
            else:
                product_data["finalQuantity"] = None

            result_data["data"]["products"].append(product_data)

        # Aplica sort_order definido pelo supervisor no Liberar.
        # Default 'ORIGINAL' = mantém a ordem natural (sequence).
        sort_order = (counting_list.sort_order or 'ORIGINAL').upper()
        if sort_order != 'ORIGINAL':
            field_map = {
                'PRODUCT_CODE':        'product_code',
                'PRODUCT_DESCRIPTION': 'product_description',
                'LOCAL1':              'product_local1',
                'LOCAL2':              'product_local2',
                'LOCAL3':              'product_local3',
            }
            field = field_map.get(sort_order)
            if field:
                # Vazios sempre no fim (independente de asc/desc) — produto sem local não some
                result_data["data"]["products"].sort(
                    key=lambda p: (
                        not (p.get(field) or '').strip(),  # vazios viram True → fim
                        (p.get(field) or '').lower(),
                        p.get('sequence', 0),  # tiebreaker
                    )
                )
        # Expor sort_order na resposta para frontend saber/mostrar
        result_data["data"]["sort_order"] = sort_order
        result_data["data"]["show_previous_counts"] = bool(counting_list.show_previous_counts)

        logger.info(f"✅ Produtos da lista {list_id}: {len(result_data['data']['products'])} produtos (sort={sort_order})")
        return result_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar produtos da lista {list_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno")
        )


@router.post("/inventories/{inventory_id}/counting-lists", response_model=CountingListResponse)
async def create_counting_list(
    inventory_id: UUID,
    list_data: CountingListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Criar uma nova lista de contagem para um inventário
    """
    # Verificar se o inventário existe
    inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventário não encontrado"
        )
    _check_not_closed(inventory)

    # Verificar permissões
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem criar listas de contagem"
        )

    # Criar a nova lista
    new_list = CountingList(
        inventory_id=inventory_id,
        list_name=list_data.list_name,
        description=list_data.description,
        counter_cycle_1=list_data.counter_cycle_1,
        counter_cycle_2=list_data.counter_cycle_2,
        counter_cycle_3=list_data.counter_cycle_3,
        created_by=current_user.id
    )

    db.add(new_list)

    # Atualizar contadores do inventário
    inventory.use_multiple_lists = True
    inventory.total_lists = (inventory.total_lists or 0) + 1

    db.commit()
    db.refresh(new_list)

    logger.info(f"Lista de contagem '{new_list.list_name}' criada para inventário {inventory_id}")
    return new_list


@router.get("/inventories/{inventory_id}/counting-lists")
async def get_inventory_counting_lists(
    inventory_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Listar todas as listas de contagem de um inventário (com contagens de itens)
    """
    # Verificar se o inventário existe
    inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventário não encontrado"
        )

    # Buscar todas as listas do inventário
    lists = db.query(CountingList).filter(
        CountingList.inventory_id == inventory_id
    ).order_by(CountingList.list_name).all()

    result = []
    for cl in lists:
        total_products = db.query(CountingListItem).filter(
            CountingListItem.counting_list_id == cl.id
        ).count()

        current_cycle = cl.current_cycle or 1
        cycle_col = {1: CountingListItem.count_cycle_1, 2: CountingListItem.count_cycle_2, 3: CountingListItem.count_cycle_3}.get(current_cycle)
        counted_items = 0
        if cycle_col is not None:
            counted_items = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == cl.id,
                cycle_col != None  # noqa: E711
            ).count()

        result.append({
            "id": str(cl.id),
            "inventory_id": str(cl.inventory_id),
            "list_name": cl.list_name,
            "description": cl.description or "",
            "list_status": cl.list_status,
            "current_cycle": cl.current_cycle,
            "counter_cycle_1": str(cl.counter_cycle_1) if cl.counter_cycle_1 else None,
            "counter_cycle_2": str(cl.counter_cycle_2) if cl.counter_cycle_2 else None,
            "counter_cycle_3": str(cl.counter_cycle_3) if cl.counter_cycle_3 else None,
            "total_products": total_products,
            "counted_items": counted_items,
            "released_at": cl.released_at.isoformat() if cl.released_at else None,
            "released_by": str(cl.released_by) if cl.released_by else None,
            "closed_at": cl.closed_at.isoformat() if cl.closed_at else None,
            "closed_by": str(cl.closed_by) if cl.closed_by else None,
            "created_at": cl.created_at.isoformat() if cl.created_at else None,
            "created_by": str(cl.created_by) if cl.created_by else None,
            "updated_at": cl.updated_at.isoformat() if cl.updated_at else None,
            "show_previous_counts": bool(cl.show_previous_counts),
        })

    return result


# IMPORTANTE: rota /me deve vir ANTES de /{list_id} — senão FastAPI tenta parsear "me" como UUID.
@router.get("/counting-lists/me")
async def my_counting_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna as listas de contagem onde o usuário atual é o contador atribuído
    para o ciclo atual da lista, status EM_CONTAGEM (prontas pra contar).

    Cada item traz dados da própria LISTA (não do inventário pai), para a tela
    "Minhas Listas" do contador. Informações do inventário vêm como sub-dados
    de contexto (nome, armazém, prazo).
    """
    from sqlalchemy import text
    uid = str(current_user.id)

    query = text("""
        SELECT
            cl.id, cl.list_name, cl.current_cycle, cl.list_status, cl.sort_order,
            cl.show_previous_counts,
            cl.inventory_id,
            il.name as inventory_name,
            il.warehouse,
            il.count_deadline,
            il.reference_date,
            -- Total de itens DA LISTA (não do inventário)
            (SELECT COUNT(*) FROM inventario.counting_list_items cli
             WHERE cli.counting_list_id = cl.id) as total_items,
            -- Contados DA LISTA no ciclo atual (count_cycle_N preenchido)
            (SELECT COUNT(*) FROM inventario.counting_list_items cli
             WHERE cli.counting_list_id = cl.id
               AND CASE cl.current_cycle
                   WHEN 1 THEN cli.count_cycle_1 IS NOT NULL
                   WHEN 2 THEN cli.count_cycle_2 IS NOT NULL
                   WHEN 3 THEN cli.count_cycle_3 IS NOT NULL
                   ELSE FALSE
               END) as counted_items
        FROM inventario.counting_lists cl
        JOIN inventario.inventory_lists il ON il.id = cl.inventory_id
        WHERE cl.list_status = 'EM_CONTAGEM'
          AND il.status = 'IN_PROGRESS'
          AND CASE cl.current_cycle
              WHEN 1 THEN cl.counter_cycle_1::text = :uid
              WHEN 2 THEN cl.counter_cycle_2::text = :uid
              WHEN 3 THEN cl.counter_cycle_3::text = :uid
              ELSE FALSE
          END
        ORDER BY il.created_at, cl.list_name
    """)

    rows = db.execute(query, {"uid": uid}).fetchall()

    items = []
    for row in rows:
        total = int(row.total_items or 0)
        counted = int(row.counted_items or 0)
        items.append({
            "id": str(row.id),
            "list_name": row.list_name,
            "current_cycle": row.current_cycle,
            "list_status": row.list_status,
            "sort_order": row.sort_order or 'ORIGINAL',
            "show_previous_counts": bool(row.show_previous_counts),
            "inventory_id": str(row.inventory_id),
            "inventory_name": row.inventory_name,
            "warehouse": row.warehouse,
            "count_deadline": row.count_deadline.isoformat() if row.count_deadline else None,
            "reference_date": row.reference_date.isoformat() if row.reference_date else None,
            "total_items": total,
            "counted_items": counted,
            "pending_items": max(0, total - counted),
            "progress_percentage": round((counted / total) * 100, 1) if total > 0 else 0.0,
        })

    return {"items": items, "total": len(items)}


@router.get("/counting-lists/{list_id}")  # response_model=CountingListWithItems (temporariamente desabilitado)
async def get_counting_list_details(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obter detalhes de uma lista de contagem específica com seus itens
    """
    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Buscar os itens da lista
    items = db.query(CountingListItem).filter(
        CountingListItem.counting_list_id == list_id
    ).all()

    # Montar resposta
    response = {
        **counting_list.__dict__,
        "items": items,
        "total_items": len(items),
        "counted_items": len([i for i in items if i.status == CountingStatus.COUNTED]),
        "pending_items": len([i for i in items if i.status == CountingStatus.PENDING])
    }

    return response


@router.put("/counting-lists/{list_id}", response_model=CountingListResponse)
async def update_counting_list(
    list_id: UUID,
    update_data: CountingListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualizar uma lista de contagem
    """
    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)

    # Verificar permissões
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem atualizar listas de contagem"
        )

    # Atualizar campos permitidos
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(counting_list, field, value)

    db.commit()
    db.refresh(counting_list)

    logger.info(f"Lista de contagem {list_id} atualizada")
    return counting_list


@router.put("/counting-lists/{list_id}/status")
async def update_counting_list_status(
    list_id: UUID,
    status_update: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualizar o status de uma lista de contagem

    Status válidos:
    - PREPARACAO: Lista não liberada
    - ABERTA: Lista liberada para contagem
    - EM_CONTAGEM: Contagem em andamento
    - ENCERRADA: Lista encerrada
    """
    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)

    # Verificar permissões
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem alterar status da lista"
        )

    # Validar novo status
    new_status = status_update.get("list_status")
    valid_statuses = ["PREPARACAO", "ABERTA", "EM_CONTAGEM", "ENCERRADA"]

    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Status válidos: {', '.join(valid_statuses)}"
        )

    # Atualizar status
    old_status = counting_list.list_status
    counting_list.list_status = new_status

    # Registrar data/usuário de liberação se mudando para ABERTA
    if new_status == "ABERTA" and old_status == "PREPARACAO":
        from datetime import datetime
        counting_list.released_at = datetime.utcnow()
        counting_list.released_by = current_user.id

    # Registrar data/usuário de encerramento se mudando para ENCERRADA
    if new_status == "ENCERRADA" and old_status in ["ABERTA", "EM_CONTAGEM"]:
        from datetime import datetime
        counting_list.closed_at = datetime.utcnow()
        counting_list.closed_by = current_user.id

    db.commit()

    logger.info(f"Status da lista {list_id} atualizado de {old_status} para {new_status}")

    return {
        "success": True,
        "list_id": str(list_id),
        "old_status": old_status,
        "new_status": new_status,
        "message": f"Status atualizado com sucesso"
    }


@router.post("/counting-lists/{list_id}/items", response_model=List[CountingListItemResponse])
async def add_items_to_counting_list(
    list_id: UUID,
    items: List[UUID],  # IDs dos inventory_items a adicionar
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adicionar produtos a uma lista de contagem específica
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem adicionar itens a listas de contagem"
        )

    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)

    # Verificar se a lista já foi liberada
    if counting_list.list_status != 'PREPARACAO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível adicionar itens a uma lista já liberada"
        )

    added_items = []

    for item_id in items:
        # Verificar se o item existe no inventário
        inv_item = db.query(InventoryItem).filter(
            and_(
                InventoryItem.id == item_id,
                InventoryItem.inventory_list_id == counting_list.inventory_id
            )
        ).first()

        if not inv_item:
            logger.warning(f"Item {item_id} não encontrado no inventário")
            continue

        # Verificar se o item já está em alguma lista deste inventário
        existing = db.query(CountingListItem).join(CountingList).filter(
            and_(
                CountingList.inventory_id == counting_list.inventory_id,
                CountingListItem.inventory_item_id == item_id
            )
        ).first()

        if existing:
            logger.warning(f"Item {item_id} já está em outra lista deste inventário")
            continue

        # Criar o item na lista
        new_item = CountingListItem(
            counting_list_id=list_id,
            inventory_item_id=item_id,
            needs_count_cycle_1=True,
            status=CountingStatus.PENDING
        )

        db.add(new_item)
        added_items.append(new_item)

    db.commit()

    logger.info(f"{len(added_items)} itens adicionados à lista {list_id}")
    return added_items


@router.delete("/counting-lists/{list_id}/items/{item_id}")
async def remove_item_from_counting_list(
    list_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remover um item de uma lista de contagem.
    Libera o produto para ser atribuído a outra lista.
    """
    # Verificar permissão (ADMIN ou SUPERVISOR)
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN ou SUPERVISOR podem remover itens de listas"
        )

    # Buscar o item na lista
    list_item = db.query(CountingListItem).filter(
        and_(
            CountingListItem.counting_list_id == list_id,
            CountingListItem.id == item_id
        )
    ).first()

    if not list_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item não encontrado nesta lista"
        )

    # Verificar se a lista já foi liberada
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)
    if counting_list.list_status not in ['PREPARACAO', 'ABERTA']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível remover itens de uma lista com status '{counting_list.list_status}'. Apenas listas em preparação ou abertas permitem remoção."
        )

    # Guardar referência ao inventory_item antes de deletar
    inventory_item_id = list_item.inventory_item_id

    db.delete(list_item)

    # ✅ CORREÇÃO: Liberar o produto para reatribuição
    if inventory_item_id:
        # Verificar se o item NÃO está em nenhuma outra lista
        other_assignment = db.query(CountingListItem).filter(
            and_(
                CountingListItem.inventory_item_id == inventory_item_id,
                CountingListItem.counting_list_id != list_id
            )
        ).first()
        if not other_assignment:
            inv_item = db.query(InventoryItem).filter(InventoryItem.id == inventory_item_id).first()
            if inv_item:
                inv_item.is_available_for_assignment = True
                logger.info(f"✅ Produto {inv_item.product_code} liberado para reatribuição")

    db.commit()

    logger.info(f"Item {item_id} removido da lista {list_id} por {current_user.username}")
    return {"message": "Item removido com sucesso e liberado para reatribuição"}


@router.post("/counting-lists/{list_id}/release")
async def release_counting_list(
    list_id: UUID,
    payload: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Liberar uma lista de contagem para início das contagens.

    Body opcional:
    - show_previous_counts (bool): permite ao contador ver C1/C2 anteriores.
      Default false (contagem cega). Sempre resetado a cada release.
    - sort_order (str): ordem em que os produtos aparecem para o contador.
      Valores: ORIGINAL, PRODUCT_CODE, PRODUCT_DESCRIPTION, LOCAL1, LOCAL2, LOCAL3.
      Default ORIGINAL. Imutável até a próxima liberação (devolver+liberar pra mudar).
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem liberar listas para contagem"
        )

    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory_check = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory_check)

    # Verificar se a lista tem itens
    items_count = db.query(func.count(CountingListItem.id)).filter(
        CountingListItem.counting_list_id == list_id
    ).scalar()

    if items_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lista não pode ser liberada sem itens"
        )

    # Verificar se tem contador atribuído para o ciclo atual
    counter_field = f"counter_cycle_{counting_list.current_cycle}"
    if not getattr(counting_list, counter_field):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lista não tem contador atribuído para o ciclo {counting_list.current_cycle}"
        )

    # Liberar a lista (ABERTA → EM_CONTAGEM)
    counting_list.list_status = 'EM_CONTAGEM'
    counting_list.released_at = func.now()
    counting_list.released_by = current_user.id

    # Visibilidade de C1/C2 — sempre resetada na liberação (default false = cega)
    show_prev = bool((payload or {}).get('show_previous_counts', False))
    counting_list.show_previous_counts = show_prev

    # Ordem dos produtos — definida no Liberar, imutável até próxima liberação
    valid_sort_orders = {'ORIGINAL', 'PRODUCT_CODE', 'PRODUCT_DESCRIPTION', 'LOCAL1', 'LOCAL2', 'LOCAL3'}
    sort_order_in = ((payload or {}).get('sort_order') or 'ORIGINAL').upper()
    if sort_order_in not in valid_sort_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"sort_order inválido. Valores aceitos: {sorted(valid_sort_orders)}"
        )
    counting_list.sort_order = sort_order_in

    # Atualizar status do inventário para IN_PROGRESS se ainda estiver em DRAFT
    inventory = db.query(InventoryList).filter(
        InventoryList.id == counting_list.inventory_id
    ).first()
    if inventory and inventory.status in ('DRAFT', 'draft'):
        inventory.status = 'IN_PROGRESS'
        logger.info(f"Inventário {inventory.id} atualizado para IN_PROGRESS")

    db.commit()

    logger.info(f"Lista {list_id} liberada para contagem (ABERTA → EM_CONTAGEM)")
    return {"message": "Lista liberada com sucesso", "status": "EM_CONTAGEM"}


# finalize-cycle: endpoint removido deste router para evitar conflito.
# A implementacao completa (com recalculate_discrepancies_for_list, validacao de role,
# e audit log) esta em main.py @app.post("/api/v1/counting-lists/{list_id}/finalize-cycle")


def _is_counter_for_current_cycle(cl: CountingList, user_id) -> bool:
    """
    Retorna True se o usuário é o contador do ciclo atual da lista.
    Em UNIFIED_AUTH, user_id vem como string do JWT; counter_cycle_X é UUID.
    Por isso comparamos sempre como string.
    """
    uid = str(user_id) if user_id is not None else None
    if cl.current_cycle == 1:
        return cl.counter_cycle_1 is not None and str(cl.counter_cycle_1) == uid
    if cl.current_cycle == 2:
        return cl.counter_cycle_2 is not None and str(cl.counter_cycle_2) == uid
    if cl.current_cycle == 3:
        return cl.counter_cycle_3 is not None and str(cl.counter_cycle_3) == uid
    return False


def _count_cycle_field(cycle: int) -> str:
    return f"count_cycle_{cycle}"


@router.post("/counting-lists/{list_id}/handoff")
async def handoff_counting_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Contador entrega a lista para revisão do supervisor.

    Regras:
    - Lista deve estar EM_CONTAGEM
    - Usuário deve ser o contador do ciclo atual (ou ADMIN/SUPERVISOR)
    - Itens não contados no ciclo atual são gravados como ZERO
    - list_status → AGUARDANDO_REVISAO
    - Registra evento ENTREGUE no histórico
    """
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

    inventory_check = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory_check)

    if counting_list.list_status != 'EM_CONTAGEM':
        raise HTTPException(
            status_code=400,
            detail=f"Lista deve estar em EM_CONTAGEM para ser entregue (atual: {counting_list.list_status})"
        )

    is_staff = current_user.role in ("ADMIN", "SUPERVISOR")
    if not is_staff and not _is_counter_for_current_cycle(counting_list, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Apenas o contador do ciclo atual (ou ADMIN/SUPERVISOR) pode entregar a lista"
        )

    cycle = counting_list.current_cycle or 1
    field = _count_cycle_field(cycle)

    # Itens não contados no ciclo atual viram zero
    items = db.query(CountingListItem).filter(CountingListItem.counting_list_id == list_id).all()
    zerados = 0
    for it in items:
        # No ciclo 2/3, considera apenas itens que precisavam ser contados nesse ciclo
        needs_field = f"needs_count_cycle_{cycle}"
        precisa = getattr(it, needs_field, True if cycle == 1 else False)
        if not precisa:
            continue
        if getattr(it, field) is None:
            setattr(it, field, 0)
            it.last_counted_at = func.now()
            it.last_counted_by = current_user.id
            it.status = CountingStatus.COUNTED
            zerados += 1

    counting_list.list_status = 'AGUARDANDO_REVISAO'
    counting_list.entregue_em = func.now()
    counting_list.entregue_por_id = current_user.id

    db.add(CountingListHandoffHistory(
        list_id=list_id,
        evento='ENTREGUE',
        ator_id=current_user.id,
        ciclo=cycle,
        observacao=f"{zerados} item(ns) não contado(s) gravado(s) como zero" if zerados > 0 else None,
    ))

    db.commit()

    logger.info(f"Lista {list_id} entregue para supervisor (EM_CONTAGEM → AGUARDANDO_REVISAO), {zerados} zerados")
    return {
        "message": "Lista entregue para o supervisor.",
        "status": "AGUARDANDO_REVISAO",
        "zerados": zerados,
    }


@router.post("/counting-lists/{list_id}/return")
async def return_counting_list(
    list_id: UUID,
    payload: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Supervisor devolve a lista para o contador (volta a EM_CONTAGEM).

    As contagens existentes são MANTIDAS — o contador faz revisão (confirmar ou editar),
    não recontagem do zero. Itens devolvidos ficam marcados com revisar_no_ciclo=True
    para destaque visual; flag é limpa automaticamente quando uma nova contagem é salva.

    Body (opcional):
    - motivo (str): motivo geral da devolução
    - item_ids (list[UUID]): se fornecido, devolução parcial — só esses itens recebem
      a marcação. Default: marcar todos os itens contados no ciclo atual.
    - sort_order (str): nova ordem dos produtos para o contador. Mesmos valores do release.
      Se omitido, mantém o sort_order anterior. Default: mantém.
    """
    if current_user.role not in ("ADMIN", "SUPERVISOR"):
        raise HTTPException(status_code=403, detail="Apenas ADMIN e SUPERVISOR podem devolver listas")

    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

    inventory_check = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory_check)

    if counting_list.list_status != 'AGUARDANDO_REVISAO':
        raise HTTPException(
            status_code=400,
            detail=f"Apenas listas em AGUARDANDO_REVISAO podem ser devolvidas (atual: {counting_list.list_status})"
        )

    body = payload or {}
    motivo = (body.get('motivo') or '').strip() or None
    item_ids_raw = body.get('item_ids') or []
    item_ids = [str(x) for x in item_ids_raw] if isinstance(item_ids_raw, list) else []

    cycle = counting_list.current_cycle or 1
    count_field = _count_cycle_field(cycle)

    base_q = db.query(CountingListItem).filter(CountingListItem.counting_list_id == list_id)
    if item_ids:
        # Devolução parcial — só os itens selecionados recebem a marcação
        items = base_q.filter(CountingListItem.inventory_item_id.in_(item_ids)).all()
    else:
        # Devolução total — marca todos os itens contados no ciclo atual
        items = [it for it in base_q.all() if getattr(it, count_field) is not None]

    marcados = 0
    for it in items:
        it.revisar_no_ciclo = True
        it.motivo_revisao = motivo
        marcados += 1

    counting_list.list_status = 'EM_CONTAGEM'
    counting_list.devolvido_em = func.now()
    counting_list.devolvido_por_id = current_user.id
    counting_list.motivo_devolucao = motivo

    # Permite supervisor mudar ordenação ao re-liberar (ex.: C1 era LOCAL1 walk-through;
    # na re-liberação prefere PRODUCT_CODE pra revisar pendentes em ordem natural)
    sort_order_in = (body.get('sort_order') or '').upper()
    if sort_order_in:
        valid_sort_orders = {'ORIGINAL', 'PRODUCT_CODE', 'PRODUCT_DESCRIPTION', 'LOCAL1', 'LOCAL2', 'LOCAL3'}
        if sort_order_in not in valid_sort_orders:
            raise HTTPException(
                status_code=400,
                detail=f"sort_order inválido. Valores aceitos: {sorted(valid_sort_orders)}"
            )
        counting_list.sort_order = sort_order_in

    db.add(CountingListHandoffHistory(
        list_id=list_id,
        evento='DEVOLVIDA',
        ator_id=current_user.id,
        ciclo=cycle,
        observacao=motivo,
        itens_devolvidos=item_ids if item_ids else None,
    ))

    db.commit()

    logger.info(f"Lista {list_id} devolvida ({marcados} itens marcados para revisão, parcial={bool(item_ids)})")
    return {
        "message": "Lista devolvida ao contador para revisão.",
        "status": "EM_CONTAGEM",
        "itens_marcados": marcados,
        "parcial": bool(item_ids),
    }


@router.get("/counting-lists/aguardando-revisao/count")
async def aguardando_revisao_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Conta listas em AGUARDANDO_REVISAO da loja do usuário (para badge no sidebar).
    Retorna 0 para OPERATOR (ele não decide).
    """
    if current_user.role not in ("ADMIN", "SUPERVISOR"):
        return {"count": 0}
    n = (
        db.query(func.count(CountingList.id))
        .join(InventoryList, InventoryList.id == CountingList.inventory_id)
        .filter(
            CountingList.list_status == 'AGUARDANDO_REVISAO',
            InventoryList.store_id == current_user.store_id,
        )
        .scalar()
    )
    return {"count": int(n or 0)}


@router.get("/counting-lists/{list_id}/handoff-history")
async def get_handoff_history(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Histórico de handoffs (entrega/devolução/finalização) da lista."""
    rows = (
        db.query(CountingListHandoffHistory, User)
        .join(User, CountingListHandoffHistory.ator_id == User.id)
        .filter(CountingListHandoffHistory.list_id == list_id)
        .order_by(CountingListHandoffHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(h.id),
            "evento": h.evento,
            "ciclo": h.ciclo,
            "ator_id": str(h.ator_id),
            "ator_nome": u.full_name or u.username,
            "observacao": h.observacao,
            "itens_devolvidos": h.itens_devolvidos,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h, u in rows
    ]


@router.post("/counting-lists/{list_id}/finalizar")
async def force_finalize_counting_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalizar lista imediatamente independente do ciclo ou status

    Funcionalidade: "Botão Finalizar Lista"
    - Encerra a lista a qualquer momento
    - Não precisa passar por todo o processo de ciclos
    - Status = 'ENCERRADA' imediatamente
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem encerrar listas"
        )

    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)

    # Finalizar imediatamente independente do status atual
    old_status = counting_list.list_status
    old_cycle = counting_list.current_cycle

    counting_list.list_status = 'ENCERRADA'
    counting_list.closed_at = func.now()
    counting_list.closed_by = current_user.id

    db.commit()

    logger.info(f"Lista {list_id} FINALIZADA FORÇADAMENTE: {old_status} (Ciclo {old_cycle}) → ENCERRADA")
    return {
        "message": f"Lista finalizada com sucesso (Ciclo {old_cycle} → ENCERRADA)",
        "status": "ENCERRADA",
        "previous_status": old_status,
        "previous_cycle": old_cycle
    }


@router.get("/counting-lists/{list_id}/items")
async def get_counting_list_items(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obter TODOS os itens de uma lista de contagem específica (para Modal Gerenciar Lista)
    Diferente do /my-items, este endpoint não filtra por contador - mostra todos os produtos da lista
    """
    try:
        # Verificar se a estrutura de múltiplas listas está sendo usada
        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()

        if counting_list:
            # 🆕 NOVA ESTRUTURA: Buscar itens da counting_list específica
            items_query = db.query(CountingListItem).join(InventoryItem).filter(
                CountingListItem.counting_list_id == list_id
            )

            counting_items = items_query.all()

            # Buscar descrições dos produtos da tabela sb1010
            product_descriptions = {}
            if counting_items:
                product_codes = [item.inventory_item.product_code for item in counting_items if item.inventory_item.product_code]
                if product_codes:
                    from sqlalchemy import text
                    desc_query = text("""
                        SELECT b1_cod, b1_desc
                        FROM inventario.sb1010
                        WHERE b1_cod = ANY(:codes)
                    """)
                    desc_results = db.execute(desc_query, {"codes": product_codes}).fetchall()
                    product_descriptions = {row[0]: row[1] for row in desc_results}
                    logger.info(f"🔍 [DESCRIÇÕES] Encontradas {len(product_descriptions)} descrições: {product_descriptions}")

            # Montar resposta usando estrutura similar ao endpoint atual
            products = []
            for counting_item in counting_items:
                inventory_item = counting_item.inventory_item

                # Obter descrição real do produto
                product_desc = product_descriptions.get(inventory_item.product_code, f"Produto {inventory_item.product_code}")

                product_data = {
                    "id": str(inventory_item.id),
                    "product_code": inventory_item.product_code,
                    "product_description": product_desc,
                    "expected_quantity": float(inventory_item.expected_quantity or 0),
                    "system_qty": float(inventory_item.expected_quantity or 0),
                    "counted_qty": None,  # Será preenchido com base no ciclo
                    "status": counting_item.status.value if counting_item.status else "pending",

                    # Campos de contagem por ciclo
                    "count_cycle_1": float(counting_item.count_cycle_1) if counting_item.count_cycle_1 else None,
                    "count_cycle_2": float(counting_item.count_cycle_2) if counting_item.count_cycle_2 else None,
                    "count_cycle_3": float(counting_item.count_cycle_3) if counting_item.count_cycle_3 else None,

                    # Controle de ciclos
                    "needs_recount_cycle_1": counting_item.needs_count_cycle_1,
                    "needs_recount_cycle_2": counting_item.needs_count_cycle_2,
                    "needs_recount_cycle_3": counting_item.needs_count_cycle_3,

                    # Metadados
                    "last_counted_at": counting_item.last_counted_at.isoformat() if counting_item.last_counted_at else None,
                    "last_counted_by": str(counting_item.last_counted_by) if counting_item.last_counted_by else None
                }
                products.append(product_data)

            return {
                "success": True,
                "data": {
                    "items": products,
                    "total_items": len(products),
                    "list_info": {
                        "list_id": str(counting_list.id),
                        "list_name": counting_list.list_name,
                        "current_cycle": counting_list.current_cycle,
                        "list_status": counting_list.list_status
                    }
                }
            }
        else:
            # 🔄 FALLBACK: Se não é múltiplas listas, buscar pelo inventário (compatibilidade)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada. Use o endpoint de inventário."
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar itens da lista de contagem: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno")
        )


@router.get("/counting-lists/{list_id}/my-items")
async def get_my_counting_items(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obter itens que o usuário atual deve contar nesta lista
    """
    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Verificar se o usuário é o contador do ciclo atual
    counter_field = f"counter_cycle_{counting_list.current_cycle}"
    assigned_counter = getattr(counting_list, counter_field)

    if assigned_counter != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Você não é o contador designado para o ciclo {counting_list.current_cycle} desta lista"
        )

    # Buscar itens que precisam ser contados neste ciclo
    needs_field = f"needs_count_cycle_{counting_list.current_cycle}"
    count_field = f"count_cycle_{counting_list.current_cycle}"

    items = db.query(CountingListItem).join(InventoryItem).filter(
        and_(
            CountingListItem.counting_list_id == list_id,
            getattr(CountingListItem, needs_field) == True
        )
    ).all()

    # Separar em pendentes e contados
    pending = []
    counted = []

    for item in items:
        item_data = {
            "id": item.id,
            "product_code": item.inventory_item.product_code,
            "expected_quantity": item.inventory_item.expected_quantity,
            "current_count": getattr(item, count_field),
            "status": "COUNTED" if getattr(item, count_field) is not None else "PENDING"
        }

        if item_data["status"] == "PENDING":
            pending.append(item_data)
        else:
            counted.append(item_data)

    return {
        "list_id": list_id,
        "list_name": counting_list.list_name,
        "current_cycle": counting_list.current_cycle,
        "total_items": len(items),
        "pending_items": pending,
        "counted_items": counted
    }


@router.delete("/counting-lists/{list_id}")
async def delete_counting_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Excluir uma lista de contagem (apenas se estiver em preparação ou aberta).
    Libera todos os produtos para reatribuição.
    """
    # Buscar a lista
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de contagem não encontrada"
        )

    # Bloquear inventário efetivado
    inventory = db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    _check_not_closed(inventory)

    # Verificar permissões (ADMIN ou SUPERVISOR)
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN ou SUPERVISOR podem excluir listas de contagem"
        )

    # Verificar se a lista pode ser excluída (PREPARACAO ou ABERTA)
    if counting_list.list_status not in ['PREPARACAO', 'ABERTA']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Apenas listas em preparação ou abertas podem ser excluídas. Status atual: '{counting_list.list_status}'"
        )

    # ✅ CORREÇÃO: Liberar produtos antes do CASCADE delete
    list_items = db.query(CountingListItem).filter(
        CountingListItem.counting_list_id == list_id
    ).all()

    freed_count = 0
    for li in list_items:
        if li.inventory_item_id:
            # Verificar se o item NÃO está em nenhuma outra lista
            other_assignment = db.query(CountingListItem).filter(
                and_(
                    CountingListItem.inventory_item_id == li.inventory_item_id,
                    CountingListItem.counting_list_id != list_id
                )
            ).first()
            if not other_assignment:
                inv_item = db.query(InventoryItem).filter(InventoryItem.id == li.inventory_item_id).first()
                if inv_item:
                    inv_item.is_available_for_assignment = True
                    freed_count += 1

    logger.info(f"✅ {freed_count} produtos liberados para reatribuição ao excluir lista {list_id}")

    # Atualizar contador do inventário
    inventory = db.query(InventoryList).filter(
        InventoryList.id == counting_list.inventory_id
    ).first()
    if inventory:
        inventory.total_lists = max(0, (inventory.total_lists or 1) - 1)
        if inventory.total_lists == 0:
            inventory.use_multiple_lists = False

    # Excluir a lista (cascade deletará os CountingListItems)
    db.delete(counting_list)
    db.commit()

    logger.info(f"Lista de contagem {list_id} excluída por {current_user.username}")
    return {"message": f"Lista excluída com sucesso. {freed_count} produtos liberados para reatribuição."}


# ========== NOVOS ENDPOINTS PARA STATUS INDIVIDUAL ==========

from pydantic import BaseModel

class StatusUpdate(BaseModel):
    new_status: str

@router.post("/{list_id}/update-status")
async def update_individual_list_status(
    list_id: str,
    status_update: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza o status individual de uma lista de contagem específica

    Status permitidos:
    - ABERTA: Lista pode ser modificada/reatribuída
    - EM_CONTAGEM: Lista liberada para contagem
    - ENCERRADA: Contagem finalizada
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem atualizar status de listas"
        )

    from app.models.models import CountingAssignment as CountingAssignmentModel

    # Validar status
    valid_statuses = ['ABERTA', 'EM_CONTAGEM', 'ENCERRADA']
    new_status = status_update.new_status
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Use: {', '.join(valid_statuses)}"
        )

    # list_id tem formato "user_{user_id}"
    if not list_id.startswith("user_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de lista inválido"
        )

    try:
        user_id = UUID(list_id.replace("user_", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de usuário inválido"
        )

    # Atualizar todas as atribuições do usuário com o novo status
    updated = db.query(CountingAssignmentModel).filter(
        CountingAssignmentModel.assigned_to == user_id
    ).update(
        {"list_status": new_status},
        synchronize_session=False
    )

    db.commit()

    logger.info(f"Status da lista {list_id} atualizado para {new_status} por {current_user.username}")

    return {
        "success": True,
        "message": f"Status atualizado para {new_status}",
        "list_id": list_id,
        "new_status": new_status,
        "updated_assignments": updated
    }


@router.get("/{list_id}/status")
async def get_individual_list_status(
    list_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtém o status atual de uma lista específica
    """
    from app.models.models import CountingAssignment as CountingAssignmentModel

    # list_id tem formato "user_{user_id}"
    if not list_id.startswith("user_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de lista inválido"
        )

    try:
        user_id = UUID(list_id.replace("user_", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de usuário inválido"
        )

    # Buscar status mais recente das atribuições do usuário
    assignment = db.query(CountingAssignmentModel).filter(
        CountingAssignmentModel.assigned_to == user_id
    ).first()

    if not assignment:
        return {
            "list_id": list_id,
            "status": "ABERTA",  # Default
            "message": "Nenhuma atribuição encontrada"
        }

    return {
        "list_id": list_id,
        "status": assignment.list_status or "ABERTA",
        "user_id": str(user_id)
    }