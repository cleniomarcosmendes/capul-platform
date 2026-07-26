# Roteiro de Finalizacao - Capul Platform

**Versao**: 1.5
**Data**: 06/06/2026
**Objetivo**: Procedimento padrao apos finalizar ajustes no sistema

**Modulos cobertos**: auth-gateway, hub, gestao-ti, inventario, configurador, **fiscal**, **logistica**

---

## Quando Usar

Use este roteiro **SEMPRE QUE**:
- Finalizar um conjunto de ajustes/correcoes
- Implementar nova funcionalidade em qualquer modulo
- Corrigir bugs importantes
- Apos sessao longa de desenvolvimento
- Antes de encerrar o dia de trabalho

---

## Prompts para Executar

```
# Roteiro completo (recomendado)
"Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2"

# Apenas documentacao e commits
"Execute ETAPA 0 + ETAPA 1 do roteiro"

# Apenas verificacao e limpeza
"Execute ETAPA 2 do roteiro"

# Apenas commits organizados
"Execute ETAPA 1 do roteiro"
```

---

## ETAPA 0: Documentacao (OBRIGATORIA)

### 0.1 Verificar o Que Mudou
**Perguntas a responder**:
- Qual modulo foi alterado? (auth-gateway, hub, gestao-ti, inventario, configurador)
- Foi bug fix, feature nova, refatoracao?
- Precisa atualizar CLAUDE.md raiz?
- Precisa atualizar MEMORY.md?

### 0.2 Documentos a Atualizar

| # | Documento | O que atualizar | Quando |
|---|-----------|-----------------|--------|
| 1 | **CLAUDE.md** (raiz) | Data de ultima atualizacao | Sempre |
| 2 | **MEMORY.md** | Status da fase/sprint atual | Se mudou estado do projeto |
| 3 | **CLAUDE.md do modulo** | Se houver (ex: inventario/CLAUDE.md) | Se mudou arquitetura do modulo |

### 0.3 Regras
- NAO criar arquivos de documentacao desnecessarios
- NAO duplicar informacao que ja esta no codigo
- Manter CLAUDE.md raiz como fonte da verdade para arquitetura
- Manter MEMORY.md como fonte da verdade para estado do projeto

---

## ETAPA 1: Analise e Commits (OBRIGATORIA)

### 1.1 Verificar Status do Git
```bash
git status
git diff --stat
```

### 1.2 Analisar Alteracoes por Servico
Agrupar mudancas por modulo:
- `auth-gateway/` → commits separados
- `gestao-ti/backend/` → commits separados
- `gestao-ti/frontend/` → commits separados
- `fiscal/backend/` → commits separados
- `fiscal/frontend/` → commits separados
- `logistica/backend/` → commits separados
- `logistica/frontend/` → commits separados
- `hub/` → commits separados
- `configurador/` → commits separados
- `inventario/` → commits separados
- `nginx/` → commits separados
- Raiz (`docker-compose.yml`, `CLAUDE.md`, etc.) → commit proprio

### 1.3 Regras de Commit
1. **1 commit = 1 funcionalidade/correcao**
2. **Mensagem clara** descrevendo o que e por que
3. **Formato padrao**:
```
<tipo>(<escopo>): <descricao>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

**Tipos**: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`
**Escopos**: `gestao-ti`, `auth-gateway`, `hub`, `configurador`, `inventario`, `fiscal`, `nginx`, `platform`

### 1.4 Verificacao Pos-Commit
```bash
git status    # Deve estar limpo
git log -5    # Verificar commits recentes
```

### 1.5 NUNCA fazer automaticamente
- Push para remoto sem aprovacao
- Commits sem verificar alteracoes
- Amend em commits ja publicados

---

## ETAPA 2: Verificacao e Limpeza (RECOMENDADA)

