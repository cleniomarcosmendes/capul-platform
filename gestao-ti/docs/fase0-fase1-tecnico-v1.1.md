# Documentação Técnica — Fase 0 + Fase 1
# Plataforma Corporativa Capul Systems
# Versão 1.1

**Referências:**
- Plano Estratégico: `plano-ti-system-v5.md` (v5.0)
- Arquitetura: `arquitetura-plataforma-v2.1.md` (v2.1)

---

## Fase 0 — Plataforma Core + Migração Inventário

### Duração: 3-4 semanas (2 sprints)

---

### 0.1 Objetivo

Construir a base compartilhada da plataforma (schema core, Auth Gateway, Portal Hub) e migrar as entidades comuns do inventário (stores → filiais, users → usuarios) para o core. Ao final, o inventário existente funciona normalmente, mas agora com login unificado.

---

### 0.2 Pré-Requisitos

- PostgreSQL 16 rodando (já existe no inventário).
- Docker e Docker Compose instalados.
- Repositório `capul-platform` criado.
- Inventário realocado para `capul-platform/inventario/`.

---

### 0.2.1 Step 0 — Renomear Banco de Dados (Pré-Migração)

Antes de qualquer outra ação, renomear o banco do inventário para o nome da plataforma. Executar **fora do expediente** (requer zero conexões ativas):

```sql
-- Como superuser (postgres)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'inventario_protheus' AND pid <> pg_backend_pid();

ALTER DATABASE inventario_protheus RENAME TO capul_platform;
```

Após o rename, atualizar o `.env` do inventário:
```env
DATABASE_URL=postgresql://capul_user:xxx@postgres:5432/capul_platform
```

O inventário continua funcionando normalmente — o `search_path` já usa `inventario` como schema.

---

### 0.3 Sprint 0A — Core + Auth Gateway (Semanas 1-2)

#### 0.3.1 Setup do Projeto

```bash
# Criar estrutura
mkdir -p capul-platform/{auth-gateway,hub,gestao-ti,database/migrations,nginx/certs,docs}
cd capul-platform

# Mover inventário existente
# cp -r /path/to/Capul_Inventario ./inventario

# Gerar certificados para dev local
mkcert -install
cd nginx/certs && mkcert localhost capul.empresa.com
mv localhost+1.pem cert.pem && mv localhost+1-key.pem key.pem
cd ../..

# Adicionar ao /etc/hosts (dev local)
# echo "127.0.0.1 capul.empresa.com" | sudo tee -a /etc/hosts

# Iniciar Auth Gateway
cd auth-gateway
npx @nestjs/cli new . --package-manager npm
npm install @nestjs/config @nestjs/jwt @nestjs/passport
npm install @prisma/client prisma bcryptjs class-validator class-transformer
npm install -D @types/bcryptjs
npx prisma init
```

#### 0.3.2 Nginx — Reverse Proxy (CRÍTICO)

Todos os frontends e APIs são servidos por trás do Nginx em **uma única origem** (`capul.empresa.com`). Isso é obrigatório porque `localStorage` é isolado por origem — sem Nginx, o token salvo no Hub não seria visível pelo Inventário nem pela Gestão TI.

Arquivo: `capul-platform/nginx/nginx.conf`

A configuração completa do Nginx está no `arquitetura-plataforma-v2.1.md`, seção 6. Resumo das rotas:

| Rota | Destino | Serviço |
|------|---------|---------|
| `/` | hub:5170 | Portal Hub |
| `/api/v1/auth/*` | auth-gateway:3000 | Auth Gateway |
| `/api/v1/core/*` | auth-gateway:3000 | Auth Gateway |
| `/inventario/` | inventario-web:8443 | Inventário Frontend |
| `/api/v1/inventory/*` | inventario-api:8000 | Inventário Backend |
| `/api/v1/products/*` | inventario-api:8000 | Inventário Backend |
| `/api/v1/stores/*` | inventario-api:8000 | Inventário Backend |
| `/api/v1/users/*` | inventario-api:8000 | Inventário Backend |
| `/api/v1/sync/*` | inventario-api:8000 | Inventário Backend |
| `/gestao-ti/` | gestao-ti-web:5173 | Gestão TI Frontend |
| `/api/v1/gestao-ti/*` | gestao-ti-api:3001 | Gestão TI Backend |

#### 0.3.2b Docker Compose Unificado

Arquivo: `capul-platform/docker-compose.yml`

Todos os serviços em um único compose, incluindo **Nginx como reverse proxy**. Banco `capul_platform` com schemas separados. Mesma `JWT_SECRET` compartilhada entre Auth Gateway, Inventário e Gestão TI. O Docker Compose completo está no `arquitetura-plataforma-v2.1.md`, seção 7.

Arquivo: `capul-platform/.env`

```env
# Banco de Dados
DB_USER=capul_user
DB_PASSWORD=capul_secure_password_2025
DB_NAME=capul_platform
DB_PORT=5432

# JWT (COMPARTILHADO entre todos os backends)
JWT_SECRET=uma-chave-secreta-muito-longa-e-segura-minimo-64-chars
JWT_REFRESH_SECRET=outra-chave-secreta-diferente-para-refresh-tokens
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Redis
REDIS_URL=redis://redis:6379

# PgAdmin
PGADMIN_EMAIL=admin@capul.com
PGADMIN_PASSWORD=admin123
```

#### 0.3.3 Init SQL — Criar Schemas

Arquivo: `capul-platform/database/init-schemas.sql`

```sql
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS inventario;
CREATE SCHEMA IF NOT EXISTS gestao_ti;

-- Comentários
COMMENT ON SCHEMA core IS 'Entidades compartilhadas: empresas, filiais, usuarios, auth, permissoes';
COMMENT ON SCHEMA inventario IS 'Módulo de Inventário de Estoque';
COMMENT ON SCHEMA gestao_ti IS 'Módulo de Gestão de T.I.';
```

