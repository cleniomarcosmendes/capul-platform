# Capul Platform - Documentacao Tecnica v1

> Documento gerado em: Fevereiro/2026
> Versao: 1.0 — Fase 6C (Final)

---

## 1. Visao Geral

A **Capul Platform** e uma plataforma corporativa modular que centraliza a gestao de TI, inventario, autenticacao e cadastros em uma unica infraestrutura. A arquitetura e composta por microservicos independentes acessados atraves de um reverse proxy (Nginx) com SSL, compartilhando um unico banco PostgreSQL multi-schema e autenticacao JWT.

### Diagrama de Componentes

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
| **Inventario Backend** | FastAPI + Python | 8000 | `inventario` |
| **Inventario Frontend** | HTML + Bootstrap 5 | 8443 | - |
| **PostgreSQL** | PostgreSQL 16 | 5432 | Multi-schema |
| **Redis** | Redis 7 | 6379 | Cache/sessoes |
| **PgAdmin** | PgAdmin 4 | 5050 | - |

---

## 2. Stack Tecnologico

### Backend (Gestao TI)
- **Runtime**: Node.js 22
- **Framework**: NestJS 11
- **ORM**: Prisma 6 (multi-schema)
- **Autenticacao**: Passport + JWT (@nestjs/jwt, @nestjs/passport)
- **Validacao**: class-validator + class-transformer
- **Excel**: ExcelJS 4 (import/export .xlsx)
- **Linguagem**: TypeScript 5.7 (`isolatedModules: true`, `module: nodenext`)
- **Testes**: Jest 30 + ts-jest 29 + @nestjs/testing
- **Build**: NestJS CLI (nest build)

### Frontend (Gestao TI)
- **Framework**: React 19
- **Bundler**: Vite 7
- **CSS**: Tailwind CSS v4 (plugin `@tailwindcss/vite`)
- **Roteamento**: React Router 7
- **Icones**: Lucide React
- **HTTP**: Fetch API nativa
- **Linguagem**: TypeScript 5.7 (strict mode)

### Infraestrutura
- **Container**: Docker 28 + Docker Compose
- **Proxy**: Nginx com SSL (certificados em `nginx/certs/`)
- **Banco**: PostgreSQL 16 (schemas isolados por modulo)
- **Cache**: Redis 7
- **Package Manager**: npm 10.9

---

## 3. Estrutura de Modulos (Gestao TI Backend)

O backend possui **16 controllers** com **~150 endpoints** organizados em modulos NestJS:

| Modulo | Controller | Endpoints | Funcionalidade |
|--------|-----------|-----------|----------------|
| **EquipeModule** | `/equipes` | 8 | CRUD equipes, membros, status |
| **CatalogoServicoModule** | `/catalogo-servicos` | 5 | CRUD catalogo, ativar/inativar |
| **SlaModule** | `/sla` | 5 | CRUD definicoes SLA por equipe+prioridade |
| **ChamadoModule** | `/chamados` | 12 | Workflow completo: abertura, assumir, transferir, comentar, resolver, fechar, reabrir, cancelar, CSAT |
| **OrdemServicoModule** | `/ordens-servico` | 4 | CRUD ordens vinculadas a chamados |
| **SoftwareModule** | `/softwares` | 13 | CRUD softwares, modulos, filiais N:N |
| **LicencaModule** | `/licencas` | 6 | CRUD licencas, renovar, inativar |
| **ContratoModule** | `/contratos` | 16 | CRUD contratos, parcelas, rateio, licencas vinculadas |
| **ParadaModule** | `/paradas` | 6 | CRUD paradas, finalizar, cancelar |
| **ProjetoModule** | `/projetos` | 41 | CRUD projetos hierarquicos (3 niveis), fases, atividades, membros RACI, terceirizados, cotacoes, custos, riscos, dependencias, anexos, apontamentos |
| **AtivoModule** | `/ativos` | 9 | CRUD ativos (CMDB), softwares instalados |
| **ConhecimentoModule** | `/conhecimento` | 6 | CRUD artigos base de conhecimento |
| **NotificacaoModule** | `/notificacoes` | 5 | Listar, contar, marcar lida, excluir |
| **DashboardModule** | `/dashboard` | 4 | Dashboard operacional, executivo, disponibilidade, financeiro |
| **ExportModule** | `/export` | 1 | Export xlsx (7 entidades) |
| **ImportModule** | `/import` | 2 | Import xlsx com preview+execucao (ativos, softwares) |

