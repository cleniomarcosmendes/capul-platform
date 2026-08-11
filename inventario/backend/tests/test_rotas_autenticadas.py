"""
Nenhuma rota de operação pode ficar anônima.

⚠️ Origem (revisão de segurança de 11/08/2026): dois routers estavam montados
**sem** `dependencies=[...]` e com rotas que não declaravam usuário —
`POST /api/v1/assignments/.../assign-by-criteria` (atribui produtos em massa),
`GET /api/v1/assignments/.../available-users` (lista gente) e **as cinco** de
`/api/v1/lot-draft/`, incluindo `DELETE .../clear-all-drafts`, que apaga todos
os rascunhos de lote do inventário. O nginx proxia os dois prefixos, então
rodavam abertas de fora.

É a **terceira** vez que este módulo tropeça na mesma pedra: antes foram as 4
rotas de `/api/v1/import/*` (que gravavam em SB1010/SB2010 sem token). A lição
que este arquivo grava: *proteger rota a rota depende de cada uma lembrar* — e
uma sempre esquece. O teste olha o app MONTADO, que é a verdade do que está no
ar, e não o código-fonte de um endpoint isolado.

⚠️ Rodar por `./run-tests.sh` (tests/ está no .dockerignore).
"""

import pytest
from fastapi.dependencies.utils import get_flat_dependant

from app.main import app
from app.core.security import (
    get_current_active_user,
    get_current_user,
    require_staff_role,
)

# Callables que constituem "esta rota exige alguém autenticado".
AUTENTICADORES = {get_current_active_user, get_current_user, require_staff_role}

# Prefixos cujas rotas mexem em dado de inventário. Acrescentar aqui é de graça;
# esquecer é o defeito que este arquivo existe para pegar.
PREFIXOS_PROTEGIDOS = (
    "/api/v1/assignments",
    "/api/v1/lot-draft",
    "/api/v1/import/",
    "/api/v1/cycles",
    "/api/v1/stores",
)


def _exige_autenticacao(route) -> bool:
    """A rota (ou o mount dela) exige credencial?

    O sinal é `security_requirements` do dependant ACHATADO — é onde o FastAPI
    consolida os esquemas de segurança (aqui, `HTTPBearer`) vindos de QUALQUER
    profundidade: do `include_router(dependencies=[...])`, da assinatura do
    endpoint ou de dentro de outra dependência.

    ⚠️ Não procurar por nome de função: `get_flat_dependant()` **não** achata em
    `.dependencies` (essa lista sai vazia), e comparar `dep.call` só na raiz
    perde tudo que está aninhado. Foi a primeira versão deste teste, e ela
    acusou de anônimas rotas que estavam protegidas — falso positivo que teria
    mandado consertar o que não estava quebrado.

    Como o `HTTPBearer` só entra por uma das dependências de autenticação do
    módulo, exigir a presença dele equivale a exigir usuário — e continua
    valendo se amanhã surgir um autenticador novo.
    """
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return False
    flat = get_flat_dependant(dependant, skip_repeats=False)
    if flat.security_requirements:
        return True
    # Rede: dependência declarada direto na rota, sem esquema de segurança.
    chamadas = {d.call for d in dependant.dependencies if d.call is not None}
    return bool(chamadas & AUTENTICADORES)


def _rotas_dos_prefixos():
    for route in app.routes:
        caminho = getattr(route, "path", "")
        if caminho.startswith(PREFIXOS_PROTEGIDOS):
            yield route


def test_ha_rotas_para_conferir():
    """Sanidade: se os routers deixarem de ser montados, o teste abaixo passaria
    vazio e daria falsa aprovação — exatamente o tipo de silêncio que causou o
    problema original."""
    rotas = list(_rotas_dos_prefixos())
    assert rotas, "nenhuma rota nos prefixos protegidos — o app montou diferente do esperado"


def test_nenhuma_rota_de_operacao_fica_anonima():
    anonimas = [
        f"{sorted(r.methods)[0]} {r.path}"
        for r in _rotas_dos_prefixos()
        if not _exige_autenticacao(r)
    ]
    assert not anonimas, (
        "rotas SEM autenticação (o nginx proxia estes prefixos — ficam abertas de fora):\n  "
        + "\n  ".join(sorted(anonimas))
    )


@pytest.mark.parametrize(
    "caminho",
    [
        "/api/v1/lot-draft/inventory/{inventory_id}/clear-all-drafts",
        "/api/v1/assignments/inventory/{inventory_id}/assign-by-criteria",
        "/api/v1/assignments/inventory/{inventory_id}/available-users",
    ],
)
def test_rotas_do_incidente_seguem_protegidas(caminho):
    """As três nominalmente citadas na revisão. Se alguém remover o
    `dependencies` do mount, é aqui que aparece — com o nome da rota."""
    rota = next((r for r in app.routes if getattr(r, "path", "") == caminho), None)
    assert rota is not None, f"rota sumiu do app: {caminho}"
    assert _exige_autenticacao(rota), f"voltou a ficar anônima: {caminho}"