#### 0.3.4 Schema Prisma — Core

Arquivo: `capul-platform/auth-gateway/prisma/schema.prisma`

O schema Prisma completo do core está documentado no `arquitetura-plataforma-v2.1.md`, seção 9. Inclui:

- Empresa, Filial, Departamento, CentroCusto
- Usuario (username + email, login aceita ambos)
- UsuarioFilial (N:N — mesma lógica do user_stores do inventário)
- ModuloSistema, RoleModulo, PermissaoModulo
- RefreshToken
- SystemConfig, SystemLog

Após definir o schema:

```bash
cd auth-gateway
npx prisma generate
npx prisma db push  # Para desenvolvimento. Em produção, usar migrations.
```

#### 0.3.5 Auth Gateway — Módulos NestJS

```
auth-gateway/src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── require-module.decorator.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── refresh-token.dto.ts
│       ├── change-password.dto.ts
│       └── auth-response.dto.ts
├── empresa/
│   ├── empresa.module.ts
│   ├── empresa.controller.ts
│   ├── empresa.service.ts
│   └── dto/
├── filial/
│   ├── filial.module.ts
│   ├── filial.controller.ts
│   ├── filial.service.ts
│   └── dto/
├── usuario/
│   ├── usuario.module.ts
│   ├── usuario.controller.ts
│   ├── usuario.service.ts
│   └── dto/
├── departamento/
│   ├── departamento.module.ts
│   ├── departamento.controller.ts
│   ├── departamento.service.ts
│   └── dto/
├── centro-custo/
│   ├── centro-custo.module.ts
│   ├── centro-custo.controller.ts
│   ├── centro-custo.service.ts
│   └── dto/
├── modulo/
│   ├── modulo.module.ts
│   ├── modulo.controller.ts
│   ├── modulo.service.ts
│   └── dto/
└── common/
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── logging.interceptor.ts
    └── pipes/
        └── validation.pipe.ts
```

#### 0.3.6 Endpoints do Auth Gateway

**Autenticação:**

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/v1/auth/login` | Login (username ou email + senha) | Público |
| POST | `/api/v1/auth/refresh` | Renovar access token | Refresh Token |
| POST | `/api/v1/auth/logout` | Revogar refresh token | JWT |
| PATCH | `/api/v1/auth/change-password` | Alterar senha | JWT |
| GET | `/api/v1/auth/me` | Dados do usuário + módulos | JWT |
| GET | `/api/v1/auth/modulos` | Listar módulos com acesso | JWT |
| POST | `/api/v1/auth/switch-filial` | Trocar filial ativa (regenera token) | JWT |

**Login — Lógica de detecção username/email:**

```typescript
// auth.service.ts
async login(dto: LoginDto) {
  const { login, senha } = dto;

  // Detecta se é email ou username
  const isEmail = login.includes('@');

  const usuario = await this.prisma.usuario.findFirst({
    where: isEmail
      ? { email: login, status: 'ATIVO' }
      : { username: login, status: 'ATIVO' },
    include: {
      permissoes: {
        where: { status: 'ATIVO' },
        include: {
          modulo: true,
          roleModulo: true,
        },
      },
      filiais: {
        include: { filial: true },
      },
    },
  });

  if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

  // Determinar filial ativa (default ou primeira)
  const filialAtiva = usuario.filiais.find(f => f.isDefault)
    || usuario.filiais[0];

  // Montar payload do JWT
  const payload: JwtPayload = {
    sub: usuario.id,
    username: usuario.username,
    email: usuario.email,
    filialId: filialAtiva?.filialId,
    filialCodigo: filialAtiva?.filial.codigo,
    modulos: usuario.permissoes.map(p => ({
      codigo: p.modulo.codigo,
      role: p.roleModulo.codigo,
    })),
  };

  // Gerar tokens
  const accessToken = this.jwtService.sign(payload, {
    secret: this.config.get('JWT_SECRET'),
    expiresIn: this.config.get('JWT_ACCESS_EXPIRATION'),
  });

  const refreshToken = await this.createRefreshToken(usuario.id);

  // Atualizar último login
  await this.prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  });

  return {
    accessToken,
    refreshToken: refreshToken.token,
    usuario: {
      id: usuario.id,
      username: usuario.username,
      nome: usuario.nome,
      email: usuario.email,
      filialAtual: {
        id: filialAtiva?.filialId,
        codigo: filialAtiva?.filial.codigo,
        nome: filialAtiva?.filial.nomeFantasia,
      },
      modulos: usuario.permissoes.map(p => ({
        codigo: p.modulo.codigo,
        nome: p.modulo.nome,
        icone: p.modulo.icone,
        cor: p.modulo.cor,
        url: p.modulo.urlFrontend,
        role: p.roleModulo.codigo,
        roleNome: p.roleModulo.nome,
      })),
    },
  };
}
```

**Login DTO:**

```typescript
// login.dto.ts
export class LoginDto {
  @IsNotEmpty({ message: 'Informe o username ou email' })
  @IsString()
  login: string;       // Aceita username OU email

  @IsNotEmpty({ message: 'Informe a senha' })
  @IsString()
  @MinLength(6)
  senha: string;
}
```

**Resposta do Login:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-refresh-token",
  "usuario": {
    "id": "uuid",
    "username": "joao.silva",
    "nome": "João Silva",
    "email": "joao@empresa.com",
    "filialAtual": {
      "id": "uuid",
      "codigo": "01",
      "nome": "Agroveterinária Unaí"
    },
    "modulos": [
      {
        "codigo": "INVENTARIO",
        "nome": "Inventário de Estoque",
        "icone": "package",
        "cor": "#3B82F6",
        "url": "/inventario/",
        "role": "SUPERVISOR",
        "roleNome": "Supervisor"
      },
      {
        "codigo": "GESTAO_TI",
        "nome": "Gestão de T.I.",
        "icone": "monitor",
        "cor": "#8B5CF6",
        "url": "/gestao-ti/",
        "role": "TECNICO",
        "roleNome": "Técnico"
      }
    ]
  }
}
```

