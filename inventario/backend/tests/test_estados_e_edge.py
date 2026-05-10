"""
Testes de estados inválidos e edge cases — catálogos D + E (5 cenários)

D. Estados / transições inválidas
   - D1: handoff em inventário CLOSED → 400
   - D2: return em inventário CLOSED → 400

E. Edge cases
   - E1: handoff com 1 item só (não cai em 0 / não trava)
   - E2: handoff zera itens não bipados (regra: "não bipado vira 0 ao liberar")
   - E3: RBAC — OPERATOR tenta devolver → 403
"""

import asyncio
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import (
    InventoryList,
    InventoryStatus,
    CountingList,
    CountingListItem,
)
from app.api.v1.endpoints.counting_lists import (
    handoff_counting_list,
    return_counting_list,
)


def _set_status(counting_list: CountingList, status: str, db: Session):
    counting_list.list_status = status
    db.flush()


# =============================================================================
# CATÁLOGO D — Estados inválidos
# =============================================================================

class TestEstadosInvalidos:

    def test_d1_handoff_em_inventario_closed_falha(
        self, db_session, test_inventory, test_counting_list, test_supervisor_user
    ):
        """D1: inventário CLOSED → não pode mais entregar lista."""
        _set_status(test_counting_list, 'EM_CONTAGEM', db_session)
        test_inventory.status = InventoryStatus.CLOSED
        db_session.flush()

        with pytest.raises(HTTPException) as exc:
            asyncio.run(handoff_counting_list(
                test_counting_list.id, db_session, test_supervisor_user
            ))

        assert exc.value.status_code in (400, 403, 409)

    def test_d2_return_em_inventario_closed_falha(
        self, db_session, test_inventory, test_counting_list, test_supervisor_user
    ):
        """D2: inventário CLOSED → não pode mais devolver."""
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)
        test_inventory.status = InventoryStatus.CLOSED
        db_session.flush()

        with pytest.raises(HTTPException) as exc:
            asyncio.run(return_counting_list(
                test_counting_list.id,
                payload={},
                db=db_session,
                current_user=test_supervisor_user,
            ))

        assert exc.value.status_code in (400, 403, 409)


# =============================================================================
# CATÁLOGO E — Edge cases
# =============================================================================

class TestEdgeCases:

    def test_e1_handoff_lista_com_1_item(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """E1: lista com 1 item só — handoff funciona normal."""
        _set_status(test_counting_list, 'EM_CONTAGEM', db_session)
        # Remove 4 dos 5 itens (deixa só items[0])
        for it in test_counting_list_items[1:]:
            db_session.delete(it)
        db_session.flush()
        test_counting_list_items[0].count_cycle_1 = Decimal("10")
        db_session.flush()

        result = asyncio.run(handoff_counting_list(
            test_counting_list.id, db_session, test_supervisor_user
        ))

        assert result["status"] == 'AGUARDANDO_REVISAO'

    def test_e2_handoff_zera_itens_nao_bipados(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_supervisor_user
    ):
        """E2: ao entregar, itens com count_cycle_1=NULL viram 0 (regra documentada
        em memory/feedback_inventario_handoff_supervisor.md)."""
        _set_status(test_counting_list, 'EM_CONTAGEM', db_session)
        # Conta apenas 2 dos 5 itens
        test_counting_list_items[0].count_cycle_1 = Decimal("10")
        test_counting_list_items[1].count_cycle_1 = Decimal("20")
        # items[2..4] ficam NULL
        db_session.flush()

        result = asyncio.run(handoff_counting_list(
            test_counting_list.id, db_session, test_supervisor_user
        ))

        for it in test_counting_list_items:
            db_session.refresh(it)

        # 3 não-bipados foram zerados
        assert result["zerados"] == 3
        assert test_counting_list_items[0].count_cycle_1 == Decimal("10")  # original mantido
        assert test_counting_list_items[1].count_cycle_1 == Decimal("20")  # original mantido
        assert test_counting_list_items[2].count_cycle_1 == Decimal("0")  # zerado
        assert test_counting_list_items[3].count_cycle_1 == Decimal("0")  # zerado
        assert test_counting_list_items[4].count_cycle_1 == Decimal("0")  # zerado

    def test_e3_operator_nao_pode_devolver(
        self, db_session, test_inventory, test_counting_list,
        test_counting_list_items, test_operator_user
    ):
        """E3: RBAC — OPERATOR não pode devolver lista (só ADMIN/SUPERVISOR)."""
        _set_status(test_counting_list, 'AGUARDANDO_REVISAO', db_session)

        with pytest.raises(HTTPException) as exc:
            asyncio.run(return_counting_list(
                test_counting_list.id,
                payload={},
                db=db_session,
                current_user=test_operator_user,
            ))

        assert exc.value.status_code == 403
        assert 'ADMIN' in str(exc.value.detail) or 'SUPERVISOR' in str(exc.value.detail)
