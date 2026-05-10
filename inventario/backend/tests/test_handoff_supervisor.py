"""
Testes de handoff supervisor — catálogo C (8 cenários)

C. Liberar / Devolver / Encerrar
   - C1: handoff muda EM_CONTAGEM → AGUARDANDO_REVISAO
   - C2: return TOTAL (sem item_ids) marca todos os contados com revisar=true
   - C3: return PARCIAL com item_ids → marca SÓ esses
   - C4: REGRESSÃO 09/05 — return TOTAL → return PARCIAL: limpa flags antes (bug 1)
   - C5: REGRESSÃO 09/05 — sync_cycle limpa revisar_no_ciclo (bug 2)
   - C6: handoff_history registra DEVOLVIDA com itens_devolvidos
   - C7: return em lista fora de AGUARDANDO_REVISAO → 400
   - C8: handoff em lista fora de EM_CONTAGEM → 400

Chama os handlers dos endpoints diretamente (não via HTTP) — mesmo padrão dos
testes existentes. asyncio.run para os async functions.
"""

import asyncio
from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import (
    InventoryList,
    CountingList,
    CountingListItem,
    CountingListHandoffHistory,
)
from app.api.v1.endpoints.counting_lists import (
    handoff_counting_list,
    return_counting_list,
)
from app.main import sync_cycle_between_tables


def _set_status(counting_list: CountingList, status: str, db: Session):
    counting_list.list_status = status
    db.flush()


def _contar_itens(items, valores, db, ciclo=1):
    """Helper: marca count_cycle_N + status COUNTED nos N primeiros itens."""
    for item, count in zip(items, valores):
        if count is None:
            continue
        setattr(item, f"count_cycle_{ciclo}", Decimal(str(count)))
    db.flush()


# =============================================================================
# CATÁLOGO C — Handoff Supervisor
# =============================================================================

