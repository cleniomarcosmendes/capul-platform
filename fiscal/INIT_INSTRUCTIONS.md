# Instruções de inicialização — Módulo Fiscal

Sequência de passos para subir o módulo Fiscal pela primeira vez no ambiente local. Estas instruções são para o desenvolvedor designado e refletem a Etapa 0 + 1 + 2 da Onda 1 (PLANO_MODULO_FISCAL_v1.5).

> **Onde rodar:** estas instruções assumem ambiente VSCode + Ubuntu nativo (ou WSL2 com Docker Desktop). O monorepo `capul-platform` está em `/mnt/c/meus_projetos/capul-platform/`.

---

## 1. Pré-requisitos

- Node.js 22 LTS instalado.
- Docker Engine 25+ e Docker Compose v2.
- Acesso ao monorepo `capul-platform` com a plataforma já rodando (auth-gateway, hub, postgres, redis).
- Chave AES-256 para `FISCAL_MASTER_KEY` (gere com `openssl rand -base64 32`).

---

## 2. Instalar dependências

```bash
cd /mnt/c/meus_projetos/capul-platform/fiscal/backend
npm install
```

> Em WSL2 com `/mnt/c/`, isso pode ser lento. Alternativa: rodar o `npm install` dentro do container builder do Docker (ver passo 7).

