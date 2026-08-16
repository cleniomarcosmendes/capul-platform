# Dossiê de Arquitetura — Plataforma Capul

> **Para quem:** assistente que vai planejar o módulo de **Avaliação de Desempenho e
> Pesquisa de Clima (RH)** sem acesso a este código.
> **O que é:** descrição do que **existe hoje**, com caminhos reais. Não contém
> proposta de solução nem desenho do módulo novo.
> **Data do levantamento:** 15/08/2026 · commit `eaf620c6`
> **Método:** leitura do código. Onde não foi possível concluir, está escrito
> `NÃO IDENTIFICADO` ou `INCERTO — verificar`.

---

## 1. Visão geral

Plataforma corporativa **modular** da Capul: um portal (Hub) e vários módulos
independentes, cada um com backend e frontend próprios, atrás de um **nginx** único,
compartilhando **um PostgreSQL** (schemas separados) e **um** serviço de autenticação.

| Módulo | O que faz | Maturidade |
|---|---|---|
| **Auth Gateway** | Login, JWT, usuários, empresas/filiais/departamentos, permissões, integrações | **Produção** |
| **Hub** | Portal de entrada; navegação para os módulos autorizados | **Produção** |
| **Gestão TI / Workspace** | Chamados, contratos, projetos, CMDB, tarefas, SAC, Venda Ativa | **Produção** — é o maior |
| **Inventário** | Inventário Protheus: contagem multi-ciclo, divergências, sincronismo ERP | **Produção** |
| **Configurador** | Cadastros da plataforma, permissões, integrações, telas administrativas | **Produção** |
| **Fiscal** | NF-e/CT-e, consulta cadastral, cruzamento SEFAZ×Protheus | **Em desenvolvimento** |
| **Logística / Entregas** | Entregas domiciliares, frota, RDV de supervisores, app do entregador | **Em desenvolvimento** (mais recente) |

**Tamanho aproximado** (código-fonte, sem `node_modules`/`dist`):

| Módulo | Linhas | Arquivos |
|---|---:|---:|
| gestao-ti | 76.734 | 372 |
| inventario | 63.153 | 145 |
| fiscal | 49.294 | 197 |
| logistica | 41.126 | 218 |
| configurador | 8.528 | 43 |
| auth-gateway | 7.745 | 101 |
| hub | 1.547 | 11 |
| **Total** | **≈ 248.000** | **≈ 1.087** |

Documento de referência mantido pelo time: `CLAUDE.md` (raiz).

---

## 2. Stack e ferramental

**Monorepo único** (um repositório git, pastas por módulo). Não há workspaces
npm/pnpm/turborepo — **cada pasta tem seu próprio `package.json` e seu próprio
`node_modules`**, instalados e buildados de forma independente.

### Backend (padrão em 4 dos 5 backends)
- **NestJS 11** + **TypeScript** + **Prisma 6** (`@prisma/client ^6.19.2`)
- **Node 22** (`logistica/backend/package.json` declara `engines.node ^22.10.7`; imagens Docker usam `node:22-alpine`)
- `class-validator` + `class-transformer` — validação declarativa dos DTOs
- `@nestjs/passport` + `passport-jwt` — autenticação
- `@nestjs/throttler` — rate limit
- `@nestjs/schedule` — cron
- `nestjs-pino` + `pino-http` — log estruturado JSON
- `helmet` — cabeçalhos de segurança

### Exceção: Inventário
**FastAPI + Python 3.11 + SQLAlchemy**, sem Prisma. Migrations em **SQL puro**
(`inventario/database/migrations/*.sql`, 43 arquivos) aplicadas por
`inventario/database/migrations/migrate.sh`.

### Frontend (idêntico em todos os módulos web)
- **React 19** + **Vite 7** + **TypeScript**
- **react-router-dom 7** — roteamento
- **axios** — HTTP
- **Tailwind CSS v4** — estilo, com tokens CSS (`--color-capul-*`)
- **lucide-react** — ícones
- **recharts** — gráficos (presente em `gestao-ti/frontend` e `inventario/frontend`)

> ⚠️ **Não há** `react-hook-form`, `zod`, `@tanstack/react-query` nem biblioteca de
> tabela/datagrid. Formulários, estado e tabelas são feitos **à mão** com
> `useState`/`useEffect`. Ver §8.

### App mobile
**Expo SDK 56 / React Native 0.85** em `logistica/app` (entregador e supervisor).

### Lint / format
- **ESLint 9** (flat config) nos frontends e — desde 15/08 — no app.
  Ex.: `logistica/frontend/eslint.config.js`, `logistica/app/eslint.config.mjs`.
  Calibração da casa: **0 erros / 0 avisos**.
