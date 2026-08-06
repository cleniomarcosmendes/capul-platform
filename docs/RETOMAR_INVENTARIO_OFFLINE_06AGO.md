# Onde paramos — Inventário / contagem offline

*Aberto em 05/08/2026; atualizado em 06/08 ao fim do dia.*

Plano completo: `docs/PLANO_INVENTARIO_MOBILE_OFFLINE_FASE0.md`

---

## Estado em uma linha

**Fases 0, 1 e 1.5 IMPLEMENTADAS e verdes no DEV.** Suíte do Inventário passou de
**31 → 62 testes**, todas passando. Backend e web prontos para o app começar.
Nada foi pushado.

---

## O que foi feito em 05/08 (Fase 0 — backend)

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

## O que foi feito em 06/08 (Fases 1 e 1.5)

### ✅ Fase 1 — a web passa a consumir a Fase 0
Tudo abaixo está FEITO (commit `8a8a963`):

- **Passa a enviar** `counting_list_id` + `expected_cycle` no
  `registrarContagem`, via o hook novo `useRegistrarContagem` (usado pelas DUAS
  telas de contagem). O WARN de cliente legado parou de aparecer no log.
  **Pendência registrada:** tornar os campos **obrigatórios** no backend e
  remover o ramo legado, agora que a web migrou.
- **Trata o 409 `LISTA_EM_USO_OUTRO_DISPOSITIVO`** com confirmação que reenvia
  com `force: true`. `CICLO_DIVERGENTE`/`LEASE_INVALIDO` recarregam a tela.
- **Selo do lease** em três lugares: seleção de lista, topo da contagem e visão
  do supervisor (com o NOME de quem retirou, não só o id do aparelho).
- **`zerado_no_fecho`** exibido na revisão do supervisor.

> ⚠️ **Lacuna da Fase 0 fechada aqui.** Existia um **quarto** endpoint devolvendo
> saldo — `GET /counting-lists/{list_id}/products` (`app/main.py:10145`) — que é
> justamente o que a tela de contagem usa. Ficou de fora em 05/08 porque a
> varredura foi feita só em `counting_lists.py`. **Lição:** neste módulo as rotas
> estão espalhadas entre `main.py` e `api/v1/endpoints/`.

### ✅ Fase 1.5 — teto de itens por lista (commit `6b517b3`)
Configurável em `inventario.system_config` (`max_itens_por_lista_contagem`,
padrão 3.000), **aviso** no `AtribuirProdutosModal` e **bloqueio rígido** no
`checkout`. A assimetria é proposital e tem teste nos dois lados.

### 2. ✅ Números de produção — ENCERRADO em 06/08 (não virão, e não precisam)

O Clenio esclareceu: **esse número não existe**. Hoje a contagem é feita em
**lista de papel, que aceita qualquer quantidade** — o pessoal divide as páginas
e cria várias listas na mão. Não há um "tamanho típico" no sistema para medir,
e o DEV está com as tabelas de inventário vazias.

**Isso não enfraquece o teto de 3.000 — fortalece**, por três motivos:

1. **Confirma que é regra de negócio, não limite técnico.** O teto passa a ser
   uma decisão de operação ("qual atribuição uma pessoa dá conta"), que é
   exatamente o teste que separa regra de gambiarra. Se fosse derivado do
   limite do AsyncStorage, seria limitação disfarçada.
2. **O modelo já espelha a prática.** Dividir em várias listas é o que já se faz
   com as páginas de papel — a plataforma não está impondo um jeito novo de
   trabalhar, está formalizando o que já acontece. E ganha o que o papel não dá:
   cada lista tem contador e ciclo próprios, então dividir **paraleliza**.
3. **A folga técnica não depende de medição.** 3.000 itens ≈ **1,9 MB** no
   payload atual, contra 6 MB de limite do AsyncStorage. A conta fecha sozinha;
   o número de produção só confirmaria o que já se sabe.

**Consequência prática:** o teto pode ser reavaliado pela OPERAÇÃO (se 3.000 for
grande ou pequeno demais para uma pessoa), não por medição de dado. E como ele é
configurável em `system_config`, mudar não exige deploy.

### 2b. Ainda em aberto
- **Gerador de listas por localidade** (Fase 1.5, opcional) — ficou mais
  interessante depois dessa conversa: hoje a divisão é feita na mão, dividindo
  páginas. Automatizar a divisão respeitando `local1/2/3` faria a plataforma
  entregar algo que o papel não entrega. Ver `AtribuirProdutosModal`, que já tem
  os 7 filtros de faixa necessários.
- **O teto só se altera pelo banco** — não há tela. Se virar algo que o usuário
  precise ajustar, cai na regra de "funcionalidade oculta precisa de tela".

### 3. Depois disso
**Fases 0, 1 e 1.5 estão FEITAS** (06/08). Backend e web prontos para o app
começar — a próxima é a **Fase 1** do app (multi-módulo: `jwt.ts` lendo papel por
módulo, tile no `HomeScreen`, `name` → "CAPUL Platform"), e daí a 2 em diante.

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
cd inventario/backend && ./run-tests.sh     # esperado: 62 passed
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
