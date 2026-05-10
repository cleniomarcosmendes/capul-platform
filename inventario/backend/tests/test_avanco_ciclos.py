"""
Testes de avanço de ciclos — catálogos A + B (12 cenários)

A. Transição C1 → C2 (regra: count_1 != expected → vai pro C2)
B. Transição C2 → C3 (regra: count_2 != count_1 → vai pro C3, SEM percentual)

Foca na função `recalculate_discrepancies_for_list` (main.py:11252) que é a
fonte da verdade da regra de avanço. Cada teste:
  1. Configura items com count_1 / count_2 / expected específicos.
  2. Chama recalculate_discrepancies_for_list(cycle=N).
  3. Refresca items.
  4. Asserta needs_count_cycle_(N+1).

Inclui teste de regressão do bug do 5% (09/05/2026): divergência pequena
deveria ir pro C3 (não silenciar como antes).
"""

from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from app.models.models import (
    InventoryList,
    CountingList,
    CountingListItem,
    InventoryItem,
)
from app.main import recalculate_discrepancies_for_list


# =============================================================================
# CATÁLOGO A — Transição C1 → C2
# =============================================================================

class TestC1ToC2:
    """C1 → C2: vai pro C2 SE (count_1 != expected) OU (count_1 IS NULL e needs_count_1)."""

    def test_a1_sem_divergencia_zero_itens_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items, test_inventory_items
    ):
        """A1: todos batem expected → 0 itens vão pro C2."""
        # expected: 10, 20, 30, 40, 50 (do fixture). Conta exatos.
        for item, expected in zip(test_counting_list_items, [10, 20, 30, 40, 50]):
            item.count_cycle_1 = Decimal(str(expected))
        db_session.flush()

        r = recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        for it in test_counting_list_items:
            db_session.refresh(it)

        assert r["products_needing_recount"] == 0
        assert all(it.needs_count_cycle_2 is False for it in test_counting_list_items)

    def test_a2_todos_divergentes_todos_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """A2: todos divergentes → todos vão pro C2."""
        for item, count in zip(test_counting_list_items, [99, 99, 99, 99, 99]):
            item.count_cycle_1 = Decimal(str(count))
        db_session.flush()

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        for it in test_counting_list_items:
            db_session.refresh(it)

        assert all(it.needs_count_cycle_2 is True for it in test_counting_list_items)

    def test_a3_misto_so_divergentes_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """A3: 3 batem, 2 divergem → só os 2 divergentes vão."""
        # expected: 10, 20, 30, 40, 50
        # contagens: 10 (OK), 99 (DIV), 30 (OK), 40 (OK), 99 (DIV)
        contagens = [10, 99, 30, 40, 99]
        for item, count in zip(test_counting_list_items, contagens):
            item.count_cycle_1 = Decimal(str(count))
        db_session.flush()

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        for it in test_counting_list_items:
            db_session.refresh(it)

        precisam = [it.needs_count_cycle_2 for it in test_counting_list_items]
        assert precisam == [False, True, False, False, True]

    def test_a4_count_null_vai_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """A4: count_1 IS NULL e needs_count_1=true → divergência (não bipou).

        Regra: produto pendente do ciclo 1 (NULL) deve ir pro C2 conforme caso 2
        do recalculate_discrepancies_for_list (linha 11302-11305).
        """
        # 3 contados (todos com expected), 2 NULL
        for item, count in zip(test_counting_list_items[:3], [10, 20, 30]):
            item.count_cycle_1 = Decimal(str(count))
        # items[3] e [4] ficam NULL — mas needs_count_cycle_1=True (default fixture)
        db_session.flush()

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        for it in test_counting_list_items:
            db_session.refresh(it)

        assert test_counting_list_items[0].needs_count_cycle_2 is False
        assert test_counting_list_items[3].needs_count_cycle_2 is True   # NULL → vai
        assert test_counting_list_items[4].needs_count_cycle_2 is True

    def test_a5_zero_confirmado_nao_vai_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items, test_inventory_items
    ):
        """A5: expected=0 e count_1 IS NULL → "Zero Confirmado" (não vai pro C2).

        Regra do caso 1 da `recalculate_discrepancies_for_list` (linha 11293-11295):
        produto com qty esperada=0 e campo de contagem vazio é considerado
        confirmação de zero (operador não bipou porque não tem o produto).
        """
        # Override o expected do primeiro item pra 0
        test_inventory_items[0].expected_quantity = Decimal("0")
        # count_1 fica NULL
        db_session.flush()

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[0])
        assert test_counting_list_items[0].needs_count_cycle_2 is False

    def test_a6_zero_esperado_mas_count_positivo_vai_para_c2(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items, test_inventory_items
    ):
        """A6: expected=0 e count_1>0 → divergência (achou produto que não devia)."""
        test_inventory_items[0].expected_quantity = Decimal("0")
        test_counting_list_items[0].count_cycle_1 = Decimal("3")  # achou 3 unidades
        db_session.flush()

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 1,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[0])
        assert test_counting_list_items[0].needs_count_cycle_2 is True