- Regras de hooks: `react-hooks/rules-of-hooks` = **error**, `exhaustive-deps` = warn.
- Prettier declarado nos backends (`npm run format`), **não** aplicado por hook.
- `NÃO IDENTIFICADO`: husky / lint-staged / pre-commit hooks.

### Infra local e de produção
`docker-compose.yml` na raiz, **29 serviços**: nginx, postgres (×3: principal, `rfb`,
`cofre`), redis, minio, mailhog/greenmail (e-mail de teste), pgadmin, osrm (rotas),
mais backend+frontend de cada módulo e os **jobs `*-migrate`**.

---

## 3. Estrutura de pastas

```
capul-platform/
├── docker-compose.yml          # orquestração (29 serviços)
├── CLAUDE.md                   # documento-guia da plataforma
├── nginx/                      # proxy reverso + SSL
│   ├── nginx.conf              #   ⚠️ é ele que decide o que fica exposto
│   └── dev/                    #   listener :8085 só de desenvolvimento
├── scripts/                    # backup.sh, migrate.sh, check-migrations-all.sh…
├── docs/                       # documentação e roteiros
├── database/                   # ⚠️ diretório ABANDONADO — nenhum runner o lê
│
├── auth-gateway/               # NestJS — autenticação e cadastros CORE
│   ├── prisma/{schema.prisma,migrations/,seed.ts}
│   └── src/{auth,usuario,integracao,presenca,email,...}/
│
├── hub/                        # React — portal de entrada
├── configurador/               # React — telas administrativas (SEM backend próprio)
│   └── src/{pages,services,layouts,components}/
│
├── gestao-ti/                  # Workspace
│   ├── backend/{prisma,src}/
│   └── frontend/src/
├── inventario/                 # FastAPI + React
│   ├── backend/app/{api,core,models,services}/
│   ├── database/migrations/    #   SQL puro, numerado (014_…, 021_…)
│   └── frontend/src/
├── fiscal/{backend,frontend}/
└── logistica/
    ├── backend/{prisma,src}/
    ├── frontend/src/
    └── app/                    # Expo (React Native)
```

**Lógica de organização:** primeiro **por módulo de negócio**, depois **por camada**
dentro do backend e **por domínio** dentro de `src/`. No NestJS, cada pasta de
`src/<dominio>/` reúne controller + service + dto + module + spec do mesmo assunto —
**não** há pastas globais `controllers/`, `services/`.

**Onde ficaria fisicamente um módulo novo:**
`./rh/backend/` (NestJS+Prisma) + `./rh/frontend/` (React+Vite), mais os serviços
`rh-migrate`, `rh-backend`, `rh-frontend` no `docker-compose.yml` e um bloco
`location /api/v1/rh/` em `nginx/nginx.conf`.
*(Descrição do padrão observado — não é recomendação.)*

> ⚠️ `database/` na raiz é um **plano abandonado**: migrations lá **não são lidas por
> runner nenhum**. Já causou incidente (escrita bloqueada em silêncio por 5 meses).

---

## 4. Anatomia de um módulo — fatia vertical

### Módulo escolhido: **Logística** (`logistica/`)

**Por quê:**
1. É o mais recente — reflete o padrão **atual**, não o histórico;
2. tem a **maior suíte** dos backends NestJS (363 testes / 14 arquivos `.spec.ts`);
3. exercita tudo que o módulo de RH vai precisar: RBAC por papel **e** por
   departamento, escopo por filial, upload de arquivo, cron, integração Protheus e
   consumo do schema `core`;
4. é o único com backend + frontend web + app mobile na mesma convenção.

> Ressalva honesta: **Gestão TI é maior e mais maduro em produção**, mas carrega mais
> padrão legado. Para "escrever código que pareça da mesma pessoa", Logística é a
> referência melhor.

### Fluxo completo, na ordem

#### 4.1 Migration
`logistica/backend/prisma/migrations/20260809180000_entrega_data_entrega/migration.sql`

- Nome: `<AAAAMMDDHHMMSS>_<descricao_em_snake_case>`
- Geradas por Prisma; **nunca escritas à mão** (regra do time)
- ⚠️ **Na Logística `prisma migrate dev` RESETA o banco** — o fluxo usado é
  `prisma migrate diff` + `migrate deploy`
- A tabela `_prisma_migrations` vive no schema **`public`** (multi-schema)

#### 4.2 Modelo / entidade
`logistica/backend/prisma/schema.prisma` (~1.000 linhas, todos os modelos do módulo
num arquivo só)

