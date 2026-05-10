# Auditoria — Segurança Externa Deep — 10/05/2026

**Frente:** 1 (do `PLAYBOOK_AUDITORIA_v1.md`)
**Modo:** profunda
**Branch:** `audit/seguranca-externa`
**Auditor:** Claude Opus 4.7 (sessão Clenio)
**Escopo:** vulnerabilidades que permitam **ataque externo** com possibilidade de **pivot pra outras aplicações da CAPUL**. Foco em superfície WAN. LGPD/Backup/Performance fora de escopo (frentes próprias).

---

## Sumário Executivo

| Severidade | Qtd | Esforço estimado |
|---|---|---|
| **Críticos** | 1 | 4-8h |
| **Altos** | 4 | 6-14h |
| **Médios** | 7 | 4-12h |
| **Baixos** | 5 | 2-6h |
| **Pontos fortes** | 12 | — |

**TOTAL esforço de remediação:** 16-40h

### Quick wins (alta criticidade + baixo esforço)
1. **#A2** — atualizar dependências `npm audit fix` em auth-gateway e gestao-ti (não-breaking) — 30min
2. **#A4** — remover declaração `JWT_REFRESH_SECRET` obrigatória (não usada) ou implementar uso real — 1h
3. **#M3** — `PROTHEUS_INVENTARIO_VERIFY_SSL: true` em docker-compose — 5min + teste

### Achado mais grave
**#C1** — credencial Protheus PROD `APICAPUL:Ap1C4pu1PRD` está hardcoded em **12 arquivos do repositório** desde o **first commit** (`f690b05`). Está no git history público pra sempre. **Rotação obrigatória + limpeza de history.**

---

## Achados Críticos (resolver imediatamente)

### Achado #C1 — Credencial Protheus PROD hardcoded em código + git history

- **Dimensão:** 3 (Secrets Management)
- **Severidade:** **Crítico**
- **Localização:**
  - `docker-compose.yml:208` (`PROTHEUS_API_AUTH` fallback)
  - `docker-compose.yml:211` (`PROTHEUS_INVENTARIO_AUTH` fallback)
  - `auth-gateway/prisma/seed.ts:320` (seed `authConfig`)
  - `inventario/backend/test_api_protheus.py:10`
  - `inventario/backend/app/core/config.py:59` e `:136`
  - `inventario/backend/app/core/protheus_config.py:118`
  - `inventario/docs/PLANO_CONTINUIDADE_INTEGRACAO_PROTHEUS.md:253`
  - `inventario/docs/historico/IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md:50, 256`
  - `inventario/docs/historico/PLANO_SINCRONIZACAO_API_PROTHEUS_v2.14.0.md:39, 142, 277, 589, 599`

- **Descrição:** O valor `Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=` aparece em 12+ locais no repositório. Decodificado em Base64: **`APICAPUL:Ap1C4pu1PRD`** — credencial real e em produção do usuário Protheus consumido pelos módulos Inventário e Fiscal.

- **Por que é problema:**
  - **Repositório versionado** — qualquer pessoa com acesso de leitura ao git (atual ou histórica) tem credencial PROD do Protheus
  - **Git history imutável** — mesmo trocando o valor agora, ele permanece no histórico (`git log` retornou commit `f690b05` = "first commit" como introdutor)
  - **Defaults usados se .env ausente** — em deploy mal configurado, sistema sobe usando essa credencial
  - **Pivot pra outras aplicações** — Protheus é o ERP central da CAPUL. Quem entrar nele tem acesso a financeiro, fiscal, estoque, RH, etc. Risco máximo no Eixo 1 (lateral).
  - **Senha fraca** — "Ap1C4pu1PRD" é leetspeak transparente de "ApiCapulPRD", facilmente adivinhável

- **Evidência:**
  ```
  $ echo "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=" | base64 -d
  APICAPUL:Ap1C4pu1PRD

  $ git log --all --oneline -S "Ap1C4pu1PRD"
  5e1ccef refs/remotes/origin/HEAD feat: refatoração.
  f690b05 refs/remotes/origin/HEAD first commit
  ```