# =============================================================================
# CATÁLOGO B — Transição C2 → C3
# =============================================================================

class TestC2ToC3:
    """C2 → C3: vai pro C3 SOMENTE se C1 != C2 (desempate). SEM percentual."""

    def _setup_cycle_2(self, items, list_obj, db):
        """Helper: marca lista como ciclo 2 e flags pra recontagem."""
        list_obj.current_cycle = 2
        for it in items:
            it.needs_count_cycle_2 = True
        db.flush()

    def test_b1_c1_igual_c2_confirma_nao_vai_para_c3(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """B1: C1 == C2 (mesmo divergente do expected) → confirmado, não vai pro C3.

        Cenário: expected=20, C1=18, C2=18 — operador confirmou divergência.
        Não precisa terceiro contador.
        """
        # items[1]: expected=20, C1=18 (divergiu), C2=18 (confirmou)
        test_counting_list_items[1].count_cycle_1 = Decimal("18")
        test_counting_list_items[1].count_cycle_2 = Decimal("18")
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is False

    def test_b2_c1_diferente_c2_vai_para_c3_desempate(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """B2: C1 != C2 e ambos != expected → desempate, vai pro C3."""
        # items[1]: expected=20, C1=18, C2=22 — divergem entre si E do expected
        test_counting_list_items[1].count_cycle_1 = Decimal("18")
        test_counting_list_items[1].count_cycle_2 = Decimal("22")
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is True

    def test_b3_c2_corrigiu_para_expected_nao_vai_para_c3(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """B3: C1 divergente, C2 == expected (corrigiu) → fica OK, não vai."""
        # items[1]: expected=20, C1=18 (divergiu), C2=20 (corrigiu)
        test_counting_list_items[1].count_cycle_1 = Decimal("18")
        test_counting_list_items[1].count_cycle_2 = Decimal("20")
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is False

    def test_b4_c2_null_e_needs_recount_vai_para_c3(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """B4: needs_count_2=true e count_2 IS NULL (não bipou) → vai pro C3.

        Caso 4 do recalculate_discrepancies_for_list (linha 11390-11393).
        """
        # items[1]: expected=20, C1=18 (era divergente do C1), C2=NULL (não bipou)
        test_counting_list_items[1].count_cycle_1 = Decimal("18")
        test_counting_list_items[1].count_cycle_2 = None
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is True

    def test_b5_REGRESSAO_divergencia_pequena_3pct_vai_para_c3(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items
    ):
        """B5: REGRESSÃO bug 5% (09/05/2026).

        Antes do fix, este caso ficava silenciado:
          expected=100, C1=98, C2=98 — diferença 2% < 5% → não ia pro C3.

        Regra correta: C1 != C2 → vai. Como C1 == C2 mas != expected, o caso
        cai em "confirmado" (caso 2) → não vai. Mas se fosse 98 vs 99 (C1 != C2
        com diferença pequena), AGORA tem que ir pro C3.

        Cenário: expected=20 (do fixture), C1=18, C2=19 — diferença 1 (5.5%
        sobre 18, ou 5% sobre 20 — borderline antigo). Com regra direta C1!=C2,
        VAI pro C3.
        """
        # items[1]: expected=20, C1=18, C2=19 — pequena divergência entre C1 e C2
        test_counting_list_items[1].count_cycle_1 = Decimal("18")
        test_counting_list_items[1].count_cycle_2 = Decimal("19")
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is True, \
            "REGRESSÃO bug 5%: divergência pequena entre C1 e C2 deve ir pro C3"

    def test_b6_zero_confirmado_em_c2_nao_vai_para_c3(
        self, db_session, test_inventory, test_counting_list, test_counting_list_items, test_inventory_items
    ):
        """B6: expected=0 e count_2 IS NULL → zero confirmado no C2, não vai."""
        test_inventory_items[1].expected_quantity = Decimal("0")
        test_counting_list_items[1].count_cycle_1 = None  # não tinha no C1 também
        test_counting_list_items[1].count_cycle_2 = None  # confirmado vazio no C2
        self._setup_cycle_2([test_counting_list_items[1]], test_counting_list, db_session)

        recalculate_discrepancies_for_list(
            db_session, str(test_counting_list.id), 2,
            str(test_inventory.created_by), str(test_inventory.id)
        )
        db_session.refresh(test_counting_list_items[1])
        assert test_counting_list_items[1].needs_count_cycle_3 is False
