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

Os cinco problemas abaixo não aparecem em teste de mesa. Aparecem no cenário **normal**
de uso offline — contar sem sinal enquanto o supervisor toca a lista pelo desktop, ou o
mesmo operador abrindo a web porque o celular travou. Se o app for construído antes, ele
funciona na demonstração e corrompe contagem no galpão.

| Item | O que resolve | Vale sem o app? |
|---|---|---|
| **0.1** | Ciclo carimbado pelo cliente | Parcial — endurece o endpoint |
| **0.2** | Saldo fora do payload do OPERATOR | **Sim** — furo de contagem cega que existe hoje |
| **0.3** | Handoff com trabalho preso no aparelho | Parcial — o rastro `zerado_no_fecho` vale sempre |
| **0.4** | Idempotência e ordenação | **Sim** — endurece o endpoint |
| **0.5** | Mesma lista contada em dois lugares | **Sim** — hoje já não há controle algum entre as duas telas web |

Ou seja: três dos cinco itens corrigem problemas que **já existem na web**. Se o projeto
mobile for cancelado depois, esse trabalho não se perde.

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

## 5. Item 0.3 — Handoff com trabalho preso no aparelho

> **Correção (05/08, após revisão do Clenio).** A primeira versão deste item chamava os
> zeros do handoff de "zeros falsos" e tratava a regra como problema. **Estava errado.**
> Zero é contagem legítima — há produtos que realmente estão zerados — e o preenchimento
> é a semântica correta de encerrar a varredura. A regra **não muda**. O que segue é o
> problema real, que é mais estreito.

### O que o handoff faz, e por que está certo

`POST /counting-lists/{list_id}/handoff` — `counting_lists.py:880`.

O modelo **já distingue** os dois casos:

| Valor | Significado |
|---|---|
| `count_cycle_N = NULL` | não contado |
| `count_cycle_N = 0` | contado, saldo zero |

E o preenchimento (`counting_lists.py:920`) só age sobre `if getattr(it, field) is None`,
ainda filtrando por `needs_count_cycle_N` — no 2º/3º ciclo nem olha item que não precisava
ser recontado. É o contador declarando *"varri a lista inteira; o que sobrou eu não
achei"*. Zero é o resultado correto disso.

**Só o handoff preenche.** Os outros dois caminhos de fecho não mexem em item não contado:

| Caminho | Onde | Preenche? |
|---|---|---|
| `/handoff` — contador entrega ao supervisor | `counting_lists.py:880` | **Sim** — declaração de varredura completa |
| `finalize-cycle` — divergência + avanço 1→2→3 | `main.py:11078` | Não — usa `isnot(None)` na lógica |
| `/finalizar` — ADMIN/SUPERVISOR encerra direto | `counting_lists.py:1115` | Não — só marca `ENCERRADA` |

### O problema real (que é do offline, não da regra)

O preenchimento assume que **o servidor conhece todo o trabalho do operador**. Offline
quebra essa premissa:

1. Operador baixa a lista e conta 500 itens offline, sem sinal.
2. O celular não sincronizou.
3. Alguém faz o handoff pelo desktop.
4. O preenchimento grava zero — inclusive sobre itens que o operador **contou de verdade**,
   com valor real, que está preso no aparelho.
5. O celular sincroniza depois. A lista está `AGUARDANDO_REVISAO`, que não consta de
   `valid_statuses` (`app/main.py:6424`) → as contagens tomam `400`.

Não é a regra que falha — é a informação que faltava ao servidor no momento em que ela foi
aplicada.

### O que fazer

**1. Guarda no app (a correção de verdade — Fase 3).** O app **bloqueia o handoff enquanto
houver fila pendente**, com mensagem explícita ("faltam N contagens para sincronizar"). O
servidor não tem como saber que existe trabalho num celular; essa guarda só pode ser do
cliente. Com ela, o cenário praticamente desaparece.

**2. Erro identificável (Fase 0).** Contagem para lista fora de `EM_CONTAGEM` hoje devolve
`400` com texto solto. Passa a devolver código próprio, para o app explicar em vez de só
falhar:

```jsonc
{
  "erro": "LISTA_NAO_ESTA_EM_CONTAGEM",
  "mensagem": "A lista foi entregue ao supervisor. Sua contagem não foi gravada.",
  "list_status": "AGUARDANDO_REVISAO",
  "counting_list_id": "uuid"
}
```

**3. Recuperação pelo fluxo existente.** `POST /counting-lists/{list_id}/return`
(`counting_lists.py:957`) já devolve a lista ao contador. Volta a `EM_CONTAGEM`, a fila
reenvia, com histórico em `/handoff-history` (`counting_lists.py:1086`) e decisão humana
explícita. **Não criar exceção que aceite contagem em `AGUARDANDO_REVISAO`** — seria abrir
buraco na regra que dá confiabilidade à revisão do supervisor.

### Rastro por item — ✅ APROVADO (Clenio, 05/08)

Depois do preenchimento o item fica `count_cycle_N = 0`, `status = COUNTED` e
`last_counted_by = <operador>` — **idêntico a uma contagem ativa**. O único rastro é
agregado, no histórico: *"N item(ns) não contado(s) gravado(s) como zero"*.

Hoje isso é aceitável: o operador está presente e sabe o que fez. No offline, se um
preenchimento passar por cima de contagem real presa no celular, **não há como descobrir
depois quais itens foram** — só o total.

Coluna booleana `zerado_no_fecho` em `counting_list_items`, marcada no laço que já existe
(`counting_lists.py:920`), junto do `setattr(it, field, 0)`, e exposta na revisão do
supervisor. **Não muda regra nenhuma** e não transforma o handoff em operação de risco — é
rastreabilidade. Custo: uma coluna e uma linha no laço.

Uma nova contagem sobre o item **limpa a marca** (`zerado_no_fecho = False`) — o mesmo
padrão que `revisar_no_ciclo` já usa em `app/main.py:6500`.

### Reatribuição de contador

`app/main.py:6462` recusa com `403` quem não é o `counter_cycle_N` da lista. Mesma correção
de forma: erro identificável em vez de texto solto.

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

## 7. Item 0.5 — Mesma lista contada em dois lugares

*Levantado pelo Clenio em 05/08. É o furo que o `counted_at_client` do 0.4 **não** cobre:
aquele mecanismo ordena capturas do **mesmo** aparelho; relógios de aparelhos diferentes
não são comparáveis.*

### O estado hoje

**Não existe controle de concorrência algum.** Os únicos guards nas telas de contagem
(`ContagemDesktopPage.tsx:47`, `ContagemMobilePage.tsx:24`) são de **autorização** —
`noAssignedList`, `listNotReleased`, `notCounterOfRequested`. Nada impede a mesma lista de
ser contada em dois lugares ao mesmo tempo.

E já existem **duas** superfícies web hoje — `ContagemDesktopPage` e `ContagemMobilePage`.
O app nativo seria a terceira.

O modelo de domínio **já quer dono único**: `counter_cycle_1/2/3` amarra um contador por
ciclo (`models.py:1058`). O que ninguém amarra é **em quantos dispositivos** esse contador
pode estar. O caso realista não é fraude, é banal: o operador começa no celular, o
aparelho dá problema, ele abre o desktop e continua.

**Por que hoje é tolerável e com offline deixa de ser:** as duas telas web estão online, a
gravação é imediata e o operador vê o resultado na hora — a janela de divergência é de
segundos. Com o app offline, a janela vira **horas**, e o perdedor do *last-write-wins* é
descartado em silêncio.

### Comportamento alvo — lease por dispositivo, sem trava dura

A identidade necessária **já existe**: `logistica/app/src/auth/deviceId.ts` gera um
`deviceId` estável por instalação, guardado no SecureStore, e o backend já amarra sessão de
dispositivo a ele.

**Novos endpoints:**

```
POST   /api/v1/counting-lists/{list_id}/checkout   { device_id }  → { lease_token }
DELETE /api/v1/counting-lists/{list_id}/checkout   { lease_token }
```

- O app faz `checkout` **ao baixar** a lista e recebe um `lease_token` (uuid).
- Toda contagem vinda do app carrega o `lease_token`.
- O `release` acontece ao sincronizar tudo, ou no handoff (automático).

**Validação no `register_count`:**