#### Plano de Correção

1. **Pré-requisitos**
   - Acesso ao Protheus pra criar novo usuário API ou rotacionar senha do `APICAPUL`
   - Coordenação com equipe Protheus (Douglas em férias — outro contato confirmado)
   - Janela de manutenção (~1h) — durante a janela, integrações Protheus ficam offline
   - Decisão se cria usuário API novo (preferível) ou rotaciona o existente

2. **Passos concretos**
   1. **Criar novo usuário API no Protheus** (ex: `APICAPUL_2026`) com senha gerada (`openssl rand -base64 24`)
   2. **Atualizar `.env` em DEV/HOM/PROD** com novo `PROTHEUS_API_AUTH` (formato Base64 de `usuario:senha`)
   3. **Remover fallbacks hardcoded** em todos os 12 arquivos:
      ```yaml
      # ANTES
      PROTHEUS_API_AUTH: ${PROTHEUS_API_AUTH:-Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=}
      # DEPOIS
      PROTHEUS_API_AUTH: ${PROTHEUS_API_AUTH:?PROTHEUS_API_AUTH obrigatoria — ver C:\\Arquivos-de-projeto\\PROTHEUS_CREDENTIALS.md}
      ```
   4. **Substituir em `seed.ts:320`** (auth-gateway): pegar do env `PROTHEUS_API_AUTH` ao invés de hardcoded
   5. **Substituir em `config.py:59, :136`** e `protheus_config.py:118` (inventário): remover defaults hardcoded, deixar `os.getenv` retornar `None` e levantar erro explícito
   6. **Atualizar arquivos `.md` de docs históricas** — substituir por placeholder `<CREDENCIAL_API_PROTHEUS>` com nota "ver .env real"
   7. **Limpar git history** — usar `git filter-branch` ou (preferível) `git filter-repo`:
      ```bash
      git filter-repo --replace-text replacements.txt
      # replacements.txt:
      # QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=>***REMOVED***
      # Ap1C4pu1PRD>***REMOVED***
      # APICAPUL:Ap1C4pu1PRD>***REMOVED***
      ```
   8. **Force push pra origin** (com Clenio — ÚNICA exceção da regra "Clenio dá push")
   9. **Comunicar todos os colaboradores** que tem clones locais — eles precisam re-clonar (history reescrita invalida fetches)
   10. **Desabilitar usuário antigo** `APICAPUL` no Protheus assim que confirmar novo funcionando 48h

3. **Critério de validação**
   ```bash
   # 1. Não há mais ocorrências do valor antigo no working tree
   grep -r "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ" . --exclude-dir=.git
   # Esperado: zero matches

   # 2. Não há mais no git history
   git log --all -p | grep "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ"
   # Esperado: zero matches

   # 3. Sistema funciona com novo PROTHEUS_API_AUTH
   curl -sk https://localhost/api/v1/inventory/sync/protheus/ping
   # Esperado: 200 OK
   ```

4. **Estimativa de esforço:** 4-8h
   - Substituições em código: 30min
   - Coordenação com Protheus pra criar usuário: 1-2h
   - `git filter-repo` + force push + comunicação: 1-2h
   - Testes em DEV/HOM/PROD: 1-2h
   - Rotação efetiva (desabilitar antigo): 1h

5. **Riscos da correção**
   - Force push reescreve history — quem tem clones locais precisa re-clonar (impacto em 1-2 colaboradores ativos)
   - Se algum CI/script externo usa o repo via SHA específico, vai quebrar
   - Janela de manutenção: integrações Protheus offline durante rotação (~30min)

6. **Rollback**
   - Manter usuário antigo Protheus ativo por 48h após cutover
   - Reverter `.env` pra credencial antiga se algo quebrar
   - History reescrita NÃO é reversível — backup do `.git` antes do `filter-repo` é obrigatório

7. **Dependências:** nenhuma — bloqueia outros achados? Não, mas aguardar Douglas voltar de férias se houver outras tarefas críticas em paralelo.