---

## 4. Modelo de Dados

### Schemas

- **`core`** (somente leitura no Gestao TI): 4 modelos — `Filial`, `Usuario`, `CentroCusto`, `Departamento`
- **`gestao_ti`**: 35 modelos + 38 enums

### Modelos por Fase

| Fase | Modelos | Descricao |
|------|---------|-----------|
| 1 | `EquipeTI`, `MembroEquipe` | Equipes de TI e seus membros |
| 2 | `CatalogoServico`, `SlaDefinicao`, `Chamado`, `HistoricoChamado`, `OrdemServico` | Suporte: chamados e SLA |
| 2B | `Software`, `SoftwareModulo`, `SoftwareFilial`, `ModuloFilial`, `SoftwareLicenca` | Portfolio de softwares e licencas |
| 3 | `Contrato`, `ParcelaContrato`, `ContratoRateioConfig`, `ContratoRateioItem`, `ContratoHistorico` | Contratos e financeiro |
| 4 | `RegistroParada`, `ParadaFilialAfetada` | Sustentacao e disponibilidade |
| 5 | `Projeto`, `MembroProjeto`, `TerceirizadoProjeto`, `FaseProjeto`, `AtividadeProjeto`, `CotacaoProjeto`, `CustoProjeto`, `RiscoProjeto`, `DependenciaProjeto`, `AnexoProjeto`, `ApontamentoHoras` | Projetos de TI |
| 6A | `Ativo`, `AtivoSoftware`, `ArtigoConhecimento` | CMDB e base de conhecimento |
| 6B | `Notificacao` | Notificacoes in-app |

### Enums (38 total)

| Categoria | Enums |
|-----------|-------|
| Gerais | `StatusGeral`, `Prioridade` |
| Chamados | `StatusChamado`, `Visibilidade`, `TipoHistorico`, `StatusOS` |
| Software | `TipoSoftware`, `Criticidade`, `AmbienteSoftware`, `StatusSoftware`, `StatusModulo` |
| Licencas | `ModeloLicenca`, `StatusLicenca` |
| Contratos | `TipoContrato`, `StatusContrato`, `ModalidadeRateio`, `StatusParcela`, `TipoHistoricoContrato` |
| Sustentacao | `TipoParada`, `ImpactoParada`, `StatusParada` |
| Projetos | `TipoProjeto`, `ModoProjeto`, `StatusProjeto`, `PapelRaci`, `StatusFase`, `StatusCotacao`, `CategoriaCusto`, `ProbabilidadeRisco`, `ImpactoRisco`, `StatusRisco`, `TipoDependencia`, `TipoAnexo` |
| Ativos | `TipoAtivo`, `StatusAtivo` |
| Conhecimento | `CategoriaArtigo`, `StatusArtigo` |
| Notificacoes | `TipoNotificacao` |

---

## 5. API Reference

Todos os endpoints do Gestao TI Backend usam o prefixo base configurado no Nginx.
Autenticacao via header `Authorization: Bearer <jwt_token>`.

### Equipes (`/equipes`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/equipes` | Todos | Listar equipes |
| GET | `/equipes/:id` | Todos | Detalhe com membros |
| POST | `/equipes` | ADMIN, GESTOR_TI | Criar equipe |
| PATCH | `/equipes/:id` | ADMIN, GESTOR_TI | Atualizar equipe |
| PATCH | `/equipes/:id/status` | ADMIN, GESTOR_TI | Ativar/inativar |
| POST | `/equipes/:id/membros` | ADMIN, GESTOR_TI | Adicionar membro |
| PATCH | `/equipes/:id/membros/:membroId` | ADMIN, GESTOR_TI | Atualizar membro (lider/status) |
| DELETE | `/equipes/:id/membros/:membroId` | ADMIN, GESTOR_TI | Remover membro |

