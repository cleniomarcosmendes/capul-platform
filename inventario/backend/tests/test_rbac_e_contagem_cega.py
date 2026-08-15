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


# ==========================================================================
# /warehouses/simple — as duas fontes (07/08/2026)
# ==========================================================================

def test_armazens_preferem_a_tabela_propria(db_session, test_store):
    """Onde `warehouses` tem dados, o comportamento NÃO muda — é o caso de
    produção, e o fallback não pode atropelá-lo."""
    from app.api.v1.endpoints.warehouses import list_warehouses_simple
    from app.models.models import Warehouse

    db_session.add(Warehouse(
        id=uuid4(), code='99', name='ARMAZEM DA TABELA PROPRIA',
        store_id=test_store.id, is_active=True,
    ))
    db_session.flush()

    user = SimpleNamespace(store_id=test_store.id, store_code='01', role='ADMIN')
    out = list_warehouses_simple(store_id=None, db=db_session, current_user=user)

    assert [a['code'] for a in out] == ['99']


def test_armazens_caem_para_szb010_quando_tabela_propria_esta_vazia(db_session):
    """⭐ O caso que o Clenio reportou: a tela mandava "sincronize a hierarquia
    primeiro", ele sincronizava (a szb010 enchia) e a lista seguia vazia, porque
    nada liga a szb010 na `warehouses`.

    Casa por CÓDIGO da filial: com UNIFIED_AUTH o `store_id` do usuário vem de
    `core.filiais`, enquanto `Warehouse.store_id` aponta para
    `inventario.stores` — comparar UUID não acharia nada.
    """
    from app.api.v1.endpoints.warehouses import list_warehouses_simple

    db_session.execute(text("""
        INSERT INTO inventario.szb010 (zb_filial, zb_xlocal, zb_xdesc)
        VALUES ('77', 'A1', 'ARMAZEM UM'), ('77', 'A2', 'ARMAZEM DOIS'),
               ('88', 'B1', 'DE OUTRA FILIAL')
        ON CONFLICT (zb_filial, zb_xlocal) DO NOTHING
    """))
    db_session.flush()

    # Sem linha em `warehouses` para este usuário → cai no espelho do Protheus.
    user = SimpleNamespace(store_id=uuid4(), store_code='77', role='OPERATOR')
    out = list_warehouses_simple(store_id=None, db=db_session, current_user=user)

    assert [a['code'] for a in out] == ['A1', 'A2'], 'deve trazer só a filial do usuário'
    assert out[0]['name'] == 'ARMAZEM UM'


# ==========================================================================
# Espelhos do Protheus — todo ON CONFLICT precisa de UNIQUE (07/08/2026)
# ==========================================================================

def test_espelhos_tem_a_unique_que_o_importador_exige(db_session):
    """⭐ Três vezes no mesmo dia (migrations 016, 017, 018) o código assumiu um
    objeto de schema que nenhuma migration criava. Aqui foi o pior formato:
    `ON CONFLICT (...)` sem UNIQUE correspondente derruba a importação com 500
    NO MEIO do processo, depois de já ter gravado parte.

    Este teste varre as chaves que `import_produtos.py` usa contra as
    restrições reais. Se uma tabela for recriada sem a chave natural — foi
    exatamente o que aconteceu com sb8010, que perdeu a PK composta para um
    `id` substituto — ele acusa antes de a importação quebrar em produção.
    """
    esperado = {
        'sb1010': ['b1_filial', 'b1_cod'],
        'sb2010': ['b2_filial', 'b2_cod', 'b2_local'],
        'sb8010': ['b8_filial', 'b8_produto', 'b8_local', 'b8_lotectl'],
        'sbz010': ['bz_filial', 'bz_cod'],
        'slk010': ['slk_filial', 'slk_codbar', 'slk_produto'],
    }

    reais = db_session.execute(text("""
        SELECT c.relname, string_agg(a.attname, ',' ORDER BY k.ord)
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        WHERE n.nspname = 'inventario' AND (i.indisunique OR i.indisprimary)
        GROUP BY c.relname, i.indexrelid
    """)).fetchall()

    por_tabela: dict[str, set[str]] = {}
    for tabela, cols in reais:
        por_tabela.setdefault(tabela, set()).add(cols)

    faltando = [
        f"{tabela} ({','.join(cols)})"
        for tabela, cols in esperado.items()
        if ','.join(cols) not in por_tabela.get(tabela, set())
    ]
    assert not faltando, (
        'Tabela(s) sem a UNIQUE que o ON CONFLICT do importador exige: '
        + '; '.join(faltando)
        + '. A importação de produtos vai falhar com InvalidColumnReference.'
    )