**CRUDs Organizacionais (Auth Gateway — todos sob `/api/v1/core/`):**

| Grupo | Método | Rota | Descrição |
|-------|--------|------|-----------|
| Empresa | GET | `/api/v1/core/empresas` | Listar |
| | GET | `/api/v1/core/empresas/:id` | Detalhe |
| | POST | `/api/v1/core/empresas` | Criar |
| | PATCH | `/api/v1/core/empresas/:id` | Atualizar |
| Filial | GET | `/api/v1/core/filiais` | Listar (filtro por empresa) |
| | GET | `/api/v1/core/filiais/:id` | Detalhe |
| | POST | `/api/v1/core/filiais` | Criar |
| | PATCH | `/api/v1/core/filiais/:id` | Atualizar |
| Usuário | GET | `/api/v1/core/usuarios` | Listar (filtro por filial) |
| | GET | `/api/v1/core/usuarios/:id` | Detalhe com permissões |
| | POST | `/api/v1/core/usuarios` | Criar com permissões de módulo |
| | PATCH | `/api/v1/core/usuarios/:id` | Atualizar |
| | PATCH | `/api/v1/core/usuarios/:id/status` | Ativar/Desativar |
| | POST | `/api/v1/core/usuarios/:id/permissoes` | Atribuir acesso a módulo |
| | DELETE | `/api/v1/core/usuarios/:id/permissoes/:moduloId` | Revogar acesso |
| Depto | GET | `/api/v1/core/departamentos` | Listar (filtro por filial) |
| | POST | `/api/v1/core/departamentos` | Criar |
| | PATCH | `/api/v1/core/departamentos/:id` | Atualizar |
| CC | GET | `/api/v1/core/centros-custo` | Listar (filtro por filial) |
| | POST | `/api/v1/core/centros-custo` | Criar |
| | PATCH | `/api/v1/core/centros-custo/:id` | Atualizar |
| Módulo | GET | `/api/v1/core/modulos` | Listar módulos do sistema |
| | GET | `/api/v1/core/modulos/:id/roles` | Listar roles de um módulo |

---

### 0.4 Sprint 0B — Hub + Migração Inventário (Semanas 3-4)

#### 0.4.1 Portal Hub (React)

```bash
cd capul-platform/hub
npm create vite@latest . -- --template react-ts
npm install @tanstack/react-router axios
# Shadcn setup
npx shadcn-ui@latest init
```

**Telas do Hub:**

| Tela | Rota | Descrição |
|------|------|-----------|
| Login | `/login` | Username/email + senha |
| Hub | `/` | Cards dos módulos com acesso |
| Perfil | `/perfil` | Dados do usuário, trocar senha |
| Trocar Filial | Modal no Hub | Select de filiais, regenera token |

**Fluxo:**
1. Usuário acessa Hub → redireciona para `/login` se sem token.
2. Faz login → recebe token + lista de módulos.
3. Vê tela Hub com cards dos módulos.
4. Clica em módulo → navega para `/inventario/` ou `/gestao-ti/` (mesma origem via Nginx = mesmo localStorage = token compartilhado automaticamente).

#### 0.4.2 Scripts de Migração

Arquivo: `capul-platform/database/migrations/002-migrate-stores.sql`

```sql
-- Migrar stores → filiais (preservando UUIDs)
-- Primeiro, criar empresa padrão
INSERT INTO core.empresas (id, razao_social, nome_fantasia, cnpj_matriz, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Grupo Capul',                    -- Ajustar para nome real
    'Grupo Capul',
    '00.000.000/0001-00',             -- Ajustar para CNPJ real
    NOW(), NOW()
);

-- Migrar stores para filiais
INSERT INTO core.filiais (
    id, codigo, nome_fantasia, descricao, endereco, telefone, email,
    status, empresa_id, created_at, updated_at
)
SELECT
    s.id,                              -- Preserva UUID
    s.code,
    s.name,
    s.description,
    s.address,
    s.phone,
    s.email,
    CASE WHEN s.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
    (SELECT id FROM core.empresas LIMIT 1),  -- Empresa padrão
    COALESCE(s.created_at, NOW()),
    COALESCE(s.updated_at, NOW())
FROM inventario.stores s;
```

Arquivo: `capul-platform/database/migrations/003-migrate-users.sql`