### Chamados (`/chamados`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/chamados` | Todos | Listar (filtros: status, equipe, visibilidade, meusChamados, projetoId) |
| GET | `/chamados/:id` | Todos | Detalhe com historico/timeline |
| POST | `/chamados` | Todos | Abrir chamado |
| POST | `/chamados/:id/assumir` | ADMIN, GESTOR_TI, TECNICO | Assumir chamado |
| POST | `/chamados/:id/transferir-equipe` | ADMIN, GESTOR_TI, TECNICO | Transferir para outra equipe |
| POST | `/chamados/:id/transferir-tecnico` | ADMIN, GESTOR_TI, TECNICO | Atribuir a tecnico |
| POST | `/chamados/:id/comentar` | Todos | Adicionar comentario |
| PATCH | `/chamados/:id/resolver` | ADMIN, GESTOR_TI, TECNICO | Marcar como resolvido |
| PATCH | `/chamados/:id/fechar` | Todos | Fechar chamado resolvido |
| POST | `/chamados/:id/reabrir` | Todos | Reabrir chamado |
| PATCH | `/chamados/:id/cancelar` | ADMIN, GESTOR_TI, TECNICO | Cancelar chamado |
| POST | `/chamados/:id/avaliar` | Solicitante | Avaliar satisfacao (CSAT) |

### Softwares (`/softwares`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/softwares` | Todos | Listar softwares |
| GET | `/softwares/:id` | Todos | Detalhe com modulos e filiais |
| POST | `/softwares` | ADMIN, GESTOR_TI | Criar software |
| PATCH | `/softwares/:id` | ADMIN, GESTOR_TI | Atualizar software |
| PATCH | `/softwares/:id/status` | ADMIN, GESTOR_TI | Ativar/inativar |
| POST | `/softwares/:id/filiais` | ADMIN, GESTOR_TI | Vincular filial |
| DELETE | `/softwares/:id/filiais/:filialId` | ADMIN, GESTOR_TI | Desvincular filial |
| GET | `/softwares/:id/modulos` | Todos | Listar modulos |
| POST | `/softwares/:id/modulos` | ADMIN, GESTOR_TI | Criar modulo |
| PATCH | `/softwares/:id/modulos/:moduloId` | ADMIN, GESTOR_TI | Atualizar modulo |
| PATCH | `/softwares/:id/modulos/:moduloId/status` | ADMIN, GESTOR_TI | Status modulo |
| POST | `/softwares/:id/modulos/:moduloId/filiais` | ADMIN, GESTOR_TI | Vincular filial ao modulo |
| DELETE | `/softwares/:id/modulos/:moduloId/filiais/:filialId` | ADMIN, GESTOR_TI | Desvincular |

### Licencas (`/licencas`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/licencas` | Todos | Listar licencas |
| GET | `/licencas/:id` | Todos | Detalhe |
| POST | `/licencas` | ADMIN, GESTOR_TI | Criar licenca |
| PATCH | `/licencas/:id` | ADMIN, GESTOR_TI | Atualizar |
| POST | `/licencas/:id/renovar` | ADMIN, GESTOR_TI | Renovar licenca (nova vigencia) |
| POST | `/licencas/:id/inativar` | ADMIN, GESTOR_TI | Inativar licenca |

