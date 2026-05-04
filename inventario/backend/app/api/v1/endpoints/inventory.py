"""
Rotas de Inventário
Sistema multi-loja para inventário físico integrado ao ERP Protheus
"""

# ✅ CORREÇÃO DEFINITIVA: Não usar __future__.annotations com FastAPI
# FastAPI precisa avaliar annotations em runtime, não como strings
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging
from app.core.exceptions import safe_error_response

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    get_current_active_user,
    verify_store_access,
    require_permission
)

# ✅ SEGURANÇA v2.19.13: Proteção de endpoints de teste
def require_test_endpoints():
    """Dependency que bloqueia endpoints de teste se desabilitados"""
    if not settings.ENABLE_TEST_ENDPOINTS:
        raise HTTPException(status_code=404, detail="Endpoint não disponível")
from app.schemas.schemas import (
    Counting,
    CountingCreate,
    CountingUpdate,
    PaginatedResponse,
    APIResponse,
    InventoryStatus,
    CountingStatus
)
from app.schemas.inventory_schemas import (
    InventoryListResponse as InventoryList,
    InventoryListCreate,
    InventoryListUpdate,
    InventoryItemCreate,
    InventoryItemResponse as InventoryItem
)
from app.models.models import (
    InventoryList as InventoryListModel,
    InventoryItem as InventoryItemModel,
    Counting as CountingModel,
    Product as ProductModel,
    User as UserModel,
    Store as StoreModel,
    CountingAssignment,
    Discrepancy as DiscrepancyModel,
    UserStore  # ✅ v2.15.4: Adicionado para sistema multi-filial
)
from app.services.snapshot_service import SnapshotService  # v2.10.0 - Sistema de snapshot

# =================================
# CONFIGURAÇÃO DO ROUTER
# =================================

router = APIRouter()

# =================================
# ENDPOINTS DE LISTAS DE INVENTÁRIO
# =================================

