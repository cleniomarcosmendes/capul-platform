"""
Etapa 2 — cobertura que faltava no módulo.

Três frentes que estavam descobertas e sustentam o resto:

  1. **RBAC do OPERATOR** — a contagem cega só é cega se o operador não chega ao
     saldo por NENHUM caminho. O frontend esconde; quem tem que barrar é o
     servidor, senão um `curl` com o JWT dele lê tudo.
  2. **Contagem cega end-to-end** — havia teste unitário do
     `aplicar_contagem_cega`, mas nenhum provando que o payload que SAI do
     endpoint real não traz saldo.
  3. **Sync Protheus** — o `flatten_hierarchy` + a gravação nas colunas que a
     migration 014 alargou. Era exatamente onde quebrava
     (`StringDataRightTruncation`) e ficou ~6 semanas sem ninguém perceber.

⚠️ Rodar por `./run-tests.sh` (tests/ está no .dockerignore).
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.core.security import require_staff_role
from app.models.models import UserRole
from app.main import get_list_products
from app.api.v1.endpoints.sync_protheus import flatten_hierarchy, sync_table


# ==========================================================================
# 1. RBAC do OPERATOR
# ==========================================================================

@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.SUPERVISOR, "ADMIN", "SUPERVISOR"])
def test_staff_passa_como_enum_e_como_string(role):
    """Aceita as DUAS formas de propósito.

    `UserRole` é `(str, Enum)`, então a comparação com string funciona — mas com
    UNIFIED_AUTH o papel vem do JWT como string pura, e é esse o caminho de
    produção. Se alguém trocar `UserRole` por um Enum comum um dia, o staff
    passaria a tomar 403 e este teste cai antes de ir para produção.
    """
    user = SimpleNamespace(role=role, username="fulano")
    assert require_staff_role(user) is user


@pytest.mark.parametrize("role", [UserRole.OPERATOR, "OPERATOR"])
def test_operator_e_barrado(role):
    with pytest.raises(HTTPException) as exc:
        require_staff_role(SimpleNamespace(role=role, username="operador"))
    assert exc.value.status_code == 403
    assert "contagem cega" in str(exc.value.detail).lower()


def test_papel_desconhecido_e_barrado():
    """Falha FECHADA: papel que ninguém previu não vira staff por acidente."""
    for role in (None, "", "VISITANTE", "admin"):  # 'admin' minúsculo não passa
        with pytest.raises(HTTPException):
            require_staff_role(SimpleNamespace(role=role, username="x"))


# ==========================================================================
# 2. Contagem cega — pelo ENDPOINT, não pelo helper
# ==========================================================================

@pytest.mark.asyncio
async def test_endpoint_nao_entrega_saldo_ao_operator(
    db_session, test_counting_list, test_counting_list_items, test_operator_user
):
    """E2E pelo endpoint que a TELA realmente usa (`/counting-lists/{id}/products`).

    O teste unitário do helper não bastava — o endpoint monta o dicionário em
    vários pontos e calcula `finalQuantity` A PARTIR do `expected_quantity`, o
    que já quase produziu regressão (o cálculo precisa vir ANTES da projeção).
    """
    resp = await get_list_products(
        list_id=str(test_counting_list.id),
        show_all=True,
        current_user=test_operator_user,
        db=db_session,
    )
    produtos = resp["data"]["products"]
    assert produtos, "fixture precisa ter itens para o teste valer"

    for p in produtos:
        assert "expected_quantity" not in p, f"saldo vazou para o OPERATOR: {p}"
        assert "system_qty" not in p
        # o ciclo CORRENTE tem que continuar: é dele que a tela deriva o que já
        # foi contado. Sem isso todo item volta a aparecer como pendente.
        assert "count_cycle_1" in p


@pytest.mark.asyncio
async def test_endpoint_entrega_saldo_ao_supervisor(
    db_session, test_counting_list, test_counting_list_items, test_supervisor_user
):
    resp = await get_list_products(
        list_id=str(test_counting_list.id),
        show_all=True,
        current_user=test_supervisor_user,
        db=db_session,
    )
    produtos = resp["data"]["products"]
    assert produtos
    assert all("expected_quantity" in p for p in produtos)


# ==========================================================================
# 3. Sync Protheus — o que a migration 014 destravou
# ==========================================================================

# Formato de PRODUÇÃO: códigos de 6 dígitos e descrições longas. Era isto que
# estourava as colunas varchar(4)/varchar(30) dimensionadas por HOMOLOGAÇÃO.
HIERARQUIA_PRODUCAO = [
    {
        "bm_grupo": "003687",
        "bm_desc": "MEDICAMENTOS VETERINARIOS DE USO RESTRITO E CONTROLADO",
        "categoria": [
            {
                "zd_xcod": "004512",
                "zd_xdesc": "ANTIBIOTICOS INJETAVEIS DE AMPLO ESPECTRO",
                "subcategoria": [
                    {
                        "ze_xcod": "005998",
                        "ze_xdesc": "EQUINOS E MUARES - LINHA HOSPITALAR",
                        "segmento": [
                            {"zf_xcod": "580068", "zf_xdesc": "ANESTESICO GERAL INJETAVEL"},
                        ],
                    }
                ],
            }
        ],
    }
]


def test_flatten_hierarchy_achata_os_quatro_niveis():
    grupos, categorias, subcategorias, segmentos = flatten_hierarchy(HIERARQUIA_PRODUCAO)

    assert grupos == [{"bm_grupo": "003687", "bm_desc": HIERARQUIA_PRODUCAO[0]["bm_desc"]}]
    assert categorias[0]["zd_xcod"] == "004512"
    assert subcategorias[0]["ze_xcod"] == "005998"
    assert segmentos[0]["zf_xcod"] == "580068"


def test_flatten_hierarchy_aguenta_niveis_ausentes():
    """A API não devolve `categoria`/`subcategoria`/`segmento` para todo grupo —
    o achatamento não pode explodir com KeyError."""
    grupos, categorias, subcategorias, segmentos = flatten_hierarchy(
        [{"bm_grupo": "000001", "bm_desc": "SEM FILHOS"}]
    )
    assert len(grupos) == 1
    assert categorias == [] and subcategorias == [] and segmentos == []


def test_sync_grava_codigo_de_6_digitos_sem_truncar(db_session):
    """⭐ A regressão que a migration 014 corrigiu.

    As colunas eram `varchar(4)`/`varchar(30)`, dimensionadas pelos dados de
    HOMOLOGAÇÃO. O Protheus de PRODUÇÃO devolve código de 6 dígitos e descrição
    longa → `StringDataRightTruncation`, e a sincronização morria.

    Se alguém reverter a 014 (ou criar a tabela do zero com o tamanho antigo),
    este teste cai — em vez de o sync quebrar em produção sem aviso.
    """
    grupos, categorias, _, _ = flatten_hierarchy(HIERARQUIA_PRODUCAO)

    sync_table(db_session, "sbm010", grupos, "bm_grupo", "bm_desc")
    sync_table(db_session, "szd010", categorias, "zd_xcod", "zd_xdesc")
    db_session.flush()

    gravado = db_session.execute(
        text("SELECT bm_grupo, bm_desc FROM inventario.sbm010 WHERE bm_grupo = :c"),
        {"c": "003687"},
    ).fetchone()
    assert gravado is not None, "grupo de 6 dígitos não foi gravado"
    assert gravado[0] == "003687", "código truncado"
    assert gravado[1] == HIERARQUIA_PRODUCAO[0]["bm_desc"], "descrição truncada"


def test_colunas_do_mercadologico_estao_alargadas(db_session):
    """Trava o efeito da 014 no SCHEMA, não só no comportamento — se o banco
    for recriado sem ela, isto acusa direto."""
    larguras = dict(
        db_session.execute(text("""
            SELECT table_name || '.' || column_name, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'inventario'
              AND (table_name, column_name) IN (
                ('sbm010','bm_grupo'), ('sbm010','bm_desc'),
                ('szd010','zd_xcod'),  ('szf010','zf_xdesc')
              )
        """)).fetchall()
    )
    assert larguras["sbm010.bm_grupo"] >= 20, "migration 014 não aplicada"
    assert larguras["sbm010.bm_desc"] >= 100
    assert larguras["szd010.zd_xcod"] >= 20
    assert larguras["szf010.zf_xdesc"] >= 100
