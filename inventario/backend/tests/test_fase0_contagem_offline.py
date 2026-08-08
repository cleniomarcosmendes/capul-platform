"""
Fase 0 da contagem offline no app — gates dos itens 0.1 a 0.5.
Ver docs/PLANO_INVENTARIO_MOBILE_OFFLINE_FASE0.md

Chama os handlers/validadores diretamente (não via HTTP), mesmo padrão de
test_handoff_supervisor.py.

⚠️ Rodar por `./run-tests.sh` — `tests/` está no .dockerignore, então `pytest`
   dentro do container coleta só o test_smoke.py da raiz.

O teste que NÃO pode voltar nunca é o de ciclo divergente (0.1): sem ele, uma
contagem offline do 1º ciclo sincronizada depois do avanço sobrescreve em
silêncio o trabalho do contador do 2º.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import (
    CountingList,
    CountingListItem,
    CountingListHandoffHistory,
    Counting,
)
from app.api.v1.endpoints.counting_lists import (
    aplicar_contagem_cega,
    handoff_counting_list,
    checkout_counting_list,
    release_counting_list,
)
from app.main import _validar_captura_offline, _validar_contagem_por_lote


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _captura(**kw):
    """Objeto no formato de RegisterCountRequest, só com o que o validador lê."""
    base = dict(
        counting_list_id=None,
        expected_cycle=None,
        idempotency_key=None,
        counted_at_client=None,
        lease_token=None,
        force=False,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _erro(exc_info) -> str:
    detail = exc_info.value.detail
    return detail.get("erro") if isinstance(detail, dict) else str(detail)


# ==========================================================================
# 0.1 — Ciclo carimbado pelo cliente
# ==========================================================================

def test_01_ciclo_divergente_e_recusado(db_session, test_counting_list, test_counting_list_items):
    """⭐ A regressão que corrompe inventário em silêncio.

    Contagem capturada no ciclo 1 chegando com a lista já no ciclo 2 tem que
    ser RECUSADA. Antes ela era gravada como contagem do ciclo 2 e o upsert por
    (item, ciclo) sobrescrevia o valor do outro contador.
    """
    test_counting_list.current_cycle = 2
    db_session.flush()
    item = test_counting_list_items[0]

    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(counting_list_id=str(test_counting_list.id), expected_cycle=1),
            counting_list=test_counting_list,
            cycle_number=2,
            item_uuid=item.inventory_item_id,
            current_user=SimpleNamespace(id=uuid4()),
        )

    assert exc.value.status_code == 409
    assert _erro(exc) == "CICLO_DIVERGENTE"
    assert exc.value.detail["expected_cycle"] == 1
    assert exc.value.detail["current_cycle"] == 2


def test_01_ciclo_igual_passa(db_session, test_counting_list, test_counting_list_items):
    item = test_counting_list_items[0]
    _validar_captura_offline(
        db=db_session,
        count_data=_captura(counting_list_id=str(test_counting_list.id), expected_cycle=1),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=SimpleNamespace(id=uuid4()),
    )


def test_01_lista_divergente_e_recusada(db_session, test_counting_list, test_counting_list_items):
    """Item que mudou de lista entre a captura e a sincronização."""
    item = test_counting_list_items[0]
    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(counting_list_id=str(uuid4()), expected_cycle=1),
            counting_list=test_counting_list,
            cycle_number=1,
            item_uuid=item.inventory_item_id,
            current_user=SimpleNamespace(id=uuid4()),
        )
    assert exc.value.status_code == 409
    assert _erro(exc) == "LISTA_DIVERGENTE"


def test_01_retrocompat_sem_campos_novos(db_session, test_counting_list, test_counting_list_items):
    """Cliente legado (a web de hoje) não envia nada disso e não pode quebrar."""
    item = test_counting_list_items[0]
    _validar_captura_offline(
        db=db_session,
        count_data=_captura(),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=SimpleNamespace(id=uuid4()),
    )


# ==========================================================================
# 0.2 — Saldo fora do payload do OPERATOR
# ==========================================================================

def _payload_produto():
    return {
        "id": str(uuid4()),
        "product_code": "000001",
        "expected_quantity": 1234.5,
        "system_qty": 1234.5,
        "count_cycle_1": 10.0,
        "count_cycle_2": 12.0,
        "count_cycle_3": None,
        "finalQuantity": 12.0,
    }


def test_02_operator_nao_recebe_saldo(test_counting_list, test_operator_user):
    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert "expected_quantity" not in out
    assert "system_qty" not in out


def test_02_supervisor_recebe_saldo(test_counting_list, test_supervisor_user):
    out = aplicar_contagem_cega(_payload_produto(), test_supervisor_user, test_counting_list)
    assert out["expected_quantity"] == 1234.5
    assert out["system_qty"] == 1234.5


def test_02_ciclo_atual_nunca_e_removido(db_session, test_counting_list, test_operator_user):
    """⚠️ O count_cycle do ciclo CORRENTE não pode sair nunca.

    É dele que a tela deriva o que já foi contado (useCountingData monta
    contados/pendentes a partir da count_cycle real, não do status). Removê-lo
    faria todo item voltar a aparecer como pendente para o operador.
    """
    test_counting_list.current_cycle = 1
    test_counting_list.show_previous_counts = False
    db_session.flush()

    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert out["count_cycle_1"] == 10.0


def test_02_ciclos_anteriores_saem_quando_cega(db_session, test_counting_list, test_operator_user):
    test_counting_list.current_cycle = 3
    test_counting_list.show_previous_counts = False
    db_session.flush()

    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert "count_cycle_1" not in out
    assert "count_cycle_2" not in out
    assert "count_cycle_3" in out  # ciclo corrente permanece


def test_02_show_previous_counts_true_devolve_anteriores(db_session, test_counting_list, test_operator_user):
    """A decisão é do supervisor no Liberar — o servidor só passa a honrá-la."""
    test_counting_list.current_cycle = 3
    test_counting_list.show_previous_counts = True
    db_session.flush()

    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert out["count_cycle_1"] == 10.0
    assert out["count_cycle_2"] == 12.0


def test_02_final_quantity_sobrevive_para_operator(db_session, test_counting_list, test_operator_user):
    """Regressão do `.pop()`: finalQuantity é calculado a partir do
    expected_quantity, então tem que ser resolvido ANTES da projeção."""
    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert out["finalQuantity"] == 12.0


# ==========================================================================
# 0.2b — Saldo POR LOTE fora do payload do OPERATOR (08/08/2026)
# ==========================================================================
#
# A projeção acima só alcança chaves de PRIMEIRO NÍVEL. O payload real leva o
# mesmo saldo repetido dentro de listas — `snapshot_lots`, `saved_lots` e
# `countings`. Somar os lotes reconstrói o `system_qty` recém-removido.
#
# Ficou latente enquanto nenhum cliente lia esses campos. A contagem por lote no
# app passa a lê-los e a PERSISTIR o resultado no aparelho do operador, que é o
# cenário que o item 0.2 existe para evitar. Estes testes seguram a porta.


def _payload_com_lotes():
    """Espelha o payload real de `/counting-lists/{id}/products`."""
    return {
        "id": str(uuid4()),
        "product_code": "000001",
        "expected_quantity": 300.0,
        "system_qty": 300.0,
        "requires_lot": True,
        # inventory_lots_snapshot: b8_lotectl / b8_saldo / b8_lotefor
        "snapshot_lots": [
            {"lot_number": "L001", "quantity": 100.0, "b8_lotefor": "FORN-A"},
            {"lot_number": "L002", "quantity": 200.0, "b8_lotefor": "FORN-B"},
        ],
        # rascunho salvo durante a contagem: system_qty + o que já foi contado
        "saved_lots": [
            {"lot_number": "L001", "quantity": 100.0, "counted_qty": 97.0, "b8_lotefor": "FORN-A"},
        ],
        # histórico por ciclo E por lote
        "countings": [
            {"count_number": 1, "quantity": 90.0, "lot_number": "L001"},
            {"count_number": 2, "quantity": 97.0, "lot_number": "L001"},
        ],
        "count_cycle_1": 90.0,
        "count_cycle_2": 97.0,
    }


def test_02b_operator_nao_recebe_saldo_por_lote(test_counting_list, test_operator_user):
    """⭐ O buraco: somar os lotes devolvia o saldo que a máscara removeu."""
    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)

    assert "system_qty" not in out, "o saldo de primeiro nível deveria ter saído"
    for lote in out["snapshot_lots"]:
        assert "quantity" not in lote, (
            f"lote {lote.get('lot_number')} ainda entrega o saldo do sistema — "
            "somando os lotes o operador reconstrói o system_qty"
        )
    for lote in out["saved_lots"]:
        assert "quantity" not in lote


def test_02b_operator_ainda_sabe_QUAL_lote_contar(test_counting_list, test_operator_user):
    """Esconder o saldo não pode inviabilizar a contagem.

    O contador precisa da IDENTIDADE do lote (número + lote do fornecedor, que
    é o que está impresso na embalagem). O que ele não pode saber é QUANTO
    deveria ter.
    """
    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)

    numeros = [l["lot_number"] for l in out["snapshot_lots"]]
    assert numeros == ["L001", "L002"], "a lista de lotes não pode sumir"
    assert all(l.get("b8_lotefor") for l in out["snapshot_lots"])


def test_02b_operator_ve_o_que_ELE_contou_no_lote(test_counting_list, test_operator_user):
    """`counted_qty` é o trabalho do próprio operador no ciclo corrente — fica.

    Sem isso ele reabre o produto e não vê o que já digitou lote a lote.
    """
    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)
    assert out["saved_lots"][0]["counted_qty"] == 97.0


def test_02b_countings_de_ciclos_anteriores_saem_quando_cega(
    db_session, test_counting_list, test_operator_user
):
    """O `countings[]` burlava a regra de ciclos anteriores.

    `count_cycle_1` era removido, mas o array trazia a mesma contagem
    detalhada por lote — inclusive de quem contou antes.
    """
    test_counting_list.current_cycle = 2
    test_counting_list.show_previous_counts = False
    db_session.flush()

    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)

    ciclos = sorted({c["count_number"] for c in out["countings"]})
    assert ciclos == [2], f"ciclo anterior vazou pelo countings[]: {ciclos}"


def test_02b_countings_do_ciclo_corrente_permanecem(
    db_session, test_counting_list, test_operator_user
):
    """Mesma razão do `count_cycle` corrente: é dele que a tela deriva o que já
    foi contado — por lote, aqui."""
    test_counting_list.current_cycle = 2
    test_counting_list.show_previous_counts = False
    db_session.flush()

    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)
    atual = [c for c in out["countings"] if c["count_number"] == 2]
    assert atual and atual[0]["lot_number"] == "L001"


def test_02b_show_previous_counts_true_devolve_countings_anteriores(
    db_session, test_counting_list, test_operator_user
):
    """A decisão segue sendo do supervisor no ato de liberar."""
    test_counting_list.current_cycle = 2
    test_counting_list.show_previous_counts = True
    db_session.flush()

    out = aplicar_contagem_cega(_payload_com_lotes(), test_operator_user, test_counting_list)
    assert sorted({c["count_number"] for c in out["countings"]}) == [1, 2]


def test_02b_supervisor_continua_vendo_tudo(test_counting_list, test_supervisor_user):
    out = aplicar_contagem_cega(_payload_com_lotes(), test_supervisor_user, test_counting_list)
    assert out["snapshot_lots"][0]["quantity"] == 100.0
    assert out["saved_lots"][0]["quantity"] == 100.0
    assert len(out["countings"]) == 2


def test_02b_payload_sem_lote_nao_quebra(test_counting_list, test_operator_user):
    """Produto sem controle de lote não tem as listas — a projeção não pode
    explodir por causa disso."""
    out = aplicar_contagem_cega(_payload_produto(), test_operator_user, test_counting_list)
    assert "system_qty" not in out


def test_02b_lista_de_lote_nula_nao_quebra(test_counting_list, test_operator_user):
    """`snapshot_lots` chega como `[]` do json_agg, mas defensivo contra None."""
    payload = _payload_com_lotes()
    payload["snapshot_lots"] = None
    payload["saved_lots"] = []
    payload["countings"] = None
    out = aplicar_contagem_cega(payload, test_operator_user, test_counting_list)
    assert out["snapshot_lots"] is None


# ==========================================================================
# 0.3 — Rastro do preenchimento do handoff
# ==========================================================================

def test_03_handoff_marca_zerado_no_fecho(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    """Item não contado vira 0 E fica marcado; item contado como 0 NÃO é marcado.

    A regra do preenchimento não muda — zero é contagem legítima. A marca só
    diz de onde o zero veio.
    """
    test_counting_list.list_status = 'EM_CONTAGEM'
    contado_zero, nao_contado = test_counting_list_items[0], test_counting_list_items[1]
    contado_zero.count_cycle_1 = Decimal("0")
    nao_contado.count_cycle_1 = None
    db_session.flush()

    asyncio.run(handoff_counting_list(
        list_id=test_counting_list.id, db=db_session, current_user=test_supervisor_user
    ))

    db_session.refresh(contado_zero)
    db_session.refresh(nao_contado)
    assert nao_contado.count_cycle_1 == 0
    assert nao_contado.zerado_no_fecho is True, "preenchido no fecho tem que ficar marcado"
    assert contado_zero.zerado_no_fecho is False, "zero CONTADO não é preenchimento"


def test_03_handoff_preserva_item_ja_contado(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    """Proteção da regra: o handoff só toca count_cycle_N NULL. Se alguém
    'consertar' isso para sobrescrever tudo com zero, este teste cai."""
    test_counting_list.list_status = 'EM_CONTAGEM'
    item = test_counting_list_items[0]
    item.count_cycle_1 = Decimal("42")
    db_session.flush()

    asyncio.run(handoff_counting_list(
        list_id=test_counting_list.id, db=db_session, current_user=test_supervisor_user
    ))

    db_session.refresh(item)
    assert item.count_cycle_1 == 42


def test_03_handoff_ciclo2_ignora_item_que_nao_precisa_recontagem(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    test_counting_list.list_status = 'EM_CONTAGEM'
    test_counting_list.current_cycle = 2
    fora, dentro = test_counting_list_items[0], test_counting_list_items[1]
    fora.needs_count_cycle_2 = False
    dentro.needs_count_cycle_2 = True
    db_session.flush()

    asyncio.run(handoff_counting_list(
        list_id=test_counting_list.id, db=db_session, current_user=test_supervisor_user
    ))

    db_session.refresh(fora)
    db_session.refresh(dentro)
    assert fora.count_cycle_2 is None, "item fora do ciclo 2 não pode ser preenchido"
    assert dentro.count_cycle_2 == 0


# ==========================================================================
# 0.4 — Ordenação (idempotência é testada pelo caminho do endpoint)
# ==========================================================================

def test_04_captura_mais_velha_e_recusada(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    """O operador conta 10, corrige para 12, e as duas sobem fora de ordem."""
    item = test_counting_list_items[0]
    agora = datetime.now(timezone.utc)

    db_session.add(Counting(
        id=uuid4(),
        inventory_item_id=item.inventory_item_id,
        quantity=Decimal("12"),
        counted_by=test_operator_user.id,
        count_number=1,
        counted_at_client=agora,
    ))
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(counted_at_client=agora - timedelta(minutes=5)),
            counting_list=test_counting_list,
            cycle_number=1,
            item_uuid=item.inventory_item_id,
            current_user=test_operator_user,
        )
    assert _erro(exc) == "CONTAGEM_DESATUALIZADA"


def test_04_captura_mais_nova_passa(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    item = test_counting_list_items[0]
    agora = datetime.now(timezone.utc)
    db_session.add(Counting(
        id=uuid4(),
        inventory_item_id=item.inventory_item_id,
        quantity=Decimal("10"),
        counted_by=test_operator_user.id,
        count_number=1,
        counted_at_client=agora - timedelta(minutes=5),
    ))
    db_session.flush()

    _validar_captura_offline(
        db=db_session,
        count_data=_captura(counted_at_client=agora),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=test_operator_user,
    )


# ==========================================================================
# 0.5 — Lease por dispositivo
# ==========================================================================

def _com_lease(counting_list, db, device="dev-aaa"):
    counting_list.lease_token = uuid4()
    counting_list.lease_device_id = device
    counting_list.lease_at = datetime.now(timezone.utc)
    db.flush()
    return counting_list.lease_token


def test_05_sem_lease_web_grava_como_hoje(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    """Retrocompatibilidade: lista sem lease se comporta exatamente como antes."""
    item = test_counting_list_items[0]
    _validar_captura_offline(
        db=db_session,
        count_data=_captura(),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=test_operator_user,
    )


def test_05_web_sem_token_com_lease_ativo_avisa(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    _com_lease(test_counting_list, db_session)
    item = test_counting_list_items[0]

    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(),
            counting_list=test_counting_list,
            cycle_number=1,
            item_uuid=item.inventory_item_id,
            current_user=test_operator_user,
        )
    assert exc.value.status_code == 409
    assert _erro(exc) == "LISTA_EM_USO_OUTRO_DISPOSITIVO"
    assert exc.value.detail["lease_device_id"]


def test_05_force_grava_e_invalida_o_lease(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    """Decisão humana informada: passa a contar E derruba o lease, para o app
    descobrir na sincronização em vez de sobrescrever calado."""
    _com_lease(test_counting_list, db_session)
    item = test_counting_list_items[0]

    _validar_captura_offline(
        db=db_session,
        count_data=_captura(force=True),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=test_operator_user,
    )
    assert test_counting_list.lease_token is None


def test_05_app_com_token_invalidado_e_recusado(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    """O app estava offline; alguém contou na web com force. Ao sincronizar, ele
    NÃO pode sobrescrever — tem que descobrir."""
    _com_lease(test_counting_list, db_session)
    item = test_counting_list_items[0]
    token_velho = str(uuid4())

    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(lease_token=token_velho),
            counting_list=test_counting_list,
            cycle_number=1,
            item_uuid=item.inventory_item_id,
            current_user=test_operator_user,
        )
    assert _erro(exc) == "LEASE_INVALIDO"


def test_05_app_com_token_valido_passa(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    token = _com_lease(test_counting_list, db_session)
    item = test_counting_list_items[0]

    _validar_captura_offline(
        db=db_session,
        count_data=_captura(lease_token=str(token)),
        counting_list=test_counting_list,
        cycle_number=1,
        item_uuid=item.inventory_item_id,
        current_user=test_operator_user,
    )


def test_05_checkout_e_recusado_para_outro_aparelho(
    db_session, test_counting_list, test_supervisor_user
):
    test_counting_list.list_status = 'EM_CONTAGEM'
    _com_lease(test_counting_list, db_session, device="dev-aaa")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(checkout_counting_list(
            list_id=test_counting_list.id,
            payload={"device_id": "dev-bbb"},
            db=db_session,
            current_user=test_supervisor_user,
        ))
    assert _erro(exc) == "LISTA_EM_USO_OUTRO_DISPOSITIVO"


def test_05_checkout_do_mesmo_aparelho_renova(
    db_session, test_counting_list, test_supervisor_user
):
    """O app pode perder o token local (reinstalação) — o mesmo aparelho retoma."""
    test_counting_list.list_status = 'EM_CONTAGEM'
    antigo = _com_lease(test_counting_list, db_session, device="dev-aaa")

    resp = asyncio.run(checkout_counting_list(
        list_id=test_counting_list.id,
        payload={"device_id": "dev-aaa"},
        db=db_session,
        current_user=test_supervisor_user,
    ))
    assert resp["lease_token"] != str(antigo)


def test_05_supervisor_libera_lease_a_forca(
    db_session, test_counting_list, test_supervisor_user
):
    """Escape hatch obrigatório: sem ele, aparelho perdido congela a lista."""
    _com_lease(test_counting_list, db_session)

    resp = asyncio.run(release_counting_list(
        list_id=test_counting_list.id,
        lease_token=None,
        db=db_session,
        current_user=test_supervisor_user,
    ))

    assert resp["forcado"] is True
    assert test_counting_list.lease_token is None

    evento = db_session.query(CountingListHandoffHistory).filter(
        CountingListHandoffHistory.list_id == test_counting_list.id,
        CountingListHandoffHistory.evento == 'LEASE_LIBERADO',
    ).first()
    assert evento is not None, "liberação forçada tem que ficar no histórico"


def test_05_operator_nao_libera_lease_de_outro(
    db_session, test_counting_list, test_operator_user
):
    _com_lease(test_counting_list, db_session)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(release_counting_list(
            list_id=test_counting_list.id,
            lease_token=None,
            db=db_session,
            current_user=test_operator_user,
        ))
    assert exc.value.status_code == 403


# ==========================================================================
# 0.2 — a lacuna descoberta em 06/08: o endpoint que a TELA usa
# ==========================================================================

def test_02_endpoint_da_tela_de_contagem_tambem_projeta(
    db_session, test_counting_list, test_operator_user, test_supervisor_user
):
    """`GET /counting-lists/{id}/products` (app/main.py) é o endpoint que a tela
    de contagem usa via `listarItens` — e ficou de fora da primeira
    implementação do 0.2, que só cobriu os três de counting_lists.py.

    Este teste trava a regra no formato do payload daquele endpoint, que tem
    nomes próprios (`system_qty`, `counted_qty`) e é montado por SQL cru.
    """
    payload_do_endpoint = {
        "id": str(uuid4()),
        "product_code": "000001",
        "system_qty": 999.0,
        "expected_quantity": 999.0,
        "counted_qty": 5.0,          # ciclo corrente — NÃO pode sair
        "count_cycle_1": 5.0,
        "zerado_no_fecho": False,
    }
    test_counting_list.current_cycle = 1
    test_counting_list.show_previous_counts = False
    db_session.flush()

    out = aplicar_contagem_cega(dict(payload_do_endpoint), test_operator_user, test_counting_list)
    assert "system_qty" not in out
    assert "expected_quantity" not in out
    assert out["counted_qty"] == 5.0, "o que o operador contou tem que continuar visível"
    assert out["count_cycle_1"] == 5.0

    # Supervisor segue vendo tudo.
    out_sup = aplicar_contagem_cega(dict(payload_do_endpoint), test_supervisor_user, test_counting_list)
    assert out_sup["system_qty"] == 999.0


# ==========================================================================
# Fase 1.5 — teto de itens por lista
# ==========================================================================
# A regra é deliberadamente ASSIMÉTRICA: aviso no desktop, bloqueio no mobile.
# Se alguém "uniformizar" isso um dia, um dos dois testes abaixo cai — e é
# proposital, porque travar o desktop por causa do celular seria transformar
# uma regra de negócio em limitação técnica disfarçada.

from app.api.v1.endpoints.counting_lists import (  # noqa: E402
    obter_teto_itens,
    TETO_ITENS_PADRAO,
    CHAVE_TETO_ITENS,
)
from app.models.models import SystemConfig  # noqa: E402


def test_15_teto_usa_o_padrao_sem_configuracao(db_session):
    assert obter_teto_itens(db_session) == TETO_ITENS_PADRAO


def test_15_teto_le_a_configuracao_do_banco(db_session):
    db_session.add(SystemConfig(id=uuid4(), key=CHAVE_TETO_ITENS, value='500', is_active=True))
    db_session.flush()
    assert obter_teto_itens(db_session) == 500


def test_15_configuracao_invalida_cai_no_padrao(db_session):
    """Config quebrada não pode derrubar a contagem — cai no padrão e loga."""
    db_session.add(SystemConfig(id=uuid4(), key=CHAVE_TETO_ITENS, value='abc', is_active=True))
    db_session.flush()
    assert obter_teto_itens(db_session) == TETO_ITENS_PADRAO


def test_15_checkout_recusa_lista_acima_do_teto(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    """Bloqueio RÍGIDO na porta do mobile."""
    test_counting_list.list_status = 'EM_CONTAGEM'
    # Teto abaixo do que a lista tem (as fixtures criam poucos itens).
    db_session.add(SystemConfig(id=uuid4(), key=CHAVE_TETO_ITENS, value='1', is_active=True))
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(checkout_counting_list(
            list_id=test_counting_list.id,
            payload={"device_id": "dev-aaa"},
            db=db_session,
            current_user=test_supervisor_user,
        ))
    assert _erro(exc) == "LISTA_ACIMA_DO_TETO"
    assert exc.value.detail["teto"] == 1


def test_15_checkout_passa_dentro_do_teto(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    test_counting_list.list_status = 'EM_CONTAGEM'
    db_session.flush()
    resp = asyncio.run(checkout_counting_list(
        list_id=test_counting_list.id,
        payload={"device_id": "dev-aaa"},
        db=db_session,
        current_user=test_supervisor_user,
    ))
    assert resp["lease_token"]


def test_15_desktop_nao_e_bloqueado_pelo_teto(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    """⭐ A assimetria. Adicionar itens acima do teto CONTINUA permitido — o
    desktop não pode ficar travado por uma regra que existe por causa do
    celular. Quem recusa é o checkout (teste acima)."""
    from app.api.v1.endpoints.counting_lists import add_items_to_counting_list
    from app.models.models import InventoryItem

    db_session.add(SystemConfig(id=uuid4(), key=CHAVE_TETO_ITENS, value='1', is_active=True))
    test_counting_list.list_status = 'PREPARACAO'
    # Item do inventário ainda fora de qualquer lista.
    novo = InventoryItem(
        id=uuid4(),
        inventory_list_id=test_counting_list.inventory_id,
        product_code='NOVO-001',
        expected_quantity=10,
        warehouse='01',
        sequence=99,
    )
    db_session.add(novo)
    db_session.flush()

    resultado = asyncio.run(add_items_to_counting_list(
        list_id=test_counting_list.id,
        items=[novo.id],
        db=db_session,
        current_user=test_supervisor_user,
    ))
    assert len(resultado) == 1, "acima do teto o desktop AVISA, não bloqueia"


def test_15_listagem_marca_lista_que_nao_cabe_no_app(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    """O aviso de montar a lista é TRANSITÓRIO. Sem esta marca na listagem, o
    supervisor só descobriria que a lista não cabe no app quando o contador já
    estivesse com o aparelho na mão.

    Quem compara é o SERVIDOR — o teto é configurável, então a regra não pode
    estar escrita na tela.
    """
    from app.api.v1.endpoints.counting_lists import get_inventory_counting_lists

    db_session.add(SystemConfig(id=uuid4(), key=CHAVE_TETO_ITENS, value='1', is_active=True))
    db_session.flush()

    listas = asyncio.run(get_inventory_counting_lists(
        inventory_id=test_counting_list.inventory_id,
        db=db_session,
        current_user=test_supervisor_user,
    ))
    alvo = next(l for l in listas if l["id"] == str(test_counting_list.id))
    assert alvo["acima_do_teto_app"] is True
    assert alvo["teto_itens_app"] == 1


def test_05_supervisor_libera_lease_de_lista_com_contagem_pendente(
    db_session, test_counting_list, test_supervisor_user
):
    """O escape hatch nao pergunta se o aparelho ainda esta contando — nao tem
    como saber. Ele libera, e a consequencia (contagem do aparelho recusada na
    sincronizacao) e assumida pelo supervisor na confirmacao da tela.

    Este teste trava o comportamento: liberar SEMPRE funciona para staff, sem
    depender de estado do aparelho.
    """
    _com_lease(test_counting_list, db_session, device="dev-perdido")

    resp = asyncio.run(release_counting_list(
        list_id=test_counting_list.id,
        lease_token=None,
        db=db_session,
        current_user=test_supervisor_user,
    ))
    assert resp["forcado"] is True
    assert test_counting_list.lease_token is None

    # E a contagem que chegar depois com o token velho e recusada — nao
    # sobrescreve calado.
    with pytest.raises(HTTPException) as exc:
        _validar_captura_offline(
            db=db_session,
            count_data=_captura(lease_token=str(uuid4())),
            counting_list=test_counting_list,
            cycle_number=1,
            item_uuid=uuid4(),
            current_user=test_supervisor_user,
        )
    assert _erro(exc) == "LEASE_INVALIDO"


# ==========================================================================
# Guarda de LOTE (08/08/2026) — o cadastro decide, não o cliente
# ==========================================================================
#
# `has_lot_control` saía de `count_data.lot_counts`. Um cliente que não
# implementa lote (o app, até hoje) mandava `{quantity}` e o produto rastreado
# virava UMA contagem com `lot_number = None`, em silêncio. Estes testes seguram
# a regra no servidor — que é o único lugar que protege um APK antigo já
# instalado em campo.


def _snapshot_do_item(db_session, item, rastro, lotes=()):
    """Cria o snapshot do item com o rastro pedido e, opcionalmente, lotes."""
    db_session.execute(text("""
        INSERT INTO inventario.inventory_items_snapshot (id, inventory_item_id, b1_rastro, created_at)
        VALUES (gen_random_uuid(), :item_id, :rastro, NOW())
    """), {"item_id": str(item.id), "rastro": rastro})
    for numero in lotes:
        db_session.execute(text("""
            INSERT INTO inventario.inventory_lots_snapshot
                (id, inventory_item_id, b8_lotectl, b8_lotefor, b8_saldo, created_at)
            VALUES (gen_random_uuid(), :item_id, :lote, :lote, 10, NOW())
        """), {"item_id": str(item.id), "lote": numero})
    db_session.flush()


def test_lote_produto_rastreado_recusa_contagem_unica(db_session, test_inventory_items):
    """⭐ O buraco: `{quantity}` num produto com lote gravava lot_number=None."""
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "L", lotes=["L001", "L002"])

    with pytest.raises(HTTPException) as exc:
        _validar_contagem_por_lote(db_session, item.id, item.product_code, None)

    assert exc.value.status_code == 400
    assert exc.value.detail["erro"] == "CONTAGEM_EXIGE_LOTE"


def test_lote_produto_rastreado_aceita_quando_vem_com_lote(db_session, test_inventory_items):
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "L", lotes=["L001"])

    # Não deve levantar.
    _validar_contagem_por_lote(
        db_session, item.id, item.product_code,
        [SimpleNamespace(lot_number="L001", quantity=5)],
    )


def test_lote_produto_sem_rastro_segue_livre(db_session, test_inventory_items):
    """Produto normal não pode passar a exigir lote — seria quebrar a contagem."""
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "N")

    _validar_contagem_por_lote(db_session, item.id, item.product_code, None)


def test_lote_rastreado_sem_lote_no_snapshot_nao_bloqueia(db_session, test_inventory_items):
    """Rastreado, mas o recorte não trouxe lote nenhum (todos vencidos na data
    de referência, ou SB8010 vazio).

    Recusar aqui deixaria o item IMPOSSÍVEL de contar. Passa — o rastro fica no
    log, e o problema nesse caso é do snapshot, não da contagem.
    """
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "L")  # sem lotes

    _validar_contagem_por_lote(db_session, item.id, item.product_code, None)


def test_lote_rastro_S_tambem_exige(db_session, test_inventory_items):
    """`b1_rastro` do Protheus é L (lote) ou S (sub-lote) — os dois rastreiam."""
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "S", lotes=["L001"])

    with pytest.raises(HTTPException) as exc:
        _validar_contagem_por_lote(db_session, item.id, item.product_code, None)
    assert exc.value.detail["erro"] == "CONTAGEM_EXIGE_LOTE"


def test_lote_usa_o_SNAPSHOT_e_nao_o_cadastro_de_hoje(db_session, test_inventory_items):
    """⭐ O recorte manda.

    Se o produto passou a controlar lote no Protheus DEPOIS de entrar no
    inventário, a contagem em curso não pode mudar de regra no meio — mesma
    lógica que já vale para o saldo congelado.
    """
    item = test_inventory_items[0]
    _snapshot_do_item(db_session, item, "N")  # no recorte, NÃO tinha lote

    # ...mas o cadastro de hoje diz que tem.
    db_session.execute(text("""
        INSERT INTO inventario.sb1010 (b1_cod, b1_filial, b1_rastro, created_at, updated_at)
        VALUES (:cod, 'ZZ', 'L', NOW(), NOW())
        ON CONFLICT (b1_filial, b1_cod) DO UPDATE SET b1_rastro = 'L'
    """), {"cod": item.product_code})
    db_session.flush()

    # Não deve levantar: vale o que estava congelado.
    _validar_contagem_por_lote(db_session, item.id, item.product_code, None)