class TestHandoffSupervisor:

    def test_c1_handoff_muda_status_para_aguardando_revisao(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C1: handoff (contador entrega) muda EM_CONTAGEM → AGUARDANDO_REVISAO."""
        _set_status(test_counting_list, 'EM_CONTAGEM', db_session)
        _contar_itens(test_counting_list_items, [10, 20, 30, 40, 50], db_session)

        result = asyncio.run(handoff_counting_list(
            test_counting_list.id, db_session, test_supervisor_user
        ))

        db_session.refresh(test_counting_list)
        assert test_counting_list.list_status == 'AGUARDANDO_REVISAO'
        assert result["status"] == 'AGUARDANDO_REVISAO'
        assert test_counting_list.entregue_por_id == test_supervisor_user.id

    def test_c2_return_total_marca_todos_contados(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C2: return TOTAL (sem item_ids) marca todos os itens contados no ciclo."""
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        # 4 contados, 1 NULL
        _contar_itens(test_counting_list_items, [10, 20, 30, 40, None], db_session)

        result = asyncio.run(return_counting_list(
            test_counting_list.id,
            payload={"motivo": "Conferir setor"},
            db=db_session,
            current_user=test_supervisor_user,
        ))

        for it in test_counting_list_items:
            db_session.refresh(it)

        # 4 contados foram marcados, 1 NULL não foi
        marcados = [it.revisar_no_ciclo for it in test_counting_list_items]
        assert marcados == [True, True, True, True, False]
        assert result["itens_marcados"] == 4
        assert result["parcial"] is False

        db_session.refresh(test_counting_list)
        assert test_counting_list.list_status == 'EM_CONTAGEM'

    def test_c3_return_parcial_marca_so_selecionados(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C3: return PARCIAL com item_ids específicos → SÓ esses ficam marcados."""
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        _contar_itens(test_counting_list_items, [10, 20, 30, 40, 50], db_session)

        # Selecionar só os items[1] e items[3] (inventory_item_id deles)
        ids_selecionados = [
            str(test_counting_list_items[1].inventory_item_id),
            str(test_counting_list_items[3].inventory_item_id),
        ]

        result = asyncio.run(return_counting_list(
            test_counting_list.id,
            payload={"motivo": "Verificar lote", "item_ids": ids_selecionados},
            db=db_session,
            current_user=test_supervisor_user,
        ))

        for it in test_counting_list_items:
            db_session.refresh(it)

        marcados = [it.revisar_no_ciclo for it in test_counting_list_items]
        assert marcados == [False, True, False, True, False]
        assert result["itens_marcados"] == 2
        assert result["parcial"] is True

    def test_c4_REGRESSAO_total_seguido_parcial_limpa_antes(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C4: REGRESSÃO bug 09/05/2026 (commit 090efd8).

        Cenário do INV_04:
          1. Supervisor devolve TOTAL (todos itens marcados)
          2. Contador re-libera (sem alterar)
          3. Supervisor devolve PARCIAL com 2 itens

        Esperado: SÓ os 2 itens da segunda devolução ficam marcados.
        Antes do fix: 100% ficavam marcados (acumulava).
        """
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        _contar_itens(test_counting_list_items, [10, 20, 30, 40, 50], db_session)

        # 1. Devolução TOTAL
        asyncio.run(return_counting_list(
            test_counting_list.id,
            payload={"motivo": "Total"},
            db=db_session,
            current_user=test_supervisor_user,
        ))
        for it in test_counting_list_items:
            db_session.refresh(it)
        assert all(it.revisar_no_ciclo is True for it in test_counting_list_items)

        # 2. Contador re-libera (status volta a AGUARDANDO_REVISAO)
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)

        # 3. Devolução PARCIAL com 2 itens
        ids_selecionados = [
            str(test_counting_list_items[0].inventory_item_id),
            str(test_counting_list_items[2].inventory_item_id),
        ]
        asyncio.run(return_counting_list(
            test_counting_list.id,
            payload={"motivo": "Parcial", "item_ids": ids_selecionados},
            db=db_session,
            current_user=test_supervisor_user,
        ))
        for it in test_counting_list_items:
            db_session.refresh(it)

        # Esperado: SÓ os 2 ficaram marcados, os outros foram LIMPOS
        marcados = [it.revisar_no_ciclo for it in test_counting_list_items]
        assert marcados == [True, False, True, False, False], \
            "REGRESSÃO bug 1: devolução parcial não limpou flags da total anterior"

    def test_c5_REGRESSAO_sync_cycle_limpa_revisar_no_ciclo(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C5: REGRESSÃO bug 09/05/2026 (commit 48f95e8).

        Quando avança o ciclo (sync_cycle_between_tables), todas as flags
        revisar_no_ciclo do ciclo anterior devem ser LIMPAS.

        Antes do fix: revisar_no_ciclo=true ficava pendurado e o frontend
        partialReviewMode forçava filtro 'revisar', escondendo itens válidos
        do novo ciclo.
        """
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        # 3 itens marcados pra revisar do ciclo 1
        for it in test_counting_list_items[:3]:
            it.revisar_no_ciclo = True
            it.motivo_revisao = "Conferir lote"
        db_session.flush()

        marcados_antes = sum(1 for it in test_counting_list_items if it.revisar_no_ciclo)
        assert marcados_antes == 3, "setup: 3 marcados antes do avanço"

        # Avança ciclo (1 → 2)
        sync_cycle_between_tables(db_session, str(test_inventory.id), 2)

        for it in test_counting_list_items:
            db_session.refresh(it)

        marcados_depois = sum(1 for it in test_counting_list_items if it.revisar_no_ciclo)
        assert marcados_depois == 0, \
            "REGRESSÃO bug 2: sync_cycle deve limpar revisar_no_ciclo do ciclo anterior"

        # motivo_revisao também limpo
        motivos = [it.motivo_revisao for it in test_counting_list_items]
        assert all(m is None for m in motivos)

    def test_c6_handoff_history_grava_devolvida_com_itens(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C6: tabela counting_list_handoff_history registra evento DEVOLVIDA
        com observacao + itens_devolvidos (JSONB).
        """
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        _contar_itens(test_counting_list_items, [10, 20, 30, 40, 50], db_session)

        ids_selecionados = [
            str(test_counting_list_items[0].inventory_item_id),
            str(test_counting_list_items[2].inventory_item_id),
        ]
        asyncio.run(return_counting_list(
            test_counting_list.id,
            payload={"motivo": "Verificar lote 99X", "item_ids": ids_selecionados},
            db=db_session,
            current_user=test_supervisor_user,
        ))

        history = db_session.query(CountingListHandoffHistory).filter(
            CountingListHandoffHistory.list_id == test_counting_list.id,
            CountingListHandoffHistory.evento == 'DEVOLVIDA',
        ).all()

        assert len(history) == 1
        assert history[0].observacao == "Verificar lote 99X"
        assert history[0].ator_id == test_supervisor_user.id
        assert history[0].ciclo == 1
        # itens_devolvidos é JSONB com a lista
        assert history[0].itens_devolvidos is not None
        assert sorted(history[0].itens_devolvidos) == sorted(ids_selecionados)

    def test_c7_return_lista_fora_de_aguardando_revisao_falha(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """C7: tentar devolver lista que NÃO está em AGUARDANDO_REVISAO → HTTP 400."""
        _set_status(test_counting_list, 'EM_CONTAGEM', db_session)

        with pytest.raises(HTTPException) as exc:
            asyncio.run(return_counting_list(
                test_counting_list.id,
                payload={},
                db=db_session,
                current_user=test_supervisor_user,
            ))

        assert exc.value.status_code == 400
        assert 'AGUARDANDO_REVISAO' in str(exc.value.detail)

    def test_c8_handoff_lista_fora_de_em_contagem_falha(
        self, db_session, test_inventory, test_counting_list,
        test_supervisor_user
    ):
        """C8: tentar handoff (entregar) em lista NÃO em EM_CONTAGEM → HTTP 400."""
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)

        with pytest.raises(HTTPException) as exc:
            asyncio.run(handoff_counting_list(
                test_counting_list.id, db_session, test_supervisor_user
            ))

        assert exc.value.status_code == 400
        assert 'EM_CONTAGEM' in str(exc.value.detail)