---

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# editar .env e ajustar:
#   - DATABASE_URL (use as credenciais do .env raiz)
#   - JWT_SECRET (mesmo valor do .env raiz)
#   - PROTHEUS_API_URL e PROTHEUS_API_AUTH (mesmo valor usado pelo inventario)
#   - FISCAL_MASTER_KEY (openssl rand -base64 32)
#   - SMTP_* (provisório: mailhog ou smtp interno)
#   - FISCAL_PROTHEUS_MOCK=true  (até a reunião com time Protheus em 13/04/2026)
```

---

## 4. Aplicar a migration Prisma do schema `fiscal`

O Prisma precisa criar o schema `fiscal` no banco `capul_platform`. **Antes** disso, garanta que o schema existe:

```sql
-- Conectado ao banco capul_platform como superuser ou capul_user
CREATE SCHEMA IF NOT EXISTS fiscal;
GRANT USAGE ON SCHEMA fiscal TO capul_user;
GRANT CREATE ON SCHEMA fiscal TO capul_user;
```

Depois, dentro de `fiscal/backend/`:

```bash
npx prisma generate
npx prisma migrate dev --name init_fiscal_schema
```

Isso cria as 12 tabelas + enums em `fiscal.*` e gera o cliente TypeScript em `node_modules/.prisma/client`.

---

## 5. Registrar o módulo FISCAL no Auth Gateway (Etapa 0 da Onda 1)

Inserir o registro do módulo em `core.modulos_sistema` e criar as roles. SQL de referência (validar nomes de coluna com o `auth-gateway/prisma/schema.prisma` antes de aplicar):

```sql
-- 5.1 Registro do módulo
INSERT INTO core.modulos_sistema (codigo, nome, descricao, url_frontend, url_backend, ativo, created_at, updated_at)
VALUES (
  'FISCAL',
  'Módulo Fiscal',
  'Consulta de NF-e/CT-e, Sintegra/CCC e cruzamento Protheus',
  '/fiscal/',
  '/api/v1/fiscal/',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (codigo) DO NOTHING;

-- 5.2 Roles disponíveis no módulo (se houver tabela core.modulos_roles ou equivalente)
-- ROLES: OPERADOR_ENTRADA, ANALISTA_CADASTRO, GESTOR_FISCAL, ADMIN_TI
-- A estrutura exata depende do auth-gateway — peça ao ADMIN_TI para revisar.

-- 5.3 Atribuir GESTOR_FISCAL ao usuário inicial (substituir pelo ID real)
-- INSERT INTO core.usuarios_modulos (id, usuario_id, modulo_codigo, role, ativo, created_at)
-- VALUES (gen_random_uuid(), '<USER_UUID>', 'FISCAL', 'GESTOR_FISCAL', true, NOW());
```

> **Importante:** essa Etapa 0 valida o fluxo completo de autenticação **antes** de o módulo ter qualquer endpoint de negócio. Sem o registro em `core.modulos_sistema` e sem ao menos um usuário com role no módulo `FISCAL`, qualquer chamada vai bater no `FiscalGuard` e retornar `403 Usuário não possui acesso ao módulo FISCAL`.

---

## 6. Rodar localmente (modo dev, fora do Docker)

```bash
cd /mnt/c/meus_projetos/capul-platform/fiscal/backend
npm run start:dev
```

Acesse:

- `GET http://localhost:3002/api/v1/fiscal/ambiente` (com Bearer token válido) → deve retornar `200 { ambienteAtivo: HOMOLOGACAO, bootstrapConcluido: false, ... }`.

> Se chamar sem Bearer token, retorna `401`. Se o token não tiver módulo `FISCAL`, retorna `403`.

---

## 7. Subir via Docker (após validação local)

7.1. Mesclar manualmente o conteúdo de `fiscal/docker-compose.fiscal.yml` no `docker-compose.yml` raiz da plataforma.

7.2. Mesclar o conteúdo de `fiscal/nginx-fiscal.conf` no bloco `server { ... }` apropriado de `nginx/nginx.conf`.

7.3. Adicionar as variáveis `FISCAL_*`, `SMTP_*`, `PROTHEUS_API_*` (se ainda não existirem) no `.env` raiz.

7.4. Build e up:

```bash
cd /mnt/c/meus_projetos/capul-platform
docker compose build fiscal-backend
docker compose up -d fiscal-backend
docker compose logs -f fiscal-backend
```

7.5. Aplicar a migration dentro do container:

```bash
docker compose exec fiscal-backend npx prisma migrate deploy
```

7.6. Reload do nginx:

```bash
docker compose exec nginx nginx -s reload
```

---

## 8. Health check

Após subir:

```bash
# Sem auth — só verifica se a aplicação subiu
curl http://localhost:3002/api/v1/fiscal/ambiente
# Esperado: 401 Unauthorized (porque não passou JWT)

# Com auth — substituir <TOKEN>
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3002/api/v1/fiscal/ambiente
# Esperado: 200 OK com bootstrapConcluido: false

# Health dos sub-módulos stub
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3002/api/v1/fiscal/nfe/health
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3002/api/v1/fiscal/cte/health
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3002/api/v1/fiscal/cadastro/health
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3002/api/v1/fiscal/cruzamento/health
```

---

## 9. Testar o adapter Protheus em modo MOCK

Com `FISCAL_PROTHEUS_MOCK=true`, é possível exercitar o ciclo `exists` → `post` → `exists` → `get` sem o time Protheus ter publicado o endpoint real.

Quando o ProtheusXmlService receber uma chave de 44 dígitos via `NfeService.consultarPorChave()`, o cache interno em memória decide o caminho. Para testar isolado, implemente um endpoint de debug temporário em `cruzamento/` ou rode os specs unitários (próxima etapa).

---

## 10. Próximas etapas (após este scaffold)

- **Reunião com time Protheus (segunda-feira, 13/04/2026):** apresentar `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`. Coletar respostas das 15 perguntas formais (Seção 9 da Especificação).
- **Quando o endpoint real estiver em homologação:** trocar `FISCAL_PROTHEUS_MOCK=false` e validar com chamadas reais.
- **Etapa 3:** implementar `CertificadoModule` (upload, AES-256-GCM, leitura segura do .pfx).
- **Etapas 4-5:** implementar `SefazClient` (NFeDistribuicaoDFe via mTLS) e parser NF-e.
- **Etapas 6, 8, 9:** CT-e, DANFE PDF, DACTE PDF.
- **Etapas 10-11:** CCC client + parser cadastro.
- **Etapa 12-15:** frontend React + Vite (`fiscal/frontend/`).
- **Onda 2 (Etapas 18-27):** cruzamento, scheduler BullMQ, alertas digest, circuit breaker, watchdog, expurgo.

---

## Referências

- `../docs/PLANO_MODULO_FISCAL_v1.4.docx`
- `../docs/PLANO_MODULO_FISCAL_v1.5_ADDENDUM.md`
- `../docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`