### 2.1 Verificacao de Builds
```bash
# Backend gestao-ti
cd gestao-ti/backend && npx tsc --noEmit

# Frontend gestao-ti
cd gestao-ti/frontend && npx tsc --noEmit

# Auth gateway
cd auth-gateway && npx tsc --noEmit

# Backend fiscal (NestJS 11 + Prisma 6)
cd fiscal/backend && npx tsc --noEmit

# Frontend fiscal (React + Vite)
cd fiscal/frontend && npx tsc --noEmit

# Backend logistica (NestJS 11 + Prisma 6)
cd logistica/backend && npx tsc --noEmit

# Frontend logistica (React + Vite)
cd logistica/frontend && npx tsc --noEmit

# App entregador/supervisor (Expo — NAO sobe em container, ver 2.7.1)
cd logistica/app && npm run typecheck
```

### 2.1.1 Testes Automatizados (OBRIGATORIO se mexeu em logica)

`tsc --noEmit` so checa tipos — **nao roda os testes**. Se a sessao tocou regra de
negocio/guard/parser, rodar as suites. **Falha em teste = NAO finalizar.**

```bash
# Backends NestJS com Jest (specs em src/**/*.spec.ts)
cd gestao-ti/backend && npm test
cd fiscal/backend    && npm test
cd logistica/backend && npm test

# Inventario (FastAPI/pytest)
cd inventario/backend && python -m pytest -q

# App entregador (Jest)
cd logistica/app && npm test
```

> Se criou regra nova sem teste, **adicione o teste** (padrao: `createPrismaMock`
> nos NestJS). Cobertura minima esperada: guards de RBAC/filial, FSM de status,
> parsers e calculos.
```bash
# Status dos containers
docker compose ps

# Verificar logs de erro (todos os backends)
docker compose logs --tail 5 auth-gateway gestao-ti-backend fiscal-backend logistica-backend 2>&1 | grep -i error

# Verificar uso de disco
docker system df
```

### 2.2.1 Health checks especificos do Fiscal
```bash
# Health endpoints
curl -sk https://localhost/api/v1/fiscal/health        # DB + Redis + SMTP
curl -sk https://localhost/api/v1/fiscal/ambiente      # PRODUCAO/HOMOLOGACAO
curl -sk https://localhost/api/v1/fiscal/certificado   # Certificado A1 ativo

# Certificado A1 — dias para vencer (ALERTA se < 30 dias)
docker compose exec fiscal-backend sh -c 'ls -la /app/certs/'
```

### 2.3 Verificacao de Migrations

A partir de 05/05/2026 (v1.4), Prisma migrations sao aplicadas automaticamente
pelos init jobs `*-migrate` no `docker compose up -d`. Esta verificacao serve
como **auditoria pos-deploy**, nao como passo de aplicacao.

```bash
# Auditoria agregada schema x migrations (todos os backends Prisma de uma vez)
./scripts/check-migrations-all.sh
# Cobre: auth-gateway, fiscal/backend, gestao-ti/backend, logistica/backend.
# Esperado: "✓ Todos os N backends estao consistentes (schema vs migrations)."

# Auditoria dos init jobs (devem ter saido com exit 0)
docker compose ps --all | grep -E "auth-migrate|gestao-ti-migrate|fiscal-migrate|logistica-migrate"
# Esperado: cada um em "Exited (0)"

# Status detalhado por backend (deve mostrar "Database schema is up to date")
docker compose exec auth-gateway npx prisma migrate status
docker compose exec gestao-ti-backend npx prisma migrate status
docker compose exec fiscal-backend npx prisma migrate status
docker compose exec logistica-backend npx prisma migrate status
```

**Se algum init job aparecer "Exited (1)":**
```bash
# Investigar logs do init que falhou
docker compose logs <servico>-migrate | tail -50

# Apos corrigir a causa raiz (migration mal escrita, FK quebrada, etc.):
docker compose run --rm <servico>-migrate
# Idempotente — re-aplica apenas migrations pendentes.
```

**Inventario** continua com SQL manual (sem init job equivalente):
```bash
docker compose exec postgres psql -U capul_user -d capul_platform \
  -c "SELECT * FROM inventario.schema_migrations ORDER BY id"
```