8. **Quem executa:** Clenio + 1 contato Protheus (criação usuário) + Claude (substituições em código) + DevOps (force push + comunicação)

---

## Achados Altos (resolver em até 30 dias)

### Achado #A1 — Senhas default `admin123` / `123456` hardcoded em endpoints de seed

- **Dimensão:** 2 (Auth/RBAC) e 3 (Secrets)
- **Severidade:** **Alto**
- **Localização:**
  - `auth-gateway/prisma/seed.ts:203` — `senhaInicial = 'admin123'` (fallback de `INITIAL_ADMIN_PASSWORD`)
  - `inventario/backend/app/main.py:1714` — `hash_password("admin123")` (admin user seed)
  - `inventario/backend/app/main.py:10046-10090` — `password_hash_admin123`, `password_hash_123456`, e endpoint `/test/create-test-users` que **retorna senhas em texto puro** no JSON de resposta
  - `inventario/CLAUDE.md` — documenta `admin / admin123` como credencial de login
  - `inventario/docker-compose.yml:99` — `PGADMIN_DEFAULT_PASSWORD: admin123`

- **Descrição:** Múltiplas senhas fracas hardcoded. Pior caso: endpoint `/test/create-test-users` (linha 10032) retorna 3 credenciais válidas no body da resposta:
  ```json
  {"users": [
    {"username": "admin", "password": "admin123", "role": "ADMIN"},
    {"username": "operador1", "password": "123456", "role": "OPERATOR"},
    {"username": "supervisor1", "password": "123456", "role": "SUPERVISOR"}
  ]}
  ```

- **Por que é problema:**
  - Em produção, a flag `ENABLE_TEST_ENDPOINTS` é forçada a `False` (✅ bom), mas se algum dia regredir, esse endpoint vaza credenciais
  - `auth-gateway/seed.ts` cria admin com `admin123` se `INITIAL_ADMIN_PASSWORD` não definida no .env — bootstrap inseguro
  - `inventario/CLAUDE.md` orienta o desenvolvedor a usar essa senha — pode acabar em PROD se UNIFIED_AUTH=false (legado dormente)

- **Evidência:** `grep -rn "admin123" --include="*.py" --include="*.ts"` retornou 18+ matches

#### Plano de Correção

1. **Pré-requisitos:** verificar em PROD se admin foi criado com `admin123` (improvável, mas conferir)

2. **Passos concretos:**
   1. **Remover endpoint `/test/create-test-users`** completamente (não tem razão de existir mesmo em dev — usuários de teste devem vir de fixture/seed determinístico, não endpoint público)
   2. **Mudar fallback `seed.ts:203`** pra abortar se `INITIAL_ADMIN_PASSWORD` ausente:
      ```typescript
      const senhaInicial = process.env.INITIAL_ADMIN_PASSWORD;
      if (!senhaInicial || senhaInicial.length < 12) {
        throw new Error('INITIAL_ADMIN_PASSWORD obrigatória (mín 12 chars). Gerar com `openssl rand -base64 24`.');
      }
      ```
   3. **Limpar `inventario/main.py`** — `/test/create-admin`, `/test/create-test-users`, `/test/debug-user` removidos. Substituir por seed CLI (`docker compose exec inventario-backend python -m app.seed`).
   4. **Atualizar `inventario/CLAUDE.md`** removendo `admin/admin123`, substituindo por "credencial em .env"
   5. **Garantir `inventario/docker-compose.yml` standalone também usa env var** pra PGADMIN_DEFAULT_PASSWORD (esse compose é separado do principal mas vale higienizar)
   6. **Auditar PROD**: rodar query no banco confirmando que ninguém tem hash de `admin123` ou `123456` (pode ser feito sem expor: rehashear localmente e comparar)