| Situação | Resposta |
|---|---|
| Contagem **com** `lease_token` que bate | grava normalmente |
| Contagem **com** `lease_token` que **não** bate (lease foi invalidado) | `409 LEASE_INVALIDO` |
| Contagem **sem** token, lista **com** lease ativo | `409 LISTA_EM_USO_OUTRO_DISPOSITIVO` + dados do lease |
| Contagem **sem** token, lista **sem** lease | grava normalmente (web de hoje, inalterada) |

**Deliberadamente não é trava dura.** Se o celular do operador morre, ele não pode ficar
refém de um lease. Então: ao tomar `LISTA_EM_USO_OUTRO_DISPOSITIVO`, a web mostra o aviso
com os dados reais e pede confirmação —

> *"Esta lista está baixada no aplicativo (dispositivo …a3f, desde 14:22). Contar aqui pode
> descartar contagens que ainda não sincronizaram. Continuar assim mesmo?"*

— e, confirmado, reenvia com `force: true`, o que **invalida o lease**. A partir daí o app,
ao sincronizar, recebe `LEASE_INVALIDO` em vez de sobrescrever em silêncio, e o que estava
preso vai para quarentena (Fase 4) com aviso ao operador.

O ganho é esse: **a decisão passa a ser humana e informada**, e o lado perdedor descobre em
vez de sumir.

### Visibilidade — o aviso não pode chegar só na hora de salvar

*Reforço do Clenio (05/08): "o desktop/mobile tem que ter conhecimento que existe um
aparelho APP-MOBILE realizando contagem offline, senão vai que o usuário faz merda."*

Avisar só no `409` da primeira gravação é **tarde**: a pessoa já abriu a lista, já se
posicionou para trabalhar, e descobre no meio. O estado do lease tem que ser **visível
antes de começar**.

Como os campos do lease ficam na própria linha de `counting_lists`, sai de graça nos
endpoints de leitura que já existem — é acrescentar ao payload e renderizar:

| Onde | O que mostrar |
|---|---|
| `GET /counting-lists/me` (`counting_lists.py`) → tela "Minhas Listas" e `ContagemSelectorPage` | Selo na lista: **"Em contagem no aplicativo desde 14:22"** |
| `GET /counting-lists/{list_id}` → `ContagemDesktopPage` / `ContagemMobilePage` | Faixa fixa no topo, antes do primeiro item, não um toast que some |
| Visão do supervisor (`TabListas` / `ListaDetalheModal`) | Mesma indicação — o supervisor precisa saber antes de liberar, devolver ou cobrar a lista |

Campos a expor: `lease_ativo`, `lease_device_id` (abreviado na UI), `lease_user_id`,
`lease_at`. Como o lease é por **dispositivo** e não por pessoa, mostrar também de **quem**
é o aparelho — senão o supervisor vê "dispositivo …a3f" e não sabe a quem cobrar.

Com isso o `409` deixa de ser a primeira notícia e vira a última barreira: quem chegar até
ele já foi avisado duas vezes.

### Escape hatch obrigatório

`SUPERVISOR`/`ADMIN` podem liberar o lease de qualquer lista (celular perdido, operador
desligado). Sem isso, um aparelho perdido congela a lista para sempre. Registrar o evento
no `handoff-history`, que já existe.

### Ressalva

Um lease **não** garante exclusão mútua de verdade — o app pode contar offline sem falar
com o servidor. Ele reduz a janela e, principalmente, **torna a colisão detectável**. A
garantia real continua sendo `counter_cycle_N` (um contador por ciclo) mais a disciplina de
uma lista por vez. Não vender o lease como lock distribuído.

---

## 8. Migration 015

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

**Item 0.3 — rastro por item** (aprovado). Vai em `counting_list_items`, não em
`countings`, porque é ali que o preenchimento do handoff escreve:

```sql
ALTER TABLE inventario.counting_list_items
  ADD COLUMN zerado_no_fecho BOOLEAN NOT NULL DEFAULT FALSE;
```

Marcado no laço que já existe (`counting_lists.py:920`), junto do `setattr(it, field, 0)`,
e limpo quando chega contagem nova para o item. Linhas históricas ficam `FALSE` — o que é
honesto: para o passado não sabemos quais zeros vieram de preenchimento.

