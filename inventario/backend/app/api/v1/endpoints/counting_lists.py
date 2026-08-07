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


# ---------------------------------------------------------------------------
# Teto de itens por lista de contagem (Fase 1.5)
# ---------------------------------------------------------------------------
# O teto existe por DOIS motivos que se reforçam, e é importante não confundi-los:
#
#  1. **Operacional** — uma lista é a atribuição de UMA pessoa. Ninguém conta
#     10.000 itens numa atribuição só; dividir é o que o modelo multi-lista já
#     faz (cada lista tem contador e ciclo próprios, então dividir também
#     PARALELIZA a contagem).
#  2. **Técnico** — a lista precisa caber no aparelho para a contagem offline
#     (3.000 itens ≈ 1,9 MB, dentro do limite do AsyncStorage).
#
# Se fosse só o motivo 2, seria limitação técnica disfarçada de regra. Como o
# motivo 1 vale sozinho, o teto é regra de negócio — e por isso ele é **aviso**
# no desktop e **bloqueio** só na porta do mobile (o checkout). Assim o desktop
# nunca fica travado por uma regra que existe por causa do celular.
CHAVE_TETO_ITENS = 'max_itens_por_lista_contagem'
TETO_ITENS_PADRAO = 3000


def obter_teto_itens(db: Session) -> int:
    """Teto configurado em `inventario.system_config`, ou o padrão.

    Hoje só se altera pelo banco — não há tela. Se virar algo que o usuário
    precise ajustar, ver a regra de "funcionalidade oculta precisa de tela".
    """
    try:
        from app.models.models import SystemConfig
        cfg = db.query(SystemConfig).filter(
            SystemConfig.key == CHAVE_TETO_ITENS,
            SystemConfig.is_active == True,  # noqa: E712 — SQLAlchemy
        ).first()
        if cfg and cfg.value:
            valor = int(str(cfg.value).strip())
            if valor > 0:
                return valor
    except Exception as err:  # config inválida não pode derrubar a contagem
        logger.warning(f"Teto de itens por lista inválido em system_config: {err}. Usando o padrão.")
    return TETO_ITENS_PADRAO


def _contar_itens_da_lista(db: Session, list_id) -> int:
    return db.query(CountingListItem).filter(CountingListItem.counting_list_id == list_id).count()


def _is_staff(user) -> bool:
    """ADMIN/SUPERVISOR. Aceita Enum ou string — o campo role aparece das duas
    formas dependendo de como o usuário foi carregado (UNIFIED_AUTH x tabela)."""
    role = getattr(user, "role", None)
    role = getattr(role, "value", role)
    return str(role).upper() in ("ADMIN", "SUPERVISOR")


# Campos que revelam o saldo do sistema. Nomes variam entre os endpoints, por
# isso a lista é ampla — melhor remover um campo inexistente do que deixar
# passar.
_CAMPOS_SALDO = ("expected_quantity", "system_qty", "expected", "saldo", "variacao", "difference")


def aplicar_contagem_cega(product_data: dict, user, counting_list) -> dict:
    """
    Fase 0 / item 0.2 — projeção server-side da CONTAGEM CEGA.

    Contagem cega só é cega se o OPERATOR não chega ao saldo por nenhum caminho.
    Até aqui quem escondia era o frontend, o que quer dizer que qualquer cliente
    com o JWT do OPERATOR lia o saldo. Com o app offline isso pioraria: o payload
    passaria a ficar PERSISTIDO no aparelho do operador.

    ⚠️ Isto NÃO é `require_staff_role` no endpoint. Existe nota antiga dizendo
    para não bloquear estes endpoints server-side — e está certa: o OPERATOR
    PRECISA chamá-los para contar. O que se faz aqui é devolver MENOS CAMPOS
    para ele. Não confundir projeção com bloqueio ao revisar.

    ⚠️ Chamar DEPOIS de qualquer cálculo que use os campos removidos
    (`finalQuantity` usa `expected_quantity`).

    Ciclos anteriores respeitam `show_previous_counts`, que já é a decisão do
    supervisor no ato de liberar (migration 010, default False = cega).

    ⚠️ Remove apenas ciclos ANTERIORES ao corrente. O `count_cycle_N` do ciclo
    ATUAL não pode sair nunca: é dele que a tela de contagem deriva o que já foi
    contado (`useCountingData.ts` monta contados/pendentes a partir da
    count_cycle real, não do status). Removê-lo faria todo item voltar a
    aparecer como pendente para o operador.
    """
    if _is_staff(user):
        return product_data

    for campo in _CAMPOS_SALDO:
        product_data.pop(campo, None)

    if not bool(getattr(counting_list, "show_previous_counts", False)):
        ciclo_atual = getattr(counting_list, "current_cycle", 1) or 1
        for anterior in range(1, ciclo_atual):
            product_data.pop(f"count_cycle_{anterior}", None)

    return product_data