3. **Critério de validação:**
   ```bash
   grep -rn "admin123\|123456" --include="*.py" --include="*.ts" --include="*.yml" | grep -v "test\|spec\|\.git"
   # Esperado: zero matches em código de prod
   curl -sk https://localhost/api/v1/inventory/test/create-test-users
   # Esperado: 404 (endpoint removido) ou 403
   ```

4. **Esforço:** 2-4h (1h pra remover + 1h pra seed CLI + 1h validação)

5. **Riscos:** desenvolvedores que usavam endpoints `/test/*` em dev local precisam adaptar (substituir por seed CLI)

6. **Rollback:** revert do commit

7. **Dependências:** nenhuma

8. **Quem executa:** Backend dev (substituições) + Claude

---

### Achado #A2 — Vulnerabilidade HIGH em `fast-xml-builder` (auth-gateway)

- **Dimensão:** 4 (Dependências)
- **Severidade:** **Alto**
- **Localização:** `auth-gateway/package.json` → `node_modules/fast-xml-builder`

- **Descrição:** `npm audit` reporta 1 vulnerabilidade HIGH em `fast-xml-builder <=1.1.6`:
  - GHSA-5wm8-gmm8-39j9 — bypass de attribute values com unwanted quotes
  - GHSA-45c6-75p6-83cc — Comment Value regex bypass

- **Por que é problema:** Auth-gateway processa XML em algum ponto (provável dependência transitiva). XML injection pode permitir bypass de validação ou comportamento inesperado em parsing/serialization.

- **Evidência:**
  ```
  fast-xml-builder  <=1.1.6
  Severity: high
  fix available via `npm audit fix`
  1 high severity vulnerability
  ```

#### Plano de Correção

1. **Passos:**
   ```bash
   cd auth-gateway && npm audit fix
   git add package.json package-lock.json
   ```
2. **Validação:** `npm audit` retorna `0 vulnerabilities`
3. **Esforço:** 30min (incluindo testes)
4. **Risco:** baixo — `npm audit fix` sem `--force` mantém compatibilidade
5. **Rollback:** revert do commit

---

### Achado #A3 — Vulnerabilidade em `python-multipart` (inventário FastAPI)

- **Dimensão:** 4 (Dependências)
- **Severidade:** **Alto** (em runtime — `python-multipart` é dependência direta de FastAPI pra forms/uploads)
- **Localização:** `inventario/backend/requirements.txt` → `python-multipart==0.0.26`

- **Descrição:** GHSA-pp6c-gr5w-3c5g — fix disponível em 0.0.27. Inventário processa uploads (Excel, etc), exposição direta.

#### Plano de Correção

1. **Passos:**
   ```python
   # requirements.txt
   python-multipart>=0.0.27
   ```
2. **Validação:** `pip-audit` retorna 0 vulns relevantes em runtime
3. **Esforço:** 1h (incluindo teste de uploads)
4. **Risco:** baixo (patch version)

---

### Achado #A4 — `JWT_REFRESH_SECRET` declarado obrigatório mas NÃO usado

- **Dimensão:** 2 (Auth)
- **Severidade:** **Alto** (não cria vulnerabilidade direta, mas indica falha de design / ilusão de proteção)
- **Localização:**
  - `docker-compose.yml:123` — `JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?...}`
  - `auth-gateway/src/auth/auth.service.ts` — toda criação/verificação de JWT usa apenas `JWT_SECRET`

- **Descrição:** `docker-compose.yml` exige `JWT_REFRESH_SECRET` como obrigatório (com erro se vazio), mas o código NUNCA usa esse secret. Refresh token é uma string aleatória persistida no banco (`prisma.refreshToken.create`) — não é JWT assinado.

- **Por que é problema:**
  - Quem lê o docker-compose acha que existe defesa em profundidade (refresh assinado com secret separado), mas não existe
  - Se em algum momento for descoberto que a variável é "ignorada", o operador pode preenchê-la com o mesmo valor de `JWT_SECRET` por descuido — sem efeito real
  - Indica gap de design: refresh deveria ser JWT também (ou pelo menos rotação/revogação por user agent + IP) pra detectar uso indevido

#### Plano de Correção

