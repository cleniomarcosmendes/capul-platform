# Auditoria — Dívida Técnica — 10/05/2026 (Fase 5.1)

**Frente:** 5 (do `PLAYBOOK_AUDITORIA_v1.md`)
**Modo:** profunda (Fase 5.1 — mapa + plano; Fase 5.2 — refactor pendente aprovação)
**Branch:** `audit/divida-tecnica`
**Auditor:** Claude Opus 4.7 (sessão Clenio)
**Escopo:** higiene de código sem risco de segurança — duplicações, dead code, dependências não usadas, inconsistências, funções gigantes.

---

## Sumário Executivo (Fase 5.1)

| Severidade | Qtd | Esforço refactor estimado |
|---|---|---|
| **Alto** | 1 | 12-20h |
| **Médio** | 7 | 14-22h |
| **Baixo** | 2 | 2-4h |
| **Pontos fortes** | 8 | — |

**TOTAL refactor**: 28-46h

### Quick wins (alto impacto, baixo esforço — ~5h)
1. **DT3-M1** — Pares Create/Update DTOs via `PartialType()` (2h, elimina 245 linhas)
2. **DT3-M3** — Helper CNPJ centralizado (1h, elimina 7 duplicações no fiscal)
3. **DT3-M2** — Helper Multer config compartilhado (1-2h)

### Maior dívida
**DT5-A1** — `inventario/backend/app/main.py` com **12878 linhas** e **97 endpoints declarados diretamente** (god object). Já existe pasta `app/api/v1/endpoints/` com routers separados — indica refactor parcial em andamento que ficou pela metade. Mover endpoints pra routers reduz acoplamento e facilita testes.

---

## Achados Altos

### Achado #DT5-A1 — `inventario/main.py` god object (12878 linhas, 97 endpoints diretos)

- **Categoria:** Funções/arquivos gigantes (Dimensão 4)
- **Severidade:** **Alto** (manutenção, onboarding, isolamento de bugs)
- **Localização:** `inventario/backend/app/main.py`

- **Descrição:**
  - 12878 linhas no arquivo principal — comparável a uma codebase inteira
  - 97 decoradores `@app.get/post/put/delete` declarando endpoints DIRETO no main
  - Ao mesmo tempo, `app/api/v1/endpoints/` tem **10+ routers separados** (assignments, counting_lists, cycle_control, import_data, import_produtos, integration_protheus, inventory, inventory_comparison, etc.)
  - Indica refactor **parcial**: alguém começou a separar endpoints em routers e parou no caminho

- **Por que é problema:**
  - Onboarding: dev novo precisa entender 13k linhas pra contribuir
  - Code review: PRs em main.py sempre tocam o mesmo arquivo (conflitos de merge)
  - Testes: difícil mockar/testar endpoints isolados
  - Performance de IDE: parser/lint demora em arquivos enormes
  - Cognitive load: um único arquivo com 97 endpoints + helpers + lifecycle + setup mistura responsabilidades

- **Evidência:**
  ```bash
  $ wc -l inventario/backend/app/main.py
  12878 inventario/backend/app/main.py
  $ grep -cE '^@app\.(get|post|put|delete|patch)' inventario/backend/app/main.py
  97
  $ ls inventario/backend/app/api/v1/endpoints/ | wc -l
  10  # routers separados já existentes
  ```

#### Plano de Refactor

**Fases incrementais — pode ser interrompido a qualquer momento:**

1. **Inventário inicial** (1h): mapear cada endpoint do main.py para um router-alvo:
   - 60% provavelmente cabem em routers existentes (`inventory.py`, `assignments.py`, etc.)
   - 30% precisam de routers novos (`auth.py`, `users.py`, `dashboard.py`, etc.)
   - 10% são lifecycle/setup que ficam mesmo no main.py

2. **Lotes de migração** (2-3h cada, ~10 endpoints por lote):
   - Lote 1: endpoints de auth/users → router `auth.py`
   - Lote 2: endpoints de dashboard → router `dashboard.py`
   - Lote 3-N: refinar routers existentes
   - Cada lote: extrair endpoints, registrar router no main, rodar suite pytest existente, commit

