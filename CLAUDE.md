# CLAUDE.md

Orientacoes para o Claude Code ao trabalhar neste repositorio.

## Status do Projeto

**Capul Platform v1.0** - **PRODUCAO** *(Março/2026)*

### Arquitetura

Plataforma corporativa modular com microservicos independentes:

```
                      Internet
                         |
                    [ Nginx :443 ]
                    SSL Termination
                   /    |    |    \
                  /     |    |     \
            [Hub]  [Auth GW]  [Gestao TI]  [Inventario]
            :5170   :3000      :3001/:5173   :8000/:8443
               \      |        /       /
                \     |       /       /
              [ PostgreSQL :5432 ]
              capul_platform DB
              schemas: core | gestao_ti | inventario
                         |
                    [ Redis :6379 ]
```

### Servicos

| Servico | Stack | Porta | Schema DB |
|---------|-------|-------|-----------|
| **Nginx** | Nginx 1.27 | 80, 443 | - |
| **Auth Gateway** | NestJS 11 + Prisma 6 | 3000 | `core` |
| **Hub** | React 19 + Vite 7 | 5170 | - |
| **Gestao TI Backend** | NestJS 11 + Prisma 6 | 3001 | `core` (RO) + `gestao_ti` |
| **Gestao TI Frontend** | React 19 + Vite 7 + Tailwind v4 | 5173 | - |
| **Inventario Backend** | FastAPI + Python 3.11 | 8000 | `inventario` |
| **Inventario Frontend** | HTML + Bootstrap 5 (PWA) | 8443 | - |
| **PostgreSQL** | PostgreSQL 16 | 5432 | Multi-schema |
| **Redis** | Redis 7 | 6379 | Cache/sessoes |

---

## Modulos da Plataforma

### 1. Auth Gateway (`/auth-gateway`)
- Autenticacao centralizada JWT
- Gestao de usuarios, empresas e filiais
- Controle de acesso por modulo/role
- UNIFIED_AUTH: autenticacao unificada para todos os modulos

### 2. Hub (`/hub`)
- Portal de entrada da plataforma
- Navegacao entre modulos autorizados
- Dashboard inicial do usuario

### 3. Gestao TI (`/gestao-ti`)
- Sistema completo de gestao de TI
- Chamados, contratos, projetos, CMDB
- 16 controllers, ~145 endpoints
- Docs: `gestao-ti/docs/documentacao-tecnica-v1.md`

### 4. Inventario (`/inventario`)
- Sistema de inventario Protheus
- Contagem multi-ciclo, sincronizacao ERP
- Docs: `inventario/CLAUDE.md`

### 5. Configurador (`/configurador`)
- Configuracao da plataforma
- Gestao de usuarios e permissoes
- Atribuicao de modulos por usuario

---

## Comandos Essenciais

```bash
# Docker Compose (raiz)
docker compose up -d                    # Iniciar tudo
docker compose ps                       # Status
docker compose logs -f <service>        # Logs
docker compose down                     # Parar

# Rebuild servico especifico
docker compose build gestao-ti-backend
docker compose up -d gestao-ti-backend

# Databases
docker compose exec gestao-ti-backend npx prisma migrate deploy
docker compose exec gestao-ti-backend npx prisma db seed
docker compose exec auth-gateway npx prisma migrate deploy
docker compose exec auth-gateway npx prisma db seed
```

### Acessos

| Servico | URL | Credenciais |
|---------|-----|-------------|
| Hub | https://localhost/ | - |
| Gestao TI | https://localhost/gestao-ti/ | admin |
| Inventario | https://localhost:8443/ | admin/admin123 |
| PgAdmin | http://localhost:5050 | Ver .env |
| API Docs (Inventario) | http://localhost:8000/docs | - |

---

## Estrutura do Repositorio

```
capul-platform/
├── .env                    # Variaveis de ambiente globais
├── docker-compose.yml      # Orquestracao de containers
├── nginx/                  # Proxy reverso + SSL
│   ├── nginx.conf
│   └── certs/              # Certificados SSL
├── auth-gateway/           # Autenticacao centralizada
│   ├── prisma/schema.prisma
│   └── src/
├── hub/                    # Portal de entrada
│   └── src/
├── gestao-ti/              # Modulo Gestao de TI
│   ├── backend/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── frontend/
│   │   └── src/
│   └── docs/               # Documentacao tecnica
├── inventario/             # Modulo Inventario
│   ├── backend/
│   └── frontend/
└── configurador/           # Modulo Configurador
    └── ...
```

---

## Autenticacao Unificada

### Fluxo JWT

1. Login via Auth Gateway (`POST /api/v1/auth/login`)
2. Retorna `{ accessToken, refreshToken }`
3. JWT payload inclui modulos e roles:
   ```typescript
   {
     sub: string,          // userId
     email: string,
     nome: string,
     empresaId: string,
     filialId: string,
     modulos: [
       { codigo: 'GESTAO_TI', role: 'ADMIN' },
       { codigo: 'INVENTARIO', role: 'ADMIN' },
       { codigo: 'CONFIGURADOR', role: 'ADMIN' }
     ]
   }
   ```
4. Cada modulo valida JWT com mesmo `JWT_SECRET`
5. Access token: 15min | Refresh token: 7 dias

### UNIFIED_AUTH

Variavel de ambiente que habilita autenticacao unificada:
- `UNIFIED_AUTH=true`: Inventario usa `core.usuarios` via JWT do Auth Gateway
- `UNIFIED_AUTH=false`: Inventario usa tabela propria `inventario.users` (legado)

---

## Roles por Modulo

### Gestao TI (9 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador do sistema |
| GESTOR_TI | Gestor de TI |
| TECNICO | Tecnico de suporte |
| DESENVOLVEDOR | Desenvolvedor |
| USUARIO_FINAL | Usuario comum |
| MANUTENCAO | Manutencao |
| INFRAESTRUTURA | Infraestrutura |
| USUARIO_CHAVE | Usuario-chave de projetos |
| TERCEIRIZADO | Analista externo com acesso restrito a projetos vinculados |

### Inventario (3 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador |
| SUPERVISOR | Supervisor |
| OPERATOR | Operador |

### Configurador (3 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador |
| OPERADOR | Operador |
| VIEWER | Visualizador |

---

## Diretrizes de Desenvolvimento

1. **Multi-schema**: Cada modulo usa seu schema PostgreSQL isolado
2. **JWT compartilhado**: Mesmo `JWT_SECRET` para todos os backends
3. **Schema core read-only**: Gestao TI nao escreve no schema core
4. **Store/Filial context**: Operacoes requerem filial do usuario
5. **Transacoes**: Usar sessoes com rollback em erros
6. **Seguranca**: Validar inputs, sanitizar erros
7. **Commits**: Descritivos, changelog atualizado

---

## Documentacao

### Por Modulo
- **Auth Gateway**: `auth-gateway/README.md`
- **Gestao TI**: `gestao-ti/docs/documentacao-tecnica-v1.md`
- **Inventario**: `inventario/CLAUDE.md`

### Roteiros e Procedimentos
- **Roteiro de Finalizacao**: `docs/ROTEIRO_FINALIZACAO.md` — Procedimento padrao pos-desenvolvimento (documentacao + commits + verificacao). Invocar com: `"Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2"`

### Este Arquivo
Este arquivo serve como ponto de entrada para o Claude Code entender a estrutura geral da plataforma e navegar entre os modulos.

---

*Ultima atualizacao: 31/03/2026*