@router.get("/lists", response_model=None, summary="Listar inventários")  # ✅ CORREÇÃO v2: response_model=None para desabilitar validação
async def list_inventory_lists(
    store_id: Optional[str] = Query(None, description="ID da loja"),
    status: Optional[InventoryStatus] = Query(None, description="Status do inventário"),
    date_from: Optional[datetime] = Query(None, description="Data inicial"),
    date_to: Optional[datetime] = Query(None, description="Data final"),
    page: int = Query(1, ge=1, description="Página"),
    size: int = Query(20, ge=1, le=100, description="Itens por página"),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> dict:  # ✅ CORREÇÃO: Retornar dict genérico
    """
    Lista inventários com filtros e paginação
    
    **Filtros disponíveis:**
    - **store_id**: Filtra por loja específica
    - **status**: Filtra por status (DRAFT, IN_PROGRESS, COMPLETED, CLOSED)
    - **date_from/date_to**: Período de criação
    
    **Retorna:**
    - Lista paginada de inventários com estatísticas
    """
    
    # ✅ v2.19.52: Log de debug dos filtros recebidos
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"📋 [FILTROS] Recebidos: status={status}, date_from={date_from}, date_to={date_to}, store_id={store_id}")

    # Query base
    query = db.query(InventoryListModel)

    # Filtro por loja (admins veem todas, outros apenas sua loja)
    if current_user.role != "ADMIN":
        query = query.filter(InventoryListModel.store_id == current_user.store_id)
    elif store_id:
        query = query.filter(InventoryListModel.store_id == store_id)

    # Filtro por status
    if status:
        query = query.filter(InventoryListModel.status == status)

    # Filtro por período
    if date_from:
        logger.info(f"📅 [FILTRO] Aplicando date_from >= {date_from}")
        query = query.filter(InventoryListModel.created_at >= date_from)
    if date_to:
        logger.info(f"📅 [FILTRO] Aplicando date_to <= {date_to}")
        query = query.filter(InventoryListModel.created_at <= date_to)
    
    # Ordenação (mais recentes primeiro)
    query = query.order_by(InventoryListModel.created_at.desc())
    
    # Contar total
    total = query.count()

    # Aplicar paginação
    offset = (page - 1) * size
    inventories = query.offset(offset).limit(size).all()

    # ✅ OTIMIZAÇÃO v2.19.13: Buscar estatísticas em UMA query (evita N+1)
    if inventories:
        inventory_ids = [inv.id for inv in inventories]

        # Subquery para estatísticas de todos os inventários de uma vez
        stats_query = db.query(
            InventoryItemModel.inventory_list_id,
            func.count(InventoryItemModel.id).label('total_items'),
            func.sum(
                func.case(
                    (InventoryItemModel.status == CountingStatus.COUNTED, 1),
                    else_=0
                )
            ).label('counted_items')
        ).filter(
            InventoryItemModel.inventory_list_id.in_(inventory_ids)
        ).group_by(
            InventoryItemModel.inventory_list_id
        ).all()

        # Criar dicionário para lookup rápido
        stats_dict = {
            str(stat.inventory_list_id): {
                'total_items': stat.total_items or 0,
                'counted_items': stat.counted_items or 0
            }
            for stat in stats_query
        }

        # Aplicar estatísticas aos inventários
        for inventory in inventories:
            stats = stats_dict.get(str(inventory.id), {'total_items': 0, 'counted_items': 0})
            inventory.total_items = stats['total_items']
            inventory.counted_items = stats['counted_items']
            inventory.progress_percentage = (
                (inventory.counted_items / inventory.total_items * 100)
                if inventory.total_items > 0 else 0
            )

    # Calcular total de páginas
    pages = (total + size - 1) // size

    # Onda 3 — incluir etapa_atual e proximo_passo (properties derivadas) no payload
    from fastapi.encoders import jsonable_encoder
    serialized = jsonable_encoder(inventories)
    for i, inv in enumerate(inventories):
        serialized[i]["etapa_atual"] = inv.etapa_atual
        serialized[i]["proximo_passo"] = inv.proximo_passo
        serialized[i]["analisado_em"] = inv.analisado_em.isoformat() if inv.analisado_em else None

    # ✅ CORREÇÃO: Retornar dict em vez de PaginatedResponse para evitar erro Pydantic
    return {
        "success": True,
        "data": serialized,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.post("/lists", response_model=InventoryList, summary="Criar inventário")
async def create_inventory_list(
    inventory_data: InventoryListCreate,
    current_user: UserModel = Depends(require_permission("create_inventory")),
    db: Session = Depends(get_db)
) -> InventoryList:
    """
    Cria uma nova lista de inventário
    
    **Permissões necessárias:** create_inventory
    
    **Dados obrigatórios:**
    - **name**: Nome da lista
    - **store_id**: ID da loja
    
    **Opcionais:**
    - **description**: Descrição
    - **reference_date**: Data de referência
    - **count_deadline**: Prazo para contagem
    - **product_filters**: Filtros para seleção automática de produtos
    
    **Retorna:**
    - Lista de inventário criada
    """
    
    # Verificar acesso à loja
    if not verify_store_access(current_user, str(inventory_data.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Criar lista de inventário
    import uuid
    
    inventory = InventoryListModel(
        id=str(uuid.uuid4()),
        name=inventory_data.name,
        description=inventory_data.description,
        warehouse=inventory_data.warehouse,  # Adicionar campo warehouse
        reference_date=inventory_data.reference_date or datetime.utcnow(),
        count_deadline=inventory_data.count_deadline,
        status=inventory_data.status,
        store_id=inventory_data.store_id,
        created_by=str(current_user.id),
        created_at=datetime.utcnow()
    )
    
    db.add(inventory)
    db.commit()
    db.refresh(inventory)

    # 🚀 CRIAR LISTAS DE CONTAGEM AUTOMÁTICAS
    # DESABILITADO: Criação automática de listas vazias - usuário deve criar manualmente
    # try:
    #     from app.services.counting_lists_service import create_default_counting_lists
    #     await create_default_counting_lists(db, inventory.id, str(current_user.id), str(inventory.store_id))
    #     logger.info(f"✅ Listas automáticas criadas para inventário {inventory.id}")
    # except Exception as e:
    #     logger.error(f"⚠️ Erro ao criar listas automáticas (não crítico): {e}")
    #     import traceback
    #     logger.error(f"⚠️ Stacktrace: {traceback.format_exc()}")
    #     # Não falha a criação do inventário se houver erro nas listas

    # Se há filtros de produtos, adicionar produtos automaticamente
    if inventory_data.product_filters:
        await add_products_to_inventory(inventory.id, inventory_data.product_filters, db)

    return inventory


@router.get("/test-warehouse/{inventory_id}", dependencies=[Depends(require_test_endpoints)])
async def test_warehouse(inventory_id: str, db: Session = Depends(get_db)):
    """Teste simples para warehouse (protegido)"""
    inventory = db.query(InventoryListModel).filter(InventoryListModel.id == inventory_id).first()
    if not inventory:
        return {"error": "Not found"}
    return {"warehouse": inventory.warehouse, "name": inventory.name}

@router.get("/lists/{inventory_id}", summary="Obter inventário")
async def get_inventory_list(
    inventory_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtém dados detalhados de um inventário específico
    
    **Retorna:**
    - Dados completos do inventário com estatísticas
    """
    
    # ✅ CORREÇÃO: Usar query SQL direta para garantir que list_status e current_cycle sejam retornados
    from sqlalchemy import text
    
    print(f"🔍 [DEBUG BACKEND] Buscando inventário {inventory_id}")
    
    inventory_raw = db.execute(
        text("""
            SELECT id, name, description, warehouse, status, list_status, current_cycle,
                   reference_date, count_deadline, store_id, created_by, created_at, updated_at
            FROM inventario.inventory_lists 
            WHERE id = :inventory_id
        """),
        {"inventory_id": inventory_id}
    ).fetchone()
    
    print(f"🔍 [DEBUG BACKEND] Resultado raw: {inventory_raw}")
    if inventory_raw:
        print(f"🔍 [DEBUG BACKEND] list_status: {inventory_raw.list_status}")
        print(f"🔍 [DEBUG BACKEND] current_cycle: {inventory_raw.current_cycle}")
    else:
        print("🔍 [DEBUG BACKEND] Nenhum resultado encontrado!")
    
    if not inventory_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory list not found"
        )
    
    # Buscar inventário usando ORM para verificação de acesso
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory list not found"
        )
    
    # Verificar acesso à loja
    if not verify_store_access(current_user, str(inventory.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Calcular estatísticas detalhadas
    # Contar total de itens
    total_items = db.query(func.count(InventoryItemModel.id)).filter(
        InventoryItemModel.inventory_list_id == inventory_id
    ).scalar() or 0
    
    # Contar itens com pelo menos uma contagem (qualquer ciclo)
    counted_items = db.query(func.count(InventoryItemModel.id)).filter(
        InventoryItemModel.inventory_list_id == inventory_id,
        or_(
            InventoryItemModel.count_cycle_1.isnot(None),
            InventoryItemModel.count_cycle_2.isnot(None),
            InventoryItemModel.count_cycle_3.isnot(None),
            InventoryItemModel.status.in_(["COUNTED", "ZERO_CONFIRMED", "APPROVED"]),
        )
    ).scalar() or 0
    
    # Buscar dados computados
    created_by_user = db.query(UserModel.full_name).filter(UserModel.id == inventory.created_by).scalar() or "N/A"
    store = db.query(StoreModel.name).filter(StoreModel.id == inventory.store_id).scalar() or "N/A"
    
    # DEBUG: Log do warehouse para verificar
    print(f"🔍 DEBUG WAREHOUSE - id: {inventory.id}")
    print(f"🔍 DEBUG WAREHOUSE - warehouse: '{inventory.warehouse}'")
    print(f"🔍 DEBUG WAREHOUSE - warehouse type: {type(inventory.warehouse)}")
    print(f"🔍 DEBUG WAREHOUSE - hasattr: {hasattr(inventory, 'warehouse')}")
    
    # ✅ DEBUG: Verificar list_status
    print(f"🔍 DEBUG LIST_STATUS - hasattr list_status: {hasattr(inventory, 'list_status')}")
    print(f"🔍 DEBUG LIST_STATUS - valor: {getattr(inventory, 'list_status', 'ATRIBUTO_NAO_EXISTE')}")
    print(f"🔍 DEBUG CURRENT_CYCLE - hasattr current_cycle: {hasattr(inventory, 'current_cycle')}")
    print(f"🔍 DEBUG CURRENT_CYCLE - valor: {getattr(inventory, 'current_cycle', 'ATRIBUTO_NAO_EXISTE')}")
    print(f"🔍 DEBUG INVENTORY - todos os atributos: {dir(inventory)}")
    
    # ✅ CORREÇÃO: Usar dados da query SQL direta para garantir list_status e current_cycle corretos
    response_data = {
        "id": str(inventory_raw.id),
        "name": inventory_raw.name,
        "description": inventory_raw.description or "",
        "warehouse": inventory_raw.warehouse,  # CAMPO CRÍTICO PARA MULTI-ARMAZÉM
        "status": inventory_raw.status if inventory_raw.status else "DRAFT",
        "list_status": inventory_raw.list_status if inventory_raw.list_status else "ABERTA",  # ✅ CORREÇÃO: Valor direto do banco
        "current_cycle": inventory_raw.current_cycle if inventory_raw.current_cycle else 1,  # ✅ CORREÇÃO: Valor direto do banco
        "reference_date": inventory_raw.reference_date,
        "count_deadline": inventory_raw.count_deadline,
        "store_id": str(inventory_raw.store_id),
        "created_by": str(inventory_raw.created_by),
        "created_at": inventory_raw.created_at,
        "updated_at": inventory_raw.updated_at,
        "created_by_name": created_by_user,
        "store_name": store,
        "total_items": total_items,
        "counted_items": counted_items,
        "progress_percentage": round((counted_items / total_items * 100) if total_items > 0 else 0, 2),
        # Onda 3 — etapa derivada e próximo passo recomendado
        "analisado_em": inventory.analisado_em.isoformat() if inventory.analisado_em else None,
        "analisado_por_id": str(inventory.analisado_por_id) if inventory.analisado_por_id else None,
        "etapa_atual": inventory.etapa_atual,
        "proximo_passo": inventory.proximo_passo,
    }

    print(f"🔍 DEBUG RESPONSE - warehouse in response: {response_data.get('warehouse')}")
    print(f"🔍 [DEBUG BACKEND] Response list_status: {response_data.get('list_status')}")
    print(f"🔍 [DEBUG BACKEND] Response current_cycle: {response_data.get('current_cycle')}")
    print(f"🔍 [DEBUG BACKEND] Response completa: {response_data}")
    return response_data


@router.put("/lists/{inventory_id}", response_model=InventoryList, summary="Atualizar inventário")
async def update_inventory_list(
    inventory_id: str,
    inventory_data: InventoryListUpdate,
    current_user: UserModel = Depends(require_permission("update_inventory")),
    db: Session = Depends(get_db)
) -> InventoryList:
    """
    Atualiza dados de um inventário
    
    **Permissões necessárias:** update_inventory
    
    **Campos atualizáveis:**
    - **name**: Nome da lista
    - **description**: Descrição
    - **reference_date**: Data de referência
    - **count_deadline**: Prazo
    - **status**: Status do inventário
    
    **Retorna:**
    - Inventário atualizado
    """
    
    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory list not found"
        )
    
    # Verificar acesso à loja
    if not verify_store_access(current_user, str(inventory.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Validações de status
    if inventory_data.status:
        if inventory.status == InventoryStatus.CLOSED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify closed inventory"
            )
    
    # Atualizar campos fornecidos
    update_data = inventory_data.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(inventory, field, value)
    
    inventory.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(inventory)
    
    return inventory


@router.delete("/lists/{inventory_id}")
async def delete_inventory_list(
    inventory_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Exclui um inventário e todas as suas dependências.
    - Apenas ADMIN ou SUPERVISOR
    - Apenas inventários em DRAFT (Em Preparação)
    - Exclui listas de contagem vinculadas
    - CASCADE limpa snapshots, CountingListItems, contagens, divergências
    """
    # Verificar permissão (ADMIN ou SUPERVISOR)
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN ou SUPERVISOR podem excluir inventários"
        )

    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventário não encontrado"
        )

    # Validar se pode ser excluído (apenas DRAFT)
    from app.models.models import InventoryStatus
    if inventory.status not in [InventoryStatus.DRAFT, "DRAFT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Apenas inventários em preparação (DRAFT) podem ser excluídos. Status atual: '{inventory.status}'"
        )

    try:
        from app.models.models import InventoryItemSnapshot, InventoryLotSnapshot, CountingList, CountingListItem

        # 🔍 Contar dependências para log
        item_snapshots_count = db.query(func.count(InventoryItemSnapshot.id)).join(
            InventoryItemModel,
            InventoryItemSnapshot.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).scalar() or 0

        lot_snapshots_count = db.query(func.count(InventoryLotSnapshot.id)).join(
            InventoryItemModel,
            InventoryLotSnapshot.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).scalar() or 0

        # Excluir listas de contagem vinculadas ao inventário
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()
        lists_deleted = len(counting_lists)
        for cl in counting_lists:
            db.delete(cl)  # CASCADE deleta CountingListItems

        logger.info(f"🗑️ [DELETE] Inventário '{inventory.name}' será excluído por {current_user.username}")
        logger.info(f"🗑️ [DELETE] → {lists_deleted} listas de contagem")
        logger.info(f"🗑️ [DELETE] → {item_snapshots_count} snapshots de itens")
        logger.info(f"🗑️ [DELETE] → {lot_snapshots_count} snapshots de lotes")

        # Excluir itens do inventário
        # CASCADE DELETE irá automaticamente deletar:
        # - inventory_items_snapshot, inventory_lots_snapshot
        # - counting_list_items (FK ondelete=CASCADE)
        # - countings, discrepancies (cascade="all, delete-orphan")
        items_deleted = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).delete(synchronize_session=False)

        logger.info(f"✅ [DELETE] {items_deleted} itens deletados (snapshots via CASCADE)")

        # Excluir o inventário
        db.delete(inventory)
        db.commit()

        return {
            "success": True,
            "message": f"Inventário '{inventory.name}' excluído com sucesso",
            "data": {
                "inventory_id": str(inventory_id),
                "items_deleted": items_deleted,
                "lists_deleted": lists_deleted,
                "item_snapshots_deleted": item_snapshots_count,
                "lot_snapshots_deleted": lot_snapshots_count
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao excluir inventário")
        )


# =================================
# ENDPOINTS DE ITENS DE INVENTÁRIO
# =================================

@router.get("/lists/{inventory_id}/items", response_model=PaginatedResponse, summary="Listar itens do inventário")
async def list_inventory_items(
    inventory_id: str,
    status: Optional[CountingStatus] = Query(None, description="Status da contagem"),
    search: Optional[str] = Query(None, description="Buscar produto"),
    page: int = Query(1, ge=1, description="Página"),
    size: int = Query(50, ge=1, le=200, description="Itens por página"),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> PaginatedResponse:
    """
    Lista itens de um inventário específico
    
    **Filtros:**
    - **status**: Status da contagem
    - **search**: Busca em código/nome do produto
    
    **Retorna:**
    - Lista paginada de itens do inventário
    """
    
    # Verificar se inventário existe e usuário tem acesso
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory list not found"
        )
    
    await verify_store_access(inventory.store_id, current_user, db)
    
    # Query base com join no produto
    query = db.query(InventoryItemModel).join(ProductModel).filter(
        InventoryItemModel.inventory_list_id == inventory_id
    )
    
    # Filtro por status
    if status:
        query = query.filter(InventoryItemModel.status == status)
    
    # Filtro por busca
    if search:
        search_filter = or_(
            ProductModel.code.ilike(f"%{search}%"),
            ProductModel.name.ilike(f"%{search}%"),
            ProductModel.barcode.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    # Ordenação por sequência
    query = query.order_by(InventoryItemModel.sequence)
    
    # Contar total
    total = query.count()

    # Aplicar paginação
    offset = (page - 1) * size
    items = query.offset(offset).limit(size).all()

    # ✅ OTIMIZAÇÃO v2.19.14: Buscar contagens em UMA query (evita N+1)
    if items:
        item_ids = [item.id for item in items]

        # Subquery para buscar soma de contagens de todos os itens de uma vez
        counting_totals = db.query(
            CountingModel.inventory_item_id,
            func.sum(CountingModel.quantity).label('total_counted')
        ).filter(
            CountingModel.inventory_item_id.in_(item_ids)
        ).group_by(
            CountingModel.inventory_item_id
        ).all()

        # Criar dicionário para lookup rápido
        counting_dict = {
            row.inventory_item_id: float(row.total_counted or 0)
            for row in counting_totals
        }

        # Atribuir valores aos itens
        for item in items:
            item.counting_quantity = counting_dict.get(item.id, 0.0)

            # Calcular variação
            if item.expected_quantity is not None:
                item.variance = item.counting_quantity - item.expected_quantity
                item.variance_percentage = (
                    (item.variance / item.expected_quantity * 100)
                    if item.expected_quantity > 0 else 0
                )

    pages = (total + size - 1) // size
    
    return PaginatedResponse(
        success=True,
        data=items,
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("/lists/{inventory_id}/items", response_model=InventoryItem, summary="Adicionar item ao inventário")
async def add_inventory_item(
    inventory_id: str,
    item_data: InventoryItemCreate,
    current_user: UserModel = Depends(require_permission("update_inventory")),
    db: Session = Depends(get_db)
) -> InventoryItem:
    """
    Adiciona um produto à lista de inventário
    
    **Permissões necessárias:** update_inventory
    
    **Dados obrigatórios:**
    - **product_id**: ID do produto
    - **sequence**: Sequência do item
    
    **Retorna:**
    - Item de inventário criado
    """
    
    # Verificar inventário e acesso
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory list not found"
        )
    
    await verify_store_access(inventory.store_id, current_user, db)
    
    # Verificar se inventário não está fechado
    if inventory.status == InventoryStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify closed inventory"
        )

    # Bloquear se houver lista de contagem já liberada/em contagem/encerrada
    from app.models.models import CountingList
    has_active_list = db.query(CountingList).filter(
        CountingList.inventory_id == inventory_id,
        CountingList.list_status.in_(['LIBERADA', 'EM_CONTAGEM', 'ENCERRADA'])
    ).first()
    if has_active_list:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Não é possível adicionar produtos: existe lista de contagem já liberada. "
                "Adicione produtos antes de liberar a primeira lista para contagem."
            )
        )

    # Verificar se produto existe na mesma loja
    product = db.query(ProductModel).filter(
        and_(
            ProductModel.id == item_data.product_id,
            ProductModel.store_id == inventory.store_id
        )
    ).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found in this store"
        )
    
    # Verificar se produto já não está na lista
    existing_item = db.query(InventoryItemModel).filter(
        and_(
            InventoryItemModel.inventory_list_id == inventory_id,
            InventoryItemModel.product_id == item_data.product_id
        )
    ).first()
    
    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product already exists in this inventory"
        )
    
    # Criar item
    import uuid
    
    item = InventoryItemModel(
        id=str(uuid.uuid4()),
        inventory_list_id=inventory_id,
        product_id=item_data.product_id,
        sequence=item_data.sequence,
        expected_quantity=item_data.expected_quantity,
        status=item_data.status,
        created_at=datetime.utcnow()
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)

    # 📸 v2.10.0: CRIAR SNAPSHOT DE DADOS CONGELADOS
    try:
        logger.info(f"📸 Criando snapshot para item {item.id} (produto: {product.code})")

        # Buscar informações da store para obter o filial
        store = db.query(StoreModel).filter(StoreModel.id == inventory.store_id).first()
        filial = store.code if store else '01'  # Fallback para '01' se store não encontrada

        # Criar snapshot do item (SB1+SB2+SBZ)
        item_snapshot = SnapshotService.create_item_snapshot(
            db=db,
            inventory_item_id=item.id,
            product_code=product.code,
            filial=filial,
            warehouse=inventory.warehouse,
            created_by=current_user.id
        )

        if item_snapshot:
            logger.info(f"✅ Snapshot de item criado: {item.id}")

            # Se produto tem rastreamento de lote (b1_rastro='L'), criar snapshots de lotes
            if item_snapshot.b1_rastro == 'L':
                lot_snapshots = SnapshotService.create_lots_snapshots(
                    db=db,
                    inventory_item_id=item.id,
                    product_code=product.code,
                    filial=filial,
                    warehouse=inventory.warehouse,
                    created_by=current_user.id
                )
                logger.info(f"✅ {len(lot_snapshots)} snapshot(s) de lotes criados para item {item.id}")

            db.commit()
        else:
            logger.warning(f"⚠️ Não foi possível criar snapshot para item {item.id} (produto não encontrado em SB2)")

    except Exception as e:
        logger.error(f"❌ Erro ao criar snapshot para item {item.id}: {e}")
        db.rollback()
        # Não falha a criação do item se snapshot falhar (snapshot é opcional)

    # 🔄 AUTO-DISTRIBUIR PRODUTOS SE HOUVER LISTAS DE CONTAGEM
    try:
        from app.models.models import CountingList
        # Verificar se existem listas de contagem para este inventário
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()

        if counting_lists:
            logger.info(f"🔄 Verificando distribuição automática para inventário {inventory_id}")
            from app.services.counting_lists_service import distribute_products_to_counting_lists

            # Tentar distribuir produtos (não forçar, apenas distribuir novos)
            result = await distribute_products_to_counting_lists(
                db=db,
                inventory_id=inventory_id,
                force_redistribution=False
            )

            if result.get("success"):
                logger.info(f"✅ Produtos distribuídos automaticamente após adição")
    except Exception as e:
        logger.warning(f"⚠️ Não foi possível auto-distribuir produtos: {e}")
        # Não falha a adição do item se houver erro na distribuição

    return item