### Contratos (`/contratos`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/contratos` | Todos | Listar contratos |
| GET | `/contratos/:id` | Todos | Detalhe com parcelas e rateio |
| POST | `/contratos` | ADMIN, GESTOR_TI | Criar contrato |
| PATCH | `/contratos/:id` | ADMIN, GESTOR_TI | Atualizar |
| PATCH | `/contratos/:id/status` | ADMIN, GESTOR_TI | Alterar status |
| POST | `/contratos/:id/renovar` | ADMIN, GESTOR_TI | Renovar contrato |
| GET | `/contratos/:id/parcelas` | Todos | Listar parcelas |
| POST | `/contratos/:id/parcelas` | ADMIN, GESTOR_TI | Criar parcela |
| PATCH | `/contratos/:id/parcelas/:pid` | ADMIN, GESTOR_TI | Atualizar parcela |
| POST | `/contratos/:id/parcelas/:pid/pagar` | ADMIN, GESTOR_TI | Registrar pagamento |
| POST | `/contratos/:id/parcelas/:pid/cancelar` | ADMIN, GESTOR_TI | Cancelar parcela |
| GET | `/contratos/:id/rateio` | Todos | Ver config rateio |
| POST | `/contratos/:id/rateio/simular` | ADMIN, GESTOR_TI | Simular rateio |
| POST | `/contratos/:id/rateio` | ADMIN, GESTOR_TI | Aplicar rateio |
| POST | `/contratos/:id/licencas` | ADMIN, GESTOR_TI | Vincular licenca |
| DELETE | `/contratos/:id/licencas/:licId` | ADMIN, GESTOR_TI | Desvincular licenca |

### Paradas (`/paradas`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/paradas` | Todos | Listar paradas |
| GET | `/paradas/:id` | Todos | Detalhe com filiais afetadas |
| POST | `/paradas` | ADMIN, GESTOR_TI, TECNICO | Registrar parada |
| PATCH | `/paradas/:id` | ADMIN, GESTOR_TI, TECNICO | Atualizar |
| POST | `/paradas/:id/finalizar` | ADMIN, GESTOR_TI, TECNICO | Finalizar parada |
| POST | `/paradas/:id/cancelar` | ADMIN, GESTOR_TI, TECNICO | Cancelar parada |

### Projetos (`/projetos`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/projetos` | Todos | Listar (filtros: tipo, modo, status, softwareId, apenasRaiz) |
| GET | `/projetos/:id` | Todos | Detalhe completo |
| POST | `/projetos` | ADMIN, GESTOR_TI | Criar projeto |
| PATCH | `/projetos/:id` | ADMIN, GESTOR_TI | Atualizar |
| DELETE | `/projetos/:id` | ADMIN, GESTOR_TI | Excluir projeto |
| POST/GET/DELETE | `/projetos/:id/membros` | ADMIN, GESTOR_TI | Gestao membros RACI |
| POST/GET/PATCH/DELETE | `/projetos/:id/fases` | ADMIN, GESTOR_TI | Gestao fases |
| POST/GET | `/projetos/:id/atividades` | ADMIN, GESTOR_TI | Atividades (kanban) |
| POST/GET/PATCH/DELETE | `/projetos/:id/cotacoes` | ADMIN, GESTOR_TI | Cotacoes orcamentarias |
| POST/GET/PATCH/DELETE | `/projetos/:id/custos-detalhados` | ADMIN, GESTOR_TI | Custos realizados |
| POST/GET/PATCH/DELETE | `/projetos/:id/riscos` | ADMIN, GESTOR_TI | Gestao de riscos |
| POST/GET/DELETE | `/projetos/:id/dependencias` | ADMIN, GESTOR_TI | Dependencias entre projetos |
| POST/GET/DELETE | `/projetos/:id/anexos` | ADMIN, GESTOR_TI | Anexos |
| POST/GET/DELETE | `/projetos/:id/apontamentos` | Todos | Apontamento de horas |
| GET | `/projetos/:id/chamados` | Todos | Chamados vinculados |
| GET | `/projetos/:id/custos` | ADMIN, GESTOR_TI | Resumo financeiro |
| GET | `/projetos/:id/terceirizados` | ADMIN, GESTOR_TI | Listar terceirizados |
| POST | `/projetos/:id/terceirizados` | ADMIN, GESTOR_TI | Adicionar terceirizado |
| PATCH | `/projetos/:id/terceirizados/:tid` | ADMIN, GESTOR_TI | Atualizar terceirizado |
| DELETE | `/projetos/:id/terceirizados/:tid` | ADMIN, GESTOR_TI | Remover terceirizado |
| GET | `/projetos/meus-projetos-terceirizado` | TERCEIRIZADO | Projetos do terceirizado logado |