```sql
-- Registrar módulos do sistema
INSERT INTO core.modulos_sistema (id, codigo, nome, descricao, icone, cor, url_frontend, url_backend, ordem, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'INVENTARIO', 'Inventário de Estoque', 'Sistema de inventário e contagem de estoque', 'package', '#3B82F6', '/inventario/', '/api/v1/inventory', 1, 'ATIVO', NOW(), NOW()),
    (gen_random_uuid(), 'GESTAO_TI', 'Gestão de T.I.', 'Sistema de gestão do departamento de TI', 'monitor', '#8B5CF6', '/gestao-ti/', '/api/v1/gestao-ti', 2, 'ATIVO', NOW(), NOW());

-- Registrar roles do módulo Inventário
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid(), r.codigo, r.nome, r.descricao, m.id
FROM (VALUES
    ('ADMIN', 'Administrador', 'Acesso total ao inventário'),
    ('SUPERVISOR', 'Supervisor', 'Criar e gerenciar inventários da filial'),
    ('OPERATOR', 'Operador', 'Contar itens do inventário')
) AS r(codigo, nome, descricao)
CROSS JOIN core.modulos_sistema m
WHERE m.codigo = 'INVENTARIO';

-- Registrar roles do módulo Gestão TI
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid(), r.codigo, r.nome, r.descricao, m.id
FROM (VALUES
    ('ADMIN', 'Administrador', 'Acesso total à gestão de TI'),
    ('GESTOR_TI', 'Gestor de TI', 'Gestão completa do departamento'),
    ('TECNICO', 'Técnico', 'Atender chamados (públicos e privados) e registrar atividades'),
    ('DESENVOLVEDOR', 'Desenvolvedor', 'Chamados internos e projetos dev'),
    ('GERENTE_PROJETO', 'Gerente de Projeto', 'Projetos, custos e aprovações'),
    ('USUARIO_FINAL', 'Usuário Final', 'Abrir chamados públicos e consultar status dos próprios chamados'),
    ('FINANCEIRO', 'Financeiro', 'Contratos, rateio e custos')
) AS r(codigo, nome, descricao)
CROSS JOIN core.modulos_sistema m
WHERE m.codigo = 'GESTAO_TI';

-- Migrar users → usuarios (preservando UUIDs e hashes)
INSERT INTO core.usuarios (
    id, username, email, nome, senha, status,
    filial_principal_id, ultimo_login, primeiro_acesso,
    created_at, updated_at
)
SELECT
    u.id,                              -- Preserva UUID
    u.username,
    u.email,
    u.full_name,
    u.password_hash,                   -- Mesmo hash bcrypt funciona
    CASE WHEN u.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
    u.store_id,
    u.last_login,
    false,                             -- Usuários existentes não são primeiro acesso
    COALESCE(u.created_at, NOW()),
    COALESCE(u.updated_at, NOW())
FROM inventario.users u;

-- Migrar user_stores → usuario_filiais
INSERT INTO core.usuario_filiais (
    id, usuario_id, filial_id, is_default, created_at, created_by, updated_at
)
SELECT
    us.id,
    us.user_id,
    us.store_id,
    us.is_default,
    COALESCE(us.created_at, NOW()),
    us.created_by::text,
    us.updated_at
FROM inventario.user_stores us;

-- Criar permissões de módulo (mapeando roles)
INSERT INTO core.permissoes_modulo (id, usuario_id, modulo_id, role_modulo_id, status, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    m.id,
    rm.id,
    'ATIVO',
    NOW(),
    NOW()
FROM inventario.users u
JOIN core.modulos_sistema m ON m.codigo = 'INVENTARIO'
JOIN core.roles_modulo rm ON rm.modulo_id = m.id AND rm.codigo = u.role::text;
```

Arquivo: `capul-platform/database/migrations/004-compatibility-views.sql`

```sql
-- VIEWs de compatibilidade: queries do FastAPI continuam funcionando
-- sem alteração no SQLAlchemy (durante período de transição)

-- Renomear tabelas originais como backup
ALTER TABLE inventario.stores RENAME TO stores_backup;
ALTER TABLE inventario.users RENAME TO users_backup;
ALTER TABLE inventario.user_stores RENAME TO user_stores_backup;

-- Criar VIEWs com nomes originais mapeando para core
-- (código das VIEWs — ver arquitetura-plataforma-v2.1.md seção 5.3)
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
```

**CRÍTICO — INSTEAD OF Triggers (migration 005):**

VIEWs com JOIN são **read-only** no PostgreSQL. A VIEW `inventario.users` faz JOIN com 3 tabelas. Sem triggers, qualquer INSERT/UPDATE do FastAPI vai falhar.

Arquivo: `capul-platform/database/migrations/005-instead-of-triggers.sql`

Os INSTEAD OF triggers completos (INSERT/UPDATE/DELETE para as 3 VIEWs) estão documentados no `arquitetura-plataforma-v2.1.md`, seção 5.3. Resumo:

| VIEW | Triggers | Complexidade |
|------|----------|-------------|
| `inventario.stores` | INSERT, UPDATE | Média — converte is_active ↔ status |
| `inventario.users` | INSERT, UPDATE, DELETE | Alta — escreve em core.usuarios + core.permissoes_modulo |
| `inventario.user_stores` | INSERT, UPDATE, DELETE | Baixa — mapeia direto para core.usuario_filiais |

Os triggers interceptam operações de escrita na VIEW e redirecionam para as tabelas reais no schema core, fazendo as conversões de tipo necessárias (is_active → ATIVO/INATIVO, role → permissoes_modulo, etc.).

#### 0.4.3 Ajuste no FastAPI para Novo JWT

**Antes (inventário atual):**

```python
# Payload antigo
# { "sub": "uuid", "username": "joao", "role": "SUPERVISOR", "store_id": "uuid" }
```

**Depois (com feature flag para transição):**

```python
# auth/jwt_handler.py
import os

UNIFIED_AUTH = os.getenv("UNIFIED_AUTH", "true").lower() == "true"

def decode_token(token: str) -> dict:
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

    if UNIFIED_AUTH:
        # Novo formato unificado
        return {
            "user_id": payload["sub"],
            "username": payload["username"],
            "role": get_inventory_role(payload),
            "store_id": payload["filialId"],
        }
    else:
        # Formato antigo (fallback durante transição)
        return {
            "user_id": payload["sub"],
            "username": payload["username"],
            "role": payload["role"],
            "store_id": payload["store_id"],
        }

def get_inventory_role(payload: dict) -> str:
    for modulo in payload.get("modulos", []):
        if modulo["codigo"] == "INVENTARIO":
            return modulo["role"]
    raise HTTPException(status_code=403, detail="Sem acesso ao inventário")
```

**Adicionar refresh automático no frontend do inventário:**