### 2.4 Analise de Arquivos Orfaos
```bash
# Arquivos nao rastreados pelo git
git ls-files --others --exclude-standard

# Arquivos grandes (>5MB) excluindo node_modules, .git, dist
find . -type f -size +5M ! -path "./.git/*" ! -path "*/node_modules/*" ! -path "*/dist/*" -exec ls -lh {} \;

# Verificar se ha .env ou credenciais expostas
git ls-files | grep -E "\.env$|credentials|secret"
```

**Procedimento para arquivos > 5MB encontrados:**

1. **PERGUNTAR ao usuario, arquivo por arquivo** — nunca deletar automatico.
   Mostrar caminho + tamanho + data, ele decide.
2. Tipicos candidatos a remocao (com confirmacao):
   - `estrutura.txt` na raiz (snapshot da arvore — gera grande)
   - JSONs de teste em `*/docs/archive/tests/` (resquicios de testes antigos)
   - Logs em `*.log` se nao estiverem em `.gitignore`
3. **Apos remover arquivos**, verificar pastas vazias:
   ```bash
   find . -type d -empty ! -path "./.git/*" ! -path "*/node_modules/*"
   ```
   E remover com `rmdir` (so remove se vazia — seguro).
4. **NUNCA adicionar arquivos > 5MB ao git** sem alinhamento (poluiria o repo).

### 2.5 Limpeza Docker (com confirmacao)
```bash
# Mostrar uso atual de disco (sempre primeiro — visibilidade)
docker system df

# Imagens dangling (sem tag) — seguro, sem confirmacao
docker image prune -f

# Build cache antigo > 24h — preserva cache da sessao atual
# (foi 168h ate 04/05/2026; trocado pra 24h porque sessoes longas geram
#  muito cache e 168h quase nada e antigo o suficiente pra liberar)
docker builder prune -f --filter "until=24h"
```

**Por que 24h e nao 168h?** Em desenvolvimento ativo (multiplos builds/dia),
cache de 168h libera quase nada. Cache de 24h libera ~8-15GB tipicamente,
preservando o que acelerou builds da sessao atual.

#### Inspecao de volumes dangling — uso de container temporario (sem sudo)

Em WSL2, `sudo ls` no Mountpoint do volume pede senha (sem TTY).
Use container Alpine temporario:
```bash
# Listar volumes dangling
docker volume ls -q --filter dangling=true

# Inspecionar conteudo SEM sudo (para cada volume)
for v in $(docker volume ls -q --filter dangling=true | grep -E "^[a-f0-9]{64}$"); do
  echo "=== Volume: $v ==="
  docker volume inspect $v --format 'Criado: {{.CreatedAt}}'
  docker run --rm -v $v:/data alpine sh -c 'du -sh /data; ls -la /data | head -10'
  echo ""
done
```

#### ⚠️ Volumes órfãos — NUNCA prune automático

**NUNCA rodar `docker volume prune -f`** sem revisão manual.

O comando remove TODOS os volumes sem container associado, incluindo volumes nomeados
do projeto (ex.: `capul_inventario_postgres_data`, `capul_inventario_pgadmin_data`) que
podem conter dados históricos de versões anteriores da plataforma — legado do setup
pré-multi-schema, backups de migração, dados de dev que nunca foram transferidos.

**Procedimento obrigatório** quando o roteiro ETAPA 2.5 detectar volumes órfãos:

1. Listar os volumes órfãos primeiro:
   ```bash
   docker volume ls -q --filter dangling=true
   ```
2. **Separar** em dois grupos visualmente:
   - **Anônimos** (hash de 64 chars `[a-f0-9]`): gerados pelo próprio build/runtime, seguros
   - **Nomeados** (começam com `capul_*`, `fiscal_*`, etc.): dados nomeados do projeto
3. **Inspecionar conteúdo** dos anônimos primeiro (snippet acima) — ver o que tem dentro.
   Pode haver volume de PgAdmin/etc. com configurações que o usuário queira preservar.
4. Para os **anônimos**, remover apenas após confirmar com o usuário:
   ```bash
   docker volume ls -q --filter dangling=true | grep -E "^[a-f0-9]{64}$" | xargs -r docker volume rm
   ```