def test_importador_preenche_toda_coluna_obrigatoria_dos_espelhos(db_session):
    """⭐ A outra metade do drift dos espelhos.

    A 016/017/018 cobriram "objeto de schema que falta". Este cobre o inverso:
    coluna NOT NULL **sem default** que o importador nunca preenche — o INSERT
    estoura com NotNullViolation NO MEIO da importação, com tudo já processado
    até ali. Foi o caso de `slk010.product_id`/`store_id`, FKs de um modelo
    nativo anterior numa tabela que hoje é espelho do Protheus.

    A lista abaixo é a das colunas que `import_produtos.py` realmente informa
    em cada INSERT. Se alguém tornar uma coluna obrigatória sem ensinar o
    importador a preenchê-la, isto acusa antes de a importação quebrar.
    """
    fornecidas = {
        'sb1010': ['b1_cod', 'b1_filial', 'b1_codbar', 'b1_desc', 'b1_tipo', 'b1_um',
                   'b1_locpad', 'b1_grupo', 'b1_xcatgor', 'b1_xsubcat', 'b1_xsegmen',
                   'b1_xgrinve', 'b1_rastro', 'created_at', 'updated_at'],
        'sb2010': ['b2_cod', 'b2_filial', 'b2_local', 'b2_qatu', 'b2_qemp', 'b2_reserva',
                   'b2_cm1', 'b2_vatu1', 'b2_xentpos', 'created_at', 'updated_at'],
        'sb8010': ['id', 'b8_produto', 'b8_filial', 'b8_local', 'b8_lotectl', 'b8_lotefor',
                   'b8_numlote', 'b8_dtvalid', 'b8_saldo', 'created_at', 'updated_at'],
        'sbz010': ['bz_cod', 'bz_filial', 'bz_local', 'bz_xlocal1', 'bz_xlocal2',
                   'bz_xlocal3', 'is_active', 'created_at', 'updated_at'],
        'slk010': ['id', 'slk_filial', 'slk_codbar', 'slk_produto', 'is_active',
                   'created_at', 'updated_at'],
    }

    faltando: list[str] = []
    for tabela, cols in fornecidas.items():
        obrigatorias = db_session.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'inventario' AND table_name = :t
              AND is_nullable = 'NO' AND column_default IS NULL
        """), {'t': tabela}).fetchall()
        for (coluna,) in obrigatorias:
            if coluna not in cols:
                faltando.append(f'{tabela}.{coluna}')

    assert not faltando, (
        'Coluna(s) NOT NULL sem default que o importador não preenche: '
        + ', '.join(faltando)
        + '. A importação de produtos vai falhar com NotNullViolation no meio.'
    )


# ==========================================================================
# 4. Contagem cega — as SEIS rotas que passaram batido (/security-review 15/08)
# ==========================================================================
#
# O helper existia e era chamado em 4 lugares; outras 6 rotas devolviam saldo do
# sistema para o OPERATOR sem passar por ele. A mais grave é `my-assignments`: a
# rota que o PRÓPRIO contador chama para saber o que contar, devolvendo o
# `expected_quantity` de cada item ANTES da contagem — bastava digitar o número
# de volta e a contagem deixava de verificar qualquer coisa.
#
# O comentário do próprio helper já previa o risco: "rotas espalhadas entre
# main.py e api/v1/endpoints/. Endpoint novo que devolva saldo por lote precisa
# passar por aqui." A remediação tinha sido feita rota a rota.

from app.api.v1.endpoints.counting_lists import (
    _CAMPOS_SALDO,
    aplicar_contagem_cega,
    mascarar_saldo_dos_lotes,
)

OPERADOR = SimpleNamespace(role="OPERATOR", username="contador", id=uuid4())
SUPERVISOR = SimpleNamespace(role="SUPERVISOR", username="chefe", id=uuid4())
LISTA = SimpleNamespace(current_cycle=1, show_previous_counts=False)


def test_campos_de_valor_e_variance_tambem_somem():
    """⭐ `variance` = contado − esperado. Sozinho ele DEVOLVE o esperado.

    Estes três entraram na tupla em 15/08: o relatório final os expunha, e
    mascarar só `expected_quantity` deixava o saldo reconstruível por subtração.
    """
    for campo in ("variance", "expected_value", "variance_value"):
        assert campo in _CAMPOS_SALDO, f"{campo} precisa sair para o OPERATOR"

    item = {
        "product_code": "P1", "counted_quantity": 8,
        "expected_quantity": 10, "variance": -2,
        "expected_value": 100.0, "variance_value": -20.0,
    }
    aplicar_contagem_cega(item, OPERADOR, LISTA)

    assert item["counted_quantity"] == 8      # o trabalho DELE fica
    assert item["product_code"] == "P1"
    for campo in ("expected_quantity", "variance", "expected_value", "variance_value"):
        assert campo not in item


def test_staff_continua_vendo_tudo():
    """A projeção não pode atrapalhar quem supervisiona — é para isso que ela olha o papel."""
    item = {"expected_quantity": 10, "variance": -2, "expected_value": 100.0}
    aplicar_contagem_cega(item, SUPERVISOR, LISTA)
    assert item["expected_quantity"] == 10
    assert item["variance"] == -2


def test_saldo_por_lote_do_search_product_some():
    """`POST /counting/search-product` devolvia `lots[].balance` (SB8010.b8_saldo).

    Somar os lotes reconstrói o esperado do item. O `lot_number` FICA: o contador
    precisa saber qual lote está contando.
    """
    lots = [
        {"lot_number": "L1", "balance": 30.0, "expiry_date": None},
        {"lot_number": "L2", "balance": 12.0, "expiry_date": None},
    ]
    mascarar_saldo_dos_lotes(lots, OPERADOR, campo="balance")

    assert [l["lot_number"] for l in lots] == ["L1", "L2"]
    assert all("balance" not in l for l in lots)


def test_saldo_por_lote_fica_para_staff():
    lots = [{"lot_number": "L1", "balance": 30.0}]
    mascarar_saldo_dos_lotes(lots, SUPERVISOR, campo="balance")
    assert lots[0]["balance"] == 30.0


def test_rotas_que_expoem_saldo_passam_pela_projecao():
    """Guarda de REGRESSÃO por leitura do fonte.

    Não é teste de comportamento — é a rede que o módulo não tinha: as rotas vivem
    espalhadas entre `main.py` e `api/v1/endpoints/`, e a correção anterior foi
    aplicada uma a uma, deixando seis para trás. Se alguém acrescentar/renomear um
    handler que devolva saldo sem projetar, isto cai.
    """
    from pathlib import Path

    fonte = Path(__file__).resolve().parents[1] / "app" / "main.py"
    texto = fonte.read_text(encoding="utf-8")

    # As 5 rotas que PROJETAM (a 6ª, lists/{id}/discrepancies, é bloqueada por
    # require_staff_role — não tem consumidor no frontend).
    assert texto.count("aplicar_contagem_cega(") >= 6, (
        "alguma rota que devolve saldo deixou de passar pela contagem cega"
    )
    assert 'mascarar_saldo_dos_lotes(lots, current_user, campo="balance")' in texto
    # A divergência por lista é STAFF: expõe saldo, variação e QUEM contou.
    assert 'dependencies=[Depends(require_staff_role)],\n)\nasync def get_inventory_discrepancies' in texto
