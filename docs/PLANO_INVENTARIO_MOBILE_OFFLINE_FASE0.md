# Inventário — Contagem offline no app · FASE 0 (pré-requisitos de backend)

*Escrito em 05/08/2026. Detalhamento endpoint a endpoint da Fase 0 do plano de
contagem offline. As demais fases estão descritas ao final, em resumo.*

---

## 1. Contexto

Avaliou-se levar a contagem do Inventário para o app mobile (o mesmo da Logística,
`logistica/app`), com operação **offline**. Decisões já fechadas com o Clenio:

| Decisão | Consequência |
|---|---|
| Teto de **3.000 itens por lista de contagem** | Cabe em AsyncStorage (1,9 MB no payload atual) — **sem `expo-sqlite`**, sem dependência nativa, sem APK novo |
| **Uma lista por vez** no app | É o que realmente dimensiona o aparelho: o contador pode ter N listas atribuídas (`/counting-lists/me` devolve várias) |
| **Não existe "lista para mobile"** | O teto é regra do sistema; app e desktop consomem a mesma `counting_list` |
| App é o mesmo da Logística, renomeado | Só o `name` de exibição muda; `package`/`slug` permanecem |

Nada disso está implementado. Este documento cobre **apenas a Fase 0** — as correções
de backend que precisam existir **antes** de qualquer linha do app.

## 2. Por que a Fase 0 é bloqueante

Os três problemas abaixo não aparecem em teste de mesa. Aparecem no cenário **normal**
de uso offline — contar sem sinal enquanto o supervisor toca a lista pelo desktop. Se o
app for construído antes, ele funciona na demonstração e corrompe contagem no galpão.

Dois dos quatro itens (0.2 e 0.4) têm valor **independente do mobile**: corrigem furos
que existem hoje na web.

---

## 3. Item 0.1 — Ciclo carimbado pelo cliente

### Endpoints afetados

| Endpoint | Arquivo | Papel |
|---|---|---|
| `POST /api/v1/inventory/items/{item_id}/count` | `app/main.py:6337` | É o que a tela de contagem usa hoje (`inventory.service.ts:147`) |
| `POST /api/v1/counting/inventory/{inventory_id}/register-count` | `app/main.py:6375` | Implementação real; o de cima delega para este |

### Comportamento hoje

Em `app/main.py:6415` o servidor resolve o ciclo **no momento do request**:

```python
counting_list = db.query(CountingList).join(CountingListItem)...first()
if counting_list:
    list_status  = counting_list.list_status
    cycle_number = counting_list.current_cycle   # ← ciclo do AGORA
```

E mais abaixo (`app/main.py:6478`) faz *upsert* por `(inventory_item_id, count_number)`.

**A falha:** uma contagem capturada offline no ciclo 1, sincronizada depois que o
supervisor avançou para o ciclo 2, é gravada **como contagem do ciclo 2** — e o upsert
**sobrescreve em silêncio** o que o contador do ciclo 2 já tinha registrado. Não há erro,
não há log de anomalia. O multi-ciclo perde o sentido.

### Comportamento alvo

O cliente declara contra qual lista e qual ciclo contou; o servidor **compara e recusa**
em vez de adaptar.

**Request** (campos novos, ambos opcionais na Fase 0 — ver retrocompatibilidade):

```jsonc
{
  "quantity": 42.0,
  "observation": "...",
  "lot_counts": [...],

  "counting_list_id": "uuid",   // NOVO — contra qual lista o operador contou
  "expected_cycle": 1,          // NOVO — em qual ciclo ele estava
  "idempotency_key": "uuid",    // NOVO — ver item 0.4
  "counted_at_client": "2026-08-05T14:22:31-03:00"  // NOVO — ver item 0.4
}
```

**Validação a inserir logo após `app/main.py:6420`**, antes de qualquer escrita:

1. Se `counting_list_id` veio e **não é** a lista que contém o item → `409`.
2. Se `expected_cycle` veio e **difere** de `counting_list.current_cycle` → `409`.

**Resposta 409** — precisa ser distinguível pelo app, não um 400 genérico:

```jsonc
{
  "erro": "CICLO_DIVERGENTE",
  "mensagem": "Esta contagem foi feita no 1º ciclo, mas a lista já está no 2º. Ela não foi gravada.",
  "expected_cycle": 1,
  "current_cycle": 2,
  "counting_list_id": "uuid",
  "item_id": "uuid"
}
```