3. **Limpeza final** (2h): main.py vira só lifecycle (startup, shutdown, middleware, exception handlers, mount routers)

**Esforço:** 12-20h em ~6 lotes. Pode ser distribuído em várias sessões.

**Risco:** médio — endpoints existentes funcionam; refactor mantém comportamento. Suite pytest 25 cenários (sessão 10/05 manhã) cobre fluxo principal de contagem. Riscos:
- Imports circulares ao mover endpoints que dependem de utility do main.py
- Mudança de path se algum endpoint estiver com `/api/v1/X` hardcoded em vez de prefix do router
- Hook lifecycle (`@app.on_event`) precisa permanecer no main.py

**Validação:** `pytest tests/` continua passando + smoke test de endpoint random após cada lote.

---

## Achados Médios

### Achado #DT3-M1 — Pares Create/Update DTOs duplicados (gestao-ti)

- **Categoria:** Duplicação (Dimensão 1)
- **Severidade:** Médio
- **Localização:** 6 pares no `gestao-ti/backend/src`:
  - `software/dto/create-software.dto.ts` × `update-software.dto.ts` (38 linhas idênticas)
  - `licenca/dto/create-licenca.dto.ts` × `update-licenca.dto.ts` (51)
  - `equipe/dto/create-equipe.dto.ts` × `update-equipe.dto.ts` (31)
  - `contrato/dto/create-contrato.dto.ts` × `update-contrato.dto.ts` (76 — 2 blocos)
  - `ativo/dto/create-ativo.dto.ts` × `update-ativo.dto.ts` (41)
- **Total:** ~245 linhas duplicadas
- **Plano:** usar `PartialType()` do `@nestjs/mapped-types`:
  ```typescript
  // ANTES
  export class UpdateSoftwareDto { /* repete tudo de Create com ?: */ }
  // DEPOIS
  export class UpdateSoftwareDto extends PartialType(CreateSoftwareDto) {}
  ```
- **Esforço:** 2h (validação extra: confirmar que PartialType cria validators opcionais corretos)
- **Risco:** baixo — pattern oficial NestJS

### Achado #DT3-M2 — Lógica de upload Multer duplicada (chamado × projeto)

- **Categoria:** Duplicação (Dimensão 1)
- **Severidade:** Médio
- **Localização:** `chamado/chamado.controller.ts:296-329` × `projeto/projeto.controller.ts:561-594`
- **Descrição:** 34 linhas de config Multer (`diskStorage`, `destination`, `filename: randomUUID()`, fileFilter MIME) replicadas
- **Plano:** extrair para `gestao-ti/backend/src/common/helpers/multer-config.helper.ts` exportando função fábrica `createMulterConfig({ subdir, mimes })`. Aplicar em:
  - chamado.controller.ts (anexos)
  - projeto.controller.ts (anexos)
  - compra.controller.ts (NF anexos — provavelmente também)
  - conhecimento.controller.ts (artigos)
- **Esforço:** 1-2h
- **Risco:** baixo

### Achado #DT3-M3 — Validação CNPJ replicada no fiscal-backend (7+ lugares)

- **Categoria:** Duplicação (Dimensão 1)
- **Severidade:** Médio
- **Localização:** `cnpj.replace(/\D/g, '')` + `length === 14` repetido em:
  - `fiscal/backend/src/cadastro/cadastro.service.ts:269,613,621`
  - `fiscal/backend/src/cadastro/receita.client.ts:59`
  - `fiscal/backend/src/cadastro/pdf/comprovante-ie-generator.service.ts:284`
  - `fiscal/backend/src/cruzamento/cruzamento.worker.ts:137`
  - `fiscal/backend/src/cte/pdf/dacte-generator.service.ts:749-750`
  - `fiscal/backend/src/nfe/nfe.service.ts:1276-1339` (3x)