**Opção A** (preferida) — implementar uso real do secret:
1. Refresh token vira JWT assinado com `JWT_REFRESH_SECRET` (separado de `JWT_SECRET`)
2. Persiste hash no banco em vez de string plain
3. Validação na rota `/refresh` verifica assinatura + existência no banco

**Opção B** — remover declaração obrigatória:
1. Remover `JWT_REFRESH_SECRET` do `docker-compose.yml` e `.env.example`
2. Comentar no código: "refresh é DB-backed, não JWT — não precisa de secret separado"

**Esforço:** Opção A: 4-8h (mudança de design, requer migration DB). Opção B: 30min.

**Recomendação:** **Opção A** se houver fôlego (mais robusto, separa blast radius access vs refresh). Se não, Opção B pra evitar ilusão.

---

## Achados Médios (planejar para próximo trimestre)

### Achado #M1 — Várias rotas Inventário no nginx sem rate limit

- **Dimensão:** 1 (Rate limiting)
- **Severidade:** Médio
- **Localização:** `nginx/nginx.conf:155-241` — ~15 `location /api/v1/...` sem `limit_req zone=api_limit`
- **Descrição:** Apenas `/auth/`, `/core/`, `/gestao-ti/`, `/fiscal/` têm `limit_req`. Endpoints Inventário (`/products/`, `/cycles/`, `/inventory/`, etc.) só têm `limit_conn` global. Permite scraping/DoS leve.
- **Mitigação atual:** `slowapi` no FastAPI provê alguma proteção aplicacional
- **Plano resumido:** adicionar `limit_req zone=api_limit burst=50 nodelay;` nas ~15 locations Inventário. 1h de trabalho.

### Achado #M2 — bcrypt cost = 10 (recomendação 2026: 12+)

- **Dimensão:** 2 (Senhas)
- **Severidade:** Médio
- **Localização:** `auth-gateway/src/auth/auth.service.ts:229`, `usuario/usuario.service.ts:116, 214` — `bcrypt.hash(..., 10)`
- **Descrição:** Cost 10 era padrão 2018-2020. Em 2026, com hardware mais rápido, recomenda-se 12. Diferença de tempo pra hash: ~100ms vs ~400ms (aceitável em UX).
- **Plano resumido:** mudar para 12, rehashear senhas no próximo login do usuário. 2h.

### Achado #M3 — `PROTHEUS_INVENTARIO_VERIFY_SSL: false`

- **Dimensão:** 3 (Dados em trânsito)
- **Severidade:** Médio
- **Localização:** `docker-compose.yml:213`
- **Descrição:** SSL verification desabilitada para conexão com Protheus. Vulnerável a MITM dentro da rede.
- **Mitigação atual:** Protheus está em rede interna (172.16.0.x), reduzindo risco
- **Plano resumido:** corrigir certificado Protheus e habilitar verify. 1-2h (depende de cooperação Protheus). **Atualmente é o único `verify_ssl=false` do sistema.**

### Achado #M4 — Vulnerabilidade `fast-xml-parser` (fiscal)

- **Dimensão:** 4 (Dependências)
- **Severidade:** Médio (XML injection, fix breaking)
- **Localização:** `fiscal/backend/package.json` → `fast-xml-parser`
- **Plano resumido:** atualizar para 5.7+, testar parsing de NFe/CTe. 4-6h. **Crítico pro Fiscal — esse parser processa XMLs SEFAZ que vêm de fontes externas (emitentes).**

### Achado #M5 — Vulnerabilidade `brace-expansion` (gestao-ti)

- **Dimensão:** 4 (Dependências)
- **Severidade:** Médio (DoS via regex)
- **Localização:** `gestao-ti/backend/node_modules/brace-expansion`
- **Plano resumido:** `npm audit fix`. 30min.

### Achado #M6 — CSP sem `block-all-mixed-content` e `upgrade-insecure-requests`