O app usa `erro` para decidir: `CICLO_DIVERGENTE` **não** é erro de rede (não reenviar) nem
erro de negócio comum (não descartar em silêncio) — vai para quarentena local e é
reportado ao operador. O tratamento visual disso é da Fase 4.

### Retrocompatibilidade

Na Fase 0 os campos são **opcionais**:

- **Ausentes** → comportamento atual, preservado. A web continua funcionando sem alteração.
- **Presentes** → validação estrita.

Quando a tela web passar a enviá-los (Fase 1.5 ou junto), tornar `counting_list_id` e
`expected_cycle` **obrigatórios** e remover o caminho legado. Registrar isso como
pendência — campo opcional "temporário" que fica cinco anos é o padrão conhecido.

Enquanto opcionais, logar em nível WARN quando ausentes, para dar visibilidade de quem
ainda não migrou.

---

## 4. Item 0.2 — Saldo fora do payload do OPERATOR

### O problema

Três endpoints devolvem `expected_quantity` / `system_qty` (o **saldo do sistema**) e
**nenhum** filtra por papel:

| Endpoint | Arquivo | Onde vaza |
|---|---|---|
| `GET /inventories/{inventory_id}/lists/{list_id}/products` | `counting_lists.py:38` | linhas **181-182** |
| `GET /counting-lists/{list_id}/items` | `counting_lists.py:1166` | linhas **1215-1216** |
| `GET /counting-lists/{list_id}/my-items` | `counting_lists.py:1266` | linha **1312** |

Hoje quem esconde o saldo é o **frontend**, com base em `show_previous_counts`. Ou seja:
a contagem cega é uma decisão de renderização. Qualquer `curl` com o JWT do OPERATOR lê
o saldo — isso já é verdade **hoje, na web**.

**Por que vira crítico no offline:** o app precisa cachear esse payload no aparelho. O
que hoje é um vazamento transitório em memória passa a ser um arquivo **persistido no
celular do operador**. A contagem cega deixa de existir na prática.

> ⚠️ **Atenção a uma nota antiga.** Existe registro de que
> `/counting-lists/{id}/products` é "exceção: **NÃO bloquear** server-side senão quebra a
> contagem". Aquilo se referia a aplicar `require_staff_role` no endpoint inteiro — o que
> de fato quebraria, porque o OPERATOR precisa chamá-lo. **Não é o que se propõe aqui.**
> A proposta é **projeção de campos**: o endpoint continua aberto ao OPERATOR, mas devolve
> menos campos para ele. Não confundir as duas coisas ao revisar.

### Comportamento alvo

Nos três endpoints, montar o dicionário de resposta conforme o papel:

```python
is_staff = current_user.role in (UserRole.ADMIN, UserRole.SUPERVISOR)

if not is_staff:
    product_data.pop("expected_quantity", None)
    product_data.pop("system_qty", None)
    # ciclos anteriores só quando o supervisor liberou explicitamente
    if not counting_list.show_previous_counts:
        product_data.pop("count_cycle_1", None)
        product_data.pop("count_cycle_2", None)
```

O campo `show_previous_counts` **já existe** (`models.py:1069`, migration 010) e já é
a decisão do supervisor no ato de liberar, com default `false` = cega. A mudança apenas
faz o servidor **honrar** o que hoje só a UI honra.

### Efeito colateral a verificar

`counting_lists.py:211` usa `product_data["expected_quantity"]` para calcular
`finalQuantity`. O cálculo deve ser feito **antes** da remoção dos campos, ou passar a
ler da variável local em vez do dicionário. Sem esse cuidado, o `.pop()` quebra o cálculo
para o OPERATOR — que é justamente quem mais usa o endpoint.

### Valor independente

Este item fecha um furo de contagem cega **que existe hoje**, com ou sem app. Se o
projeto mobile for cancelado, ele continua valendo.

---

## 5. Item 0.3 — Handoff, atribuição, e o zero silencioso

Este é o item com o cenário mais destrutivo, e o que exige uma decisão sua.

### O que o handoff faz hoje

`POST /counting-lists/{list_id}/handoff` — `counting_lists.py:880`:

```
- Lista deve estar EM_CONTAGEM
- Usuário deve ser o contador do ciclo atual (ou ADMIN/SUPERVISOR)
- Itens não contados no ciclo atual são gravados como ZERO   ← aqui
- list_status → AGUARDANDO_REVISAO
```