### Ativos (`/ativos`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/ativos` | Todos | Listar ativos |
| GET | `/ativos/:id` | Todos | Detalhe |
| POST | `/ativos` | ADMIN, GESTOR_TI, TECNICO | Criar ativo |
| PATCH | `/ativos/:id` | ADMIN, GESTOR_TI, TECNICO | Atualizar |
| PATCH | `/ativos/:id/status` | ADMIN, GESTOR_TI, TECNICO | Alterar status |
| DELETE | `/ativos/:id` | ADMIN, GESTOR_TI | Excluir ativo |
| GET | `/ativos/:id/softwares` | Todos | Softwares instalados |
| POST | `/ativos/:id/softwares` | ADMIN, GESTOR_TI, TECNICO | Vincular software |
| DELETE | `/ativos/:id/softwares/:softwareId` | ADMIN, GESTOR_TI, TECNICO | Desvincular software |

### Conhecimento (`/conhecimento`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/conhecimento` | Todos | Listar artigos |
| GET | `/conhecimento/:id` | Todos | Detalhe do artigo |
| POST | `/conhecimento` | ADMIN, GESTOR_TI, TECNICO | Criar artigo |
| PATCH | `/conhecimento/:id` | ADMIN, GESTOR_TI, TECNICO | Atualizar |
| PATCH | `/conhecimento/:id/status` | ADMIN, GESTOR_TI | Publicar/arquivar |
| DELETE | `/conhecimento/:id` | ADMIN, GESTOR_TI | Excluir artigo |