- **Dimensão:** 1 (Headers)
- **Severidade:** Médio (defesa em profundidade)
- **Localização:** `nginx/nginx.conf:96` — header `Content-Security-Policy`
- **Plano resumido:** adicionar essas duas diretivas. 15min.

### Achado #M7 — HSTS sem `preload`

- **Dimensão:** 1 (Headers)
- **Severidade:** Médio (defesa em profundidade)
- **Localização:** `nginx/nginx.conf:91` — `Strict-Transport-Security "max-age=31536000; includeSubDomains"`
- **Plano resumido:** adicionar `preload` e submeter domínio em hstspreload.org. **Pré-requisito:** ter certeza que TODOS os subdomínios usam HTTPS — preload é IRREVERSÍVEL por ~1 ano. 30min validação + 5min config.

---

## Achados Baixos / Boas Práticas Sugeridas

### #B1 — MFA token usa mesmo secret que access token
`auth-gateway/src/auth/auth.service.ts:105` — em rigor, secrets separados pra purposes diferentes seguem princípio menor privilégio.

### #B2 — SSRF teórico em alert-notifier (admin malicioso)
`auth-gateway/src/alert-notifier/alert-notifier.service.ts:52` — webhookAlerta vem de DB. Validar host contra allowlist (não permitir 127.0.0.1, 169.254.169.254, 10.x, 172.16-31.x, 192.168.x).

### #B3 — `CORS_ORIGINS` com fallback `https://localhost`
`docker-compose.yml:128, 275, 349` — defensivamente seria melhor `${VAR:?}` (abortar se ausente). Fiscal já tem isso. Aplicar em auth-gateway e gestao-ti.

### #B4 — `FISCAL_PROTHEUS_MOCK: true` default
Risco operacional, não de segurança. Em prod se .env esquecido, sobe em mock — descoberto em `staging` na auditoria 19/04/2026.

### #B5 — `pytest 8.3.4` e `black 24.10.0` com vulns (dev only)
Não-bloqueante (não rodam em prod), mas atualizar quando puder.

---

## Pontos Fortes Identificados

1. **Nginx proxy reverso único** — só 80/443 expostos. Postgres, Redis, todos backends apenas em rede docker interna.
2. **pgAdmin restrito a `127.0.0.1:5050`** — não acessível externamente.
3. **TLS 1.2/1.3 only** com ciphers ECDHE+GCM, OCSP stapling ativo, session_tickets off.
4. **`server_tokens off`** — versão nginx não vazada.
5. **Headers de segurança bem configurados:** HSTS 1 ano + includeSubDomains, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, CSP restritivo (sem `unsafe-inline` em script-src).
6. **Variáveis críticas com `${VAR:?}`** — `JWT_SECRET`, `REDIS_PASSWORD`, `FISCAL_MASTER_KEY`, `DB_PASSWORD`, `PROTHEUS_API_AUTH` — Compose aborta se ausentes (lições do incidente 19/04/2026).
7. **Todos os 4 backends rodam como `appuser`** (não root) com multi-stage build.
8. **Throttler aplicacional** em todos os 3 backends NestJS + `slowapi` no FastAPI Inventário + `limit_req_zone` no nginx — defesa em camadas.
9. **Senha de criação tem complexidade obrigatória:** lowercase + uppercase + digit, mín 8 chars (`@Matches` regex em DTOs).
10. **Helmet configurado em todos backends NestJS.**
11. **`ENABLE_TEST_ENDPOINTS` forçado a `False` em produção** (override seguro independente da env var).
12. **Uploads usam `randomUUID()` para nome** — previne path traversal por nome de arquivo malicioso.
13. **Downloads usam `path.normalize()`** — previne `../` traversal.
14. **`/api/v1/internal/` bloqueado externamente** (`deny all` no nginx).
15. **Rate limit RIGOROSO em `/auth/login`** — 5 req/s burst 10 nodelay (brute force protection eficiente).
16. **Zero matches** em greps por logs de senha/token/req.body — higiene de logs OK.
17. **Limites de recursos** em todos containers (mem_limit, cpus) — previne runaway.
18. **Log rotation configurada** — 50m × 5 arquivos por container.
19. **Init jobs `*-migrate`** garantem schema sincronizado antes do backend iniciar.