5. Para cada **volume nomeado**, PARAR e **PERGUNTAR ao usuário antes de deletar**.
   Se ele não souber de cabeça, mostrar inspeção (mesmo snippet) — tamanho + mountpoint
   + últimos arquivos modificados. Só deletar após confirmação explícita.

**Incidentes de referência:**
- **13/04/2026**: encontrados 12 volumes órfãos, dos quais 3 eram `capul_inventario_*_data`
  (resquícios do setup antigo quando o inventário tinha seu próprio PostgreSQL).
  `docker volume prune -f` teria deletado dados históricos.
- **04/05/2026**: 2 volumes anônimos detectados eram `pgadmin4.db` antigos (24/04 e 27/04).
  Volume ATIVO do PgAdmin tinha nome diferente (configurações preservadas), os 2 órfãos
  eram realmente sobras de redeploys. Inspeção via container Alpine confirmou antes de remover.

### 2.6 Limpeza de Cache Local
```bash
# Cache Python (inventario)
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null
find . -type f -name "*.pyc" -delete

# Arquivos temporarios
find . -type f -name ".DS_Store" -delete
find . -type f -name "*.log" ! -path "./.git/*" -delete 2>/dev/null
```

### 2.7 Verificacao de Impacto em Migracao
Verificar se houve alteracoes em arquivos que impactam o roteiro de migracao para producao:
```bash
# Arquivos que impactam migracao (verificar nos commits da sessao)
git diff --name-only HEAD~5 | grep -E "(schema\.prisma|docker-compose\.yml|Dockerfile|migrations/|migrate\.sh|\.env)"
```

**Se houver alteracoes**: verificar se `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` precisa ser atualizado.
Cenarios que exigem atualizacao:
- Novo modelo/tabela no Prisma schema
- Mudanca no docker-compose (portas, volumes, servicos)
- Novo Dockerfile ou mudanca de CMD
- Nova migration SQL no inventario
- Mudanca na estrategia de deploy

### 2.7.1 Verificacao de Impacto no App Entregador (`logistica/app`)

O app **nao sobe em container**: ele chega no aparelho por OTA (bundle JS) ou por APK
novo (nativo). O `docker compose` do deploy **nao entrega nada disso** — se esta etapa
for pulada, o codigo fica no `main` e nunca chega no entregador.

```bash
# A sessao tocou o app?
git diff --name-only HEAD~5 | grep "^logistica/app/"
```

**Classificar a mudanca** (define o que vai no roteiro de deploy):

| Mudou | Chega por | Bumpar? |
|---|---|---|
| So `src/`, `App.tsx` (JS/TS puro) | **OTA** (`npm run ota:homolog` → validar → `npm run ota:promote`) | nada |
| `assets/` (icone/splash) | **APK novo** — recurso nativo, OTA nao troca icone | so `versionCode`, **se o APK anterior ja foi distribuido** |
| `app.json` (permissao, plugin, SDK), `plugins/`, dep nativa nova | **APK novo** | **`runtimeVersion` + `versionCode`** (REGRA DO BUMP) |

> ⚠️ **REGRA DO BUMP** (`memory/feedback_app_ota_runtime_fixo_bump.md`): o EAS so entrega
> OTA cujo `runtimeVersion` bate com o do APK instalado. Mexeu em nativo e **nao** bumpou →
> o OTA novo (que exige o nativo novo) **crasha** o APK antigo. Bumpou o `runtimeVersion` →
> os aparelhos so voltam a receber OTA **depois** de reinstalar o APK.
> Icone/splash sao excecao: sao nativos, mas **nao** mudam a compatibilidade JS↔nativo,
> entao **nao** bumpam `runtimeVersion`.

**RBAC — espelho obrigatorio** (`memory/feedback_app_rbac_espelha_backend.md`): se a sessao
adicionou/alterou papel nos `@Roles` de `logistica/backend` (frota, supervisor, entregas),
espelhar em `logistica/app/src/screens/HomeScreen.tsx` (`ROLES_ENTREGA` / `ROLES_FROTA` /
`ROLES_SUPERVISOR`). Sem isso o app **barra na porta quem a API autoriza**.
Testar com a **persona real** do papel, nunca com ADMIN (ADMIN passa em tudo e esconde o bug).