### O cenário que quebra

1. Operador baixa a lista (3.000 itens) e conta **500** offline, sem sinal.
2. Fim do expediente. O celular não sincronizou.
3. Alguém faz o handoff pelo desktop — o operador, o supervisor, não importa.
4. **Os 2.500 itens não contados viram ZERO** no ciclo atual.
5. No dia seguinte o celular sincroniza. A lista está `AGUARDANDO_REVISAO`, que **não**
   está em `valid_statuses` (`app/main.py:6424`) → as 500 contagens tomam `400`.

Resultado: **500 contagens reais perdidas e 2.500 zeros falsos gravados.** Como zero é
uma contagem válida (produto que acabou), nada nisso parece anômalo depois.

### Decisão necessária

Há dois caminhos. **Recomendo o A.**

**A — Recusar a contagem tardia e usar o fluxo de devolução que já existe (recomendado)**

- O servidor recusa contagem para lista fora de `EM_CONTAGEM`, mas com erro **específico**
  (hoje é um 400 genérico com texto):

```jsonc
{
  "erro": "LISTA_NAO_ESTA_EM_CONTAGEM",
  "mensagem": "A lista foi entregue ao supervisor. Sua contagem não foi gravada.",
  "list_status": "AGUARDANDO_REVISAO",
  "counting_list_id": "uuid"
}
```

- O supervisor usa `POST /counting-lists/{list_id}/return` (`counting_lists.py:957`),
  que **já existe** para devolver a lista ao contador. A lista volta a `EM_CONTAGEM` e a
  fila do app reenvia normalmente.
- **Vantagem:** não inventa exceção nova. Reusa um fluxo existente, com histórico
  (`/handoff-history`, `counting_lists.py:1086`) e decisão humana explícita.

**B — Aceitar contagem tardia em `AGUARDANDO_REVISAO`** se vier do contador atribuído
daquele ciclo e o valor atual for um zero posto pelo handoff.

- **Vantagem:** menos atrito.
- **Desvantagem séria:** cria uma exceção à regra "lista entregue não recebe contagem",
  que é justamente o que dá confiabilidade à revisão do supervisor. E o supervisor pode
  já ter analisado a lista com os zeros.

### Proteção no app (não é backend, mas pertence a esta decisão)

Independente do caminho escolhido, o app **deve bloquear o handoff enquanto houver fila
pendente**, com mensagem explícita ("faltam N contagens para sincronizar"). O servidor
não tem como saber que existe trabalho preso num celular — essa guarda só pode ser do
cliente. Registrar como requisito da Fase 3.

### Reatribuição de contador

`app/main.py:6462` recusa com `403` quem não é o `counter_cycle_N` da lista. Vale a mesma
correção de forma: erro identificável em vez de texto solto.

```jsonc
{
  "erro": "CONTADOR_NAO_ATRIBUIDO",
  "mensagem": "Você não é mais o contador do 2º ciclo desta lista.",
  "cycle": 2
}
```

---

## 6. Item 0.4 — Idempotência e ordenação

### Idempotência

O padrão já existe e é conhecido na plataforma — a Logística usa `idempotencyKey` com
coluna única e `findUnique` antes de inserir (`despesa.service.ts:444`). Espelhar.

Aqui há uma sutileza a favor: o `register_count` **já é upsert** por `(item, ciclo)`, então
reenviar a mesma contagem não duplica valor. A chave serve para:

- não reprocessar efeitos colaterais (recálculo, log de auditoria, fechamento de lista);
- dar rastreabilidade de qual captura offline gerou qual gravação.

### Ordenação — o problema que a idempotência **não** resolve

Cenário: o operador conta **10**, percebe o erro e corrige para **12**, ambos offline.
Se as duas entradas subirem fora de ordem, o valor final grava **10**.

Duas defesas, complementares:

1. **No app (Fase 3):** a fila de contagem guarda **uma entrada por item — a última** —
   e não um log append. Isso difere das cinco filas atuais da Logística, que são append
   por natureza (cada baixa é um evento). Contagem é **estado**, não evento. Registrar
   essa diferença no desenho da fila, senão o padrão existente é copiado por reflexo.
2. **No servidor (Fase 0):** rejeitar escrita cujo `counted_at_client` seja **anterior**
   ao já gravado:

```jsonc
{
  "erro": "CONTAGEM_DESATUALIZADA",
  "mensagem": "Já existe uma contagem mais recente para este item.",
  "counted_at_client_recebido": "...",
  "counted_at_client_gravado": "..."
}
```

`counted_at_client` vem do relógio do celular e **não é confiável como hora absoluta** —
serve para ordenar capturas do mesmo aparelho, que é o caso de uso. Não usar para
auditoria legal; para isso vale o `created_at`/`updated_at` do servidor.

---

## 7. Migration 015

Convenção do módulo: `inventario/database/migrations/NNN_descricao.sql`. Próximo número
livre: **015**.

```sql
-- 015_add_offline_count_tracking.sql
ALTER TABLE inventario.countings
  ADD COLUMN idempotency_key  TEXT,
  ADD COLUMN counted_at_client TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS countings_idempotency_key_uidx
  ON inventario.countings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;   -- parcial: linhas antigas ficam NULL
```

Nenhuma outra mudança de schema é necessária na Fase 0. A tabela de quarentena, se vier,
é da Fase 4 — e provavelmente nem existe: a quarentena natural é **a própria fila do
app**, que retém o que o servidor recusou.

> ⚠️ O Inventário aplica migrations **manualmente** (é o único backend da plataforma sem
> job `*-migrate` no startup). Incluir a 015 no roteiro de deploy explicitamente.

---

## 8. Gates — o que precisa passar

Os testes entram em `inventario/backend/tests/`, executados por
`inventario/backend/run-tests.sh` (a suíte tem 31 cenários; `tests/` fica fora da imagem
por `.dockerignore`, então **não** use `pytest` dentro do container para conferir).

| # | Teste que fecha o item |
|---|---|
| 0.1 | Contagem com `expected_cycle=1` chegando com a lista em `current_cycle=2` → **409**, e o valor do ciclo 2 **permanece intacto** |
| 0.1 | Sem os campos novos → comportamento atual preservado (retrocompat) |
| 0.2 | `GET .../products` como OPERATOR **não** traz `expected_quantity`/`system_qty`; como SUPERVISOR traz |
| 0.2 | Com `show_previous_counts=false`, OPERATOR não recebe `count_cycle_1/2`; com `true`, recebe |
| 0.2 | `finalQuantity` continua correto para OPERATOR (regressão do `.pop()`) |
| 0.3 | Contagem para lista em `AGUARDANDO_REVISAO` → erro `LISTA_NAO_ESTA_EM_CONTAGEM` |
| 0.3 | Após `/return`, a mesma contagem é aceita |
| 0.4 | Mesma `idempotency_key` duas vezes → uma gravação, sem efeito colateral duplicado |
| 0.4 | `counted_at_client` mais antigo que o gravado → `CONTAGEM_DESATUALIZADA` |

**O teste 0.1 é o que não pode voltar nunca** — é a regressão que corrompe inventário em
silêncio.

---

## 9. O que NÃO entra na Fase 0

- Qualquer código do app.
- Tela de quarentena / resolução de conflito (Fase 4).
- Teto de 3.000 itens no `AtribuirProdutosModal` (Fase 1.5).
- Gerador automático de listas por localidade (Fase 1.5, opcional).
- Extração do componente de filtro compartilhado entre `AddProductsModal` (843 linhas) e
  `AtribuirProdutosModal` (795 linhas) — os dois têm os **mesmos 7 filtros de faixa**
  duplicados, mas refatorar isso sem cobertura de teste de UI é risco desnecessário agora.

---

## 10. Resumo das demais fases

| Fase | O quê | Depende de |
|---|---|---|
| **0** | Este documento — backend | — |
| **1** | App multi-módulo: `jwt.ts:76` lê papel por módulo, tile no `HomeScreen`, `name` → "CAPUL Platform" | — (paralelo à 0) |
| **1.5** | Teto de 3.000 no `AtribuirProdutosModal` + configuração; gerador por localidade (opcional) | — |
| **2** | Working set offline: endpoint de pacote, AsyncStorage, "uma lista por vez" | 0.2, 1.5 |
| **3** | `filaContagem.ts` (estado, não append) + bloqueio de handoff com fila pendente | 0.1, 0.4, 2 |
| **4** | Conflito: tratamento de `CICLO_DIVERGENTE`, tela do supervisor | 0.1, 0.3, 3 |
| **5** | Piloto: uma filial, uma lista real, web como saída | todas |
