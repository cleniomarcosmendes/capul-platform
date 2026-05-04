# Roteiro de Finalizacao - Capul Platform

**Versao**: 1.3
**Data**: 04/05/2026
**Objetivo**: Procedimento padrao apos finalizar ajustes no sistema

**Modulos cobertos**: auth-gateway, hub, gestao-ti, inventario, configurador, **fiscal**

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
```

### 2.2 Verificacao de Containers
```bash
# Status dos containers
docker compose ps

# Verificar logs de erro (todos os backends)
docker compose logs --tail 5 auth-gateway gestao-ti-backend fiscal-backend 2>&1 | grep -i error

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
```bash
# Auth gateway
docker compose exec auth-gateway npx prisma migrate status

# Gestao TI
docker compose exec gestao-ti-backend npx prisma migrate status

# Fiscal (multi-schema: fiscal + core — nao usa Prisma migrate system)
# ALTERs diretos sao rastreados em `fiscal/backend/prisma/alters/*.sql`
docker compose exec fiscal-backend sh -c 'ls -la /app/prisma/'
ls fiscal/backend/prisma/alters/ 2>/dev/null || echo "(sem ALTERs pendentes)"
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

### 2.8 Relatorio Final
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
- [ ] Containers saudaveis
- [ ] Migrations em dia
- [ ] Arquivos orfaos analisados
- [ ] Limpeza Docker (se necessario)
- [ ] Impacto em migracao verificado (schema, docker-compose, Dockerfile)
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

**Ultima Atualizacao**: 04/05/2026
**Versao**: 1.3

## Changelog

- **1.3 (04/05/2026)**: Build cache de 168h → 24h (libera mais espaco em dev ativo).
  Volume dangling: inspecao via container Alpine (sem sudo). Procedimento explicito
  para arquivos > 5MB (perguntar caso a caso, remover pastas vazias depois).
  Incidente PgAdmin 04/05 documentado.
- **1.2 (12/04/2026)**: Versao base.