### 2.7.2 Gate de RBAC: menu x backend (se mexeu em papel, menu ou @Roles)

Classe de defeito que **mordeu 3x** (25-26/07): o item aparece no menu para um
papel que o backend nao admite. A tela abre, lista e **morre no clique com 403**.
Casos reais: `OPERADOR_ENTREGA` x cofre de comprovantes (`7531175`),
`GESTOR_FROTA` x painel de entregas (`f4697de`).

**Regra de ouro: grep levanta hipotese, HTTP conclui.** Na varredura de 26/07 o
grep errou 3x — `@Roles` pode vir DEPOIS do `@Get`, pode estar separado do
`@Controller` por bloco de comentario, e guarda de estado pode morar em helper
(`rascunhoOuErro`). **Nunca feche o gate sem bater no endpoint.**

```bash
# 1) Monte a matriz: para cada item de menu, o papel que o menu mostra
#    (frontend: layouts/Sidebar.tsx ou Layout.tsx) x o @Roles do endpoint.
# 2) Bata no endpoint com token de CADA papel afetado. Procure 403 onde o
#    menu mostra o item.
TK=$(curl -sk -X POST https://localhost/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"login":"<usuario_do_papel>","senha":"<senha>"}' \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
curl -sk -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TK" \
     "https://localhost/api/v1/<modulo>/<rota-da-tela>"
```

⚠️ **200 nao e prova de exposicao, nem 403 e prova de bug.** Compare o
**conteudo** entre um papel baixo e o ADMIN: no Workspace, 11 telas devolviam
200 ao `USUARIO_FINAL` mas com lista **vazia** (o filtro esta na camada de
servico). E o `GET /equipes` aberto e **decisao documentada** — bloquear
quebraria Chamados para 105 usuarios. Explicite a decisao de design, nao
silencie o achado.

### 2.7.3 Endpoint novo: tem guarda? (obrigatorio no Inventario)

- **NestJS** (gestao-ti, fiscal, logistica, auth-gateway): `JwtAuthGuard` e
  `APP_GUARD` global — endpoint novo ja nasce autenticado, e `@Public()` e a
  excecao. Conferir so a AUTORIZACAO (`@Roles` / `@RoleMinima` /
  `@RequiresFuncionalidade`).
- **Inventario (FastAPI)**: **NAO ha guarda global**. Rota sem `Depends(...)` de
  auth fica ABERTA. Em 26/07 foram encontradas 6 assim, uma delas gravando em
  tabela mestre e alcancavel de fora (`41035b4`).

```bash
# Rotas do inventario sem QUALQUER dependencia de auth (esperado: so /health)
cd inventario/backend && python3 - <<'PY'
import re
L=open('app/main.py',encoding='utf-8').read().split('\n')
r=re.compile(r'^@app\.(get|post|put|patch|delete)\("([^"]+)"')
for i,l in enumerate(L):
    m=r.match(l)
    if not m: continue
    sig=[]
    for k in range(i+1,min(len(L),i+45)):
        sig.append(L[k])
        if L[k].rstrip().endswith('):'): break
    s='\n'.join(sig)+l
    if not any(x in s for x in ('current_user','require_staff_role','get_current','Depends(require')):
        print(m.group(1).upper(), m.group(2))
PY
# Confirme com HTTP: sem token deve dar 401/403 (menos /health)
```

⚠️ **Antes de APAGAR um endpoint, procure consumidor** — inclusive scripts, nao
so o frontend. Em 26/07 as `clear/{tabela}` pareciam mortas e eram usadas por
`scripts/cleanup_inventories.py`; foram protegidas em vez de removidas. E
remover uma rota nao garante que ela sumiu: pode haver **implementacao gemea**
em outro arquivo (foi o caso do `import/bulk`) — confirme com HTTP que virou 404.

### 2.8 Revisao de Codigo (gate antes do push)