# ---------------------------------------------------------------------------
# REMOVIDO em 07/08/2026 — GET /inventories/{inventory_id}/lists/{list_id}/products
#
# Esta era uma CÓPIA quase idêntica do handler que vive em
# `app/main.py` (get_counting_list_products). Duas coisas erradas ao mesmo tempo:
#
#  1. A cópia daqui estava QUEBRADA: lia `item.system_qty`, atributo que
#     `InventoryItem` não tem (o campo é `b2_qatu`). Qualquer chamada com itens
#     na lista devolvia 500.
#  2. Ela SOMBREAVA a versão boa. O router é incluído antes do `@app.get` de
#     main.py, e no FastAPI a primeira rota registrada vence — então quem
#     respondia era justamente a quebrada.
#
# Ninguém reclamou porque nenhum cliente chama esta rota (o frontend usa
# `/counting-lists/{list_id}/products`, que é outro handler). Descoberto ao
# escrever o teste end-to-end da contagem cega, que passou a exercitá-la.
#
# A projeção `aplicar_contagem_cega` foi levada para a implementação de main.py,
# que voltou a servir.
# ---------------------------------------------------------------------------

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

    # Uma leitura só do teto para a listagem inteira (é config, não muda no loop).
    teto_itens = obter_teto_itens(db)

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
            # Fase 1.5 — quem responde se a lista cabe no app é o SERVIDOR, não a
            # tela: o teto é configurável e a comparação tem que morar num lugar
            # só. Sem isto o aviso só existiria no momento de montar a lista e
            # sumiria depois — e o supervisor descobriria o problema quando o
            # contador já estivesse com o aparelho na mão.
            "acima_do_teto_app": total_products > teto_itens,
            "teto_itens_app": teto_itens,
            # Item 0.5 — o supervisor precisa ver que existe aparelho com a
            # lista baixada ANTES de liberar, devolver ou cobrar.
            **_lease_payload(cl),
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
            -- Item 0.5: estado do lease já na listagem, para o contador ver que
            -- a lista está baixada num aparelho ANTES de abrir e começar.
            cl.lease_token, cl.lease_device_id, cl.lease_user_id, cl.lease_at,
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
            **_lease_payload(row),
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

    # Item 0.5 — o `**__dict__` acima despejaria o `lease_token` cru, e o token
    # É a credencial do lease: quem o lê consegue gravar como se fosse o
    # aparelho dono. Remover e devolver só o estado (ativo/quem/desde quando).
    response.pop("lease_token", None)
    response.pop("lease_device_id", None)
    response.pop("lease_user_id", None)
    response.pop("lease_at", None)
    response.update(_lease_payload(counting_list))

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

    # Fase 1.5 — o teto é AVISO no desktop, não bloqueio (o bloqueio fica na
    # porta do mobile, no checkout). Aqui só registramos, para dar rastro de
    # quando uma lista passou do tamanho recomendado e por quanto.
    total = _contar_itens_da_lista(db, list_id)
    teto = obter_teto_itens(db)
    if total > teto:
        logger.warning(
            f"[TETO_LISTA] Lista {list_id} ficou com {total} itens (teto {teto}). "
            f"Permitido no desktop; a retirada pelo aplicativo será recusada."
        )

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
            # Migration 015 / item 0.3 — rastro POR ITEM do preenchimento.
            # A regra não muda: zero é contagem legítima e o preenchimento é a
            # semântica de "varri a lista, o que sobrou eu não achei". O que
            # esta marca resolve é que, sem ela, o item preenchido fica
            # indistinguível de uma contagem ativa (0 + COUNTED + o operador em
            # last_counted_by) e o único rastro era o total no histórico.
            it.zerado_no_fecho = True
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

    # Cada devolução é uma "declaração nova" do supervisor: estes são os itens
    # que precisam de revisão AGORA. Limpa flags da devolução anterior antes de
    # aplicar a nova — caso contrário, devolver TOTAL e depois PARCIAL deixava
    # 100% dos itens marcados (bug detectado 09/05/2026 — INV_04 do Clenio).
    todos_da_lista = db.query(CountingListItem).filter(
        CountingListItem.counting_list_id == list_id
    ).all()
    for it in todos_da_lista:
        it.revisar_no_ciclo = False
        it.motivo_revisao = None

    if item_ids:
        # Devolução parcial — só os itens selecionados recebem a marcação
        items = [it for it in todos_da_lista if str(it.inventory_item_id) in item_ids]
    else:
        # Devolução total — marca todos os itens contados no ciclo atual
        items = [it for it in todos_da_lista if getattr(it, count_field) is not None]

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