```prisma
model Entrega {
  id               String   @id @default(uuid())
  numero           Int
  filialId         String   @map("filial_id")
  destinatarioNome String   @map("destinatario_nome")
  criadoEm         DateTime @default(now()) @map("criado_em")
  @@map("entrega")
  @@schema("logistica")
}
```

Obrigatório: `@@schema("logistica")` em **todo** modelo e enum; `@map`/`@@map` para
`snake_case` no banco; PK `String @id @default(uuid())`.

#### 4.3 Repositório / query
**Não existe camada de repositório.** O service injeta `PrismaService`
(`logistica/backend/src/prisma/prisma.service.ts`) e consulta direto.
SQL cru só para ler o schema `core` (§5), via `Prisma.sql` com parâmetros.

#### 4.4 Serviço (regra de negócio)
`logistica/backend/src/entrega/entrega.service.ts`
Classe `@Injectable()`, injeção por construtor. **É aqui que mora a regra** —
controllers são finos. Serviços grandes são quebrados em sub-services
(padrão *Facade*, visível em `gestao-ti/backend/src/chamado/services/`).

#### 4.5 Controller / rota
`logistica/backend/src/entrega/entrega.controller.ts`

```ts
@Controller('entregas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class EntregaController {
  @Post()
  @Roles('REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  criar(@Body() dto: CreateEntregaDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.entregas.create(dto, user);
  }
}
```

- `@Roles` na **classe** = padrão; no **método** = sobrepõe
- `@CurrentUser()` injeta o payload do JWT
- Prefixo global `api/v1/logistica` em `main.ts` — o controller declara só o resto
- ⚠️ Rotas estáticas (`@Get('grid')`) **antes** das paramétricas (`@Get(':id')`)

#### 4.6 Validação
`logistica/backend/src/entrega/dto.ts` — `class-validator` por decorator:

```ts
export class CupomDto {
  @IsOptional() @IsString() @MaxLength(60)  numeroCupom?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valor?: number;
}
```

`ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true` (`logistica/backend/src/main.ts`) — **campo não declarado no DTO
faz a requisição falhar**.

#### 4.7 Contrato de API
**Não há OpenAPI/Swagger nem tipos compartilhados.** O contrato é implícito: o front
redeclara as interfaces em TypeScript (`logistica/frontend/src/services/api.ts` e nas
próprias páginas). `NÃO IDENTIFICADO`: qualquer geração automática de client.

#### 4.8 Chamada no front
`logistica/frontend/src/services/api.ts` — três instâncias axios (`authApi`,
`coreApi`, `logisticaApi`), interceptor que injeta o Bearer de
`localStorage('accessToken')` e, em **401**, limpa e volta ao Hub.

#### 4.9 Estado
`useState`/`useEffect` locais na página. Contexto React só para transversais
(`logistica/frontend/src/contexts/`). **Sem Redux/Zustand/React Query.**

#### 4.10 Tela
`logistica/frontend/src/pages/<Assunto>Page.tsx` — uma página por rota, declarada em
`src/App.tsx`. Componentes reutilizáveis em `src/components/`.

#### 4.11 Teste
`logistica/backend/src/entrega/entrega.service.spec.ts` — **Jest**, ao lado do
código. Padrão: mock do Prisma via `src/common/testing/prisma-mock.ts`
(`createPrismaMock()`), sem banco.

**Obrigatório × opcional**

| Camada | Obrigatório | Opcional |
|---|---|---|
| Migration | sim, via Prisma | — |
| Modelo | `@@schema` + `@map` | relações cross-schema (evitadas) |
| Repositório | — | não existe |
| Service | sim | quebrar em sub-services |
| Controller | sim, fino | — |
| DTO | **sim** (ValidationPipe é estrito) | — |
| Contrato | — | não há |
| Front service | sim | — |
| Estado global | — | raro |
| Teste | **sim para regra/guard** (regra do time) | tela |

---

## 5. Banco de dados

- **PostgreSQL 16** (`postgres:16-alpine`), instância única `capul_platform`
- Mais dois bancos isolados: `postgres-cofre` (provas de entrega) e `postgres-rfb`
- **ORM:** Prisma 6 (4 backends) · **SQLAlchemy** (Inventário)
- **Multi-schema:** `core`, `gestao_ti`, `inventario`, `fiscal`, `logistica`.
  Cada módulo escreve **só no seu**; `core` é **read-only** para os demais.

### Convenções
| Item | Convenção |
|---|---|
| Tabela | `snake_case`, via `@@map("entrega")` |
| Coluna | `snake_case` no banco, `camelCase` no código, via `@map` |
| PK | `id String @id @default(uuid())` |
| FK | `<entidade>Id` → `@map("<entidade>_id")` |
| Índice | `@@index([campo])`; único `@@unique([a, b])` |
| Migration | `<AAAAMMDDHHMMSS>_<snake_case>` |
| Inventário (SQL) | `NNN_descricao.sql` sequencial |