Para features grandes ou que tocam **seguranca/RBAC/dados**, passar uma revisao
antes de o Clenio fazer o push:

```
# Revisao cloud multi-agente da branch (acionada pelo Clenio — billed)
/code-review ultra            # branch local atual vs main
/code-review ultra <PR#>      # PR do GitHub

# Se a ultrareview falhar (rate limit) ou para diffs menores:
# revisao manual do diff (Claude le os arquivos criticos e tria por severidade)
git diff --stat main...HEAD
```

Triar achados por severidade (bug/seguranca > consistencia > estilo); corrigir
em sub-fases verificadas (os testes da 2.1.1 pegam regressao). **Falso-positivo
e decisao de design devem ser explicitados, nao silenciados.**

**Mensagem de erro generica e defeito, nao detalhe.** Um `catch` que engole a
resposta do servidor (`toast('Falha ao salvar.')`) esconde a causa e custa dias
de diagnostico — aconteceu 3x: o 403 do cofre de comprovantes, o 500 que
mascarava um 400 no `import/bulk`, e o clique duplo de 26/07. Ao revisar, marcar
todo `catch` que descarta `error.response.data.message`. O ramo de edicao
(PATCH) do cadastro de entrega ja fazia certo e o de criacao (POST) nao —
divergencia dentro do MESMO arquivo passa despercebida sem esse olhar.

### 2.9 Relatorio Final
Ao concluir, apresentar:

```
=== RELATORIO DE FINALIZACAO ===

ETAPA 0 - Documentacao:
  [x] CLAUDE.md atualizado (data: DD/MM/AAAA)
  [x] MEMORY.md atualizado (se aplicavel)

ETAPA 1 - Commits:
  [x] N commits realizados
  [x] Arquivos commitados: X
  [x] Status git: limpo

ETAPA 2 - Verificacao:
  [x] Build backend: OK/ERRO
  [x] Build frontend: OK/ERRO
  [x] Containers: X/Y rodando
  [x] Migrations: em dia
  [x] Arquivos orfaos: N encontrados
  [x] Limpeza Docker: Xmb liberados

ALERTA MIGRACAO:
  [ ] Arquivos de infra alterados: SIM/NAO
      Se SIM → Atualizar docs/ROTEIRO_MIGRACAO_PRODUCAO.md

ALERTA APP ENTREGADOR:
  [ ] logistica/app alterado: SIM/NAO
      Se SIM → Entrega por: OTA / APK novo (nativo)
                Bump: runtimeVersion SIM/NAO | versionCode SIM/NAO
                RBAC do backend espelhada no HomeScreen: SIM/NAO/NA
                → Registrar no roteiro de deploy (secao 2.10)

================================
```

---

## Roteiro Completo (Checklist)

### Pre-Finalizacao
- [ ] Todos os ajustes concluidos e testados
- [ ] Sistema funcionando (docker compose ps)

### ETAPA 0: Documentacao
- [ ] Atualizar **CLAUDE.md** raiz (data)
- [ ] Atualizar **MEMORY.md** (se estado mudou)

### ETAPA 1: Commits
- [ ] `git status` verificado
- [ ] `git diff --stat` revisado
- [ ] Commits organizados por modulo
- [ ] Status final limpo

### ETAPA 2: Verificacao e Limpeza
- [ ] Builds OK (tsc --noEmit)
- [ ] **Testes automatizados passando** (npm test / pytest) — se mexeu em logica
- [ ] Containers saudaveis
- [ ] Migrations em dia (`./scripts/check-migrations-all.sh`)
- [ ] Arquivos orfaos analisados
- [ ] Limpeza Docker (se necessario)
- [ ] Impacto em migracao verificado (schema, docker-compose, Dockerfile)
- [ ] **Impacto no app entregador verificado** (OTA x APK novo, REGRA DO BUMP, RBAC espelhada) — se mexeu em `logistica/app`
- [ ] **Gate RBAC menu x backend** (2.7.2) — se mexeu em papel, menu ou `@Roles`. Bater no endpoint com token de cada papel; grep nao conclui
- [ ] **Endpoint novo tem guarda** (2.7.3) — obrigatorio no Inventario (FastAPI sem guarda global); antes de apagar rota, procurar consumidor
- [ ] **Revisao de codigo** (feature grande / toca seguranca) — gate antes do push
- [ ] Relatorio apresentado

