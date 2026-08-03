"""
Fumaça do Inventário — a única suíte automatizada do módulo até 02/08/2026.

Contexto: os dois arquivos `test_*.py` que existiam aqui eram SCRIPTS de diagnóstico
(nenhum `assert`, `print()` e chamada à API de PRODUÇÃO do Protheus). O pytest os
coletava e a suíte terminava com erro de fixture; renomeados para `diag_*`, a suíte
ficou vazia e o pytest passou a sair com código 5.

O que isto cobre é deliberadamente raso: garante que o app IMPORTA e que a rota de
health responde. É pouco, mas pega a classe de quebra mais comum e mais cara —
import quebrado por dependência/rota duplicada, que só apareceria no boot do
container. Cobertura de regra de negócio continua pendente.
"""
from fastapi.testclient import TestClient

import app.main as main


def test_app_importa_e_expoe_rotas():
    """O app sobe e tem rotas registradas."""
    assert main.app is not None
    rotas = {getattr(r, "path", None) for r in main.app.routes}
    assert "/health" in rotas, "rota /health sumiu do app"


def test_health_responde():
    """
    /health responde. Aceita 200 (ok/degraded) e 503 (DB fora) — o teste é sobre a
    rota EXISTIR e responder, não sobre a infraestrutura estar de pé, senão ele
    falharia fora do container só por não ter banco.
    """
    with TestClient(main.app) as client:
        r = client.get("/health")
    assert r.status_code in (200, 503), f"status inesperado: {r.status_code}"
    assert "status" in r.json()