⚠️ **Prisma `@unique` gera ÍNDICE único, não CONSTRAINT** — `ON CONFLICT ON
CONSTRAINT` não funciona.

### Auditoria
Não há base/mixin obrigatório. O padrão observado é `criadoEm`/`createdAt`
(18 ocorrências no schema da Logística) e `criadoPorId`. `atualizadoEm`/`updatedAt`
aparece com `@updatedAt`. **Não é sistemático.**

### Soft delete
**Não existe** coluna `deleted_at` em nenhum schema. Exclusão lógica quando ocorre é
por **flag de estado**: `ativo Boolean` (9× na Logística) ou `status StatusGeral`
(`ATIVO | INATIVO`) em `core.usuarios`.

### Multi-empresa / multi-filial
Modelado em `core`: `Empresa` → `Filial` → `Departamento` → `CentroCusto`
(`auth-gateway/prisma/schema.prisma:41-134`).
- Usuário tem `filialPrincipalId` **e** pode ter várias filiais via
  `UsuarioFilial` (`@@unique([usuarioId, filialId])`, com `isDefault`)
- Nos módulos, a filial viaja no JWT (`filialId`) e é aplicada por
  `logistica/backend/src/common/filial-scope.ts` — `assertMesmaFilial()` na escrita e
  `resolverFilialLeitura()` na leitura
- ⚠️ **Não há RLS no Postgres.** O escopo é **inteiramente aplicativo** — esquecer o
  filtro vaza dado entre filiais

### Seed
`auth-gateway/prisma/seed.ts` e `gestao-ti/backend/prisma/seed.ts`
(`npx prisma db seed`). Os demais módulos não têm.

---

## 6. Autenticação e autorização

### Login
Usuário/senha em `core.usuarios` (hash bcrypt), pelo **Auth Gateway**
(`POST /api/v1/auth/login`). **Não há SSO nem LDAP/AD.**

Existe um segundo caminho: usuários com `autenticaPortal = true` são validados
**no portal RH do Protheus** por matrícula+senha
(`auth-gateway/src/auth/portal-auth.service.ts`) — nesse ramo **não há**
`bcrypt.compare` local; a resposta do Protheus é a credencial.

Há **MFA** (`mfaEnabled`, `mfaSecret`) — ⚠️ o app mobile **não** implementa a 2ª etapa.

### Sessão
**JWT stateless**, sem sessão em servidor:
- `accessToken` — **60 min** web, 15 min mobile
- `refreshToken` — 7 dias web; sessão mobile com janela deslizante de 30 dias
  (`core.refresh_tokens`, `core.dispositivo_sessao`)
- Segredo compartilhado `JWT_SECRET` (mesmo em todos os backends) — **é isso que
  permite um módulo validar o token emitido por outro**
- **Onde fica no cliente:** `localStorage('accessToken')`, compartilhado entre os
  módulos por serem a mesma origem

### Payload do JWT — contrato que todo módulo consome
`logistica/backend/src/common/decorators/current-user.decorator.ts`

```ts
interface JwtPayload {
  sub: string; email?: string; nome?: string;
  empresaId?: string; filialId?: string; departamentoId?: string;
  tipo?: 'INDIVIDUAL' | 'PADRAO';
  modulos?: { codigo: string; role: string;
              departamentos?: { id; nome; role; funcionalidades?: string[] }[] }[];
}
```

### Modelo de permissão
`core.permissoes_modulo` (`auth-gateway/prisma/schema.prisma:251`):
**usuário × módulo × departamento × role**, com `@@unique` na tripla → a mesma pessoa
pode ter **papéis diferentes em departamentos diferentes do mesmo módulo**.

- Papéis por módulo: tabela `core.roles_modulo` (não é enum no código)
- Granularidade extra: `core.departamento_funcionalidade` (funcionalidades por
  departamento) e `core.usuario_capability`
- ⚠️ `modulos[].role` no JWT é **denormalizado** (papel do 1º departamento) e está
  marcado `@deprecated`. Ler esse campo faz o módulo enxergar **um** papel e ignorar
  os demais, em silêncio. O correto é o helper —
  `logistica/backend/src/common/roles-logistica.ts`

### Como uma rota é protegida
Guards globais em `logistica/backend/src/app.module.ts:87-89`:
`ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`.
`@Roles(...)` declara os papéis; `@Public()` libera.
`logistica/backend/src/common/guards/roles.guard.ts` — **ADMIN passa sempre**.