---

## Comparativo com auditoria anterior (25/04/2026)

| Item | 25/04 | 10/05 |
|---|---|---|
| Headers HTTP | 1 achado (`unsafe-inline`) | resolvido |
| HSTS | OK | sem `preload` (achado novo) |
| Resource limits | gap | implementado |
| Healthchecks | gap | implementado |
| Helmet | gap | implementado |
| Credenciais Protheus | **não detectado** | **#C1 CRÍTICO** |
| Senhas default | **não detectado** | **#A1 ALTO** |
| Dependências vulneráveis | OK na época | 4 achados (CVE novos surgiram) |

A auditoria de 25/04 foi varredura rápida e perdeu os achados #C1 e #A1 — vale rodar **busca por strings sensíveis** como item obrigatório do `PROMPT_AUDITORIA_PLATAFORMA.md` na próxima versão.

---

## Roadmap consolidado de correção

### Sprint 1 (semanas 1-2) — Críticos + Quick wins

- [ ] **#C1** — Rotação credencial Protheus + limpeza git history (4-8h) — **com Douglas voltando**
- [ ] **#A2** — `npm audit fix` auth-gateway (30min)
- [ ] **#A3** — `python-multipart>=0.0.27` inventário (1h)
- [ ] **#M5** — `npm audit fix` gestao-ti (30min)
- [ ] **#M3** — `PROTHEUS_INVENTARIO_VERIFY_SSL: true` (1-2h, depende Protheus)

### Sprint 2 (semanas 3-4) — Altos restantes

- [ ] **#A1** — Remover endpoints `/test/create-test-users` + senhas hardcoded (2-4h)
- [ ] **#A4** — Decidir Opção A ou B pra `JWT_REFRESH_SECRET` (30min decisão; 30min ou 8h execução)
- [ ] **#M4** — Atualizar `fast-xml-parser` em fiscal (4-6h, breaking)

### Médio prazo (1-3 meses)

- [ ] **#M1** — Rate limit nginx pra rotas Inventário (1h)
- [ ] **#M2** — bcrypt cost 12 (2h)
- [ ] **#M6** — CSP `block-all-mixed-content` + `upgrade-insecure-requests` (15min)
- [ ] **#M7** — HSTS preload (validação + config)

### Longo prazo (backlog)

- [ ] **#B1, #B2, #B3, #B4, #B5** — boas práticas defensivas

---

## Estimativa de esforço total

- **Sprint 1 (Críticos + Quick wins):** 7-12h
- **Sprint 2 (Altos):** 7-15h
- **Médio prazo:** 4-9h
- **Backlog (Baixos):** 2-6h
- **TOTAL:** 20-42h

---

## Decisões pendentes (alinhar com Clenio)

1. **#C1** — Aprovar rotação credencial Protheus + force push history? (requer cooperação Douglas/Protheus)
2. **#A4** — Opção A (refactor JWT refresh, 8h) ou Opção B (limpar declaração ilusória, 30min)?
3. **#M3** — Aceitamos investir esforço Protheus pra resolver SSL ou mantemos `verify=false` como decisão consciente?
4. **#A1** — Remover endpoints `/test/*` totalmente ou só desabilitá-los em prod (já estão)?

---

## Próximos passos

Conforme `PLAYBOOK_AUDITORIA_v1.md` Frente 1:

1. **Pausa para alinhamento** com Clenio sobre **Crítico** e **Altos** antes de aplicar fix
2. **Médios e Baixos** podem ser agrupados em lote único pra revisão
3. Após aprovação dos fixes, gerar `C:\Arquivos-de-projeto\PlatformCapul_<DDMMAAAA>_Roteiro_Seguranca.md` — roteiro próprio pro Douglas (quando voltar)
4. Branch `audit/seguranca-externa` permanece viva até deploy do roteiro Segurança ser aplicado em PROD
