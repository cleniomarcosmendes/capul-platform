# Onde paramos — Inventário / contagem offline

*Fechado em 05/08/2026, fim do dia. Para retomar em 06/08.*

Plano completo: `docs/PLANO_INVENTARIO_MOBILE_OFFLINE_FASE0.md`

---

## Estado em uma linha

**A Fase 0 está IMPLEMENTADA e verde no DEV.** Suíte do Inventário passou de
**31 → 55 testes**, todos passando. Nada foi pushado.

---

## O que foi feito hoje

### Migration 015 — aplicada no DEV
`inventario/database/migrations/015_add_offline_count_tracking.sql`

| Tabela | Colunas |
|---|---|
| `countings` | `idempotency_key` (índice único parcial), `counted_at_client` |
| `counting_list_items` | `zerado_no_fecho` |
| `counting_lists` | `lease_token`, `lease_device_id`, `lease_user_id`, `lease_at` |

Mais a extensão do CHECK `chk_handoff_evento` para aceitar `LEASE_LIBERADO`.

⚠️ **O Inventário aplica migration à mão** — é o único backend da plataforma sem
job `*-migrate` no startup. A 015 tem que entrar no roteiro de deploy
explicitamente.

### Os cinco itens

| Item | O que entrou | Onde |
|---|---|---|
| **0.1** | `counting_list_id` + `expected_cycle` no request; 409 `CICLO_DIVERGENTE` / `LISTA_DIVERGENTE` | `main.py` → `_validar_captura_offline` |
| **0.2** | Projeção da contagem cega por papel nos 3 endpoints | `counting_lists.py` → `aplicar_contagem_cega` |
| **0.3** | `zerado_no_fecho` marcado no handoff e limpo em contagem nova; `LISTA_NAO_ESTA_EM_CONTAGEM` e `CONTADOR_NAO_ATRIBUIDO` | `counting_lists.py`, `main.py` |
| **0.4** | `idempotency_key` (replay devolve o resultado anterior) e `counted_at_client` (recusa captura fora de ordem) | `main.py` |
| **0.5** | `POST`/`DELETE /counting-lists/{id}/checkout`, validação de lease, escape hatch do supervisor, visibilidade nos endpoints de leitura | `counting_lists.py` |

### Testes
`inventario/backend/tests/test_fase0_contagem_offline.py` — **24 cenários novos**.

⚠️ Rodar com **`inventario/backend/run-tests.sh`**. `tests/` está no
`.dockerignore`, então `pytest` dentro do container coleta só o `test_smoke.py`
da raiz e responde "2 tests" — foi esse engano que gerou a pendência errada de
02/08.

---

## Duas coisas que mudaram de rumo durante a implementação

Vale ler antes de mexer, porque contrariam o que estava escrito antes.

**1. O zero do handoff está CERTO.** A primeira versão do item 0.3 chamava os
zeros de "falsos". Errado: zero é contagem legítima, e o preenchimento é a
semântica de "varri a lista, o que sobrou não achei". O modelo já distingue
`NULL` (não contado) de `0` (contado). **A regra não mudou** — só ganhou rastro
por item. Há dois testes que PROTEGEM o preenchimento, justamente para ninguém
"consertar" isso lendo a versão antiga.

**2. Quase quebrei a contagem cega ao implementá-la.** Remover `count_cycle_N`
do ciclo **corrente** faria todo item voltar a aparecer como pendente — a tela
deriva contados/pendentes da `count_cycle` real, não do status. A projeção
remove apenas ciclos **anteriores**. Há teste dedicado
(`test_02_ciclo_atual_nunca_e_removido`).

---

## Para retomar amanhã

### 1. Frontend web da Fase 0 (não foi feito hoje)
O backend está pronto, mas a web ainda **não** consome nada disso:

- **Passar a enviar** `counting_list_id` + `expected_cycle` no
  `inventoryService.registrarContagem` (`inventory.service.ts:147`). Hoje o
  backend loga WARN a cada contagem legada. Quando a web migrar, tornar os
  campos **obrigatórios** e remover o ramo legado.
- **Tratar o 409 `LISTA_EM_USO_OUTRO_DISPOSITIVO`** com o diálogo de confirmação
  que reenvia com `force: true`.
- **Mostrar o selo do lease** ("Em contagem no aplicativo desde HH:MM") — o
  backend já devolve `lease_ativo`/`lease_device_id`/`lease_user_id`/`lease_at`
  em `/counting-lists/me`, no detalhe da lista e na visão do supervisor.
- **Exibir `zerado_no_fecho`** na revisão do supervisor.

### 2. Decisões ainda em aberto
- **Quantos itens tem uma lista típica em produção, e a maior?** O DEV está com
  as tabelas de inventário vazias (0 listas, 0 produtos), então não deu para
  medir. O teto de 3.000 foi decidido por critério operacional e cabe em
  AsyncStorage (1,9 MB), mas o número real confirma a folga.
- **Teto de 3.000 no `AtribuirProdutosModal`** (Fase 1.5) — ainda não implementado.

### 3. Depois disso
Fase 1 (app multi-módulo) e 1.5 (teto + gerador de listas) podem correr em
paralelo. Fase 2 em diante depende delas.

---

## Como conferir que está tudo de pé

```bash
# 1. Migration aplicada
docker compose exec -T postgres psql -U capul_user -d capul_platform -tAc "
SELECT table_name||'.'||column_name FROM information_schema.columns
WHERE table_schema='inventario' AND (
  (table_name='countings' AND column_name IN ('idempotency_key','counted_at_client')) OR
  (table_name='counting_list_items' AND column_name='zerado_no_fecho') OR
  (table_name='counting_lists' AND column_name LIKE 'lease_%')) ORDER BY 1;"
# esperado: 7 linhas

# 2. Suíte
cd inventario/backend && ./run-tests.sh     # esperado: 55 passed
```

---

## Pendências do módulo que continuam abertas

Independentes desta frente, de `docs/MELHORIAS_BACKLOG.md`:

- **Credencial de produção do Protheus no código** — `config.py:59,:136`,
  `protheus_config.py:118`, mais `docker-compose.yml` e
  `auth-gateway/prisma/seed.ts`. O caminho é **rotacionar no Protheus**
  (depende do Marco); removê-la do código não invalida, porque está no
  histórico do git.
- **7 scripts soltos na raiz** do backend do Inventário.
- Sem cobertura ainda: **sync Protheus** (migration 014), **RBAC do OPERATOR**,
  **contagem cega** end-to-end.