### Como o front esconde elemento
Lê a role do JWT decodificado e compara em JavaScript. Ex.:
`configurador/src/layouts/Sidebar.tsx` (itens com `roles: ADMINS`) e
`configurador/src/pages/integracoes/IntegracoesPage.tsx` (`canEdit = role === 'ADMIN'`).
⚠️ É **apenas cosmético** — a autoridade é o guard do backend.

### "Gestor vê apenas sua equipe"
**Existe, mas não de forma unificada** — cada módulo resolve do seu jeito:
- **Logística/RDV:** `logistica/backend/src/supervisor/` — modelo `Supervisor`
  (`schema.prisma:871`) com `coordenadorId` (quem aprova) e `departamentoId`
- **Logística/Frota:** `veiculo.supervisorId` (quem responde pelo veículo)
- **Gestão TI:** modelo `Equipe` + membros (`gestao-ti/backend/prisma/schema.prisma:172`)

⚠️ **Não existe hierarquia organizacional genérica gestor→liderado** em `core`. Ver §10.

---

## 7. Integração com Protheus / Oracle

### Como é o acesso
**Exclusivamente por API REST do Protheus.** Não há driver Oracle no código
(`oracledb`/`cx_Oracle` não aparecem) — nenhum acesso direto ao banco do ERP.

Clientes HTTP (um por módulo, mesmo formato):
- `auth-gateway/src/auth/portal-auth.service.ts` — `loginPortal`
- `auth-gateway/src/usuario/protheus-funcionario.service.ts` — `infoFuncionario`
- `gestao-ti/backend/src/protheus/protheus.service.ts`
- `logistica/backend/src/protheus/protheus-cliente.service.ts` e `-condutor.service.ts`
- `fiscal/backend/src/protheus/`

### Configuração por ambiente — **não é `.env`**
Fica em **banco**, em `core.integracoes_api` + `core.integracoes_api_endpoints`
(`auth-gateway/prisma/schema.prisma:438-476`), com granularidade
**(integração × módulo consumidor × operação × ambiente)** e `ativo`.
Editável pela tela **Configurador → Integrações API**.

- Cada backend resolve o endpoint em runtime chamando
  `GET /api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos?modulo=<MODULO>`
- Ambientes: `PRODUCAO` / `HOMOLOGACAO`, com **um ativo por (módulo, operação)**
- Variáveis de ambiente relacionadas (**nomes apenas**): `PROTHEUS_API_URL`,
  `PROTHEUS_API_AUTH`, `PROTHEUS_INVENTARIO_AUTH`

⚠️ **DESENVOLVIMENTO aponta para o Protheus de PRODUÇÃO.** Escrever em DEV escreve no
ERP real.

### Tabelas do Protheus já consumidas
| Tabela | Conteúdo | Onde |
|---|---|---|
| `SB1010` | Cadastro de produto | Inventário (294 ocorrências) |
| `SB2010` | Saldo por armazém | Inventário |
| `SB8010` | Saldo por lote | Inventário |
| `SZR010` / `SZQ010` | Fiscal (notas/eventos) | Fiscal |
| `SLK010`, `SZB010` | Inventário/local | Inventário |
| `SA1010` | Clientes | Logística, Fiscal |
| `SA2010` | Fornecedores | Fiscal |
| `SF1010` | Documentos de entrada | Fiscal |

Essas são **espelhadas no PostgreSQL** pelo Inventário
(`inventario/backend/app/api/v1/endpoints/sync_protheus.py`, `sync_products.py`) —
não são consultadas no Oracle em tempo real.

⚠️ **`SRA` (funcionários), `SQ3`, `CTT` (centro de custo) e `SM0` NÃO são consumidas.**
Dado de funcionário vem **só** pela operação REST `infoFuncionario`, que devolve
`{ matricula, nome, cc }` — **sem** situação, sem data de admissão/demissão, sem
hierarquia, sem cargo.

### Cadastro de colaborador na plataforma
**Existe, parcial.** `core.usuarios`
(`auth-gateway/prisma/schema.prisma:135`) — campos relevantes:

```prisma
model Usuario {
  id String @id @default(uuid())
  username String @unique
  email String? @unique
  nome String
  cargo String?
  status StatusGeral @default(ATIVO)   // ATIVO | INATIVO
  tipo TipoUsuario @default(INDIVIDUAL) // INDIVIDUAL | PADRAO
  matricula String? @unique             // chapa do Protheus
  filialPrincipalId String? @map("filial_principal_id")
  departamentoId String @map("departamento_id")
  autenticaPortal Boolean @default(false)
}
```

**É um cadastro de USUÁRIO DO SISTEMA, não de colaborador.** Só existe quem tem
login. Não há admissão, cargo estruturado, salário, hierarquia nem histórico.