### Dashboard (`/dashboard`)

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/dashboard` | Todos | Resumo operacional |
| GET | `/dashboard/executivo` | ADMIN, GESTOR_TI | Dashboard executivo |
| GET | `/dashboard/disponibilidade` | ADMIN, GESTOR_TI, TECNICO | Metricas disponibilidade |
| GET | `/dashboard/financeiro` | ADMIN, GESTOR_TI | Dashboard financeiro |

### Utilitarios

| Metodo | Rota | Roles | Descricao |
|--------|------|-------|-----------|
| GET | `/export/:entidade` | ADMIN, GESTOR_TI, TECNICO, DESENV | Exportar entidade para .xlsx |
| POST | `/import/preview` | ADMIN, GESTOR_TI | Preview importacao xlsx |
| POST | `/import/executar` | ADMIN, GESTOR_TI | Executar importacao |
| GET | `/notificacoes` | Todos | Listar notificacoes |
| GET | `/notificacoes/count` | Todos | Contar nao lidas |
| PATCH | `/notificacoes/ler-todas` | Todos | Marcar todas como lidas |
| PATCH | `/notificacoes/:id/lida` | Todos | Marcar uma como lida |
| DELETE | `/notificacoes/:id` | Todos | Remover notificacao |

---

## 6. Autenticacao e Autorizacao

### Fluxo JWT

```
1. Usuario faz login via Auth Gateway (POST /api/v1/auth/login)
2. Auth Gateway valida credenciais e retorna { accessToken, refreshToken }
3. Frontend armazena tokens em localStorage
4. Todas as requisicoes incluem header: Authorization: Bearer <accessToken>
5. Cada backend valida o JWT usando o mesmo JWT_SECRET compartilhado
6. accessToken expira em 15min, refreshToken em 7 dias
7. Frontend faz refresh automatico antes da expiracao
```

### JWT Payload

```typescript
{
  sub: string;       // userId
  email: string;
  nome: string;
  empresaId: string;
  filialId: string;  // filial atual
  modulos: [         // modulos com acesso
    { codigo: 'GESTAO_TI', role: 'ADMIN' }
  ]
}
```

### Guard Chain (Gestao TI)

```
Request → JwtAuthGuard → GestaoTiGuard → RolesGuard → Controller
```

1. **JwtAuthGuard** (global): Valida o JWT e popula `req.user` com o payload decodificado
2. **GestaoTiGuard** (global no modulo): Verifica se o usuario tem o modulo `GESTAO_TI` nos seus modulos. Extrai a role e coloca em `req.gestaoTiRole`
3. **RolesGuard** (por endpoint): Verifica se `req.gestaoTiRole` esta na lista de roles permitidas pelo decorator `@Roles(...)`

### Roles Disponiveis

| Role | Descricao | Nivel de Acesso |
|------|-----------|-----------------|
| `ADMIN` | Administrador do sistema | Acesso total |
| `GESTOR_TI` | Gestor de TI | Gestao completa |
| `TECNICO` | Tecnico de suporte | Operacoes tecnicas |
| `DESENVOLVEDOR` | Desenvolvedor | Acesso a projetos e chamados |
| `MANUTENCAO` | Manutencao | Operacoes de manutencao |
| `INFRAESTRUTURA` | Infraestrutura | Operacoes de infraestrutura |
| `USUARIO_FINAL` | Usuario comum | Apenas seus chamados |
| `USUARIO_CHAVE` | Usuario-chave de projetos | Acesso limitado a pendencias |
| `TERCEIRIZADO` | Analista externo | Acesso restrito a projetos vinculados |

> **Nota**: Para detalhamento completo das permissoes por role, consulte `roles-permissoes.md`

### Decorators Customizados

- `@CurrentUser('sub')` — Extrai campo do JWT payload (substitui `@Req()`)
- `@GestaoTiRole()` — Retorna a role string do usuario no modulo
- `@Roles('ADMIN', 'GESTOR_TI')` — Define roles permitidas no endpoint
- `@Public()` — Marca endpoint como publico (sem autenticacao)

---

## 7. Fluxos de Negocio

### 7.1 Workflow de Chamados

```
ABERTO → EM_ATENDIMENTO → RESOLVIDO → FECHADO
  |           |               |
  |           |               ↓
  |           |           REABERTO → (volta ABERTO)
  |           |
  ↓           ↓
CANCELADO   PENDENTE → ABERTO (via assumir)
```

**Acoes por status:**
- `ABERTO`: assumir, transferir equipe, comentar, cancelar
- `EM_ATENDIMENTO`: transferir equipe/tecnico, comentar, resolver, cancelar
- `PENDENTE`: assumir, transferir, comentar, cancelar
- `RESOLVIDO`: fechar, reabrir, avaliar (CSAT)
- `FECHADO`: reabrir, avaliar (CSAT)
- `CANCELADO`: terminal

**SLA**: Calculado na abertura com base na equipe + prioridade. `dataLimiteSla` = now + horasResolucao. Dashboard mostra % compliance.

**Notificacoes automaticas**: Disparadas fire-and-forget em assumir, transferir, comentar, resolver e fechar.

### 7.2 Gestao de Contratos

```
RASCUNHO → ATIVO → (SUSPENSO ↔ ATIVO) → ENCERRADO
                                              |
                                          CANCELADO
```

**Parcelas**: PENDENTE → PAGA ou CANCELADA. Parcelas atrasadas = dataVencimento < hoje e status PENDENTE.

**Rateio**: Distribuicao do custo do contrato entre centros de custo. Modalidades: PROPORCIONAL_HEADCOUNT, IGUALITARIO, MANUAL. Simulacao antes de aplicar.

### 7.3 Projetos

**Hierarquia**: Ate 3 niveis (projeto → subprojeto → sub-subprojeto). Controle via `paiId` e `nivel`.

**Modos**: SIMPLES (apenas campos basicos) e COMPLETO (fases, custos detalhados, cotacoes, riscos).

```
PLANEJAMENTO → EM_ANDAMENTO → (PAUSADO ↔ EM_ANDAMENTO) → CONCLUIDO
                                                              |
                                                          CANCELADO
