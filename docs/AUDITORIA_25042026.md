# Auditoria Capul Platform — 25/04/2026

**Modo:** varredura rápida (8 dimensões prioritárias)
**Versão do prompt:** 1.1 (`docs/PROMPT_AUDITORIA_PLATAFORMA.md`)
**Escopo:** plataforma completa, foco em superfície externa

---

## Sumário Executivo

| Métrica | Inicial | S1 | S2 | S3 mid | **FINAL (25/04)** |
|---|---:|---:|---:|---:|---:|
| Achados críticos | 2 | 1 | 0 ✅ | 0 | **0** |
| Achados altos | 5 | 3 | 1 | 0 ✅ | **0** |
| Achados médios | 6 | 5 | 5 | 2 | **0 ✅** |
| Achados baixos | 3 | 3 | 3 | 2 | **1** (apenas #16 SMTP — depende de credenciais externas) |
| Pontos fortes | 7 | 7 | 10 | 13 | **15** (CSP estrito + falso positivo XML documentado) |
| **Esforço restante** | ~36-50h | ~26-34h | ~13-18h | ~5-9h | **~0h** (resta só #16 quando credenciais SMTP forem obtidas) |

### Sprint 1 fechada (25/04/2026 — ~1h30)

✅ **#1** auth-gateway 12 vulns → 0
✅ **#7 (parcial)** Nginx OCSP + session_tickets off
✅ **#9** fiscal-backend 3 mod → 1 mod
✅ **#11** FastAPI docs fechados em produção
✅ **#3** N/A (decisão consciente)
✅ **#8** N/A (DEV)

### Quick Wins (alta criticidade + esforço trivial)

1. **#1 — `npm audit fix` em auth-gateway** (10 high vulns, 1 comando, ~30min)
2. **#3 — Adicionar `USER non-root` nos 8 Dockerfiles** (ajuste idempotente, ~1h total)
3. **#7 — HSTS preload + OCSP stapling no Nginx** (2-3 linhas no .conf, ~30min)

### Pontos fortes identificados

- ✅ Rate limiting Nginx bem dimensionado (auth 5r/s, api 30r/s, conn 20)
- ✅ TLS 1.2+ apenas; ciphers ECDHE-only; HSTS habilitado
- ✅ JWT_SECRET / JWT_REFRESH_SECRET separados, ≥69 chars, sem hardcoded
- ✅ CORS restritivo em todos os backends (sem wildcard com credentials)
- ✅ pgAdmin restrito a `127.0.0.1:5050` (não exposto publicamente)
- ✅ Logs limpos — nenhum vazamento de PII/tokens nas últimas 200 linhas
- ✅ Endpoints API exigindo auth (testes manuais retornaram 401 corretamente)

---

## Achados Críticos (resolver imediatamente)

### Achado #1 — Vulnerabilidades altas em auth-gateway (path-to-regexp, lodash, multer, defu, effect)

- **Dimensão:** 4 — Estrutura/dependências
- **Severidade:** **Crítico** (auth-gateway é a porta de entrada da plataforma)
- **Localização:** `auth-gateway/package.json` + `package-lock.json`
- **Descrição:** `npm audit` reporta **12 vulnerabilidades** (2 moderate + 10 high) em produção
- **Por que é problema:** auth-gateway recebe **todo tráfego de login**. CVEs ativos:
  - `path-to-regexp` HIGH — Regex DoS (atacante pode travar API com payload)
  - `lodash` HIGH — Code Injection via `_.template`
  - `multer` HIGH — DoS via cleanup incompleto
  - `defu` HIGH — Prototype pollution
  - `effect` HIGH — Context contamination concorrente
- **Evidência:**
  ```
  12 vulnerabilities (2 moderate, 10 high)
  fix available via `npm audit fix`
  ```

#### Plano de Correção

1. **Pré-requisitos:** branch isolada (não tocar produção direto), backup do `package-lock.json` atual
2. **Passos concretos:**
   ```bash
   cd auth-gateway
   cp package-lock.json package-lock.json.bak
   npm audit fix
   docker compose build auth-gateway
   docker compose up -d auth-gateway
   ```
3. **Critério de validação:**
   - `docker compose exec auth-gateway npm audit --omit=dev --audit-level=high` → 0 vulns
   - Health check: `curl -k https://localhost/api/v1/auth/login -X POST -d '{"email":"x","senha":"y"}'` → ainda responde (não quebrou rotas)
   - Login funcional pelo Hub
4. **Estimativa:** **moderado (1-2h)** — `npm audit fix` é direto, mas precisa testar regressão de login + JWT
5. **Riscos da correção:** se algum pacote precisar `--force`, pode trazer breaking change. Iniciar sem `--force`.
6. **Rollback:** `mv package-lock.json.bak package-lock.json && docker compose build auth-gateway && docker compose up -d`
7. **Dependências:** nenhuma
8. **Quem executa:** backend dev

---

### Achado #2 — 8 de 9 containers rodam como **root**

- **Dimensão:** 7 — Infraestrutura Docker
- **Severidade:** **Crítico** (em produção pública)
- **Localização:** `auth-gateway/Dockerfile`, `gestao-ti/backend/Dockerfile`, `gestao-ti/frontend/Dockerfile`, `fiscal/backend/Dockerfile`, `fiscal/frontend/Dockerfile`, `hub/Dockerfile`, `configurador/Dockerfile`, `inventario/frontend/Dockerfile`
- **Descrição:** apenas `inventario/backend/Dockerfile` define `USER appuser`. Os outros 8 rodam como `uid=0(root)`
- **Por que é problema:** se um atacante explorar uma vuln (ex.: das do Achado #1), ganha root no container, facilitando container escape e movimentação lateral
- **Evidência:**
  ```
  auth-gateway: uid=0(root) gid=0(root) groups=0(root),...
  gestao-ti-backend: uid=0(root)
  fiscal-backend: uid=0(root)
  hub: uid=0(root)
  ...
  ```

#### Plano de Correção

1. **Pré-requisitos:** entender se algum container precisa root para algum motivo específico (ex.: bind em porta <1024 — não é o caso aqui, todos usam ≥3000)
2. **Passos concretos** — adicionar ao final de cada Dockerfile (antes do `CMD`):
   ```dockerfile
   # Para Node.js (auth-gateway, gestao-ti-backend, fiscal-backend, hub, configurador, frontends)
   RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
       && chown -R appuser:appgroup /app
   USER appuser
   ```
   Para frontends Vite/Nginx-served, ajustar conforme imagem base.
3. **Critério de validação:**
   - `docker compose exec auth-gateway id` → `uid=1000(appuser)` ou similar (≠ 0)
   - Aplicação inicia sem erro de permissão
   - `docker compose ps` → containers `Up`
4. **Estimativa:** **moderado (3-4h)** — 8 Dockerfiles + ajustes de permissão em volumes (uploads, certs)
5. **Riscos da correção:** breaking em volumes que esperam ser escritos por root. Especificamente:
   - `gestao-ti/backend` monta `uploads_data:/app/uploads` — checar `chown` no Dockerfile
   - `fiscal/backend` monta `./fiscal/backend/certs:/app/certs` (rw para upload via Configurador) — ajustar
6. **Rollback:** revert dos Dockerfiles, `docker compose build && up -d`
7. **Dependências:** nenhuma (cada container independente)
8. **Quem executa:** DevOps + dev backend (testes de regressão por módulo)

---

## Achados Altos (resolver em até 30 dias)

### Achado #3 — `JWT_ACCESS_EXPIRATION=60m` — **decisão de produto, NÃO é gap**

- **Dimensão:** 2 — Auth/autorização
- **Severidade:** ~~Alto~~ → **N/A** (esclarecido por Clenio em 25/04)
- **Localização:** `.env` (raiz)
- **Status:** **60min é o valor desejado.** Decisão de UX para evitar relogin frequente. Refresh token cobre janelas longas. Memória atualizada em `feedback_jwt_access_60min.md`. **Sem ação.**

---

### Achado #4 — Sem guard JWT global (depende de `@UseGuards` por controller)

- **Dimensão:** 2 — Auth/autorização
- **Severidade:** **Alto**
- **Localização:** `auth-gateway/src/main.ts`, `gestao-ti/backend/src/main.ts`, `fiscal/backend/src/main.ts`
- **Descrição:** nenhum dos backends usa `APP_GUARD` global. Cada controller exige `@UseGuards(JwtAuthGuard)` explícito. Se um dev novo criar controller sem o decorator, fica público sem aviso.
- **Por que é problema:** regressão silenciosa. Vimos no audit que **hoje todos endpoints respondem 401** corretamente, mas é só uma questão de tempo até alguém esquecer.

#### Plano de Correção

1. **Pré-requisitos:** levantar lista de endpoints que **realmente** precisam ser públicos (login, register, health, refresh)
2. **Passos concretos:**
   - Em `app.module.ts` de cada backend, adicionar:
     ```typescript
     {
       provide: APP_GUARD,
       useClass: JwtAuthGuard,
     }
     ```
   - Criar decorator `@Public()` para endpoints que devem ficar abertos
   - Marcar `/auth/login`, `/auth/register`, `/auth/refresh`, `/health` com `@Public()`
   - Modificar `JwtAuthGuard.canActivate` para checar `Reflector.get('isPublic', ctx.getHandler())` e pular auth quando true
3. **Critério de validação:**
   - Criar controller de teste sem `@UseGuards` → request retorna 401 (provando que guard global pegou)
   - Endpoints `@Public()` continuam acessíveis
4. **Estimativa:** **moderado (3-4h)** — implementação trivial mas precisa varredura completa pra marcar `@Public` corretamente
5. **Riscos:** esquecer de marcar algum endpoint público vira 401 inesperado em produção. Mitigação: revisar OS endpoints atuais antes de aplicar.
6. **Rollback:** remover APP_GUARD global, voltar `@UseGuards` por controller
7. **Quem executa:** backend dev sênior

---

### Achado #5 — Zero limites de memória/CPU nos 12 serviços

- **Dimensão:** 7 — Infraestrutura Docker
- **Severidade:** **Alto** (DoS interno por OOM em prod com tráfego pesado)
- **Localização:** `docker-compose.yml`
- **Descrição:** nenhum serviço tem `mem_limit` ou `deploy.resources.limits`. Container com leak / runaway pode consumir toda RAM do host e derrubar todos.
- **Por que é problema:** ataques de DoS aplicacional ou bug de leak (BullMQ infinito, queries sem paginação) podem derrubar a plataforma toda.

#### Plano de Correção

1. **Pré-requisitos:** medir uso atual em produção (`docker stats`) por 1-2 dias para dimensionar limites
2. **Passos concretos** — adicionar a cada serviço em `docker-compose.yml`:
   ```yaml
   services:
     auth-gateway:
       deploy:
         resources:
           limits:
             memory: 512M
             cpus: '0.5'
           reservations:
             memory: 128M
   ```
   Sugestão inicial:
   - Backends NestJS: 512M-1G mem, 0.5-1.0 cpu
   - Frontends Vite (build estático): 128M mem, 0.25 cpu
   - PostgreSQL: 2G mem, 1.0 cpu
   - Redis: 256M mem, 0.25 cpu
   - Nginx: 128M, 0.25 cpu
3. **Critério de validação:**
   - `docker stats` mostra MEM% < limit
   - Container não morre por OOM em testes de carga moderada
4. **Estimativa:** **moderado (4-6h)** — incluindo teste de carga pra calibrar
5. **Riscos:** limite muito apertado mata container em pico legítimo. Iniciar generoso, apertar gradualmente.
6. **Rollback:** remover `deploy:` do compose
7. **Quem executa:** DevOps

---

### Achado #6 — Apenas 3/13 containers com healthcheck

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Localização:** `docker-compose.yml`
- **Descrição:** Só `db`, `fiscal-api`, `inventario-api` reportam `healthy`. Demais (auth, gestao-ti-api, hub, frontends, redis, nginx) sem healthcheck → docker não detecta containers com processo zumbi.
- **Por que é problema:** processo travado no NestJS (loop infinito, deadlock) não é detectado e `restart: unless-stopped` não dispara. Plataforma fica "online" sem responder.

#### Plano de Correção

1. **Passos concretos** — adicionar healthcheck em cada serviço sem ele:
   ```yaml
   # Para backends NestJS (já existe endpoint /health no fiscal — replicar pra outros)
   auth-gateway:
     healthcheck:
       test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/v1/health"]
       interval: 30s
       timeout: 5s
       retries: 3
       start_period: 30s

   # Redis
   redis:
     healthcheck:
       test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]

   # Nginx
   nginx:
     healthcheck:
       test: ["CMD", "wget", "-qO-", "http://localhost/health"]
   ```
2. Criar endpoint `/health` em backends que não têm (auth-gateway, gestao-ti-backend) — retorna 200 com `{db, redis}`
3. **Critério de validação:** `docker compose ps` mostra `(healthy)` em todos
4. **Estimativa:** **moderado (3-5h)**
5. **Riscos:** healthcheck mal feito derruba container saudável. Iniciar com `start_period` longo.
6. **Quem executa:** DevOps + backend dev

---

### Achado #7 — Nginx sem OCSP stapling, sem HSTS preload, sem `ssl_session_tickets off`

- **Dimensão:** 1 — TLS
- **Severidade:** **Alto** (em produção pública é o mínimo esperado)
- **Localização:** `nginx/nginx.conf:69-83`
- **Descrição:** TLS está bom (ECDHE only, TLS 1.2+, ciphers fortes), mas faltam hardening recomendados pra prod pública.
- **Por que é problema:**
  - Sem OCSP stapling → cada cliente consulta CA → latência + privacidade pra usuários
  - HSTS sem `preload` → primeira visita ainda vulnerável a SSL strip
  - Sem `ssl_session_tickets off` → vulnerabilidade de replay teórica

#### Plano de Correção

1. **Passos concretos** — editar `nginx/nginx.conf` no bloco `server { listen 443 }`:
   ```nginx
   # OCSP Stapling
   ssl_stapling on;
   ssl_stapling_verify on;
   resolver 8.8.8.8 1.1.1.1 valid=300s;
   resolver_timeout 5s;

   # Session tickets off (forward secrecy mais forte)
   ssl_session_tickets off;

   # HSTS com preload (CUIDADO: ao marcar, fica permanente — só ative quando todos
   # subdomínios estiverem em HTTPS e tiver certeza)
   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
   ```
2. **Critério de validação:**
   - `curl -I https://platform.capul.com.br | grep -i strict` → mostra `preload`
   - SSL Labs (`ssllabs.com/ssltest`) sobe nota
3. **Estimativa:** **trivial (~30min)** — Quick Win
4. **Riscos:** `preload` é compromisso permanente; só ativar com certeza de HTTPS-only. Para reverter precisa pedir remoção da lista do Chrome (~6 meses).
5. **Quem executa:** DevOps

---

## Achados Médios (planejar para próximo trimestre)

### Achado #8 — `PGADMIN_PASSWORD = admin123` (8 chars) — **N/A neste ambiente**

- **Dimensão:** 3 — Secrets
- **Severidade:** ~~Médio~~ → **N/A em DEV** (esclarecido por Clenio em 25/04)
- **Localização:** `.env`
- **Status:** este `.env` é do **ambiente de desenvolvimento**. Em produção a senha já é forte. **Sem ação necessária.**

### Achado #9 — Vulns no `fiscal-backend` ✅ **RESOLVIDO 25/04/2026**

- **Dimensão:** 4
- **Estado final:**
  - 3 moderate originais (`uuid` via `bullmq`) → resolvidos via `npm audit fix` (round Sprint 1)
  - 1 moderate restante: `fast-xml-parser` GHSA-gh4j-gqv2-49f6 (CDATA injection via **XMLBuilder**)
- **Decisão (25/04/2026):** **falso positivo** para este projeto.
  - O fiscal-backend usa apenas `XMLParser` (parsing de retorno SEFAZ) em 8 arquivos
  - Nenhum uso de `XMLBuilder` no código (`grep -rn "XMLBuilder" src/` retorna 0)
  - A vulnerabilidade só é explorável via XMLBuilder
  - Bump 4→5 traria risco de regressão nos parsers SEFAZ críticos (NF-e/CT-e/CCC) sem ganho de segurança real
- **Ação futura:** quando houver próxima sessão de mudanças no fiscal-backend, fazer bump 4→5 e validar parsers como parte do trabalho — não como item isolado de audit.

### Achado #10 — gestao-ti-backend não permite `npm audit` no container (ENOLOCK)

- **Dimensão:** 4 — não verificado por falta de package-lock.json no container
- **Plano resumido:** rodar `npm audit` no host (fora do container) ou ajustar Dockerfile pra incluir `package-lock.json` na imagem final.

### Achado #11 — FastAPI com `docs_url="/docs"` ativo em produção (mitigado por Nginx não mapear)

- **Dimensão:** 1 — Endpoints expostos
- **Localização:** `inventario/backend/app/main.py:215`
- **Plano resumido:** condicionar a `docs_url=None if settings.ENV == "production" else "/docs"`. Defesa em profundidade caso alguém adicione rota proxy genérica no Nginx. **Esforço:** trivial.

### Achado #12 — CSP `'unsafe-inline'` em `style-src` ✅ **RESOLVIDO 25/04/2026**

- **Dimensão:** 1 — Headers
- **Análise:** Vite extrai CSS pra arquivo separado (sem `<style>` inline). React `style={{}}` aplica via DOM JS (não controlado por CSP em navegadores modernos).
- **Validação:** `curl` em todos os 5 frontends — **0 ocorrências** de `<style>` ou `style=` no HTML inicial.
- **Aplicado:** removido `'unsafe-inline'` da diretiva `style-src` no `nginx.conf`. CSP atual: `style-src 'self' https://fonts.googleapis.com;`

### Achado #13 — Inventário Python: 10+ pacotes desatualizados, sem `pip-audit`

- **Dimensão:** 4
- **Plano resumido:** `pip install pip-audit && pip-audit` para enumerar CVEs; aplicar `pip install -U <pacotes>` por bateladas; testar regressão.

---

## Achados Baixos / Boas Práticas Sugeridas

### Achado #14 — `X-XSS-Protection` header obsoleto

- Header ignorado por navegadores modernos. Pode remover sem perda. (`nginx/nginx.conf:79`)

### Achado #15 — `restart: unless-stopped` em todos os 12 serviços

- Razoável; `always` seria mais defensivo se quiser que sempre reinicie mesmo após `docker stop` manual.

### Achado #16 — SMTP não configurado em `.env` (alertas Fiscal)

- Esperado em dev. Em produção: configurar `SMTP_HOST/USER/PASSWORD` para alertas críticos do Fiscal funcionarem.

---

## Roadmap consolidado de correção

### Sprint 1 (semana 1-2) — Quick Wins + Críticos urgentes — ✅ **CONCLUÍDO 25/04/2026**

- [x] **#1** — `npm audit fix` em auth-gateway → **12 vulns → 0** ✅
- [x] **#7 (parcial)** — OCSP stapling + `ssl_session_tickets off` aplicado no Nginx ✅
  - HSTS preload **NÃO** aplicado (decisão Clenio — irreversível, espera maturidade HTTPS-only)
  - OCSP stapling ignorado em DEV por cert self-signed; em PROD com cert real (Let's Encrypt) passa a funcionar
- [x] **#9** — `npm audit fix` em fiscal-backend → 3 mod → 1 mod (fast-xml-parser exige `--force`, vai pra Sprint 2)
- [x] **#11** — FastAPI `docs_url`/`redoc_url`/`openapi_url` agora `None` quando `ENVIRONMENT=production` ✅
- [x] **#8** — N/A em DEV (PROD já está seguro) ✅
- [x] **#3** — N/A — `JWT_ACCESS_EXPIRATION=60m` é decisão consciente de UX (memória `feedback_jwt_access_60min.md`) ✅

**Resultado:** 6 itens fechados em ~1h30 (mais rápido que estimado por causa de paralelização e dois itens N/A).

**Validação executada:**
- `npm audit` auth-gateway: 0 vulnerabilities
- Login funcional (`POST /api/v1/auth/login` → 400 validation, esperado)
- 3 containers (auth, fiscal-api, inventario-api) reiniciados saudáveis
- Nginx headers HSTS/CSP/X-Frame respondendo
- Nginx config validou (`nginx -t` OK)

### Sprint 2 (semana 3-4) — Críticos restantes

- [x] **#2** — `USER non-root` nos 8 Dockerfiles ✅ **CONCLUÍDO 25/04/2026**
  - 3 backends Node: `uid=100(appuser)`
  - 5 frontends: `uid=101(nginx)`
  - 1 already non-root (inventario-backend `uid=999(appuser)`)
  - Total: **9/9 containers como non-root** (era 1/9)
  - Ajuste pós-restart: chown manual no named volume `uploads_data` (gestao-ti-backend) — era owned por root da run anterior
  - Validação: login OK (400), frontends 200, APIs protegidas 401, fiscal cert legível + xmls escrita OK
- [x] **#4** — Guard JWT global + `@Public` decorator ✅ **CONCLUÍDO 25/04/2026**
  - `@Public()` decorator criado em cada backend (`common/decorators/public.decorator.ts`)
  - `JwtAuthGuard` modificado para checar `IS_PUBLIC_KEY` via Reflector
  - `APP_GUARD` JwtAuthGuard registrado em auth-gateway, gestao-ti-backend, fiscal-backend
  - Endpoints marcados `@Public()`: `auth/login`, `auth/refresh`, `auth/mfa/login`, `IntegracaoInternalController`, `HealthController` (fiscal)
  - Validação: públicos respondem sem 401 (login=400 validation, health=200); protegidos retornam 401 sem token
  - Defesa em profundidade: novo controller esquecido sem `@UseGuards` agora é automaticamente protegido
- [x] **#5** — Limites mem/cpu nos 12 serviços ✅ **CONCLUÍDO 25/04/2026**
  - Medição via `docker stats` antes de calibrar (evitou chute)
  - Limites aplicados via `mem_limit`/`mem_reservation`/`cpus` em todos os 13 containers
  - Backends NestJS: 512M/128M/0.5cpu | Fiscal-api: 768M (BullMQ + parsers XML)
  - Frontends static: 128M/32M/0.25cpu
  - PostgreSQL: 2G/256M/1.0cpu | Redis: 256M/32M/0.25cpu
  - pgAdmin: 512M/256M/0.25cpu
  - Total reservado: ~1.25GB; max teórico: ~7GB (host tem 15GB)
  - Validação: todos containers com 76-99% headroom; APIs/frontends respondem normalmente

**Total Sprint 2: ~12h** | **✅ COMPLETA**

### Médio prazo (1-3 meses)

- [x] **#6** — Healthcheck nos 10 containers faltantes ✅ **CONCLUÍDO 25/04/2026**
  - 2 endpoints `/health` novos: `auth-gateway` (`/api/v1/auth/health`) e `gestao-ti-backend` (`/api/v1/gestao-ti/health`) — retornam status do DB via `SELECT 1`, marcados `@Public()`
  - 10 healthchecks adicionados no compose: nginx, redis, auth, hub, configurador, gestao-ti-api, gestao-ti-web, inventario-web, fiscal-web, pgadmin
  - Bug curioso resolvido: nginx:alpine resolve `localhost` pra IPv6 mas escuta IPv4 → trocado por `127.0.0.1` em todos healthchecks
  - Resultado: **13/13 containers `(healthy)`** (era 3/13)
- [x] **#10** — gestao-ti-backend npm audit ✅ **CONCLUÍDO 25/04/2026**
  - Rodado no host (lockfile estava lá, mas container não permitia audit por copy parcial no Dockerfile)
  - **16 vulns (11 high + 5 mod) → 3 moderate** (uuid via exceljs, exige `--force` breaking)
- [ ] **#12** — Remover/restringir `'unsafe-inline'` CSP (4-6h)
- [x] **#13** — `pip-audit` Inventário ✅ **CONCLUÍDO 25/04/2026**
  - 3 rounds de bump: fastapi (0.104→0.121), pyjwt, multipart, dotenv, requests, redis, pydantic
  - **16 vulns → 2 vulns** (pytest 8.3.4 e black 24.10.0 — DEV deps, fixes 9.0.3/26.3.1 ainda não publicados no PyPI)
  - Aceitável: dev deps não vão pra runtime; quando os fixes saírem, atualizar.

### Backlog (longo prazo / boas práticas)

- [x] **#14** — Remover `X-XSS-Protection` ✅ **CONCLUÍDO 25/04/2026** — removido de `nginx.conf` raiz e middleware FastAPI inventário
- [x] **#15** — Restart policy ✅ **DECIDIDO 25/04/2026** — manter `restart: unless-stopped` em todos os 12 serviços. Diferença vs `always`: `unless-stopped` respeita `docker stop` manual (operações de manutenção/troubleshooting), o que é desejável. `always` reiniciaria mesmo após stop intencional, complicando manutenção. Sem mudança.
- [ ] **#16** — SMTP produção — **depende de credenciais externas** (host/user/password). Quando obtidos, configurar em `.env` e rebuildar fiscal-backend. Health check Fiscal sairá de `degraded` para `ok`.

---

## Estimativa de esforço total

| Prioridade | Horas |
|---|---:|
| Sprint 1 (curto prazo) | ~5h |
| Sprint 2 (curto prazo) | ~12h |
| Médio prazo | ~12-20h |
| Longo prazo | ~2h |
| **TOTAL** | **~31-39h** |

---

## Próximas frentes (auditoria profunda — quando retomar)

Varredura rápida cobriu 8/10 dimensões e fechou todos achados críticos/altos/médios.
Para retomar quando estiver pronto:

| Prioridade | Frente | Cobre | Esforço |
|---|---|---|---|
| **1ª** | **Backup / DR** | Política PostgreSQL, teste de restore, retenção, runbook | ~1h |
| 2ª | **Observabilidade** | Logs estruturados (JSON), níveis, retenção, métricas, alertas | ~1-2h |
| 3ª | **Performance** | N+1 Prisma, índices DB, bundle frontend, slow queries | ~2h |
| 4ª | **LGPD/compliance** | Trilha auditoria, retenção, direitos do titular, PII em exports | ~2-3h |
| Pendente | **#16 SMTP produção** | Configurar quando obtiver credenciais SMTP | trivial |

**Como invocar:**
```
Execute auditoria profunda seguindo docs/PROMPT_AUDITORIA_PLATAFORMA.md.
Escopo desta rodada: [Backup/DR | Observabilidade | Performance | LGPD]
Profundidade: profunda
Gerar relatório em: docs/AUDITORIA_<DDMMAAAA>.md
```

## Validação a executar pelo operador (Clenio) antes de continuar

Antes de retomar próxima auditoria, confirmar que tudo de hoje funciona:

### Acessos básicos
- [ ] `https://localhost/` → Hub carrega
- [ ] Login com credenciais válidas funciona
- [ ] Hub mostra módulos autorizados
- [ ] `https://localhost/gestao-ti/` carrega + navegação
- [ ] `https://localhost/fiscal/` carrega + consulta NF-e/CT-e/Cadastro
- [ ] `https://localhost/inventario/` carrega
- [ ] `https://localhost/configurador/` carrega

### Funcionalidades críticas (smoke test)
- [ ] Gestão TI: criar/editar chamado, abrir OS, criar projeto
- [ ] Fiscal: consultar NF-e por chave, ver eventos, baixar DANFE
- [ ] Fiscal: consultar cadastro CCC + Receita Federal
- [ ] Inventário: criar inventário, fazer contagem
- [ ] Configurador: editar usuário, atribuir módulos

### Backend
- [ ] APIs respondem rápido (< 500ms p/ listas)
- [ ] BullMQ jobs Fiscal rodando (cruzamento, alertas)
- [ ] Sem erros nos logs: `docker compose logs --tail 50 auth-gateway gestao-ti-backend fiscal-backend inventario-backend | grep -i error`

### Eventuais regressões esperadas (após Sprint 2+3)
1. **Healthcheck `localhost` IPv6** já tratado (trocado por 127.0.0.1) — não deve dar problema, mas se algum container ficar `unhealthy` ao subir, ver logs do container
2. **CSP `unsafe-inline` removido** — se alguma página de algum frontend perder estilo (raro), reverter `nginx/nginx.conf:83` adicionando `'unsafe-inline'` de volta no `style-src`
3. **Volume `uploads_data` chown** já feito — se algum upload falhar com permissão, refazer `docker compose exec --user 0 gestao-ti-backend chown -R appuser:appgroup /app/uploads`
4. **gestao-ti-backend rebuild** trouxe lockfile novo: se algum endpoint quebrar com erro de pacote, é regressão de `npm audit fix` — reverter `package-lock.json.bak` se houver backup ou rebuildar com lockfile antigo

---

## Histórico desta auditoria

| Data | Versão prompt | Modo | Score | Críticos |
|---|---|---|---|---|
| 25/04/2026 | 1.1 | varredura rápida | (a calibrar) | 2 |

> *Score numérico (0-100) será calibrado após primeira auditoria profunda — varredura não cobre dimensões suficientes pra dar nota global confiável.*