Desde 15/08 há uma rotina que confere as matrículas contra o Protheus e desativa quem
não é mais funcionário: `auth-gateway/src/varredura-matricula/`
(tela em `configurador/src/pages/observabilidade/VarreduraMatriculaPage.tsx`).
⚠️ Ela roda em **modo relatório** e não foi ligada em produção.

---

## 8. Frontend

- **React 19.2 + Vite 7 + TypeScript**, `react-router-dom 7`
- Cada módulo é uma **SPA independente**, servida pelo nginx sob um `base` próprio
  (`/entregas/`, `/inventario/`, `/gestao-ti/`, `/configurador/`)
- **Estado:** `useState`/`useEffect` + Context para transversais. Sem Redux/Zustand/React Query
- **UI:** Tailwind v4 puro. **Não há design system nem biblioteca de componentes**
  (sem MUI, shadcn, Ant). Componentes compartilhados são caseiros, **por módulo**, e
  **duplicados entre módulos** (`Toast.tsx` e `PasswordInput.tsx` existem em vários)
- **Tema:** tokens CSS em `<modulo>/src/index.css` — `--color-capul-50…900`
  (verde institucional, `#72BF44` / `#006838`)
- **Responsividade:** classes Tailwind. **Sem PWA**, sem service worker. O caso mobile
  real foi resolvido com **app nativo Expo**, não com web responsiva
- **Gráficos:** `recharts` — em `gestao-ti/frontend` e `inventario/frontend`

### Formulário
Feito **à mão**: um `useState` por campo, validação no `onSubmit`, erro por `toast`.
Máscaras pt-BR são **funções próprias**, ex.:
`logistica/frontend/src/utils/format.ts` — `maskMoeda`, `parseMoeda`,
`moedaParaInput`, `maskTelefone`, `maskCep`, `onlyDigits`.

⚠️ Já houve incidente aqui: `parseFloat` sobre string mascarada em pt-BR gravava
valor **sem os centavos, sem erro** — corrigido em 15/08.

### Tabela com filtro/paginação/exportação
Também à mão: `<table>` HTML + `.filter()`/`.slice()` em memória.
Há um `Paginator.tsx` em `gestao-ti/frontend/src/components/`.
**Não há** exportação genérica no front; Excel/PDF são gerados no **backend**.

### Componentes compartilhados mais úteis
| Componente | Caminho |
|---|---|
| Toast | `logistica/frontend/src/components/Toast.tsx` · `configurador/src/components/Toast.tsx` |
| ConfirmDialog (com variante `danger`) | `configurador/src/components/ConfirmDialog.tsx` |
| Paginator | `gestao-ti/frontend/src/components/Paginator.tsx` |
| SearchSelect / MultiSelectDropdown | `gestao-ti/frontend/src/components/` |
| Drawer / TabBar / EmptyState / ErrorBoundary | `gestao-ti/frontend/src/components/` |
| PeriodFilter (filtro de período) | `gestao-ti/frontend/src/components/PeriodFilter.tsx` |
| MentionInput (@menções) | `gestao-ti/frontend/src/components/MentionInput.tsx` |
| MoedaInput / DataInput / PasswordInput | `logistica/frontend/src/components/` |

---

## 9. Recursos transversais já prontos

| Recurso | Situação | Onde |
|---|---|---|
| **E-mail + templates** | **EXISTE** | `auth-gateway/src/email/email.service.ts` (nodemailer/SMTP); templates em `gestao-ti/backend/src/email/email-templates.ts` (HTML em template string, **sem** engine); mailhog/greenmail em dev |
| **Notificação in-app** | **EXISTE (Gestão TI)** | modelo `Notificacao` em `gestao-ti/backend/prisma/schema.prisma:2433` — **é do Workspace, não da plataforma** |
| **Push mobile** | **NÃO EXISTE** | — |
| **Cron / agendados** | **EXISTE** | `@nestjs/schedule`; 11 jobs (fiscal, auth-gateway, logística). Padrão: `@Cron('0 4 * * *', { name, timeZone: 'America/Sao_Paulo' })` |
| **Filas** | **PARCIAL** | **BullMQ só no Fiscal** (`fiscal/backend/src/bullmq/`). Os demais não usam |
| **Upload / storage** | **EXISTE** | `multer` (`gestao-ti/backend/src/common/helpers/multer-upload.helper.ts`); **MinIO** para binários com retenção (`logistica/backend/src/cofre/`) |
| **PDF** | **EXISTE (Fiscal)** | `pdfkit` — DANFE/DACTE em `fiscal/backend/src/{nfe,cte}/pdf/`. Específico de documento fiscal, não genérico |
| **Excel** | **EXISTE (Gestão TI)** | `exceljs` |
| **Log de auditoria** | **PARCIAL** | `core.system_logs` (`SystemLog`: level/message/module/action/usuarioId/metadata) com retenção por cron. **Não há trilha automática** de quem alterou o quê — é gravação manual |
| **Logging / erro** | **EXISTE** | `nestjs-pino` (JSON) + filtro global `AllExceptionsFilter` por módulo |
| **Feature flags / parametrização** | **PARCIAL** | `core.system_config` (key/value) e `core.departamento_funcionalidade`. **Não é** um sistema de flags |
| **i18n** | **NÃO EXISTE** | tudo em pt-BR literal no código |
| **Cache** | **PARCIAL** | Redis presente; usado para sessão/presença e BullMQ. **Sem** `CacheModule` de resposta HTTP |
| **Testes** | **PARCIAL** | Jest nos NestJS (auth 41 · TI 109 · fiscal 54 · logística 363 · app 71) e pytest no Inventário (121). Testa-se **regra de negócio, guard e parser**, com Prisma mockado. **Não há** teste de componente React nem E2E. Cobertura não medida |
| **CI/CD** | **NÃO EXISTE** | Sem GitHub Actions/GitLab CI/Jenkins. Deploy é **manual por roteiro escrito**: `git pull` + `docker compose build` + `up -d`, com os jobs `*-migrate` aplicando as migrations no startup |