```

**Matriz RACI**: Membros do projeto com papeis Responsavel/Aprovador/Consultado/Informado.

### 7.4 Notificacoes In-App

Notificacoes sao criadas fire-and-forget (sem `await`) para nao bloquear a operacao principal.

**Tipos**: CHAMADO_ATRIBUIDO, CHAMADO_ATUALIZADO, SLA_ESTOURADO, LICENCA_VENCENDO, CONTRATO_VENCENDO, PARCELA_ATRASADA, PARADA_INICIADA, PROJETO_ATUALIZADO, GERAL.

**Frontend**: Polling a cada 60 segundos para contagem de nao lidas. Badge no icone de sino no header.

---

## 8. Guia de Deploy

### Pre-requisitos

- Docker >= 28.0
- Docker Compose >= 2.0
- Certificados SSL em `nginx/certs/` (ou gerar com mkcert para dev)

### Variaveis de Ambiente

Criar `.env` na raiz baseado em `.env.example`:

```env
DB_USER=capul_user
DB_PASSWORD=<senha_segura>
DB_NAME=capul_platform
DB_PORT=5432
JWT_SECRET=<chave_64_caracteres>
JWT_REFRESH_SECRET=<outra_chave_diferente>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
REDIS_URL=redis://redis:6379
PGADMIN_EMAIL=admin@capul.com
PGADMIN_PASSWORD=<senha_pgadmin>
```

### Subir a plataforma

```bash
# Na raiz do projeto
docker compose up -d

# Verificar logs
docker compose logs -f gestao-ti-backend

# Rodar migrations (primeira vez)
docker compose exec gestao-ti-backend npx prisma migrate deploy
```

### Estrutura de containers

| Container | Imagem | Portas |
|-----------|--------|--------|
| capul-nginx | nginx:1.27 | 80→80, 443→443 |
| capul-db | postgres:16 | 5432→5432 |
| capul-redis | redis:7 | 6379→6379 |
| capul-auth | node:22 | 3000→3000 |
| capul-hub | node:22 | 5170→5170 |
| capul-gestao-ti-api | node:22 | 3001→3001 |
| capul-gestao-ti-web | node:22 | 5173→5173 |
| capul-pgadmin | pgadmin4 | 5050→5050 |

### Roteamento Nginx

```nginx
/              → Hub (:5170)
/api/v1/       → Auth Gateway (:3000)
/gestao-ti/    → Gestao TI Frontend (:5173)
/gestao-ti/api → Gestao TI Backend (:3001)
```

---

## 9. Guia de Desenvolvimento

### Setup local

```bash
# Backend
cd gestao-ti/backend
cp .env.example .env  # ajustar DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Frontend
cd gestao-ti/frontend
npm install
npm run dev
```

### Como adicionar novo modulo

1. **Schema Prisma** (`prisma/schema.prisma`):
   - Criar enums necessarios com `@@schema("gestao_ti")`
   - Criar model(s) com `@@schema("gestao_ti")` e `@@map("nome_tabela")`
   - `npx prisma migrate dev --name descricao`

2. **DTO** (`src/<modulo>/dto/`):
   - Classes com decorators `class-validator`
   - Usar classes (nao interfaces) por causa de `isolatedModules`

3. **Service** (`src/<modulo>/<modulo>.service.ts`):
   - Injetar `PrismaService`
   - Metodos CRUD + logica de negocio

4. **Controller** (`src/<modulo>/<modulo>.controller.ts`):
   - Guards: `@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)`
   - Decorators: `@Roles(...)`, `@CurrentUser('sub')`, `@GestaoTiRole()`

5. **Module** (`src/<modulo>/<modulo>.module.ts`):
   - Importar `PrismaModule`
   - Exportar service se necessario para outros modulos

6. **AppModule** (`src/app.module.ts`):
   - Adicionar novo module no array `imports`

7. **Testes** (`src/<modulo>/<modulo>.service.spec.ts`):
   - Usar `createPrismaMock()` de `common/testing/prisma-mock.ts`
   - `@nestjs/testing` com `Test.createTestingModule`

### Padroes do projeto

- **Imports `.js`**: Todos os imports relativos usam extensao `.js` (ESM / moduleResolution: nodenext)
- **Guards globais**: JwtAuth + GestaoTi + Roles aplicados em todos os controllers
- **DTOs explicitos**: Como `@nestjs/mapped-types` nao esta instalado, Update DTOs sao classes explicitas com `@IsOptional()`
- **Fire-and-forget**: Notificacoes disparadas com `.catch(() => {})` sem `await`
- **Read-only schema core**: Middleware bloqueia escrita no schema `core` (filiais, usuarios, etc.)
- **Testes**: Jest com `tsconfig.spec.json` (module: commonjs) + `moduleNameMapper` para extensoes `.js`

### Comandos uteis

```bash
# Backend
npm run start:dev     # Dev server com watch
npm test              # Rodar testes
npm run test:cov      # Testes com cobertura
npx nest build        # Build producao
npx prisma studio     # GUI do banco