---

## Avisos Importantes

### NUNCA fazer automaticamente:
- Commits sem verificar alteracoes
- Push para remoto sem aprovacao
- Remocao de arquivos sem confirmar
- `docker system prune` sem perguntar
- Reset ou checkout destrutivo

### Pode fazer automaticamente:
- Limpar `__pycache__/` e `*.pyc`
- Remover `.DS_Store`
- Verificar builds (tsc --noEmit)
- Verificar status de containers
- Gerar relatorio

---

## Checklist especifico do Modulo Fiscal

Aplicar este checklist **sempre que houver alteracoes em `fiscal/`**:

### Backend (`fiscal/backend/`)
- [ ] `npx tsc --noEmit` sem erros
- [ ] `docker compose build fiscal-backend` OK
- [ ] Container `capul-fiscal-api` saudavel (`docker compose ps`)
- [ ] Endpoint `/api/v1/fiscal/health` retorna 200 com DB+Redis OK
- [ ] Endpoint `/api/v1/fiscal/ambiente` retorna `PRODUCAO` ou `HOMOLOGACAO` (conforme `.env`)
- [ ] Certificado A1 ativo (`/api/v1/fiscal/certificado`) + validade > 30 dias
- [ ] Se alterou `schema.prisma`: gerar ALTER SQL (via `prisma migrate diff`) e aplicar via psql
- [ ] Se alterou clients SEFAZ: testar com CNPJ real (ex: CAPUL 25834847000100) + CCC
- [ ] Se alterou DANFE/DACTE: gerar PDF de amostra e revisar visualmente
- [ ] BullMQ jobs (`fiscal-cruzamento`, `fiscal-alertas`, `fiscal-scheduler`) iniciando sem erros
- [ ] Circuit breaker por UF em estado `CLOSED` (nao acumulou falhas)

### Frontend (`fiscal/frontend/`)
- [ ] `npx tsc --noEmit` sem erros
- [ ] `docker compose build fiscal-frontend` OK
- [ ] Container `capul-fiscal-web` saudavel
- [ ] Rota `https://localhost/fiscal/` carrega sem erro 404/500
- [ ] Sidebar com layout padronizado do Gestao TI (fundo escuro, "Voltar ao Hub")
- [ ] `NfeConsultaPage`, `CteConsultaPage`, `CadastroConsultaPage`, `ReceitaFederalCard` renderizam
- [ ] `ErrorCard` exibindo mensagens contextuais (4 layouts: notFound, cert, unavailable, emitidaPeloConsulente)

### Infraestrutura Fiscal
- [ ] `docker-compose.yml`: servicos `fiscal-backend` (3002) e `fiscal-frontend` (5176) OK
- [ ] `nginx/nginx.conf`: upstreams `fiscal_backend` + `fiscal_frontend` configurados
- [ ] Volume de certificados montado em `:rw` (nao `:ro` — precisa para upload)
- [ ] Variaveis de ambiente: `FISCAL_CNPJ_CONSULENTE`, `FISCAL_PROTHEUS_MOCK`, `PROTHEUS_API_URL`
- [ ] `.env` com `JWT_SECRET` compartilhado com auth-gateway (autenticacao unificada)

### Documentos especificos do Fiscal
- [ ] `docs/PLANO_MODULO_FISCAL_v1.x.docx` — plano mestre do modulo (atualizar se mudou escopo)
- [ ] `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` — contrato com Protheus (xmlFiscal + cadastral)
- [ ] Se houve mudanca em schemas SEFAZ: documentar no MEMORY.md