---

## 10. Mapa de reuso para o módulo novo

| Recurso que Avaliação/Clima vai precisar | Situação | Onde / o que falta |
|---|---|---|
| **Cadastro de colaborador** | **PARCIAL** | `core.usuarios` só tem **quem tem login**. Sem admissão, cargo estruturado, hierarquia. Quem não usa sistema **não existe** na base |
| **Hierarquia gestor→liderado** | **NÃO EXISTE** (genérica) | Só recortes por módulo: `Supervisor.coordenadorId` (logística), `Equipe`+membros (TI). Protheus **não** expõe hierarquia hoje (`infoFuncionario` devolve 3 campos) |
| **Estrutura organizacional** | **EXISTE** | `core`: Empresa → Filial → Departamento → CentroCusto. Multi-filial do usuário em `UsuarioFilial` |
| **Perfis e permissões por escopo** | **EXISTE** | `core.permissoes_modulo` (usuário × módulo × departamento × role) + `RolesGuard`. Basta cadastrar o módulo e seus papéis |
| **Formulários dinâmicos** | **NÃO EXISTE** | Todos os formulários são estáticos, codificados à mão. Não há schema-driven form |
| **Questionários / banco de perguntas** | **NÃO EXISTE** | Nada equivalente na plataforma |
| **Notificação por e-mail** | **EXISTE** | `auth-gateway/src/email/email.service.ts`. Templates são string HTML — **falta engine** se precisar de e-mail rico |
| **Agendamento de disparo** | **PARCIAL** | `@nestjs/schedule` resolve cron fixo. **Falta** agendamento por data escolhida em runtime (BullMQ delayed jobs existe **só no Fiscal**) |
| **Dashboards e gráficos** | **PARCIAL** | `recharts` já usado em 2 frontends — **copiar, não instalar**. Não há componente de gráfico compartilhado |
| **Exportação (Excel/PDF)** | **PARCIAL** | `exceljs` (TI) e `pdfkit` (Fiscal) existem, mas **acoplados aos seus domínios**. Não há utilitário genérico |
| **Log de auditoria** | **PARCIAL** | `core.system_logs` serve, mas a gravação é manual |
| **Acesso mobile** | **PARCIAL** | Web é responsiva por Tailwind, **sem PWA**. O app Expo é do entregador — reaproveitar exigiria decisão de produto |
| **Login sem e-mail corporativo** | **EXISTE** | Login é por **`username`**; `email` é opcional. Há ainda o caminho matrícula+senha do portal RH (`autenticaPortal`) e contas `PADRAO` compartilhadas |
| **Anonimato (clima)** | **NÃO EXISTE** | Nenhum mecanismo de resposta anônima/desidentificada. ⚠️ Ponto crítico para pesquisa de clima |

---

## 11. Restrições, dívidas e armadilhas

**Coisas que um dev novo faria errado por não saber:**

1. **`@@schema` obrigatório.** Modelo ou enum sem ele quebra a geração do client.
2. **`prisma migrate dev` RESETA o banco na Logística.** Usar `migrate diff` + `deploy`.
3. **`_prisma_migrations` mora no schema `public`**, não no do módulo.
4. **Typecheck de frontend é `tsc -b`, nunca `--noEmit`.** O `tsconfig.json` deles é
   arquivo-solução (`files: []`) — com `--noEmit` o tsc **checa zero arquivo e sai 0**,
   dando aprovação falsa. Já passou erro proposital por aí.