```javascript
// frontend/js/auth.js — adicionar interceptor de refresh
async function fetchWithAuth(url, options = {}) {
    let response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${getAccessToken()}`
        }
    });

    // Se token expirou, tentar refresh
    if (response.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
            response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${getAccessToken()}`
                }
            });
        } else {
            // Refresh falhou, redirecionar para Hub login
            window.location.href = '/login';
        }
    }

    return response;
}

async function refreshToken() {
    try {
        const response = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: getRefreshToken() })
        });
        if (response.ok) {
            const data = await response.json();
            setAccessToken(data.accessToken);
            setRefreshToken(data.refreshToken);
            return true;
        }
    } catch (e) { }
    return false;
}
```

#### 0.4.4 Seed de Dados Iniciais

Arquivo: `capul-platform/auth-gateway/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Empresa
  const empresa = await prisma.empresa.create({
    data: {
      razaoSocial: 'Grupo Capul Ltda',
      nomeFantasia: 'Grupo Capul',
      cnpjMatriz: '00.000.000/0001-00',
    },
  });

  // 2. Filial padrão
  const filial = await prisma.filial.create({
    data: {
      codigo: '01',
      nomeFantasia: 'Matriz - Unaí',
      razaoSocial: 'Capul Agroveterinária Ltda',
      empresaId: empresa.id,
    },
  });

  // 3. Módulos do sistema
  const modInventario = await prisma.moduloSistema.create({
    data: {
      codigo: 'INVENTARIO',
      nome: 'Inventário de Estoque',
      icone: 'package',
      cor: '#3B82F6',
      urlFrontend: '/inventario/',
      urlBackend: '/api/v1/inventory',
      ordem: 1,
    },
  });

  const modGestaoTi = await prisma.moduloSistema.create({
    data: {
      codigo: 'GESTAO_TI',
      nome: 'Gestão de T.I.',
      icone: 'monitor',
      cor: '#8B5CF6',
      urlFrontend: '/gestao-ti/',
      urlBackend: '/api/v1/gestao-ti',
      ordem: 2,
    },
  });

  // 4. Roles por módulo
  const roleAdminInv = await prisma.roleModulo.create({
    data: { codigo: 'ADMIN', nome: 'Administrador', moduloId: modInventario.id },
  });
  const roleSupInv = await prisma.roleModulo.create({
    data: { codigo: 'SUPERVISOR', nome: 'Supervisor', moduloId: modInventario.id },
  });
  const roleOpInv = await prisma.roleModulo.create({
    data: { codigo: 'OPERATOR', nome: 'Operador', moduloId: modInventario.id },
  });

  const roleAdminTi = await prisma.roleModulo.create({
    data: { codigo: 'ADMIN', nome: 'Administrador', moduloId: modGestaoTi.id },
  });
  const roleGestorTi = await prisma.roleModulo.create({
    data: { codigo: 'GESTOR_TI', nome: 'Gestor de TI', moduloId: modGestaoTi.id },
  });
  const roleTecnico = await prisma.roleModulo.create({
    data: { codigo: 'TECNICO', nome: 'Técnico', moduloId: modGestaoTi.id },
  });
  const roleDesenvolvedor = await prisma.roleModulo.create({
    data: { codigo: 'DESENVOLVEDOR', nome: 'Desenvolvedor', moduloId: modGestaoTi.id },
  });
  const roleGerenteProjeto = await prisma.roleModulo.create({
    data: { codigo: 'GERENTE_PROJETO', nome: 'Gerente de Projeto', moduloId: modGestaoTi.id },
  });
  const roleUsrFinal = await prisma.roleModulo.create({
    data: { codigo: 'USUARIO_FINAL', nome: 'Usuário Final', moduloId: modGestaoTi.id },
  });
  const roleFinanceiro = await prisma.roleModulo.create({
    data: { codigo: 'FINANCEIRO', nome: 'Financeiro', moduloId: modGestaoTi.id },
  });

  // 5. Admin master
  const admin = await prisma.usuario.create({
    data: {
      username: 'admin',
      email: 'admin@capul.com',
      nome: 'Administrador',
      senha: await bcrypt.hash('admin123', 10),
      filialPrincipalId: filial.id,
      primeiroAcesso: false,
      filiais: {
        create: { filialId: filial.id, isDefault: true },
      },
      permissoes: {
        createMany: {
          data: [
            { moduloId: modInventario.id, roleModuloId: roleAdminInv.id },
            { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id },
          ],
        },
      },
    },
  });

  console.log('Seed executado com sucesso!');
  console.log(`Admin criado: ${admin.username}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

#### 0.4.5 Testes da Fase 0

| Teste | Cenário | Resultado Esperado |
|-------|---------|-------------------|
| T0-01 | Login com username | ✅ Token gerado com módulos |
| T0-02 | Login com email | ✅ Token gerado com módulos |
| T0-03 | Login com credencial inválida | ❌ 401 Unauthorized |
| T0-04 | Login com usuário inativo | ❌ 401 Unauthorized |
| T0-05 | Refresh token | ✅ Novo access token + novo refresh |
| T0-06 | Refresh token expirado | ❌ 401, redireciona para login |
| T0-07 | Listar módulos do usuário | ✅ Retorna apenas módulos com permissão |
| T0-08 | Trocar filial | ✅ Novo token com filialId diferente |
| T0-09 | Hub → Inventário | ✅ Inventário abre e funciona normalmente |
| T0-10 | FastAPI valida novo JWT | ✅ Extrai role do módulo INVENTARIO |
| T0-11 | CRUD Filial via Auth Gateway | ✅ CRUD funciona, dados no core |
| T0-12 | CRUD Usuário + permissão | ✅ Usuário criado com acesso a módulos |
| T0-13 | VIEWs de compatibilidade | ✅ Inventário lê filiais/users via views |

---

## Fase 1 — Fundação Gestão de T.I.

### Duração: 4 semanas (2 sprints)

---

### 1.1 Objetivo

Construir o módulo de Gestão de T.I. como um segundo módulo da plataforma: backend NestJS próprio (schema gestao_ti), frontend React próprio, acessível pelo Hub. O core já existe (Fase 0).

---

### 1.2 O que NÃO se Repete (já existe no core)

| Funcionalidade | Onde Está | Como a Gestão TI Usa |
|----------------|-----------|---------------------|
| Autenticação (login, refresh) | Auth Gateway /api/v1/auth/ | Frontend chama /api/v1/auth/ |
| CRUD Empresa | Auth Gateway /api/v1/core/ | Frontend chama /api/v1/core/empresas |
| CRUD Filiais | Auth Gateway /api/v1/core/ | Frontend chama /api/v1/core/filiais |
| CRUD Usuários | Auth Gateway /api/v1/core/ | Frontend chama /api/v1/core/usuarios |
| Permissões por módulo | Auth Gateway /api/v1/core/ | Backend valida JWT + role GESTAO_TI |
| N:N Usuário ↔ Filial | Auth Gateway /api/v1/core/ | Dados no core |

---

### 1.3 Sprint 1A — Backend + Schema (Semanas 1-2)

#### 1.3.1 Setup do Backend

```bash
cd capul-platform/gestao-ti/backend
npx @nestjs/cli new . --package-manager npm
npm install @nestjs/config @nestjs/jwt @nestjs/passport
npm install @prisma/client prisma class-validator class-transformer
npm install -D @types/bcryptjs
npx prisma init
```

#### 1.3.2 Schema Prisma — Gestão TI

Arquivo: `capul-platform/gestao-ti/backend/prisma/schema.prisma`

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
// NÃO usar @@ignore (quebra o Prisma Client — relations e queries falham).
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
  id                  String      @id @default(uuid())
  nome                String      @unique
  sigla               String      @unique
  descricao           String?
  cor                 String?     @default("#3B82F6")
  icone               String?     @default("users")
  aceitaChamadoExterno Boolean    @default(true) @map("aceita_chamado_externo")
  emailEquipe         String?     @map("email_equipe")
  ordem               Int         @default(0)
  status              StatusGeral @default(ATIVO)
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

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

**Nota sobre acesso cross-schema:** O backend da Gestão TI lê dados de `core.filiais` e `core.usuarios` via Prisma (queries de leitura). Escrita nessas tabelas é responsabilidade exclusiva do Auth Gateway.

**Middleware de proteção (impede escrita acidental no core):**

```typescript
// gestao-ti/backend/src/prisma/prisma-read-only.middleware.ts
import { Prisma } from '@prisma/client';

export function readOnlyCoreMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const readOnlyModels = ['Filial', 'Usuario'];
    const writeActions = ['create', 'createMany', 'update', 'updateMany',
                          'delete', 'deleteMany', 'upsert'];

    if (readOnlyModels.includes(params.model ?? '') && writeActions.includes(params.action)) {
      throw new Error(
        `[BLOQUEADO] ${params.model} é read-only neste backend. ` +
        `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`
      );
    }
    return next(params);
  };
}

// Registrar no PrismaService (onModuleInit):
// this.$use(readOnlyCoreMiddleware());
```

#### 1.3.3 Validação de JWT + Role

O backend da Gestão TI valida o JWT usando a **mesma JWT_SECRET** e verifica se o usuário tem acesso ao módulo GESTAO_TI:

```typescript
// common/guards/gestao-ti.guard.ts
@Injectable()
export class GestaoTiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Extraído do JWT pelo JwtStrategy

    // Verificar se tem acesso ao módulo GESTAO_TI
    const modulo = user.modulos?.find(m => m.codigo === 'GESTAO_TI');
    if (!modulo) {
      throw new ForbiddenException('Sem acesso ao módulo Gestão de TI');
    }

    // Salvar role no request para uso nos controllers
    request.gestaoTiRole = modulo.role;
    return true;
  }
}
```

#### 1.3.4 Endpoints da Fase 1 — Gestão TI

**Equipes de T.I.:**

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/api/v1/equipes` | Listar equipes | Todos |
| GET | `/api/v1/equipes/:id` | Detalhe com membros | Todos |
| POST | `/api/v1/equipes` | Criar equipe | ADMIN, GESTOR_TI |
| PATCH | `/api/v1/equipes/:id` | Atualizar | ADMIN, GESTOR_TI |
| PATCH | `/api/v1/equipes/:id/status` | Ativar/Desativar | ADMIN, GESTOR_TI |
| POST | `/api/v1/equipes/:id/membros` | Adicionar membro | ADMIN, GESTOR_TI |
| PATCH | `/api/v1/equipes/:id/membros/:membroId` | Atualizar membro (líder) | ADMIN, GESTOR_TI |
| DELETE | `/api/v1/equipes/:id/membros/:membroId` | Remover membro | ADMIN, GESTOR_TI |

**Regras de negócio das equipes:**

| Regra | Descrição |
|-------|-----------|
| RN-EQP-01 | Nome e sigla são únicos |
| RN-EQP-02 | Equipe pode ser criada sem membros (preenchidos depois) |
| RN-EQP-03 | Um usuário pode ser membro de múltiplas equipes |
| RN-EQP-04 | Cada equipe pode ter N líderes (isLider = true) |
| RN-EQP-05 | Equipe com aceitaChamadoExterno = false não aparece para o usuário final |
| RN-EQP-06 | Equipe não pode ser excluída se tiver chamados (soft delete via status) |
| RN-EQP-07 | O campo ordem define a posição no select de equipes |
| RN-EQP-08 | Membro deve ser usuário ativo com permissão GESTAO_TI |

#### 1.3.6 Nota de Design — Visibilidade de Chamados (Antecipação para Fase 2)

Na Fase 2, o sistema de chamados implementará **visibilidade por chamado** (PÚBLICO / PRIVADO), conforme definido no `plano-ti-system-v5.md`, seção 2.1:

- **PÚBLICO:** Qualquer usuário do sistema pode abrir. O solicitante vê apenas os chamados que ele abriu. Equipe de TI vê todos da sua fila.
- **PRIVADO:** Apenas membros de equipes de TI criam e visualizam. Invisível para o usuário final.

Isso impacta a equipe (`aceitaChamadoExterno`):
- Equipe com `aceitaChamadoExterno = true` → aceita chamados PÚBLICOS (usuários finais podem selecionar essa equipe).
- Equipe com `aceitaChamadoExterno = false` → aceita apenas chamados PRIVADOS (equipes internas como DEV).
- Chamados PRIVADOS podem ser abertos para **qualquer equipe**, independente do flag.

O campo `visibilidade` será implementado na tabela `gestao_ti.chamados` durante a Fase 2. A Fase 1 não precisa de alteração — o modelo de equipes já suporta o conceito via `aceitaChamadoExterno`.

---

### 1.4 Sprint 1B — Frontend React (Semanas 3-4)

#### 1.4.1 Setup do Frontend

```bash
cd capul-platform/gestao-ti/frontend
npm create vite@latest . -- --template react-ts
npm install axios @tanstack/react-router @tanstack/react-table
# Shadcn + Tailwind
npx shadcn-ui@latest init
```

#### 1.4.2 Estrutura de Páginas

```
gestao-ti/frontend/src/
├── main.tsx
├── App.tsx
├── routes/
│   └── index.tsx              # Definição de rotas
├── layouts/
│   ├── MainLayout.tsx         # Sidebar + Header + Content
│   ├── Sidebar.tsx            # Menu lateral
│   └── Header.tsx             # Barra superior (usuário, filial, notificações)
├── pages/
│   ├── DashboardPage.tsx      # Home da Gestão TI
│   ├── equipes/
│   │   ├── EquipesListPage.tsx
│   │   ├── EquipeFormPage.tsx
│   │   └── EquipeDetalhePage.tsx
│   ├── departamentos/
│   │   └── DepartamentosPage.tsx  # Chama Auth Gateway
│   └── centros-custo/
│       └── CentrosCustoPage.tsx   # Chama Auth Gateway
├── components/
│   ├── ui/                    # Shadcn components
│   ├── DataTable.tsx          # Tabela reutilizável (TanStack)
│   └── ...
├── services/
│   ├── api.ts                 # Axios instance com interceptor de refresh
│   ├── auth.service.ts        # Refresh, logout (/api/v1/auth/)
│   ├── equipe.service.ts      # CRUD equipes (/api/v1/gestao-ti/)
│   ├── departamento.service.ts # CRUD deptos (/api/v1/core/)
│   └── centro-custo.service.ts # CRUD CCs (/api/v1/core/)
├── contexts/
│   └── AuthContext.tsx         # Estado global do usuário autenticado
├── hooks/
│   └── useAuth.ts
└── types/
    └── index.ts
```

#### 1.4.3 Sidebar — Menu Lateral

```
┌────────────────────────┐
│  🖥️ Gestão de T.I.    │
│  Filial: 01 - Unaí    │
├────────────────────────┤
│                        │
│  📊 Dashboard          │  ← Fase 1
│                        │
│  ── CADASTROS ──       │
│  🏢 Departamentos      │  ← Fase 1 (/api/v1/core/)
│  💰 Centros de Custo   │  ← Fase 1 (/api/v1/core/)
│  👥 Equipes de T.I.    │  ← Fase 1
│                        │
│  ── SUPORTE ──         │
│  🎫 Chamados           │  ← Fase 2 (PÚBLICO + PRIVADO)
│  📋 Ordens de Serviço  │  ← Fase 2
│  📞 Catálogo Serviços  │  ← Fase 2
│                        │
│  ── PORTFÓLIO ──       │
│  💻 Softwares          │  ← Fase 2B
│  📜 Licenças           │  ← Fase 2B
│                        │
│  ── FINANCEIRO ──      │
│  📄 Contratos          │  ← Fase 3
│                        │
│  ── SUSTENTAÇÃO ──     │
│  📈 Disponibilidade    │  ← Fase 4
│                        │
│  ── PROJETOS ──        │
│  🚀 Projetos           │  ← Fase 5
│                        │
│  ── ADMIN ──           │
│  ⚙️ Configurações      │  ← Fase 6
│  📊 Relatórios         │  ← Fase 6
│                        │
├────────────────────────┤
│  ← Voltar ao Hub       │
│  👤 João Silva         │
│  🚪 Sair               │
└────────────────────────┘
```

Os itens de fases futuras ficam visíveis mas desabilitados (com tooltip "Em breve"), ou ocultos — decisão de UX.

#### 1.4.4 Axios Instance com Refresh Automático

```typescript
// services/api.ts
import axios from 'axios';

// Com Nginx, tudo na mesma origem — usar paths relativos
const AUTH_BASE = '/api/v1/auth';          // Auth (login, refresh, logout)
const CORE_BASE = '/api/v1/core';          // CRUDs organizacionais (empresas, filiais, usuarios, deptos, CCs)
const GESTAO_BASE = '/api/v1/gestao-ti';   // Gestão TI Backend (equipes, chamados, etc.)

// Instância para Auth (login, refresh, logout)
export const authApi = axios.create({ baseURL: AUTH_BASE });

// Instância para CRUDs do Core (empresas, filiais, usuarios, departamentos, centros-custo)
export const coreApi = axios.create({ baseURL: CORE_BASE });

// Instância para Gestão TI Backend (equipes, chamados, etc.)
export const gestaoApi = axios.create({ baseURL: GESTAO_BASE });

// Interceptor: adiciona token em todas as requests
[authApi, coreApi, gestaoApi].forEach(api => {
  api.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Interceptor: refresh automático quando token expira
  api.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          const { data } = await authApi.post('/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
});
```

#### 1.4.5 Testes da Fase 1

| Teste | Cenário | Resultado Esperado |
|-------|---------|-------------------|
| T1-01 | Acessar Gestão TI pelo Hub | ✅ Frontend abre com sidebar |
| T1-02 | Listar equipes (sem dados) | ✅ Tabela vazia com botão "Nova Equipe" |
| T1-03 | Criar equipe SS (Suporte Software) | ✅ Equipe criada com sucesso |
| T1-04 | Criar equipe com sigla duplicada | ❌ Erro de validação |
| T1-05 | Adicionar membro à equipe | ✅ Membro adicionado |
| T1-06 | Adicionar membro sem permissão GESTAO_TI | ❌ Erro: usuário sem acesso |
| T1-07 | Listar departamentos (via Auth Gateway) | ✅ Dados do core retornados |
| T1-08 | Criar centro de custo (via Auth Gateway) | ✅ Dados salvos no core |
| T1-09 | Usuário sem role GESTAO_TI tenta acessar | ❌ 403 Forbidden |
| T1-10 | Refresh token automático no frontend | ✅ Token renovado sem perder sessão |

---

## Checklist de Entrega

### Fase 0 — Core + Migração

- [ ] Step 0: Banco renomeado para capul_platform
- [ ] Nginx reverse proxy configurado e rodando (:443)
- [ ] Docker Compose unificado rodando (com Nginx)
- [ ] Schema core criado e populado
- [ ] Auth Gateway: login (username/email), refresh, logout, change-password, me, switch-filial
- [ ] Auth Gateway: CRUD empresa, filiais, usuarios, departamentos, centros_custo, módulos
- [ ] Portal Hub: login, seleção de módulo, troca de filial
- [ ] Migração: stores → filiais, users → usuarios, user_stores → usuario_filiais
- [ ] VIEWs de compatibilidade criadas
- [ ] INSTEAD OF triggers criados (INSERT/UPDATE/DELETE nas 3 VIEWs)
- [ ] FastAPI do inventário validando novo JWT
- [ ] Inventário acessível pelo Hub via /inventario/ e funcionando normalmente
- [ ] Todos os 13 testes passando

### Fase 1 — Fundação Gestão TI

- [ ] Schema gestao_ti criado
- [ ] Backend NestJS da Gestão TI rodando (:3001)
- [ ] Validação JWT + role GESTAO_TI
- [ ] Prisma middleware read-only para core (Filial, Usuario)
- [ ] CRUD Equipes de T.I. completo
- [ ] CRUD Membros de equipe
- [ ] Frontend React com layout (sidebar, header)
- [ ] Telas: Dashboard (placeholder), Equipes (lista, form, detalhe)
- [ ] Telas: Departamentos e Centros de Custo (via Auth Gateway)
- [ ] Integração com Hub (link de volta, dados do usuário)
- [ ] Todos os 10 testes passando

---

## Referências Cruzadas entre Documentos

| Tópico | Plano (v5) | Arquitetura (v2) | Este Documento |
|--------|-----------|-----------------|----------------|
| Visão da plataforma | §1.2 | §1.1 | §0.1 |
| Stack tecnológica | §7 | §1.2 | §0.3.1, §1.3.1 |
| Schemas do banco | §8 | §2 | §0.3.3, §0.3.4 |
| Auth (login username/email) | §7.1 | §3.1 | §0.3.6 |
| JWT padronizado | — | §3.2 | §0.3.6 |
| Migração inventário | — | §5 | §0.4.2, §0.4.3 |
| Permissões por módulo | §8.1 | §4 | §0.3.6, §0.4.4 |
| Equipes de TI | §2 | — | §1.3.4 |
| Regras de equipe | §2 | — | §1.3.4 |
| Docker Compose | §7 | §6 | §0.3.2 |
| Portfólio + Licenças (Fase 2B) | §3 | — | — (Fase 2B) |
| Sub-projetos (Fase 5) | §4 | — | — (Fase 5) |

---

## Controle de Versão

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | — | Documento técnico inicial para Fase 0 e Fase 1. Totalmente alinhado com plano-ti-system-v5.md e arquitetura-plataforma-v2.1.md. Resolve todos os 7 pontos da revisão técnica: (1) fase1 alinhado com arquitetura; (2) multi-filial N:N consistente; (3) login por username OU email; (4) Docker Compose unificado sem conflito de portas; (5) dois backends com JWT compartilhado; (6) transição de auth detalhada com feature flag; (7) Portfólio + Licenças referenciado como Fase 2B. |
| 1.1 | — | **Correções da 2ª revisão técnica (5 pontos).** (1) Referência a INSTEAD OF triggers para VIEWs read-only — migration 005 documentada. (2) Nginx setup adicionado ao Sprint 0A — resolve localStorage cross-origin. (3) @@ignore removido do Prisma da Gestão TI + middleware read-only. (4) Step 0: rename do banco inventario_protheus → capul_platform. (5) Seed corrigido com todas as 7 roles da Gestão TI. Checklists atualizados. |
| 1.1.1 | — | **Correções da 3ª revisão.** (1) Tabela de rotas Nginx com todas as rotas do inventário (products, stores, users, sync). (2) URLs no seed e SQL migradas para paths relativos (/inventario/, /gestao-ti/). (3) Axios e auth.js usando paths relativos em vez de portas diretas. |
| 1.1.2 | — | **Correções da 4ª revisão.** (1) CRUDs do Auth Gateway prefixados com /api/v1/core/ (empresas, filiais, usuarios, departamentos, centros-custo, modulos) — Nginx já roteia /api/v1/core/*. (2) MembroEquipe: adicionada relation `usuario` no schema Prisma (faltava no técnico, existia na arquitetura). (3) Axios: adicionado `coreApi` separado para CRUDs organizacionais. |
| 1.1.3 | — | **Correções da 6ª revisão + visibilidade de chamados.** (1) Axios refresh: path corrigido para `/refresh` (evita duplicação com baseURL). (2) Referência a arquitetura-plataforma-v2.1.md corrigida. (3) Nota de design §1.3.6: visibilidade PÚBLICO/PRIVADO para chamados (Fase 2). (4) Roles TECNICO e USUARIO_FINAL: descrições atualizadas no seed SQL. (5) Sidebar: referência a PÚBLICO+PRIVADO nos Chamados. |