- **Plano:** criar `fiscal/backend/src/common/helpers/cnpj.helper.ts`:
  ```typescript
  export function onlyDigits(cnpj: string): string;
  export function isValidCnpjLength(cnpj: string): boolean;
  export function formatCnpj(cnpj: string): string;  // 12.345.678/0001-90
  ```
- **Esforço:** 1h
- **Risco:** baixo — operações puras

### Achado #DT5-M1 — `nfe.service.ts` 1360 linhas / 9 métodos (~150 LOC/método)

- **Categoria:** Funções gigantes (Dimensão 4)
- **Severidade:** Médio
- **Localização:** `fiscal/backend/src/nfe/nfe.service.ts`
- **Descrição:** 9 métodos públicos com média de **150 linhas/método**. Alguns métodos provavelmente fazem múltiplas responsabilidades (consulta + validação + persistência + alerta).
- **Plano:** refactor em 3 sub-services seguindo o pattern de gestao-ti:
  - `NfeConsultaService` (consultas SEFAZ + cache + protocolo)
  - `NfePersistenciaService` (registrar consulta, eventos, status)
  - `NfeFluxoService` (orquestração — chama os outros)
- **Esforço:** 4-6h
- **Risco:** médio (auth/fluxo crítico — testar bem cada caso)

### Achado #DT5-M2 — `dashboard-acompanhamento.service.ts` 1210 linhas

- **Categoria:** Funções gigantes (Dimensão 4)
- **Severidade:** Médio
- **Localização:** `gestao-ti/backend/src/dashboard/services/dashboard-acompanhamento.service.ts`
- **Descrição:** já é sub-service do facade pattern, mas com 1210 linhas pode ser quebrado em mais sub-services (acompanhamento OS, acompanhamento item, KPIs, etc.)
- **Esforço:** 3-4h
- **Risco:** baixo — sub-service interno, sem mudança de API externa

### Achado #DT5-M3 — `chamado-core.service.ts` 1055 linhas

- **Categoria:** Funções gigantes (Dimensão 4)
- **Severidade:** Médio
- **Localização:** `gestao-ti/backend/src/chamado/services/chamado-core.service.ts`
- **Descrição:** mesmo caso de DT5-M2. 17 métodos em 1055 linhas (~62 LOC/método — média OK, mas tem espaço pra quebrar).
- **Esforço:** 3-4h
- **Risco:** baixo

### Achado #DT1-M1 — Dependências não usadas (3 backends Node)

- **Categoria:** Bundle bloat / surface attack (Dimensão 8)
- **Severidade:** Médio
- **Localização:** `package.json` dos 3 backends
- **Detalhe:**

| Backend | Unused (runtime) | Unused (dev) |
|---|---|---|
| auth-gateway | `pino-pretty` ⚠️ | 6 (`@eslint/eslintrc`, `@nestjs/schematics`, `@types/jest`, `source-map-support`, `ts-loader`, `tsconfig-paths`) |
| gestao-ti | `@nestjs/jwt`, `pino-pretty` ⚠️ | 8 |
| fiscal | `pino-http`, `pino-pretty` ⚠️ | 13 |

**⚠️ Cuidado com `pino-pretty`** — é importado dinamicamente pelo `nestjs-pino` em modo dev (transport pretty). Depcheck NÃO detecta imports dinâmicos. Recomendação: **manter** ou mover pra `devDependencies`.

**`@nestjs/jwt` em gestao-ti**: gestao-ti não emite tokens (só valida via JwtStrategy), então pode estar realmente unused. Validar antes de remover.

- **Plano:**
  1. Validar caso a caso (testar build após cada remoção)
  2. Mover `pino-pretty` para devDependencies em todos
  3. Remover devDeps realmente não-usadas
- **Esforço:** 1-2h
- **Risco:** baixo se validar empiricamente; médio se remover sem teste

### Missing dependencies (também flagado por depcheck)

- **gestao-ti**: `multer` e `express` (peerDeps NestJS — ambos OK como transitivos, MAS adicionar como dep direta deixa mais explícito)
- **auth-gateway**: `express`
- **fiscal**: `cron`, `@jest/globals`