**Item 0.5 — lease por dispositivo.** Vai em `counting_lists` (é estado da lista):

```sql
ALTER TABLE inventario.counting_lists
  ADD COLUMN lease_token     UUID,
  ADD COLUMN lease_device_id TEXT,
  ADD COLUMN lease_user_id   UUID REFERENCES inventario.users(id),
  ADD COLUMN lease_at        TIMESTAMPTZ;
```

Todas nuláveis: lista sem lease é o estado normal de hoje, e a web continua funcionando
sem nenhuma mudança de contrato.

Nenhuma outra mudança de schema é necessária na Fase 0. A tabela de quarentena, se vier,
é da Fase 4 — e provavelmente nem existe: a quarentena natural é **a própria fila do
app**, que retém o que o servidor recusou.

> ⚠️ O Inventário aplica migrations **manualmente** (é o único backend da plataforma sem
> job `*-migrate` no startup). Incluir a 015 no roteiro de deploy explicitamente.

---

## 9. Gates — o que precisa passar

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
| 0.3 | Handoff **preserva** item já contado como `0` (não é o mesmo que não contado) e só preenche `NULL` — proteção da regra, para ninguém "consertar" o preenchimento por engano |
| 0.3 | Handoff no 2º ciclo **não** preenche item com `needs_count_cycle_2 = false` |
| 0.3 | Item preenchido no handoff fica com `zerado_no_fecho = true`; item contado ativamente como `0` fica `false` |
| 0.3 | Contagem nova sobre item preenchido **limpa** `zerado_no_fecho` |
| 0.4 | Mesma `idempotency_key` duas vezes → uma gravação, sem efeito colateral duplicado |
| 0.4 | `counted_at_client` mais antigo que o gravado → `CONTAGEM_DESATUALIZADA` |
| 0.5 | Contagem sem token, com lease ativo → `409 LISTA_EM_USO_OUTRO_DISPOSITIVO` |
| 0.5 | Mesma contagem com `force: true` → grava **e** invalida o lease |
| 0.5 | Contagem do app com `lease_token` já invalidado → `409 LEASE_INVALIDO` (e **não** sobrescreve) |
| 0.5 | Lista **sem** lease → web grava exatamente como hoje (retrocompat) |
| 0.5 | `GET /counting-lists/me` expõe `lease_ativo` para lista em contagem no app |

**O teste 0.1 é o que não pode voltar nunca** — é a regressão que corrompe inventário em
silêncio.

---

## 10. O que NÃO entra na Fase 0

- Qualquer código do app.
- Tela de quarentena / resolução de conflito (Fase 4).
- Teto de 3.000 itens no `AtribuirProdutosModal` (Fase 1.5).
- Gerador automático de listas por localidade (Fase 1.5, opcional).
- Extração do componente de filtro compartilhado entre `AddProductsModal` (843 linhas) e
  `AtribuirProdutosModal` (795 linhas) — os dois têm os **mesmos 7 filtros de faixa**
  duplicados, mas refatorar isso sem cobertura de teste de UI é risco desnecessário agora.

---

## 11. Resumo das demais fases

| Fase | O quê | Depende de |
|---|---|---|
| **0** | Este documento — backend | — |
| **1** | App multi-módulo: `jwt.ts:76` lê papel por módulo, tile no `HomeScreen`, `name` → "CAPUL Platform" | — (paralelo à 0) |
| **1.5** | Teto de 3.000 no `AtribuirProdutosModal` + configuração; gerador por localidade (opcional) | — |
| **2** | Working set offline: endpoint de pacote, AsyncStorage, "uma lista por vez", `checkout` do lease ao baixar | 0.2, 0.5, 1.5 |
| **3** | `filaContagem.ts` (estado, não append) + bloqueio de handoff com fila pendente + `release` do lease | 0.1, 0.4, 0.5, 2 |
| **4** | Conflito: tratamento de `CICLO_DIVERGENTE` e `LEASE_INVALIDO`, tela do supervisor | 0.1, 0.3, 0.5, 3 |
| **5** | Piloto: uma filial, uma lista real, web como saída | todas |
