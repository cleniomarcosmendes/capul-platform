# Auth Gateway

Gateway de autenticacao centralizada da Capul Platform.

## Stack

- **Runtime**: Node.js 22
- **Framework**: NestJS 11
- **ORM**: Prisma 6
- **Auth**: Passport + JWT
- **Banco**: PostgreSQL 16 (schema `core`)

## Schema Core

O Auth Gateway gerencia as entidades centrais da plataforma:

```
core.empresas          # Empresas (multi-tenant)
core.filiais           # Filiais por empresa
core.usuarios          # Usuarios da plataforma
core.modulos           # Modulos disponiveis (GESTAO_TI, INVENTARIO, CONFIGURADOR)
core.roles             # Roles por modulo
core.usuario_modulos   # Vinculo usuario <-> modulo/role
core.departamentos     # Departamentos
core.centros_custo     # Centros de custo
```

## Autenticacao JWT

### Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login (email + senha) |
| POST | `/api/v1/auth/refresh` | Renovar access token |
| POST | `/api/v1/auth/logout` | Invalidar refresh token |
| GET | `/api/v1/auth/me` | Dados do usuario logado |

### JWT Payload

```typescript
{
  sub: string,           // userId (UUID)
  email: string,
  nome: string,
  empresaId: string,
  filialId: string,
  modulos: [
    { codigo: 'GESTAO_TI', role: 'ADMIN' },
    { codigo: 'INVENTARIO', role: 'SUPERVISOR' },
    { codigo: 'CONFIGURADOR', role: 'ADMIN' }
  ]
}
```

### Configuracao

```env
JWT_SECRET=<chave_64_caracteres>
JWT_REFRESH_SECRET=<outra_chave>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

## UNIFIED_AUTH

Variavel de ambiente que habilita autenticacao unificada para todos os modulos:

```env
UNIFIED_AUTH=true
```

### Comportamento

- **`UNIFIED_AUTH=true`**: Todos os modulos usam `core.usuarios` via JWT do Auth Gateway
- **`UNIFIED_AUTH=false`**: Modulos podem ter tabelas de usuarios locais (legado)

### Impacto por Modulo

| Modulo | UNIFIED_AUTH=true | UNIFIED_AUTH=false |
|--------|-------------------|-------------------|
| Gestao TI | Usa `core.usuarios` | Usa `core.usuarios` |
| Inventario | Usa `core.usuarios` | Usa `inventario.users` |
| Configurador | Usa `core.usuarios` | Usa `core.usuarios` |

### Migracao

Para migrar do modo legado para unificado:

1. Garantir que todos os usuarios necessarios existam em `core.usuarios`
2. Atribuir modulo/role via Configurador
3. Setar `UNIFIED_AUTH=true` no `.env`
4. Reiniciar os containers

## Modulos e Roles

### Gestao TI (9 roles)
- ADMIN, GESTOR_TI, TECNICO, DESENVOLVEDOR
- MANUTENCAO, INFRAESTRUTURA, USUARIO_FINAL
- USUARIO_CHAVE, TERCEIRIZADO

### Inventario (3 roles)
- ADMIN, SUPERVISOR, OPERATOR

### Configurador (3 roles)
- ADMIN, OPERADOR, VIEWER

## Comandos

```bash
# Desenvolvimento
npm install
npm run start:dev

# Producao
npm run build
npm run start:prod

# Prisma
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Testes
npm test
npm run test:cov
```

## Docker

```bash
# Build
docker compose build auth-gateway

# Logs
docker compose logs -f auth-gateway

# Shell
docker compose exec auth-gateway sh

# Seed
docker compose exec auth-gateway npx prisma db seed
```

## Estrutura

```
auth-gateway/
├── prisma/
│   ├── schema.prisma    # Schema do banco (core)
│   └── seed.ts          # Seed inicial (empresa, modulos, roles, admin)
├── src/
│   ├── auth/            # Modulo de autenticacao
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── guards/
│   ├── usuarios/        # CRUD usuarios
│   ├── prisma/          # PrismaService
│   └── main.ts
└── .env.example
```

---

*Ultima atualizacao: 10/03/2026*