Validar antes — pode ser falso positivo (resolvido via deps transitivas).

---

## Achados Baixos

### Achado #DT4-B1 — 91 ocorrências de `: any` (70 concentradas em 2 parsers SEFAZ)

- **Categoria:** Type safety (Dimensão 7)
- **Severidade:** Baixo (decisão consciente nos parsers)
- **Localização:**
  - `fiscal/backend/src/cte/parsers/cte-parser.service.ts` — 46 ocorrências
  - `fiscal/backend/src/nfe/parsers/nfe-parser.service.ts` — 23 ocorrências
  - `gestao-ti/backend/src/export/export.service.ts` — 7 ocorrências
  - 21 ocorrências espalhadas em outros arquivos
- **Análise:** 70 das 91 ocorrências (77%) estão nos parsers de XML SEFAZ — **decisão consciente** porque XML retornado pela SEFAZ tem estrutura dinâmica e variável por UF/versão de schema. Tipagem rígida ali seria contraproducente.
- **Plano:** focar nas 21 ocorrências espalhadas, tipar progressivamente. Não tocar nos parsers SEFAZ.
- **Esforço:** 2-4h
- **Risco:** baixo

### Achado #DT2-B1 — Dead code real (11 exports não importados)

- **Categoria:** Dead code (Dimensão 2)
- **Severidade:** Baixo
- **Detecção:** `ts-prune` em gestao-ti + fiscal
- **Localização:**

  **gestao-ti (2):**
  - `src/chamado/dto/resolver-chamado.dto.ts:10 — FecharChamadoDto`
  - `src/notificacao/dto/create-notificacao.dto.ts:4 — CreateNotificacaoDto`

  **fiscal (9):**
  - `src/sefaz/sefaz-endpoints.map.ts:281 — RATE_LIMIT_POR_UF`
  - `src/common/constants/roles.constant.ts:35-38 — isAdminTi, isGestorFiscal, isAnalistaCadastro`
  - `src/common/helpers/chave.helper.ts:72,81,140 — cnpjEmitenteFromChave, dataEmissaoFromChave, assertChaveValida`
  - `src/protheus/interfaces/eventos-nfe.interface.ts:66 — EventosNfeErrorBody`
  - `src/protheus/interfaces/xml-fiscal.interface.ts:85,125 — XmlFiscalPostStatus, XmlFiscalErrorBody`

  **auth-gateway:** zero dead code (todos exports são "used in module")

- **Análise:** alguns desses (helpers `chave.helper`, `roles` checkers) podem ser **utility functions** previstas para uso futuro mas ainda não consumidas. Outros (DTOs, interfaces de erro) parecem genuinamente abandonados.

- **Plano:**
  1. Para cada export, validar se é "intencional pra futuro" ou "deletável". Critério: se a função tem comentário/JSDoc claro e parece útil, marcar como `@public-api` e deixar; senão, remover.
  2. Aplicar em lote único após análise individual.
- **Esforço:** 30min análise + 30min remoção/anotação
- **Risco:** baixo — ts-prune confirma zero referências

### Achado #DT3-B2 — Setup pino logger duplicado (gestao-ti × fiscal)

- **Categoria:** Duplicação (Dimensão 1)
- **Severidade:** Baixo
- **Localização:** `gestao-ti/backend/src/app.module.ts:31-62` × `fiscal/backend/src/app.module.ts:29-60` (32 linhas idênticas)
- **Análise:** config `LoggerModule.forRoot` com `genReqId`, redact, customLogLevel etc. Aceitável manter como está — backends são independentes, refactor exigiria package compartilhado (over-engineering pra plataforma de 4 backends).
- **Plano:** **NÃO refatorar** nesta frente. Documentado pra contexto futuro.

---

## Pontos Fortes Identificados