# Frontend
npm run dev           # Dev server Vite
npx tsc --noEmit      # Type check
npx vite build        # Build producao
```

---

## 10. Testes

### Configuracao

- **Framework**: Jest 30 + ts-jest 29
- **Tipo**: Testes unitarios nos services (logica de negocio)
- **Mock**: Prisma mockado via factory `createPrismaMock()`
- **Config**: `tsconfig.spec.json` com `module: commonjs` para compatibilidade com ts-jest

### Cobertura de Testes (41 testes)

| Service | Testes | Foco |
|---------|--------|------|
| NotificacaoService | 8 | CRUD, ownership, lote |
| ChamadoService | 12 | Workflow completo, SLA, permissoes, notificacoes |
| ConhecimentoService | 6 | CRUD, busca, publicacao |
| ImportService | 7 | Preview/validacao xlsx, entidades invalidas |
| DashboardService | 4 | Estrutura resumo/executivo, calculo SLA% |

### Executar testes

```bash
cd gestao-ti/backend
npm test                          # Todos os testes
npm test -- --testPathPattern=chamado  # Apenas chamado
npm run test:cov                  # Com cobertura
```

---

## 11. Frontend

### Estrutura

```
src/
  contexts/     AuthContext (JWT, usuario, modulos)
  layouts/      MainLayout, Sidebar, Header
  pages/        36 paginas organizadas por dominio
  services/     API clients (fetch)
  types/        Interfaces TypeScript
```

### Paginas (36 total)

| Dominio | Paginas | Descricao |
|---------|---------|-----------|
| Dashboard | 2 | Operacional + Executivo |
| Chamados | 3 | Lista, criacao, detalhe com timeline |
| Ordens Servico | 1 | Lista com CRUD inline |
| Softwares | 3 | CRUD com tabs (modulos/filiais/licencas) |
| Licencas | 1 | Lista com acoes inline |
| Contratos | 4 | CRUD + dashboard financeiro |
| Paradas | 4 | CRUD + dashboard disponibilidade |
| Projetos | 3 | CRUD completo |
| Ativos | 3 | CRUD (CMDB) |
| Conhecimento | 3 | CRUD base conhecimento |
| Equipes | 3 | CRUD equipes |
| Catalogo | 1 | CRUD inline servicos |
| SLA | 1 | CRUD inline definicoes |
| Departamentos | 1 | CRUD inline |
| Centros Custo | 1 | CRUD inline |
| Notificacoes | 1 | Lista com acoes |
| Importar | 1 | Wizard 3 etapas |

### Build

```
Frontend bundle: ~627KB JS + 30KB CSS (gzipped)
```