5. **Não ler `modulos[].role` do JWT** — é denormalizado e `@deprecated`; enxerga um
   papel e ignora os outros, calado. Usar o helper de roles.
6. **Não há RLS.** Esqueceu `assertMesmaFilial`/`resolverFilialLeitura`? Vaza filial.
7. **`ValidationPipe` é estrito** (`forbidNonWhitelisted`): campo fora do DTO = 400.
8. **Rota estática antes da paramétrica**, senão `:id` engole `grid`/`minhas`.
9. **Após rebuild de container, `nginx -s reload`** — IP novo, nginx com o antigo em
   cache = **502**.
10. **Os jobs `*-migrate` têm build próprio.** Não rebuildar = rodam com imagem velha
    e imprimem *"No pending migrations"*, que é **mensagem de sucesso com resultado
    errado**.
11. **`database/` na raiz é abandonado** — migration ali não roda (já custou 5 meses
    de escrita bloqueada em silêncio).
12. **DEV aponta para o Protheus de PRODUÇÃO.**

**Dívidas estruturais:**

- **Sem CI/CD.** Nada roda automaticamente: lint, teste e typecheck dependem de
  disciplina. Deploy é manual, por roteiro escrito.
- **Sem contrato de API.** Front redeclara tipos; divergência só aparece em runtime.
- **Componentes duplicados** entre frontends (Toast, PasswordInput, ConfirmDialog…).
  Não há pacote compartilhado — copiar é o padrão de fato.
- **Sem biblioteca de formulário/tabela.** Todo formulário e toda tabela são
  reescritos do zero. Para um módulo de questionários isso é significativo.
- **Padrões inconsistentes entre módulos:** Inventário é Python/SQLAlchemy com
  migrations SQL; os outros são NestJS/Prisma. BullMQ só no Fiscal. Notificação
  in-app só no Workspace. Recharts só em dois frontends.
- **Auditoria não é automática.** Quem quiser trilha, grava à mão.
- **Sem anonimato/pseudonimização** — relevante para clima e para LGPD.
- **Teste só de backend.** Zero teste de componente React ou E2E.
- **`configurador` não tem backend próprio** — consome `/api/v1/core/` do
  auth-gateway. Módulo novo que precise de tela administrativa segue esse padrão ou
  cria backend próprio.
- **Segurança recém-corrigida (15/08)**, que revela a classe de risco: controllers em
  `/api/v1/core/` com apenas `JwtAuthGuard` (sem checagem de papel) — o auth-gateway
  **não tem RolesGuard global**. Ao criar rota lá, o guard tem de ser explícito.

**Limitações de infraestrutura:**
- Um Postgres para tudo (schemas separados, mas mesma instância)
- Sem réplica de leitura; relatórios pesados batem no banco de produção
- Redis usado como sessão/fila; sem política de cache formalizada
- `INCERTO — verificar`: recursos do servidor de produção (CPU/RAM/disco)

---

## 12. Perguntas abertas

Não foi possível determinar pelo código:

1. **Fonte da hierarquia gestor→liderado.** O Protheus tem `SRA`/`SQ3` com
   superior imediato? Hoje **nada** disso é consumido, e `infoFuncionario` devolve
   só `{matricula, nome, cc}`. **Sem responder isso, um módulo de avaliação não tem
   como saber quem avalia quem.**
2. **Colaborador sem login.** A avaliação alcança quem não usa sistema (operacional,
   campo)? Hoje `core.usuarios` só tem quem tem login — e **119 dos 127 usuários
   INDIVIDUAL ativos em DEV estão sem matrícula** (em produção estão sendo preenchidas).
3. **Anonimato na pesquisa de clima.** Respostas anônimas de verdade, ou
   identificadas com acesso restrito? Muda o modelo de dados na origem.
4. **Retenção e LGPD** de avaliação e clima. Não há política formal no código.
5. **Ambiente de produção:** capacidade do servidor, janela de manutenção, política de
   backup para dados sensíveis de RH. `INCERTO — verificar`.
6. **Quem é o "RH" no modelo de permissão** — departamento existente, papéis novos?
7. **Integração com folha/ponto** (se houver outro sistema além do Protheus).
8. **Volume esperado:** ~1.000 colaboradores × quantos ciclos/ano × quantas perguntas
   — define se a leitura pode ser síncrona ou precisa de fila/materialização.
9. **`NÃO IDENTIFICADO`:** política formal de versionamento/release da plataforma
   (não há tags nem changelog automatizado no repositório).