### Pendencias criticas de go-live (verificar a cada finalizacao)
1. ⚠️ **Certificado A1** — data de vencimento (renovar 30d antes)
2. ⚠️ **FISCAL_PROTHEUS_MOCK=false** em producao (trocar apos reuniao com time Protheus)
3. ⚠️ **ReceitaWS rate limit** — 3 req/min no plano gratuito. Avaliar Serpro para producao intensa.
4. ⚠️ **Fallback BrasilAPI → ReceitaWS** — verificar se ambas estao respondendo

---

## Checklist especifico do App Entregador (`logistica/app`)

Aplicar **sempre que houver alteracoes em `logistica/app/`**. O app e o unico artefato
da plataforma que **nao e entregue pelo deploy do servidor** — quem entrega e o Clenio
(OTA) ou a TI (APK). Ver `logistica/app/docs/OTA_DOIS_AMBIENTES.md`.

### Codigo
- [ ] `npm run typecheck` sem erros
- [ ] `npm test` passando
- [ ] Papel novo/alterado no backend da logistica espelhado no `HomeScreen.tsx` (`ROLES_*`)
- [ ] Testado com a **persona real** do papel (nao com ADMIN)

### Entrega — decidir e registrar (secao 2.7.1)
- [ ] Classificado: **OTA** (so JS) x **APK novo** (nativo: `app.json`, `plugins/`, `assets/`, dep nativa)
- [ ] Se nativo que o JS novo exige: `runtimeVersion` **e** `versionCode` bumpados
- [ ] Se so icone/splash: `versionCode` bumpado **apenas se o APK anterior ja foi distribuido**
      (`runtimeVersion` **nao** muda — nao afeta compatibilidade JS↔nativo)
- [ ] Publicacao segue o fluxo: `npm run ota:homolog` → validar em campo → `npm run ota:promote`
      (**nada chega em producao sem passar por HLG**)
- [ ] Se a mudanca depende de endpoint novo: OTA/APK **so depois** do deploy do backend em PROD
- [ ] Registrado na secao 2.10 do roteiro de deploy (`docs/_TEMPLATE_Roteiro_Deploy.md`)

### Compatibilidade com quem esta em campo
- [ ] O backend novo continua respondendo a versao do app **ja instalada** nos aparelhos
      (entregador offline / que adiou o update roda o bundle antigo por dias)

---

**Ultima Atualizacao**: 13/07/2026
**Versao**: 1.6

## Changelog

- **1.6 (13/07/2026)**: **App entregador (`logistica/app`) incluido** — antes o roteiro
  ignorava o app inteiro, que nao sobe em container e nao e entregue pelo deploy do
  servidor. Novo passo **2.7.1** (classificar OTA x APK novo, REGRA DO BUMP, espelho da
  RBAC no `HomeScreen.tsx`), `typecheck`/`test` do app nas secoes 2.1/2.1.1, alerta no
  relatorio final e **checklist especifico do App Entregador**.
- **1.5 (06/06/2026)**: Modulo **logistica** incluido (builds, logs, migrations,
  commits). Nova secao **2.1.1 Testes Automatizados** (`npm test`/pytest — antes
  o roteiro so checava `tsc`, nao rodava as suites). Secao 2.3 passa a usar
  `scripts/check-migrations-all.sh` (auditoria agregada, agora cobrindo logistica).
  Nova secao **2.8 Revisao de Codigo** (gate `/code-review ultra` ou revisao
  manual antes do push). Derivado do hardening + revisao da Fase 1a da logistica.
- **1.4 (05/05/2026)**: Secao 2.3 "Verificacao de Migrations" reescrita —
  init jobs `*-migrate` aplicam automaticamente no `docker compose up -d`,
  o passo agora e auditoria pos-deploy + diagnostico de falha. Pos-incidente
  deploy 04/05 (5 migrations gestao-ti pendentes silenciosas).
- **1.3 (04/05/2026)**: Build cache de 168h → 24h (libera mais espaco em dev ativo).
  Volume dangling: inspecao via container Alpine (sem sudo). Procedimento explicito
  para arquivos > 5MB (perguntar caso a caso, remover pastas vazias depois).
  Incidente PgAdmin 04/05 documentado.
- **1.2 (12/04/2026)**: Versao base.