1. **Zero mistura de validação** — 84 arquivos usam class-validator, 0 usam Zod. Consistência total.
2. **Zero dead code real** em auth-gateway (ts-prune confirmou — todos exports são usados internamente).
3. **0.8% de duplicação geral** (jscpd) — base bem DRY.
4. **`fiscal/backend/src/common/helpers/`** já existe — boa estrutura para receber novos helpers (cnpj.helper, etc).
5. **Facade pattern ativo em gestao-ti** (sub-services em `chamado/services/`, `projeto/services/`, etc).
6. **Pasta `endpoints/` em inventário existe** (refactor parcial mostra intenção correta).
7. **DTO patterns consistentes** (Create + Update em pares previsíveis).
8. **AbortSignal/timeouts/error handling padronizado** em integrações backend (já confirmado em Frente 6).

---

## Roadmap consolidado de refactor — Fase 5.2

### Sprint 1 — Quick wins (~5h, baixo risco)

- [ ] **DT3-M1** — `PartialType()` nos 6 pares Create/Update (2h) — elimina 245 linhas
- [ ] **DT3-M3** — Helper `cnpj.helper.ts` no fiscal (1h)
- [ ] **DT3-M2** — Helper `multer-config.helper.ts` no gestao-ti (1-2h)
- [ ] **DT1-M1 (parcial)** — Mover `pino-pretty` pra devDeps + remover devDeps óbvias (1h)

### Sprint 2 — Refactor médio (~10-14h, baixo-médio risco)

- [ ] **DT5-M2** — Quebrar `dashboard-acompanhamento.service.ts` (3-4h)
- [ ] **DT5-M3** — Quebrar `chamado-core.service.ts` (3-4h)
- [ ] **DT5-M1** — Refactor `nfe.service.ts` em 3 sub-services (4-6h) — testar exaustivamente

### Sprint 3 — Refactor grande (~12-20h, médio risco)

- [ ] **DT5-A1** — Migrar 97 endpoints de `inventario/main.py` para routers (em 6 lotes de ~10 endpoints)

### Backlog (~2-4h)

- [ ] **DT4-B1** — Tipar 21 ocorrências de `: any` espalhadas
- [ ] **DT1-M1 (validar)** — `@nestjs/jwt` em gestao-ti, missing deps

---

## Estimativa de esforço total

- **Sprint 1 (Quick wins):** 5h
- **Sprint 2 (Refactor médio):** 10-14h
- **Sprint 3 (Refactor grande):** 12-20h
- **Backlog:** 2-4h
- **TOTAL:** **29-43h**

---

## Decisões pendentes (Fase 5.2)

Conforme `PLAYBOOK_AUDITORIA_v1.md` — Frente 5 tem **duas fases obrigatórias**: mapa+plano (5.1, esta) e refactor (5.2). **Fase 5.2 só pode começar após sua aprovação dos lotes.**

Decisões a tomar:

1. **Sprint 1 (5h, quick wins) — aprovar e aplicar agora?**
   - PartialType DTOs, helpers CNPJ + Multer, dev deps cleanup
   - Risco baixo, ganho imediato em manutenção

2. **Sprint 2 — qual ordem?**
   - dashboard-acompanhamento e chamado-core são sub-services internos (baixo risco)
   - nfe.service é caminho crítico de auth/fluxo Fiscal (médio risco)
   - Recomendação: dashboard + chamado primeiro; nfe depois com testes adicionais

3. **Sprint 3 (refactor main.py) — fazer agora ou priorizar Frente 2/3?**
   - 12-20h é esforço significativo. Pode ser feito em sessões espaçadas.
   - Pré-requisito: Douglas voltar (alterações grandes no Inventário precisam soak HOM)
   - Alternativa: deixar pra próximo trimestre, Sprint 1+2 já dão grande melhora

---

## Próximos passos

1. **Pausa para alinhamento** — apresentar este mapa ao Clenio
2. Após aprovação, executar Sprint 1 nesta sessão (5h)
3. Sprint 2 e 3 ficam pra sessões futuras conforme prioridade
4. Itens **não aplicados** ficam no relatório como "Backlog priorizado" para próxima execução da frente continuar de onde parou (regra do playbook)

Branch `audit/divida-tecnica` permanece viva até deploy do roteiro Dívida Técnica ser aplicado em PROD (com Douglas, depois das férias).
