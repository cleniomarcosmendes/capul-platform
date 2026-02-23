# Arquitetura da Plataforma Corporativa — Capul Systems
# Versão 2.1

---

## 1. Visão Geral da Arquitetura

### 1.1 Componentes da Plataforma

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Browser)                            │
│                                                                     │
│              https://capul.empresa.com  (origem única)              │
│                                                                     │
│  /login, /hub    /inventario/*         /gestao-ti/*                 │
│  Portal Hub      Inventário            Gestão de T.I.              │
│  (React)         (HTML+JS+BS5)         (React+Shadcn)              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                             │
│                    :443 (SSL) / :80 (redirect)                      │
│                                                                     │
│  /                    → hub:5170          (Portal Hub)              │
│  /api/v1/auth/*       → auth-gateway:3000 (Auth Gateway)           │
│  /api/v1/core/*       → auth-gateway:3000 (Auth Gateway)           │
│  /inventario/         → inventario-web:8443 (Inventário Frontend)  │
│  /api/v1/inventory/*  → inventario-api:8000 (Inventário Backend)   │
│  /api/v1/products/*   → inventario-api:8000 (Inventário Backend)   │
│  /api/v1/stores/*     → inventario-api:8000 (Inventário Backend)   │
│  /api/v1/users/*      → inventario-api:8000 (Inventário Backend)   │
│  /api/v1/sync/*       → inventario-api:8000 (Inventário Backend)   │
│  /gestao-ti/          → gestao-ti-web:5173 (Gestão TI Frontend)    │
│  /api/v1/gestao-ti/*  → gestao-ti-api:3001 (Gestão TI Backend)    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌────────────────────────┐
│  Auth Gateway    │ │  Inventário  │ │  Gestão T.I.           │
│  (NestJS)        │ │  Backend     │ │  Backend               │
│  :3000           │ │  (FastAPI)   │ │  (NestJS)              │
│                  │ │  :8000       │ │  :3001                 │
└────────┬─────────┘ └──────┬───────┘ └───────┬────────────────┘
         │                  │                 │
         └──────────────────┼─────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16 (capul_platform)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ Schema: core │  │Schema: inventario│  │ Schema: gestao_ti     │ │
│  └──────────────┘  └──────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                            │
                     ┌──────────────┐
                     │  Redis 7     │
                     │  :6379       │
                     └──────────────┘
```

### 1.2 Resumo dos Serviços

| Componente | Tecnologia | Schema DB | Porta Interna | Rota Pública (via Nginx) |
|------------|-----------|-----------|---------------|--------------------------|
| **Nginx** | nginx:alpine | — | 443/80 | `capul.empresa.com` |
| **Auth Gateway** | NestJS + Prisma | core | 3000 | `/api/v1/auth/*`, `/api/v1/core/*` |
| **Portal Hub** | React + Shadcn | — | 5170 | `/`, `/login`, `/hub`, `/perfil` |
| **Inventário Backend** | FastAPI + SQLAlchemy | inventario (lê core) | 8000 | `/api/v1/inventory/*`, `/api/v1/products/*`, `/api/v1/stores/*`, `/api/v1/users/*`, `/api/v1/sync/*` |
| **Inventário Frontend** | HTML + JS + Bootstrap 5 | — | 8443 | `/inventario/*` |
| **Gestão TI Backend** | NestJS + Prisma | gestao_ti (lê core) | 3001 | `/api/v1/gestao-ti/*` |
| **Gestão TI Frontend** | React + Shadcn | — | 5173 | `/gestao-ti/*` |
| **PostgreSQL** | 16-alpine | core + inventario + gestao_ti | 5432 | — (interno) |
| **Redis** | 7-alpine | — | 6379 | — (interno) |

### 1.3 Por que Nginx como Reverse Proxy (CRÍTICO)

Sem Nginx, cada frontend roda em porta diferente (:5170, :8443, :5173). Portas diferentes = **origens diferentes** no browser. Consequência: `localStorage` é **isolado por origem** — o token salvo no Hub (:5170) **não é visível** pelo Inventário (:8443) nem pela Gestão TI (:5173).

Com Nginx, tudo é servido em `capul.empresa.com:443` — **uma origem, um localStorage, um certificado SSL, zero CORS.**

| Aspecto | Sem Nginx (portas separadas) | Com Nginx (origem única) ✅ |
|---------|------------------------------|---------------------------|
| localStorage | ❌ Isolado por porta | ✅ Compartilhado |
| Token entre módulos | ❌ Não funciona | ✅ Automático |
| CORS | ❌ Necessário configurar | ✅ Desnecessário (mesma origem) |
| SSL | ❌ Certificado por serviço | ✅ Um certificado |
| URL para o usuário | ❌ `localhost:5170`, `localhost:8443`... | ✅ `capul.empresa.com` |

---

## 2. Banco de Dados — Schemas Separados

### 2.1 Justificativa

| Critério | Schema Único | Schemas Separados ✅ | Bancos Separados |
|----------|-------------|---------------------|-----------------|
| Isolamento | ❌ Fraco | ✅ Bom | ✅ Total |
| Queries cross-module | ✅ Simples | ✅ Simples (`core.filiais`) | ❌ Complexo |
| Backup/Restore parcial | ❌ Difícil | ✅ Por schema | ✅ Por banco |
| Permissões DB | ❌ Mesma role | ✅ Permissão por schema | ✅ Role por banco |
| Login único | ✅ | ✅ | ⚠️ Requer gateway |
| Adicionar módulo | ✅ | ✅ (`CREATE SCHEMA`) | ❌ Novo banco |

### 2.2 Rename do Banco (Step 0)

O inventário atual usa o banco `inventario_protheus`. A plataforma unificada usa `capul_platform`. O rename é o **primeiro passo**, antes de qualquer outra migração:

```sql
-- Executar como superuser (postgres), fora do expediente
-- 1. Desconectar todas as sessões ativas
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'inventario_protheus' AND pid <> pg_backend_pid();

-- 2. Renomear o banco
ALTER DATABASE inventario_protheus RENAME TO capul_platform;

-- 3. Atualizar .env de todos os serviços:
-- DATABASE_URL=postgresql://capul_user:xxx@postgres:5432/capul_platform
```

O `search_path` do inventário já usa `inventario` como schema, então as queries continuam funcionando após o rename.

### 2.3 Referências Cruzadas

Tabelas de módulo referenciam `core` para entidades compartilhadas:

```sql
CREATE TABLE gestao_ti.chamados (
    id UUID PRIMARY KEY,
    solicitante_id UUID REFERENCES core.usuarios(id),
    filial_id UUID REFERENCES core.filiais(id),
    equipe_atual_id UUID REFERENCES gestao_ti.equipes_ti(id),
    visibilidade VARCHAR(10) NOT NULL DEFAULT 'PUBLICO',  -- PUBLICO | PRIVADO
    ...
);
-- PUBLICO: qualquer usuário abre e acompanha os próprios chamados
-- PRIVADO: somente membros de equipes de TI visualizam (tarefas internas)
```

---

## 3. Autenticação Unificada

### 3.1 Login: Username OU Email

O campo de login aceita **ambos os formatos**. O Auth Gateway detecta automaticamente:

```
Entrada contém "@" → busca por email
Entrada não contém "@" → busca por username
```

Preserva compatibilidade total com o inventário (login por username) e permite que novos usuários usem email.

### 3.2 JWT — Formato Padronizado

**Todos os backends** validam o mesmo token com a **mesma JWT_SECRET**:

```json
{
  "sub": "uuid-do-usuario",
  "username": "joao.silva",
  "email": "joao@empresa.com",
  "filialId": "uuid-da-filial-atual",
  "filialCodigo": "01",
  "modulos": [
    { "codigo": "INVENTARIO", "role": "SUPERVISOR" },
    { "codigo": "GESTAO_TI", "role": "TECNICO" }
  ],
  "iat": 1708473600,
  "exp": 1708474500
}
```

| Parâmetro | Valor | Notas |
|-----------|-------|-------|
| Access Token expira | 15 minutos | Segurança reforçada |
| Refresh Token expira | 7 dias | Com rotação automática |
| Algoritmo | HS256 | Mesma chave em todos os backends |

### 3.3 Transição do Auth do Inventário

| Etapa | Ação |
|-------|------|
| 1 | Auth Gateway gera JWT no novo formato (15 min + refresh 7 dias) |
| 2 | FastAPI do inventário é ajustado para validar o novo payload |
| 3 | FastAPI extrai role do array `modulos` onde `codigo = "INVENTARIO"` |
| 4 | Frontend do inventário ajustado para chamar refresh quando token expirar |
| 5 | Período de transição: FastAPI aceita formato antigo E novo (feature flag) |
| 6 | Após validação completa, desativar formato antigo |

**Ajuste mínimo no FastAPI:**

```python
# ANTES (formato antigo):
# role = token_payload["role"]
# store_id = token_payload["store_id"]

# DEPOIS (formato unificado):
def get_inventory_role(token_payload: dict) -> str:
    for modulo in token_payload.get("modulos", []):
        if modulo["codigo"] == "INVENTARIO":
            return modulo["role"]
    raise HTTPException(403, "Sem acesso ao módulo Inventário")

filial_id = token_payload["filialId"]
```

### 3.4 Fluxo de Login Completo

```
Usuário acessa capul.empresa.com → Nginx roteia para Hub
         │
         ▼
┌─────────────────────┐
│    Tela de Login     │
│  /login              │
│                      │
│  Login: [joao.silva] │ ← aceita username ou email
│  Senha: [••••••••]   │
│  [Entrar]            │
└──────────┬──────────┘
           │
           ▼ POST /api/v1/auth/login (via Nginx → Auth Gateway)
┌──────────────────────┐
│    Auth Gateway       │
│                       │
│ 1. Detecta: username  │
│    ou email?          │
│ 2. Busca core.usuarios│
│ 3. Valida bcrypt      │
│ 4. Busca permissões   │
│ 5. Gera JWT + Refresh │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│          Portal Hub (/hub)            │
│                                       │
│  Token salvo no localStorage          │
│  (mesma origem = compartilhado)       │
│                                       │
│  ┌─────────────┐  ┌─────────────┐    │
│  │ 📦          │  │ 🖥️         │    │
│  │ Inventário  │  │ Gestão TI   │    │
│  │ Supervisor  │  │ Técnico     │    │
│  │ [Acessar]   │  │ [Acessar]   │    │
│  └─────────────┘  └─────────────┘    │
│                                       │
│  [Trocar Filial]  [Perfil]  [Sair]   │
└──────────────────────────────────────┘
           │
           │ Clica "Inventário"
           │ → navega para /inventario/
           │ (mesma origem, mesmo localStorage, mesmo token)
           ▼
┌──────────────────────────────────┐
│  /inventario/ (via Nginx)         │
│                                   │
│  JS lê token do localStorage      │
│  → funciona porque mesma origem   │
│  FastAPI valida JWT                │
│  → Dashboard do Inventário        │
└──────────────────────────────────┘
```

---

## 4. Sistema de Permissões por Módulo

### 4.1 Estrutura

```
core.modulos_sistema              core.roles_modulo
┌──────┬────────────┐            ┌──────┬──────────┬────────────────┐
│  id  │   codigo   │            │  id  │ moduloId │   codigo       │
├──────┼────────────┤            ├──────┼──────────┼────────────────┤
│ uuid │ INVENTARIO │◄───────────│ uuid │ INVENT.  │ ADMIN          │
│ uuid │ GESTAO_TI  │            │ uuid │ INVENT.  │ SUPERVISOR     │
│ uuid │ FUTURO_X   │            │ uuid │ INVENT.  │ OPERATOR       │
└──────┴────────────┘            │ uuid │ GEST.TI  │ ADMIN          │
                                 │ uuid │ GEST.TI  │ GESTOR_TI      │
                                 │ uuid │ GEST.TI  │ TECNICO        │
                                 │ uuid │ GEST.TI  │ DESENVOLVEDOR  │
                                 │ uuid │ GEST.TI  │ GERENTE_PROJETO│
                                 │ uuid │ GEST.TI  │ USUARIO_FINAL  │
                                 │ uuid │ GEST.TI  │ FINANCEIRO     │
                                 └──────┴──────────┴────────────────┘
```

### 4.2 Roles por Módulo

| Módulo | Roles | Descrição |
|--------|-------|-----------|
| INVENTARIO | ADMIN | Acesso total, todas as filiais |
| | SUPERVISOR | Criar/editar inventários da sua filial |
| | OPERATOR | Visualizar e contar itens |
| GESTAO_TI | ADMIN | Acesso total |
| | GESTOR_TI | Gestão completa de TI |
| | TECNICO | Atender chamados (PÚBLICOS e PRIVADOS), registrar atividades |
| | DESENVOLVEDOR | Chamados internos, projetos dev |
| | GERENTE_PROJETO | Projetos, custos, aprovações |
| | USUARIO_FINAL | Abrir chamados PÚBLICOS, consultar status dos próprios chamados |
| | FINANCEIRO | Contratos, rateio, custos |

**Total: 3 roles (Inventário) + 7 roles (Gestão TI) = 10 roles**

---

## 5. Migração do Inventário

### 5.1 Mapeamento de Entidades

```
INVENTÁRIO (schema inventario)       CORE (schema core)
──────────────────────────────       ──────────────────

stores                          →    core.filiais
  id (UUID)                     →      id (mesmo UUID preservado)
  code                          →      codigo
  name                          →      nome_fantasia
  description                   →      descricao
  address                       →      endereco
  phone                         →      telefone
  email                         →      email
  is_active                     →      status (ATIVO/INATIVO)
  (novo)                        →      razao_social, cnpj, cidade, estado, cep
  (novo)                        →      empresa_id (FK)

users                           →    core.usuarios
  id (UUID)                     →      id (mesmo UUID preservado)
  username                      →      username (preservado)
  password_hash                 →      senha (mesmo hash bcrypt)
  full_name                     →      nome
  email                         →      email
  role (ENUM)                   →      (migra para permissoes_modulo)
  store_id                      →      filial_principal_id
  is_active                     →      status (ATIVO/INATIVO)
  last_login                    →      ultimo_login

user_stores                     →    core.usuario_filiais
  user_id                       →      usuario_id (mesmo UUID)
  store_id                      →      filial_id (mesmo UUID)
  is_default                    →      is_default (preservado)
```

### 5.2 Etapas da Migração

```
STEP 0 — Renomear banco (pré-requisito)
─────────────────────────────────────────────────
✅ Sem risco funcional. Requer janela de manutenção (sem conexões ativas).
- ALTER DATABASE inventario_protheus RENAME TO capul_platform
- Atualizar .env de todos os serviços

ETAPA 1 — Criar schema core (sem afetar inventário)
─────────────────────────────────────────────────
✅ Sem risco. Inventário continua funcionando normalmente.
- CREATE SCHEMA core
- Criar todas as tabelas do core
- Campos novos (cnpj, razao_social) com NULL

ETAPA 2 — Migrar dados para o core
─────────────────────────────────────────────────
⚠️ Risco baixo. Script SQL testado antes em homologação.
- INSERT INTO core.filiais SELECT ... FROM inventario.stores
- INSERT INTO core.usuarios SELECT ... FROM inventario.users
- INSERT INTO core.usuario_filiais SELECT ... FROM inventario.user_stores
- Criar empresa padrão, registrar módulos, mapear roles → permissões

ETAPA 3 — VIEWs de compatibilidade + INSTEAD OF Triggers
─────────────────────────────────────────────────
⚠️ Risco médio. Testar todas as queries do FastAPI (SELECT, INSERT, UPDATE).
- Backup das tabelas originais (stores_backup, users_backup, user_stores_backup)
- Criar VIEWs que mapeiam nomes antigos para o core
- Criar INSTEAD OF triggers para INSERT/UPDATE/DELETE nas VIEWs
  (VIEWs com JOIN são READ-ONLY no PostgreSQL — triggers são obrigatórios)

ETAPA 4 — Ajustar FastAPI para novo JWT
─────────────────────────────────────────────────
⚠️ Risco médio. Validar auth completo.
- Feature flag: aceitar formato antigo E novo durante transição
- Extrair role do array modulos[INVENTARIO]
- Adicionar refresh automático no frontend

ETAPA 5 — Validação e limpeza
─────────────────────────────────────────────────
✅ Risco baixo. Após homologação completa.
- Desativar feature flag do formato antigo
- Manter VIEWs + triggers (facilitam manutenção) ou migrar FastAPI para ler core direto
```

### 5.3 VIEWs de Compatibilidade + INSTEAD OF Triggers (CRÍTICO)

No PostgreSQL, **VIEWs com JOIN são read-only**. A VIEW `inventario.users` faz JOIN com `core.usuarios`, `core.permissoes_modulo` e `core.roles_modulo`. Sem triggers, qualquer INSERT/UPDATE do FastAPI vai falhar.

**Solução:** INSTEAD OF triggers que interceptam INSERT/UPDATE/DELETE na VIEW e redirecionam para as tabelas reais no core.

**VIEW inventario.stores (simples, sem JOIN — mas precisa de trigger para conversão is_active ↔ status):**

```sql
CREATE OR REPLACE VIEW inventario.stores AS
SELECT
    id,
    codigo AS code,
    nome_fantasia AS name,
    descricao AS description,
    endereco AS address,
    telefone AS phone,
    email,
    (status = 'ATIVO') AS is_active,
    created_at,
    updated_at
FROM core.filiais;

-- INSERT trigger
CREATE OR REPLACE FUNCTION inventario.fn_stores_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO core.filiais (id, codigo, nome_fantasia, descricao, endereco, telefone, email,
        status, empresa_id, created_at, updated_at)
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.code, NEW.name, NEW.description, NEW.address, NEW.phone, NEW.email,
        CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        (SELECT id FROM core.empresas LIMIT 1),
        NOW(), NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_insert
    INSTEAD OF INSERT ON inventario.stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_stores_insert();

-- UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_stores_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.filiais SET
        codigo = NEW.code,
        nome_fantasia = NEW.name,
        descricao = NEW.description,
        endereco = NEW.address,
        telefone = NEW.phone,
        email = NEW.email,
        status = CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_update
    INSTEAD OF UPDATE ON inventario.stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_stores_update();
```

**VIEW inventario.users (com JOIN — triggers obrigatórios):**

```sql
CREATE OR REPLACE VIEW inventario.users AS
SELECT
    u.id,
    u.username,
    u.senha AS password_hash,
    u.nome AS full_name,
    u.email,
    rm.codigo::inventario.user_role AS role,
    u.filial_principal_id AS store_id,
    (u.status = 'ATIVO') AS is_active,
    u.ultimo_login AS last_login,
    u.created_at,
    u.updated_at
FROM core.usuarios u
LEFT JOIN core.permissoes_modulo pm
    ON pm.usuario_id = u.id AND pm.modulo_id = (
        SELECT id FROM core.modulos_sistema WHERE codigo = 'INVENTARIO'
    )
LEFT JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id;

-- INSERT trigger
CREATE OR REPLACE FUNCTION inventario.fn_users_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.id, gen_random_uuid());

    INSERT INTO core.usuarios (id, username, senha, nome, email,
        filial_principal_id, status, primeiro_acesso, created_at, updated_at)
    VALUES (
        v_user_id,
        NEW.username, NEW.password_hash, NEW.full_name, NEW.email,
        NEW.store_id,
        CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        true, NOW(), NOW()
    );

    -- Criar permissão do módulo inventário
    INSERT INTO core.permissoes_modulo (id, usuario_id, modulo_id, role_modulo_id, status, created_at, updated_at)
    SELECT gen_random_uuid(), v_user_id, m.id, rm.id, 'ATIVO', NOW(), NOW()
    FROM core.modulos_sistema m
    JOIN core.roles_modulo rm ON rm.modulo_id = m.id AND rm.codigo = NEW.role::text
    WHERE m.codigo = 'INVENTARIO';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_insert
    INSTEAD OF INSERT ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_insert();

-- UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_users_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.usuarios SET
        username = NEW.username,
        senha = NEW.password_hash,
        nome = NEW.full_name,
        email = NEW.email,
        filial_principal_id = NEW.store_id,
        status = CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        ultimo_login = NEW.last_login,
        updated_at = NOW()
    WHERE id = OLD.id;

    -- Atualizar role se mudou
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        UPDATE core.permissoes_modulo SET
            role_modulo_id = (
                SELECT rm.id FROM core.roles_modulo rm
                JOIN core.modulos_sistema m ON m.id = rm.modulo_id
                WHERE m.codigo = 'INVENTARIO' AND rm.codigo = NEW.role::text
            ),
            updated_at = NOW()
        WHERE usuario_id = OLD.id
          AND modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'INVENTARIO');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_update
    INSTEAD OF UPDATE ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_update();

-- DELETE trigger
CREATE OR REPLACE FUNCTION inventario.fn_users_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete: desativar em vez de excluir
    UPDATE core.usuarios SET status = 'INATIVO', updated_at = NOW()
    WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_delete
    INSTEAD OF DELETE ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_delete();
```

**VIEW inventario.user_stores:**

```sql
CREATE OR REPLACE VIEW inventario.user_stores AS
SELECT
    uf.id,
    uf.usuario_id AS user_id,
    uf.filial_id AS store_id,
    uf.is_default,
    uf.created_at,
    uf.created_by::uuid AS created_by,
    uf.updated_at
FROM core.usuario_filiais uf;

-- INSERT trigger
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO core.usuario_filiais (id, usuario_id, filial_id, is_default, created_at, created_by, updated_at)
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.user_id, NEW.store_id, COALESCE(NEW.is_default, false),
        NOW(), NEW.created_by::text, NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_insert
    INSTEAD OF INSERT ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_insert();

-- UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.usuario_filiais SET
        is_default = NEW.is_default,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_update
    INSTEAD OF UPDATE ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_update();

-- DELETE trigger
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM core.usuario_filiais WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_delete
    INSTEAD OF DELETE ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_delete();
```

### 5.4 Estratégia de Rollback

Cada etapa é reversível:
- Step 0: ALTER DATABASE capul_platform RENAME TO inventario_protheus
- Etapa 1: DROP SCHEMA core CASCADE
- Etapa 2: TRUNCATE core.filiais, core.usuarios (originais intactos nos backups)
- Etapa 3: DROP VIEWs + triggers, RENAME _backup tables back
- Etapa 4: Feature flag volta para formato antigo
- Etapa 5: Só executa após validação total

---

## 6. Nginx — Configuração do Reverse Proxy

### 6.1 Arquivo de Configuração

Arquivo: `capul-platform/nginx/nginx.conf`

```nginx
upstream hub {
    server hub:5170;
}

upstream auth_gateway {
    server auth-gateway:3000;
}

upstream inventario_frontend {
    server inventario-frontend:8443;
}

upstream inventario_backend {
    server inventario-backend:8000;
}

upstream gestao_ti_frontend {
    server gestao-ti-frontend:5173;
}

upstream gestao_ti_backend {
    server gestao-ti-backend:3001;
}

server {
    listen 80;
    server_name capul.empresa.com localhost;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name capul.empresa.com localhost;

    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    client_max_body_size 50M;

    # Headers herdados por todos os location blocks
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # ═══════════════════════════════════
    # Auth Gateway API
    # ═══════════════════════════════════
    location /api/v1/auth/ {
        proxy_pass http://auth_gateway;
    }

    location /api/v1/core/ {
        proxy_pass http://auth_gateway;
    }

    # ═══════════════════════════════════
    # Inventário (múltiplos prefixos de rota)
    # ═══════════════════════════════════
    location /inventario/ {
        proxy_pass http://inventario_frontend/;
    }

    location /api/v1/inventory/ {
        proxy_pass http://inventario_backend/api/v1/inventory/;
    }

    location /api/v1/products/ {
        proxy_pass http://inventario_backend/api/v1/products/;
    }

    location /api/v1/stores/ {
        proxy_pass http://inventario_backend/api/v1/stores/;
    }

    location /api/v1/users/ {
        proxy_pass http://inventario_backend/api/v1/users/;
    }

    location /api/v1/sync/ {
        proxy_pass http://inventario_backend/api/v1/sync/;
    }

    # ═══════════════════════════════════
    # Gestão de T.I.
    # ═══════════════════════════════════
    location /gestao-ti/ {
        proxy_pass http://gestao_ti_frontend/;
    }

    location /api/v1/gestao-ti/ {
        proxy_pass http://gestao_ti_backend/api/v1/;
    }

    # ═══════════════════════════════════
    # Hub (rota padrão — última)
    # ═══════════════════════════════════
    location / {
        proxy_pass http://hub;
    }
}
```

### 6.2 Nota sobre Desenvolvimento Local

Para desenvolvimento local, usar mkcert para gerar certificados:

```bash
# Instalar mkcert (se não tiver)
mkcert -install
cd capul-platform/nginx/certs
mkcert localhost capul.empresa.com
# Gera: localhost+1.pem e localhost+1-key.pem
# Renomear para cert.pem e key.pem
```

Adicionar no `/etc/hosts`:
```
127.0.0.1 capul.empresa.com
```

---

## 7. Docker Compose Unificado

```yaml
version: '3.8'

services:
  # ═══════════════════════════════════════
  # REVERSE PROXY
  # ═══════════════════════════════════════
  nginx:
    image: nginx:alpine
    container_name: capul-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - hub
      - auth-gateway
      - inventario-frontend
      - gestao-ti-frontend
    restart: unless-stopped

  # ═══════════════════════════════════════
  # INFRAESTRUTURA
  # ═══════════════════════════════════════
  postgres:
    image: postgres:16-alpine
    container_name: capul-db
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: capul_platform
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init-schemas.sql:/docker-entrypoint-initdb.d/01-schemas.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: capul-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # ═══════════════════════════════════════
  # CORE — Auth Gateway + Portal Hub
  # ═══════════════════════════════════════
  auth-gateway:
    build: ./auth-gateway
    container_name: capul-auth
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/capul_platform?schema=core
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  hub:
    build: ./hub
    container_name: capul-hub
    ports:
      - "5170:5170"
    depends_on:
      - auth-gateway
    restart: unless-stopped

  # ═══════════════════════════════════════
  # MÓDULO — Inventário
  # ═══════════════════════════════════════
  inventario-backend:
    build: ./inventario/backend
    container_name: capul-inventario-api
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/capul_platform
      JWT_SECRET: ${JWT_SECRET}
      DB_SCHEMA: inventario
      CORE_SCHEMA: core
      UNIFIED_AUTH: "true"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  inventario-frontend:
    build: ./inventario/frontend
    container_name: capul-inventario-web
    ports:
      - "8443:8443"
    depends_on:
      - inventario-backend
    restart: unless-stopped

  # ═══════════════════════════════════════
  # MÓDULO — Gestão de T.I.
  # ═══════════════════════════════════════
  gestao-ti-backend:
    build: ./gestao-ti/backend
    container_name: capul-gestao-ti-api
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/capul_platform
      JWT_SECRET: ${JWT_SECRET}
      DB_SCHEMA: gestao_ti
      CORE_SCHEMA: core
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  gestao-ti-frontend:
    build: ./gestao-ti/frontend
    container_name: capul-gestao-ti-web
    ports:
      - "5173:5173"
    depends_on:
      - gestao-ti-backend
    restart: unless-stopped

  # ═══════════════════════════════════════
  # FERRAMENTAS
  # ═══════════════════════════════════════
  pgadmin:
    image: dpage/pgadmin4
    container_name: capul-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

---

## 8. Estrutura de Pastas

```
capul-platform/
│
├── docker-compose.yml
├── .env
├── .env.example
│
├── nginx/
│   ├── nginx.conf                  # Reverse proxy config
│   └── certs/
│       ├── cert.pem                # SSL (mkcert para dev, real para prod)
│       └── key.pem
│
├── database/
│   ├── init-schemas.sql
│   └── migrations/
│       ├── 000-rename-database.sql
│       ├── 001-core-tables.sql
│       ├── 002-migrate-stores.sql
│       ├── 003-migrate-users.sql
│       ├── 004-compatibility-views.sql       # VIEWs
│       ├── 005-instead-of-triggers.sql       # INSTEAD OF triggers (CRÍTICO)
│       └── 006-gestao-ti-tables.sql
│
├── auth-gateway/                   # NestJS
│   ├── Dockerfile
│   ├── prisma/schema.prisma        # Schema core
│   └── src/ ...
│
├── hub/                            # React
│   ├── Dockerfile
│   └── src/ ...
│
├── inventario/                     # FastAPI + HTML (existente)
│   ├── backend/
│   └── frontend/
│
├── gestao-ti/                      # NestJS + React (novo)
│   ├── backend/
│   │   ├── prisma/schema.prisma    # gestao_ti + core (read-only via middleware)
│   │   └── src/ ...
│   └── frontend/
│       └── src/ ...
│
└── docs/
    ├── plano-ti-system-v5.md
    ├── arquitetura-plataforma-v2.1.md
    └── fase0-fase1-tecnico-v1.1.md
```

---

## 9. Schema Prisma — Core (Auth Gateway)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["core"]
}

enum StatusGeral {
  ATIVO
  INATIVO
  @@schema("core")
}

model Empresa {
  id           String      @id @default(uuid())
  razaoSocial  String      @map("razao_social")
  nomeFantasia String      @map("nome_fantasia")
  cnpjMatriz   String      @unique @map("cnpj_matriz")
  endereco     String?
  cidade       String?
  estado       String?
  cep          String?
  telefone     String?
  email        String?
  logoUrl      String?     @map("logo_url")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  filiais      Filial[]
  @@map("empresas")
  @@schema("core")
}

model Filial {
  id           String      @id @default(uuid())
  codigo       String      @unique
  razaoSocial  String?     @map("razao_social")
  nomeFantasia String      @map("nome_fantasia")
  cnpj         String?     @unique
  descricao    String?
  endereco     String?
  cidade       String?
  estado       String?
  cep          String?
  telefone     String?
  email        String?
  status       StatusGeral @default(ATIVO)
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  empresaId    String      @map("empresa_id")
  empresa      Empresa     @relation(fields: [empresaId], references: [id])
  departamentos  Departamento[]
  centrosCusto   CentroCusto[]
  usuarios       Usuario[]       @relation("FilialPrincipal")
  usuarioFiliais UsuarioFilial[]
  @@map("filiais")
  @@schema("core")
}

model Departamento {
  id        String      @id @default(uuid())
  nome      String
  descricao String?
  status    StatusGeral @default(ATIVO)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")
  filialId  String      @map("filial_id")
  filial    Filial      @relation(fields: [filialId], references: [id])
  usuarios  Usuario[]
  @@unique([filialId, nome])
  @@map("departamentos")
  @@schema("core")
}

model CentroCusto {
  id        String      @id @default(uuid())
  codigo    String
  nome      String
  descricao String?
  status    StatusGeral @default(ATIVO)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")
  filialId  String      @map("filial_id")
  filial    Filial      @relation(fields: [filialId], references: [id])
  @@unique([filialId, codigo])
  @@map("centros_custo")
  @@schema("core")
}

model Usuario {
  id             String      @id @default(uuid())
  username       String      @unique
  email          String?     @unique
  nome           String
  senha          String
  telefone       String?
  cargo          String?
  avatarUrl      String?     @map("avatar_url")
  status         StatusGeral @default(ATIVO)
  primeiroAcesso Boolean     @default(true) @map("primeiro_acesso")
  ultimoLogin    DateTime?   @map("ultimo_login")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")
  filialPrincipalId String?        @map("filial_principal_id")
  filialPrincipal   Filial?        @relation("FilialPrincipal", fields: [filialPrincipalId], references: [id])
  departamentoId    String?        @map("departamento_id")
  departamento      Departamento?  @relation(fields: [departamentoId], references: [id])
  filiais       UsuarioFilial[]
  permissoes    PermissaoModulo[]
  refreshTokens RefreshToken[]
  @@map("usuarios")
  @@schema("core")
}

model UsuarioFilial {
  id        String    @id @default(uuid())
  isDefault Boolean   @default(false) @map("is_default")
  createdAt DateTime  @default(now()) @map("created_at")
  createdBy String?   @map("created_by")
  updatedAt DateTime? @updatedAt @map("updated_at")
  usuarioId String    @map("usuario_id")
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  filialId  String    @map("filial_id")
  filial    Filial    @relation(fields: [filialId], references: [id])
  @@unique([usuarioId, filialId])
  @@map("usuario_filiais")
  @@schema("core")
}

model ModuloSistema {
  id          String      @id @default(uuid())
  codigo      String      @unique
  nome        String
  descricao   String?
  icone       String?
  cor         String?
  urlFrontend String?     @map("url_frontend")
  urlBackend  String?     @map("url_backend")
  ordem       Int         @default(0)
  status      StatusGeral @default(ATIVO)
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  rolesDisponiveis RoleModulo[]
  permissoes       PermissaoModulo[]
  @@map("modulos_sistema")
  @@schema("core")
}

model RoleModulo {
  id        String  @id @default(uuid())
  codigo    String
  nome      String
  descricao String?
  moduloId  String        @map("modulo_id")
  modulo    ModuloSistema @relation(fields: [moduloId], references: [id])
  permissoes PermissaoModulo[]
  @@unique([moduloId, codigo])
  @@map("roles_modulo")
  @@schema("core")
}

model PermissaoModulo {
  id           String      @id @default(uuid())
  status       StatusGeral @default(ATIVO)
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  usuarioId    String        @map("usuario_id")
  usuario      Usuario       @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  moduloId     String        @map("modulo_id")
  modulo       ModuloSistema @relation(fields: [moduloId], references: [id])
  roleModuloId String        @map("role_modulo_id")
  roleModulo   RoleModulo    @relation(fields: [roleModuloId], references: [id])
  @@unique([usuarioId, moduloId])
  @@map("permissoes_modulo")
  @@schema("core")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  usuarioId String   @map("usuario_id")
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@map("refresh_tokens")
  @@schema("core")
}

model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String?
  descricao String?
  categoria String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("system_config")
  @@schema("core")
}

model SystemLog {
  id        String   @id @default(uuid())
  level     String
  message   String
  module    String?
  action    String?
  usuarioId String?  @map("usuario_id")
  ipAddress String?  @map("ip_address")
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")
  @@map("system_logs")
  @@schema("core")
}
```

---

## 10. Schema Prisma — Gestão TI (Backend Gestão TI)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["gestao_ti", "core"]
}

// ============================================================
// MODELOS DO CORE — Read-Only neste backend
// NÃO usar @@ignore (quebra o Prisma Client).
// Protegido por middleware que bloqueia create/update/delete.
// ============================================================

model Filial {
  id           String @id
  codigo       String
  nomeFantasia String @map("nome_fantasia")

  @@map("filiais")
  @@schema("core")
}

model Usuario {
  id       String  @id
  username String
  nome     String
  email    String?

  membrosEquipe MembroEquipe[]

  @@map("usuarios")
  @@schema("core")
}

// ============================================================
// MODELOS DO GESTAO_TI
// ============================================================

enum StatusGeral {
  ATIVO
  INATIVO
  @@schema("gestao_ti")
}

model EquipeTI {
  id                   String      @id @default(uuid())
  nome                 String      @unique
  sigla                String      @unique
  descricao            String?
  cor                  String?     @default("#3B82F6")
  icone                String?     @default("users")
  aceitaChamadoExterno Boolean     @default(true) @map("aceita_chamado_externo")
  emailEquipe          String?     @map("email_equipe")
  ordem                Int         @default(0)
  status               StatusGeral @default(ATIVO)
  createdAt            DateTime    @default(now()) @map("created_at")
  updatedAt            DateTime    @updatedAt @map("updated_at")

  membros MembroEquipe[]

  @@map("equipes_ti")
  @@schema("gestao_ti")
}

model MembroEquipe {
  id        String      @id @default(uuid())
  isLider   Boolean     @default(false) @map("is_lider")
  status    StatusGeral @default(ATIVO)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  usuarioId String   @map("usuario_id")
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])
  equipeId  String   @map("equipe_id")
  equipe    EquipeTI @relation(fields: [equipeId], references: [id])

  @@unique([usuarioId, equipeId])
  @@map("membros_equipe")
  @@schema("gestao_ti")
}
```

**Middleware de proteção (impede escrita acidental no core):**

```typescript
// gestao-ti/backend/src/prisma/prisma-read-only.middleware.ts
import { Prisma } from '@prisma/client';

export function readOnlyCoreMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const readOnlyModels = ['Filial', 'Usuario'];
    const writeActions = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

    if (readOnlyModels.includes(params.model ?? '') && writeActions.includes(params.action)) {
      throw new Error(
        `[BLOQUEADO] ${params.model} é read-only neste backend. ` +
        `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`
      );
    }

    return next(params);
  };
}

// Registrar no PrismaService:
// this.prisma.$use(readOnlyCoreMiddleware());
```

---

## 11. Roadmap de Migração Visual do Inventário

| Etapa | Escopo | Quando |
|-------|--------|--------|
| 1 | Portal Hub (login + seleção) já é React | Fase 0 |
| 2 | Inventário funciona como está (Bootstrap) via `/inventario/` | Fase 0+ |
| 3 | Migração gradual das telas para React (começando pelo Dashboard) | Após Fase 6 |
| 4 | Desativar frontend antigo quando 100% migrado | Futuro |

Migração **não-bloqueante** — inventário funciona durante todo o processo.

---

## Controle de Versão

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | — | Versão inicial |
| 2.0 | — | Alinhamento com plano v5 e técnico v1. JWT padronizado. Migração detalhada. |
| 2.1 | — | **Correções da 2ª revisão técnica (5 pontos).** (1) Nginx reverse proxy adicionado — resolve localStorage cross-origin (CRÍTICO). (2) INSTEAD OF triggers nas VIEWs de compatibilidade — VIEWs com JOIN são read-only no PostgreSQL (CRÍTICO). (3) @@ignore removido do Prisma da Gestão TI + middleware de proteção read-only. (4) Step 0: rename do banco inventario_protheus → capul_platform documentado. (5) Todas as 10 roles listadas (7 Gestão TI + 3 Inventário). Docker Compose com Nginx. Configuração completa do nginx.conf. Estrutura de pastas com nginx/ e migrations numeradas. |
| 2.1.1 | — | **Correções da 3ª revisão.** (1) Nginx: adicionadas todas as rotas do inventário — /api/v1/products/, /api/v1/stores/, /api/v1/users/, /api/v1/sync/ (CRÍTICO). (2) URLs dos módulos corrigidas para paths relativos via Nginx. |
| 2.1.2 | — | **Correções da 6ª revisão + visibilidade de chamados.** (1) Proxy headers padronizados no nível server{} (herdados por todos os locations). (2) Schema chamados: campo `visibilidade` (PUBLICO/PRIVADO) adicionado. (3) Roles TECNICO e USUARIO_FINAL: descrições atualizadas para refletir visibilidade. |