def _lease_payload(counting_list) -> dict:
    """
    Item 0.5 — estado do lease para os endpoints de LEITURA.

    Avisar só no 409 da gravação é tarde: a pessoa já abriu a lista e se
    posicionou para trabalhar. Este bloco vai nas telas (Minhas Listas, detalhe
    da lista, visão do supervisor) para o aviso chegar ANTES de começar.

    Expõe também de QUEM é o aparelho: o lease é por dispositivo, mas quem olha
    precisa saber a quem cobrar — "dispositivo a3f…" sozinho não serve.
    """
    ativo = bool(getattr(counting_list, 'lease_token', None))
    if not ativo:
        return {"lease_ativo": False}
    device = counting_list.lease_device_id or ""
    return {
        "lease_ativo": True,
        # Só o sufixo: identifica o aparelho sem despejar o id inteiro na tela.
        "lease_device_id": device[-4:] if len(device) > 4 else device,
        "lease_user_id": str(counting_list.lease_user_id) if counting_list.lease_user_id else None,
        "lease_at": counting_list.lease_at.isoformat() if counting_list.lease_at else None,
    }


@router.get("/counting-lists/config/teto-itens")
async def teto_itens_por_lista(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teto de itens por lista, para a tela mostrar o número real em vez de um
    3.000 escrito no código do frontend (que sairia de sincronia no dia em que
    o valor mudasse no banco)."""
    return {"teto": obter_teto_itens(db), "padrao": TETO_ITENS_PADRAO}


@router.post("/counting-lists/{list_id}/checkout")
async def checkout_counting_list(
    list_id: UUID,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Item 0.5 — o app "retira" a lista para contagem offline e recebe um
    `lease_token` que deve acompanhar cada contagem enviada depois.

    Não é lock distribuído: o app conta offline sem falar com o servidor. Serve
    para (a) avisar as outras superfícies que existe aparelho com a lista
    baixada e (b) tornar a colisão detectável na sincronização, em vez de
    last-write-wins silencioso.

    Retomar o checkout no MESMO aparelho renova o lease (o app pode reinstalar
    ou perder o token local); vindo de outro aparelho, é recusado.
    """
    device_id = (payload or {}).get("device_id")
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id é obrigatório para o checkout.")

    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

    _check_not_closed(
        db.query(InventoryList).filter(InventoryList.id == counting_list.inventory_id).first()
    )

    if counting_list.list_status != 'EM_CONTAGEM':
        raise HTTPException(
            status_code=400,
            detail={
                "erro": "LISTA_NAO_ESTA_EM_CONTAGEM",
                "mensagem": f"A lista não está em contagem (status: {counting_list.list_status}).",
                "list_status": counting_list.list_status,
            },
        )

    if not _is_staff(current_user) and not _is_counter_for_current_cycle(counting_list, current_user.id):
        raise HTTPException(
            status_code=403,
            detail={
                "erro": "CONTADOR_NAO_ATRIBUIDO",
                "mensagem": "Você não é o contador atribuído ao ciclo atual desta lista.",
                "cycle": counting_list.current_cycle,
            },
        )

    # Fase 1.5 — AQUI o teto é rígido. Esta é a porta do mobile: passar de
    # 3.000 itens não cabe no aparelho (o pacote fica grande demais para o
    # armazenamento local) e, antes disso, não é uma atribuição que uma pessoa
    # dê conta. No desktop o mesmo teto é só aviso, de propósito — a operação
    # não pode ficar travada por uma regra que existe por causa do celular.
    total_itens = _contar_itens_da_lista(db, list_id)
    teto = obter_teto_itens(db)
    if total_itens > teto:
        logger.warning(
            f"[TETO_LISTA] Checkout recusado — lista {list_id} tem {total_itens} itens (teto {teto})."
        )
        raise HTTPException(
            status_code=400,
            detail={
                "erro": "LISTA_ACIMA_DO_TETO",
                "mensagem": (
                    f"Esta lista tem {total_itens} itens e o máximo para contagem pelo aplicativo "
                    f"é {teto}. Peça ao supervisor para dividir a lista."
                ),
                "total_itens": total_itens,
                "teto": teto,
            },
        )

    if counting_list.lease_token and counting_list.lease_device_id != device_id:
        raise HTTPException(
            status_code=409,
            detail={
                "erro": "LISTA_EM_USO_OUTRO_DISPOSITIVO",
                "mensagem": "Esta lista já está baixada em outro aparelho.",
                **_lease_payload(counting_list),
            },
        )

    import uuid as _uuid
    token = _uuid.uuid4()
    counting_list.lease_token = token
    counting_list.lease_device_id = device_id
    counting_list.lease_user_id = current_user.id
    counting_list.lease_at = func.now()
    db.commit()

    logger.info(f"📥 [LEASE] lista {list_id} retirada pelo aparelho {device_id} (user {current_user.id})")
    return {"lease_token": str(token), "counting_list_id": str(list_id)}


@router.delete("/counting-lists/{list_id}/checkout")
async def release_counting_list(
    list_id: UUID,
    lease_token: Optional[str] = Query(None, description="Token do lease a liberar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Item 0.5 — devolve a lista. O app chama ao terminar de sincronizar.

    ESCAPE HATCH OBRIGATÓRIO: ADMIN/SUPERVISOR liberam sem token. Sem isso, um
    aparelho perdido ou um operador desligado congelariam a lista para sempre.
    O evento fica no histórico de handoff, que já existe.
    """
    counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
    if not counting_list:
        raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

    if not counting_list.lease_token:
        return {"message": "Lista já estava livre.", "lease_ativo": False}

    forcado = False
    if lease_token and str(counting_list.lease_token) == str(lease_token):
        pass  # devolução normal, pelo próprio aparelho
    elif _is_staff(current_user):
        forcado = True
    else:
        raise HTTPException(
            status_code=403,
            detail={
                "erro": "LEASE_DE_OUTRO_DISPOSITIVO",
                "mensagem": "Só o aparelho que retirou a lista (ou um supervisor) pode liberá-la.",
            },
        )

    device_anterior = counting_list.lease_device_id
    counting_list.lease_token = None
    counting_list.lease_device_id = None
    counting_list.lease_user_id = None
    counting_list.lease_at = None

    if forcado:
        db.add(CountingListHandoffHistory(
            list_id=list_id,
            evento='LEASE_LIBERADO',
            ator_id=current_user.id,
            ciclo=counting_list.current_cycle,
            observacao=f"Lease do aparelho {device_anterior} liberado por supervisor/admin.",
        ))
        logger.warning(
            f"⚠️ [LEASE] lista {list_id} liberada À FORÇA por {current_user.id} "
            f"(aparelho anterior: {device_anterior})"
        )

    db.commit()
    return {"message": "Lista liberada.", "lease_ativo": False, "forcado": forcado}


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
                # Item 0.2 — projeção da contagem cega por papel.
                aplicar_contagem_cega(product_data, current_user, counting_list)
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
        # Item 0.2 — projeção da contagem cega por papel. `current_count` é o
        # ciclo CORRENTE (já resolvido em count_field) e por isso permanece:
        # é o que diz ao contador o que ele mesmo já contou.
        aplicar_contagem_cega(item_data, current_user, counting_list)

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