# =================================
# 📸 v2.10.0: ENDPOINTS DE SNAPSHOT
# =================================

@router.get("/items/{item_id}/lots-snapshot", response_model=None, summary="Buscar lotes do snapshot")  # ✅ v2.10.0: response_model=None
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
    if not verify_store_access(current_user, str(item.inventory_list.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )

    # Buscar snapshot do item para obter warehouse e código do produto
    from app.models.models import InventoryItemSnapshot, InventoryLotSnapshot

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
            "b8_lotefor": lot_snapshot.b8_lotefor if hasattr(lot_snapshot, 'b8_lotefor') and lot_snapshot.b8_lotefor else "",  # ✅ v2.17.1: Lote fornecedor
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

# =================================
# ENDPOINTS DE CONTAGEM
# =================================

@router.post("/items/{item_id}/count", response_model=Counting, summary="Registrar contagem")
async def register_counting(
    item_id: str,
    counting_data: CountingCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Counting:
    """
    Registra uma contagem para um item de inventário com sistema inteligente
    
    **Sistema de Contagem:**
    - 1ª contagem: Qualquer usuário atribuído
    - 2ª contagem: SUPERVISOR/ADMIN quando há divergência 
    - 3ª contagem: Apenas ADMIN quando há divergência
    
    **Dados obrigatórios:**
    - **quantity**: Quantidade contada
    
    **Opcionais:**
    - **lot_number**: Número do lote
    - **serial_number**: Número de série
    - **observation**: Observações
    
    **Retorna:**
    - Registro de contagem criado
    """
    
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
    if not verify_store_access(current_user, str(item.inventory_list.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Verificar se inventário está ativo
    if item.inventory_list.status not in [InventoryStatus.DRAFT, InventoryStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot count items in this inventory status"
        )
    
    # Usar o endpoint next-count para validar se pode contar
    from fastapi import Request
    try:
        # Simular chamada interna para validação
        next_count_info = await get_next_count_info(item_id, current_user, db)
        next_count_data = next_count_info.data
        
        if not next_count_data.get("can_count"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=next_count_data.get("reason", "Não autorizado para contar este item")
            )
        
        count_number = next_count_data.get("next_count_number")
        
    except HTTPException:
        raise
    except Exception as e:
        # Fallback para sistema anterior se houver erro
        count_number = db.query(func.count(CountingModel.id)).filter(
            CountingModel.inventory_item_id == item_id
        ).scalar() + 1
    
    # Verificar se é update ou nova contagem
    existing_counting = None
    if count_number == 1:
        # Para 1ª contagem, sempre permitir múltiplas atualizações
        existing_counting = db.query(CountingModel).filter(
            and_(
                CountingModel.inventory_item_id == item_id,
                CountingModel.count_number == 1,
                CountingModel.counted_by == str(current_user.id)
            )
        ).first()
    
    if existing_counting:
        # Atualizar contagem existente
        existing_counting.quantity = counting_data.quantity
        existing_counting.lot_number = counting_data.lot_number
        existing_counting.serial_number = counting_data.serial_number
        existing_counting.observation = counting_data.observation
        existing_counting.updated_at = datetime.utcnow()
        
        counting = existing_counting
    else:
        # Criar nova contagem
        import uuid
        
        counting = CountingModel(
            id=str(uuid.uuid4()),
            inventory_item_id=item_id,
            quantity=counting_data.quantity,
            lot_number=counting_data.lot_number,
            serial_number=counting_data.serial_number,
            observation=counting_data.observation,
            counted_by=str(current_user.id),
            count_number=count_number,
            created_at=datetime.utcnow()
        )
        
        db.add(counting)
    
    # CORREÇÃO: Lógica inteligente baseada em consenso entre contagens
    current_counted_qty = float(counting.quantity)
    expected_qty = float(item.expected_quantity or 0)
    has_divergence = abs(current_counted_qty - expected_qty) > 0.01  # Tolerância de 0.01
    
    # Buscar contagens anteriores para verificar consenso
    previous_countings = db.query(CountingModel).filter(
        CountingModel.inventory_item_id == item_id,
        CountingModel.count_number < count_number
    ).order_by(CountingModel.count_number.desc()).all()
    
    # Determinar status baseado na lógica de consenso
    if not has_divergence:
        # Quantidade igual à esperada = sempre COUNTED
        item.status = CountingStatus.COUNTED
    elif count_number == 1:
        # 1ª contagem com divergência
        item.status = CountingStatus.COUNTED  # Produto contado (com divergência)
    elif count_number >= 2 and previous_countings:
        # 2ª ou 3ª contagem - verificar consenso com contagem anterior
        previous_qty = float(previous_countings[0].quantity)
        
        if abs(current_counted_qty - previous_qty) <= 0.01:
            # CONSENSO: Duas contagens iguais = produto está COUNTED
            item.status = CountingStatus.COUNTED
        else:
            # Contagens diferentes - continuar processo
            if count_number == 2:
                item.status = CountingStatus.FINAL_COUNT  # 2ª contagem diferente da 1ª = aguardar 3ª
            else:
                item.status = CountingStatus.FINAL_COUNT  # 3ª contagem = contagem final
    else:
        # Fallback para lógica anterior
        if count_number == 2:
            item.status = CountingStatus.RECOUNT
        else:
            item.status = CountingStatus.FINAL_COUNT
    
    item.last_counted_at = datetime.utcnow()
    item.last_counted_by = str(current_user.id)
    item.updated_at = datetime.utcnow()
    
    # Se inventário estava em DRAFT, mudar para IN_PROGRESS
    if item.inventory_list.status == InventoryStatus.DRAFT:
        item.inventory_list.status = InventoryStatus.IN_PROGRESS
        item.inventory_list.updated_at = datetime.utcnow()
    
    # Se é 2ª ou 3ª contagem, verificar se resolve divergência
    if count_number > 1:
        # Verificar se quantidade coincide com sistema
        system_quantity = item.expected_quantity or 0
        if counting.quantity == system_quantity:
            # Resolver divergências pendentes
            pending_discrepancies = db.query(DiscrepancyModel).filter(
                and_(
                    DiscrepancyModel.inventory_item_id == item_id,
                    DiscrepancyModel.status == "PENDING"
                )
            ).all()
            
            for discrepancy in pending_discrepancies:
                discrepancy.status = "RESOLVED"
                discrepancy.resolution = f"Resolvido na {count_number}ª contagem"
                discrepancy.resolved_by = str(current_user.id)
                discrepancy.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(counting)
    
    return counting


@router.get("/items/{item_id}/counts", response_model=List[Counting], summary="Listar contagens do item")
async def list_item_countings(
    item_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[Counting]:
    """
    Lista todas as contagens de um item específico
    
    **Retorna:**
    - Lista de contagens ordenada por número da contagem
    """
    
    # Verificar item e acesso
    item = db.query(InventoryItemModel).join(InventoryListModel).filter(
        InventoryItemModel.id == item_id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    await verify_store_access(item.inventory_list.store_id, current_user, db)
    
    # Buscar contagens
    countings = db.query(CountingModel).filter(
        CountingModel.inventory_item_id == item_id
    ).order_by(CountingModel.count_number).all()
    
    return countings

# =================================
# FUNÇÕES AUXILIARES
# =================================

async def add_products_to_inventory(
    inventory_id: str,
    product_filters: dict,
    db: "Session"  # ✅ String para evitar avaliação problemática do Pydantic
) -> int:
    """
    Adiciona produtos automaticamente à lista baseado em filtros
    
    **Filtros suportados:**
    - category: Categoria do produto
    - active_only: Apenas produtos ativos
    - has_stock: Apenas produtos com estoque
    
    **Retorna:**
    - Número de produtos adicionados
    """
    
    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        return 0
    
    # Query base de produtos da loja E do armazém do inventário
    query = db.query(ProductModel).filter(
        ProductModel.store_id == inventory.store_id,
        ProductModel.warehouse == inventory.warehouse  # Filtrar pelo armazém do inventário
    )
    
    # Aplicar filtros
    if product_filters.get("category"):
        query = query.filter(ProductModel.category == product_filters["category"])
    
    if product_filters.get("active_only", True):
        query = query.filter(ProductModel.is_active == True)
    
    if product_filters.get("has_stock", False):
        query = query.filter(ProductModel.current_stock > 0)
    
    # Buscar produtos
    products = query.order_by(ProductModel.code).all()
    
    # Adicionar produtos como itens
    import uuid
    sequence = 1
    added_count = 0
    created_items = []  # ✅ v2.10.0: Lista para armazenar items criados para snapshot

    for product in products:
        # Verificar se produto já não está na lista
        existing = db.query(InventoryItemModel).filter(
            and_(
                InventoryItemModel.inventory_list_id == inventory_id,
                InventoryItemModel.product_id == product.id
            )
        ).first()

        if not existing:
            item = InventoryItemModel(
                id=str(uuid.uuid4()),
                inventory_list_id=inventory_id,
                product_id=product.id,
                sequence=sequence,
                expected_quantity=product.current_stock,
                status=CountingStatus.PENDING,
                created_at=datetime.utcnow()
            )

            db.add(item)
            created_items.append((item.id, product.code))  # ✅ v2.10.0: Armazenar para snapshot
            sequence += 1
            added_count += 1

    db.commit()

    # 📸 v2.10.0: CRIAR SNAPSHOTS PARA TODOS OS PRODUTOS ADICIONADOS
    if created_items:
        try:
            logger.info(f"📸 Criando snapshots para {len(created_items)} produtos adicionados em massa")

            # Buscar informações da store para obter o filial
            store = db.query(StoreModel).filter(StoreModel.id == inventory.store_id).first()
            filial = store.code if store else '01'

            snapshots_created = 0
            lots_created = 0

            for item_id, product_code in created_items:
                try:
                    # Criar snapshot do item (SB1+SB2+SBZ)
                    item_snapshot = SnapshotService.create_item_snapshot(
                        db=db,
                        inventory_item_id=item_id,
                        product_code=product_code,
                        filial=filial,
                        warehouse=inventory.warehouse,
                        created_by=store.id  # Usar store_id como created_by em massa
                    )

                    if item_snapshot:
                        snapshots_created += 1

                        # Se produto tem rastreamento de lote (b1_rastro='L'), criar snapshots de lotes
                        if item_snapshot.b1_rastro == 'L':
                            lot_snapshots = SnapshotService.create_lots_snapshots(
                                db=db,
                                inventory_item_id=item_id,
                                product_code=product_code,
                                filial=filial,
                                warehouse=inventory.warehouse,
                                created_by=store.id  # Usar store_id como created_by em massa
                            )
                            lots_created += len(lot_snapshots)

                except Exception as e:
                    logger.warning(f"⚠️ Erro ao criar snapshot para item {item_id} (produto {product_code}): {e}")
                    # Continua para próximo item mesmo se um falhar

            db.commit()
            logger.info(f"✅ Snapshots criados: {snapshots_created} items, {lots_created} lotes")

        except Exception as e:
            logger.error(f"❌ Erro ao criar snapshots em massa: {e}")
            db.rollback()
            # Não falha a adição em massa se snapshot falhar (snapshot é opcional)

    # 🔄 AUTO-DISTRIBUIR PRODUTOS SE HOUVER LISTAS DE CONTAGEM
    if added_count > 0:
        try:
            from app.models.models import CountingList
            # Verificar se existem listas de contagem para este inventário
            counting_lists = db.query(CountingList).filter(
                CountingList.inventory_id == inventory_id
            ).all()

            if counting_lists:
                logger.info(f"🔄 Distribuindo {added_count} novos produtos entre {len(counting_lists)} listas")
                from app.services.counting_lists_service import distribute_products_to_counting_lists

                # Tentar distribuir produtos (não forçar, apenas distribuir novos)
                result = await distribute_products_to_counting_lists(
                    db=db,
                    inventory_id=inventory_id,
                    force_redistribution=False
                )

                if result.get("success"):
                    logger.info(f"✅ {added_count} produtos distribuídos automaticamente entre as listas")
        except Exception as e:
            logger.warning(f"⚠️ Não foi possível auto-distribuir produtos: {e}")
            # Não falha a adição em massa se houver erro na distribuição

    return added_count


# =================================
# ENDPOINTS DE ATRIBUIÇÃO DE CONTADORES
# =================================

@router.get("/test-assignments", summary="Teste assignments", dependencies=[Depends(require_test_endpoints)])
async def test_assignments_inventory():
    """Teste assignments no inventory (protegido)"""
    from datetime import datetime
    return {"message": "Assignments working in inventory", "timestamp": datetime.utcnow().isoformat()}

@router.get("/{inventory_id}/available-users", response_model=APIResponse, summary="Listar usuários disponíveis para atribuição")
async def get_available_users_for_assignment(
    inventory_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Lista todos os usuários ativos da loja que podem receber atribuições de contagem
    
    **Retorna:**
    - Lista de usuários (OPERATOR e SUPERVISOR) da mesma loja do inventário
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # ✅ v2.15.4: Buscar usuários ativos com acesso à loja (sistema multi-filial)
        # Agora usa tabela user_stores para suportar usuários com múltiplas filiais
        users = db.query(UserModel).join(
            UserStore, UserStore.user_id == UserModel.id
        ).filter(
            and_(
                UserStore.store_id == inventory.store_id,  # ✅ Através de user_stores!
                UserModel.is_active == True,
                UserModel.role.in_(['OPERATOR', 'SUPERVISOR'])
            )
        ).order_by(UserModel.full_name).all()
        
        users_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "email": user.email
            }
            for user in users
        ]
        
        return APIResponse(
            success=True,
            message=f"Found {len(users_data)} available users for assignment",
            data=users_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching available users")
        )


# =================================
# ENDPOINT DE ENCERRAMENTO DE CONTAGEM
# =================================

@router.post("/lists/{inventory_id}/close-counting-round")
async def close_counting_round(
    inventory_id: str,
    count_round: int = Query(..., ge=1, le=3, description="Rodada de contagem (1, 2 ou 3)"),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Encerra uma rodada de contagem e apura divergências
    
    **Parâmetros:**
    - **inventory_id**: ID do inventário
    - **count_round**: Número da rodada (1, 2 ou 3)
    
    **Processo:**
    1. Valida se todos os produtos foram contados
    2. Bloqueia alterações nas contagens desta rodada
    3. Apura divergências entre sistema e contagem
    4. Prepara lista de produtos para próxima rodada
    
    **Retorna:**
    - Resumo do encerramento com divergências apuradas
    """
    
    # Verificar permissões (apenas ADMIN e SUPERVISOR)
    if current_user.role not in ['ADMIN', 'SUPERVISOR']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and supervisors can close counting rounds"
        )
    
    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found"
        )
    
    # Verificar acesso à loja
    if not verify_store_access(current_user, str(inventory.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Verificar status do inventário
    if inventory.status not in [InventoryStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventory must be IN_PROGRESS to close counting rounds"
        )
    
    # Buscar todos os itens do inventário
    items = db.query(InventoryItemModel).filter(
        InventoryItemModel.inventory_list_id == inventory_id
    ).all()
    
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No items found in inventory"
        )
    
    # Verificar contagens e apurar divergências
    total_items = len(items)
    counted_items = 0
    items_with_discrepancy = []
    discrepancy_details = []
    
    for item in items:
        # Buscar contagens desta rodada
        countings = db.query(CountingModel).filter(
            and_(
                CountingModel.inventory_item_id == item.id,
                CountingModel.count_number == count_round
            )
        ).all()
        
        if countings:
            counted_items += 1
            
            # Calcular quantidade contada (última contagem válida)
            last_counting = max(countings, key=lambda c: c.created_at)
            counted_quantity = last_counting.quantity
            
            # Comparar com quantidade do sistema
            system_quantity = item.system_quantity
            
            # Se houver divergência
            if counted_quantity != system_quantity:
                discrepancy = {
                    "item_id": str(item.id),
                    "product_code": item.product.code,
                    "product_name": item.product.name,
                    "system_quantity": system_quantity,
                    "counted_quantity": counted_quantity,
                    "difference": counted_quantity - system_quantity,
                    "percentage": round(((counted_quantity - system_quantity) / system_quantity * 100) if system_quantity > 0 else 0, 2)
                }
                items_with_discrepancy.append(item)
                discrepancy_details.append(discrepancy)
    
    # Validar se todos os itens foram contados
    if counted_items < total_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot close round {count_round}. Only {counted_items} of {total_items} items have been counted."
        )
    
    # Criar registro de encerramento no log
    import uuid
    from app.models.models import SystemLog as SystemLogModel
    
    log_entry = SystemLogModel(
        id=str(uuid.uuid4()),
        level="INFO",
        message=f"Counting round {count_round} closed for inventory {inventory.name}",
        module="inventory",
        function="close_counting_round",
        user_id=str(current_user.id),
        store_id=str(inventory.store_id),
        additional_data={
            "inventory_id": str(inventory_id),
            "count_round": count_round,
            "total_items": total_items,
            "counted_items": counted_items,
            "discrepancies_found": len(items_with_discrepancy),
            "discrepancy_details": discrepancy_details
        },
        created_at=datetime.utcnow()
    )
    
    db.add(log_entry)
    
    # Se for a 3ª contagem e não houver mais divergências, marcar inventário como COMPLETED
    if count_round == 3:
        final_discrepancies = len(items_with_discrepancy)
        if final_discrepancies == 0:
            inventory.status = InventoryStatus.COMPLETED
            inventory.updated_at = datetime.utcnow()
    
    # Commit das alterações
    db.commit()
    
    # Preparar resposta
    response_data = {
        "inventory_id": str(inventory_id),
        "inventory_name": inventory.name,
        "count_round": count_round,
        "status": "CLOSED",
        "summary": {
            "total_items": total_items,
            "counted_items": counted_items,
            "items_with_discrepancy": len(items_with_discrepancy),
            "discrepancy_percentage": round((len(items_with_discrepancy) / total_items * 100) if total_items > 0 else 0, 2)
        },
        "discrepancies": discrepancy_details,
        "next_action": {
            "required": len(items_with_discrepancy) > 0,
            "next_round": count_round + 1 if count_round < 3 else None,
            "message": f"Found {len(items_with_discrepancy)} items with discrepancies that need recount" if len(items_with_discrepancy) > 0 else "No discrepancies found"
        }
    }
    
    return APIResponse(
        success=True,
        message=f"Counting round {count_round} closed successfully",
        data=response_data
    )


# =================================
# ENDPOINT PARA DETERMINAR PRÓXIMA CONTAGEM
# =================================

@router.get("/items/{item_id}/next-count")
async def get_next_count_info(
    item_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Determina qual é a próxima contagem disponível para um item
    
    **Lógica:**
    - 1ª contagem: Sempre disponível para usuários atribuídos
    - 2ª contagem: Disponível para SUPERVISOR/ADMIN quando há divergência na 1ª
    - 3ª contagem: Disponível apenas para ADMIN quando há divergência na 2ª
    
    **Retorna:**
    - next_count_number: Número da próxima contagem (1, 2, 3 ou null)
    - can_count: Se o usuário atual pode fazer a contagem
    - reason: Motivo se não pode contar
    """
    
    # Buscar item
    item = db.query(InventoryItemModel).filter(
        InventoryItemModel.id == item_id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    # Buscar todas as contagens do item
    countings = db.query(CountingModel).filter(
        CountingModel.inventory_item_id == item_id
    ).order_by(CountingModel.count_number.desc()).all()
    
    # Se não há contagens, é a primeira
    if not countings:
        # Verificar se usuário está atribuído
        assignment = db.query(CountingAssignment).filter(
            and_(
                CountingAssignment.inventory_item_id == item_id,
                CountingAssignment.assigned_user_id == current_user.id,
                CountingAssignment.count_number == 1
            )
        ).first()
        
        return APIResponse(
            success=True,
            data={
                "item_id": str(item_id),
                "next_count_number": 1,
                "can_count": assignment is not None,
                "reason": None if assignment else "Usuário não atribuído para este item",
                "current_role": current_user.role
            }
        )
    
    # Pegar a última contagem
    last_count = countings[0]
    last_count_number = last_count.count_number
    
    # Se já foi contado 3 vezes, não há mais contagens
    if last_count_number >= 3:
        return APIResponse(
            success=True,
            data={
                "item_id": str(item_id),
                "next_count_number": None,
                "can_count": False,
                "reason": "Item já foi contado 3 vezes",
                "current_role": current_user.role
            }
        )
    
    # Verificar se há divergência na última contagem
    has_discrepancy = db.query(DiscrepancyModel).filter(
        and_(
            DiscrepancyModel.inventory_item_id == item_id,
            DiscrepancyModel.status == "PENDING"
        )
    ).first() is not None
    
    next_count_number = last_count_number + 1
    
    # Verificar permissões para próxima contagem
    can_count = False
    reason = None
    
    if next_count_number == 2:
        # 2ª contagem: SUPERVISOR ou ADMIN quando há divergência
        if not has_discrepancy:
            reason = "Não há divergência para justificar 2ª contagem"
        elif current_user.role not in ['SUPERVISOR', 'ADMIN']:
            reason = "Apenas SUPERVISOR ou ADMIN podem fazer 2ª contagem"
        else:
            can_count = True
    
    elif next_count_number == 3:
        # 3ª contagem: Apenas ADMIN quando há divergência
        if not has_discrepancy:
            reason = "Não há divergência para justificar 3ª contagem"
        elif current_user.role != 'ADMIN':
            reason = "Apenas ADMIN pode fazer 3ª contagem"
        else:
            can_count = True
    
    return APIResponse(
        success=True,
        data={
            "item_id": str(item_id),
            "next_count_number": next_count_number,
            "can_count": can_count,
            "reason": reason,
            "current_role": current_user.role,
            "has_discrepancy": has_discrepancy,
            "last_count": {
                "count_number": last_count.count_number,
                "quantity": float(last_count.quantity),
                "counted_by": str(last_count.counted_by),
                "counted_at": last_count.created_at.isoformat()
            }
        }
    )

# =================================
# ENDPOINT PARA LIBERAR INVENTÁRIO PARA CONTAGEM
# =================================

@router.post("/lists/{inventory_id}/release-for-counting")
async def release_inventory_for_counting(
    inventory_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Libera um inventário para contagem (muda status de ABERTA para EM_CONTAGEM)
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem liberar inventário para contagem"
        )

    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventário não encontrado"
        )

    # Verificar se já está liberado
    if inventory.list_status in ['EM_CONTAGEM', 'RELEASED', 'COUNTING']:
        return APIResponse(
            success=True,
            message="Inventário já está liberado para contagem",
            data={
                "inventory_id": str(inventory.id),
                "status": inventory.list_status
            }
        )

    # Atualizar status
    inventory.list_status = 'EM_CONTAGEM'
    db.commit()

    return APIResponse(
        success=True,
        message="Inventário liberado para contagem com sucesso!",
        data={
            "inventory_id": str(inventory.id),
            "name": inventory.name,
            "new_status": inventory.list_status,
            "cycle": inventory.current_cycle
        }
    )

# =================================
# ENDPOINT PARA BUSCAR USUÁRIOS POR RODADA
# =================================

@router.get("/lists/{inventory_id}/counters-by-round")
async def get_counters_by_round(
    inventory_id: str,
    round: int = Query(..., ge=1, le=3, description="Número da rodada"),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Busca usuários que fizeram contagem em uma rodada específica
    
    **Parâmetros:**
    - **inventory_id**: ID do inventário
    - **round**: Número da rodada (1, 2 ou 3)
    
    **Retorna:**
    - Lista de usuários únicos que fizeram contagem na rodada
    """
    
    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found"
        )
    
    # Verificar acesso à loja
    if not verify_store_access(current_user, str(inventory.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this store"
        )
    
    # Buscar contagens da rodada específica
    from sqlalchemy import distinct
    
    query = db.query(
        distinct(CountingModel.counted_by).label('user_id'),
        func.count(CountingModel.id).label('counted_items')
    ).join(
        InventoryItemModel,
        CountingModel.inventory_item_id == InventoryItemModel.id
    ).filter(
        and_(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingModel.count_number == round
        )
    ).group_by(CountingModel.counted_by)
    
    results = query.all()
    
    # Buscar informações dos usuários
    counters = []
    for result in results:
        user = db.query(UserModel).filter(UserModel.id == result.user_id).first()
        if user:
            counters.append({
                "user_id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "counted_items": result.counted_items
            })
    
    return APIResponse(
        success=True,
        message=f"Found {len(counters)} users who counted in round {round}",
        data=counters
    )


# =================================
# ENDPOINT PARA FINALIZAR INVENTÁRIO
# =================================

@router.post("/lists/{inventory_id}/finalize-inventory")
async def finalize_inventory(
    inventory_id: str,
    closure_data: dict,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Finaliza um inventário definitivamente
    
    **Requisitos:**
    - Inventário deve estar com todas as listas encerradas
    - Usuário deve ser SUPERVISOR ou ADMIN
    - Status será alterado para ENCERRADA
    
    **Parâmetros:**
    - inventory_id: ID do inventário
    - closure_notes: Observações do encerramento
    - finalize_type: Tipo de finalização (COMPLETE_INVENTORY)
    """
    
    # Verificar permissões
    if current_user.role not in ["SUPERVISOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and admins can finalize inventories"
        )
    
    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found"
        )
    
    # Verificar se já está encerrado
    if inventory.list_status == "ENCERRADA":
        return APIResponse(
            success=True,
            message="Inventory already finalized",
            data={
                "inventory_id": str(inventory.id),
                "name": inventory.name,
                "status": inventory.list_status,
                "finalized_at": inventory.updated_at.isoformat() if inventory.updated_at else None
            }
        )
    
    # Verificar se todas as contagens foram finalizadas
    pending_items = db.query(InventoryItemModel).filter(
        and_(
            InventoryItemModel.inventory_list_id == inventory_id,
            or_(
                InventoryItemModel.status != "COUNTED",
                InventoryItemModel.status == None
            )
        )
    ).count()
    
    if pending_items > 0 and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot finalize inventory. {pending_items} items are still pending. Only ADMIN can force finalization."
        )
    
    try:
        # Atualizar status do inventário
        inventory.list_status = "ENCERRADA"
        inventory.updated_at = datetime.utcnow()
        inventory.updated_by = current_user.id
        
        # Adicionar observações se fornecidas
        closure_notes = closure_data.get("closure_notes", "")
        if closure_notes:
            if inventory.description:
                inventory.description += f"\n\nENCERRAMENTO ({datetime.now().strftime('%d/%m/%Y %H:%M')}): {closure_notes}"
            else:
                inventory.description = f"ENCERRAMENTO ({datetime.now().strftime('%d/%m/%Y %H:%M')}): {closure_notes}"
        
        # Marcar todos os itens como finalizados
        db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).update({
            "status": "COUNTED",
            "updated_at": datetime.utcnow()
        })
        
        # Commit das alterações
        db.commit()
        
        # Preparar resposta
        total_items = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).count()
        
        counted_items = db.query(InventoryItemModel).filter(
            and_(
                InventoryItemModel.inventory_list_id == inventory_id,
                or_(
                    InventoryItemModel.count_1 != None,
                    InventoryItemModel.count_2 != None,
                    InventoryItemModel.count_3 != None
                )
            )
        ).count()
        
        # Calcular divergências
        items_with_discrepancy = db.query(InventoryItemModel).filter(
            and_(
                InventoryItemModel.inventory_list_id == inventory_id,
                or_(
                    InventoryItemModel.count_1 != InventoryItemModel.system_qty,
                    InventoryItemModel.count_2 != InventoryItemModel.system_qty,
                    InventoryItemModel.count_3 != InventoryItemModel.system_qty
                )
            )
        ).count()
        
        return APIResponse(
            success=True,
            message="Inventory finalized successfully",
            data={
                "inventory_id": str(inventory.id),
                "name": inventory.name,
                "status": inventory.list_status,
                "finalized_at": datetime.utcnow().isoformat(),
                "finalized_by": current_user.username,
                "statistics": {
                    "total_items": total_items,
                    "counted_items": counted_items,
                    "items_with_discrepancy": items_with_discrepancy,
                    "coverage_percentage": round((counted_items / total_items * 100) if total_items > 0 else 0, 2),
                    "discrepancy_percentage": round((items_with_discrepancy / total_items * 100) if total_items > 0 else 0, 2)
                },
                "closure_notes": closure_notes
            }
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "finalizing inventory")
        )


# =================================
# ENDPOINT PARA MARCAR ANÁLISE CONCLUÍDA (Onda 3)
# =================================

@router.post("/lists/{inventory_id}/marcar-analisado")
async def marcar_analisado(
    inventory_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    Marca a etapa do inventário como ANALISADO.

    Pré-condição: inventário precisa estar ENCERRADO (status COMPLETED).
    Habilita o envio ao Protheus (gating em send-protheus/finalize).

    **Permissão:** SUPERVISOR ou ADMIN.
    """
    if current_user.role not in ["SUPERVISOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas SUPERVISOR e ADMIN podem marcar a análise como concluída"
        )

    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventário não encontrado"
        )

    if not verify_store_access(current_user, str(inventory.store_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem acesso a esta loja"
        )

    if inventory.status == InventoryStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventário já foi integrado ao Protheus (CLOSED)"
        )

    # Exige inventário encerrado (todas as listas terminadas)
    if inventory.list_status != "ENCERRADA" and inventory.status != InventoryStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Encerre o inventário antes de marcar a análise como concluída"
        )

    if inventory.analisado_em is not None:
        return APIResponse(
            success=True,
            message="Análise já estava marcada como concluída",
            data={
                "inventory_id": str(inventory.id),
                "etapa_atual": inventory.etapa_atual,
                "analisado_em": inventory.analisado_em.isoformat(),
                "analisado_por_id": str(inventory.analisado_por_id) if inventory.analisado_por_id else None,
            }
        )

    inventory.analisado_em = datetime.utcnow()
    inventory.analisado_por_id = current_user.id
    db.commit()
    db.refresh(inventory)

    return APIResponse(
        success=True,
        message="Análise concluída. O inventário está pronto para envio ao Protheus.",
        data={
            "inventory_id": str(inventory.id),
            "etapa_atual": inventory.etapa_atual,
            "proximo_passo": inventory.proximo_passo,
            "analisado_em": inventory.analisado_em.isoformat(),
            "analisado_por_id": str(inventory.analisado_por_id),
        }
    )


# =================================
# ENDPOINT PARA REDISTRIBUIR PRODUTOS
# =================================

@router.get("/test-redistribute", summary="Teste de rota", dependencies=[Depends(require_test_endpoints)])
async def test_redistribute():
    """Endpoint de teste (protegido)"""
    return {"message": "Rota de redistribuição funcionando", "timestamp": datetime.utcnow().isoformat()}

@router.post("/lists/{inventory_id}/redistribute-products", summary="Redistribuir produtos entre listas")
async def redistribute_products(
    inventory_id: str,
    force: bool = Query(False, description="Forçar redistribuição mesmo se já houver produtos distribuídos"),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Redistribui os produtos do inventário entre as listas de contagem.

    Este endpoint é útil quando:
    - Produtos foram adicionados após a criação das listas
    - Houve erro na distribuição inicial
    - Precisa reorganizar a distribuição

    **Parâmetros:**
    - force: Se True, limpa distribuição existente e redistribui

    **Retorna:**
    - Resumo da distribuição de produtos entre as listas
    """
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN e SUPERVISOR podem redistribuir produtos entre listas"
        )

    try:
        # Verificar se inventário existe
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventário {inventory_id} não encontrado"
            )

        # Verificar permissão (apenas admin ou supervisor)
        if current_user.role not in ['ADMIN', 'SUPERVISOR']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores e supervisores podem redistribuir produtos"
            )

        # Executar redistribuição
        from app.services.counting_lists_service import distribute_products_to_counting_lists

        result = await distribute_products_to_counting_lists(
            db=db,
            inventory_id=inventory_id,
            force_redistribution=force
        )

        if result["success"]:
            return APIResponse(
                success=True,
                message=result["message"],
                data=result["distribution"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao redistribuir produtos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao redistribuir produtos")
        )