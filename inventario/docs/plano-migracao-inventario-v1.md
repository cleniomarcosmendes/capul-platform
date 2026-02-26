# Plano de Migracao — Inventario para Capul Platform

**Data**: 25/02/2026
**Versao**: 1.1
**Status**: PROPOSTA (revisado — Abordagem B aprovada)

---

## 1. VISAO GERAL

### 1.1 Objetivo

Migrar o sistema de inventario standalone (`Capul_Inventario`, Python/FastAPI + HTML/Bootstrap5) para dentro da plataforma unificada (`capul-platform`), mantendo todas as funcionalidades existentes e proporcionando experiencia de usuario consistente com o modulo Gestao de TI.

### 1.2 Estado Atual

| Aspecto | Capul_Inventario (Standalone) | Capul Platform |
|---------|------------------------------|----------------|
| Backend | Python 3.11 + FastAPI + SQLAlchemy | NestJS 11 + Prisma 6 |
| Frontend | HTML/CSS/JS + Bootstrap 5 (15 paginas) | React 19 + Tailwind CSS v4 + Vite 7 |
| Auth | JWT proprio (tabela users propria) | Auth Gateway centralizado (JWT compartilhado) |
| Database | PostgreSQL 15, schema `inventario` | PostgreSQL 16, schemas `core` + `gestao_ti` |
| Cache | Redis 7 | Nao utiliza |
| Deploy | Docker independente (porta 8000/8443) | Docker Compose unificado (nginx reverse proxy) |
| Paginas | 15 HTML estaticas (~1.4MB a maior) | SPA React com router |
| API Routes | 111 endpoints em 18 modulos | ~ 80 endpoints |

### 1.3 Infraestrutura Ja Existente na Plataforma

A plataforma ja possui infraestrutura parcial para o inventario:
- **docker-compose.yml**: servicos `inventario-backend` e `inventario-frontend` definidos
- **auth-gateway seed**: modulo INVENTARIO registrado com 3 roles (ADMIN, SUPERVISOR, OPERATOR)
- **database/init-schemas.sql**: schema `inventario` criado
- **database/migrations**: 5 scripts de migracao core→inventario (stores, users, views, triggers)
- **Hub**: exibe card INVENTARIO dinamicamente via `usuario.modulos`

**NAO existe ainda**:
- Rotas nginx para inventario
- Frontend React
- Integracao real de auth (JWT da plataforma → FastAPI)

---

## 2. ANALISE DO SISTEMA ATUAL

### 2.1 Complexidade do Backend (111 endpoints)

| Modulo | Endpoints | Complexidade | Nucleo? |
|--------|-----------|--------------|---------|
| Auth | 4 | Media | Nao (sera substituido pelo Auth Gateway) |
| Inventory Lists | ~25 | **ALTA** | **SIM — NUCLEO** |
| Counting Lists | ~13 | **ALTA** | **SIM — NUCLEO** |
| Assignments/Cycle | ~20 | **ALTA** | **SIM — NUCLEO** |
| Products | ~10 | Media | Sim |
| Stores | 5 | Baixa | Nao (usara core.filiais) |
| Users | 6 | Baixa | Nao (usara core.usuarios) |
| Warehouses | 6 | Baixa | Sim |
| Import/Export | ~8 | Media | Sim |
| Protheus Integration | 7 | **ALTA** | Sim |
| Sync (Protheus) | 3 | Media | Sim |
| Monitoring | 4 | Baixa | Nao |
| Lot Draft | 5 | Media | Sim |
| Validation/Comparison | 5 | Media | Sim |

### 2.2 Nucleo: Sistema de Ciclos de Contagem (3 Ciclos)

Este e o ponto mais critico e complexo do sistema. O workflow:

```
INVENTARIO (DRAFT)
  |
  v
CRIAR LISTAS → Adicionar produtos → Congelar snapshots (SB1/SB2/SB8/SBZ)
  |
  v
CICLO 1: Atribuir contador → Liberar → Contagem → Registrar quantidades
  |
  v
ANALISE CICLO 1: Identificar divergencias (contado != esperado)
  |                                                |
  | Sem divergencias                               | Com divergencias
  v                                                v
APROVADO                            CICLO 2: Novo contador → Recontagem
                                      |
                                      v
                                    ANALISE CICLO 2: Comparar C1 vs C2
                                      |                        |
                                      | C1 == C2               | C1 != C2
                                      v                        v
                                    APROVADO          CICLO 3: Desempate
                                                        |
                                                        v
                                                      REGRAS DE MAIORIA:
                                                      C1==C3 → usa C1
                                                      C2==C3 → usa C2
                                                      Todos != → usa C3
```

**Tabelas envolvidas diretamente**:
- `inventory_lists` (cabecalho com status dual: status + list_status)
- `inventory_items` (itens com flags needs_recount_cycle_1/2/3 e count_cycle_1/2/3)
- `inventory_items_snapshot` (dados congelados 1:1)
- `inventory_lots_snapshot` (lotes congelados 1:N)
- `counting_lists` + `counting_list_items` (modo multiplas listas)
- `countings` + `counting_lots` (registros de contagem)
- `counting_assignments` (atribuicoes de contadores por ciclo)
- `discrepancies` (divergencias detectadas)
- `closed_counting_rounds` (rodadas encerradas)
- `cycle_audit_log` (auditoria de ciclos)

**Funcoes SQL criticas**:
- `advance_cycle()` — avanca ciclo automaticamente baseado em tolerancia
- `can_user_count()` — verifica permissao de contagem
- `validate_cycle_assignment()` — trigger de validacao

### 2.3 Integracao Protheus

O inventario se integra com o ERP Protheus via API REST:
- **URL**: `https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/hierarquiaMercadologica`
- **Auth**: Basic Auth (credenciais em .env)
- **Tabelas espelhadas**: SB1010, SB2010, SB8010, SBZ010, SLK010, DA1010, SBM010, SZD010, SZE010, SZF010
- **Funcionalidade**: Sincroniza hierarquia de produtos, saldos, lotes, precos e localizacoes

### 2.4 Frontend — Paginas Existentes

| Pagina | Arquivo | Complexidade | Tamanho |
|--------|---------|--------------|---------|
| Login | login.html | Media | ~500 linhas |
| **Gerenciamento de Lista** | **inventory.html** | **MUITO ALTA** | **~24.000 linhas (~1.4MB)** |
| Contagem (Desktop) | counting_improved.html | **ALTA** | ~5.200 linhas |
| Contagem (Mobile) | counting_mobile.html | Media | ~2.000 linhas |
| Dashboard | dashboard.html | Media | ~1.500 linhas |
| Produtos | products.html | Media | ~1.000 linhas |
| Lojas | stores.html | Baixa | ~500 linhas |
| Usuarios | users.html | Baixa | ~500 linhas |
| Relatorios | reports.html | Media | ~800 linhas |
| Divergencias | discrepancies.html | Media | ~600 linhas |
| Comparacao | comparison_results.html | Media | ~500 linhas |
| Import | import.html | Media | ~600 linhas |
| Integracao Protheus | integration_protheus.html | Alta | ~1.200 linhas |
| Monitoramento | admin_monitoring.html | Baixa | ~400 linhas |
| Transferencias | inventory_transfer_report.html | Baixa | ~400 linhas |

**Total**: ~35.000+ linhas de HTML/JS/CSS

---

## 3. ESTRATEGIA DE MIGRACAO

### 3.1 Opcoes Avaliadas

| Opcao | Descricao | Prós | Contras |
|-------|-----------|------|---------|
| **A** | Manter FastAPI, reescrever frontend em React | Menor risco backend, UI consistente | Dois backends (Python + NestJS) |
| **B** | Reescrever tudo em NestJS + React | Maximo de consistencia | ALTO risco, timeline longa, reescrever 111 endpoints |
| **C** | Integracao minima (nginx + auth) | Mais rapido | UI inconsistente, divida tecnica |

### 3.2 Opcao Recomendada: A (Hibrida)

**Manter o backend FastAPI** (111 endpoints, logica de ciclos complexa e testada) e **reescrever o frontend em React** (consistencia visual com Gestao TI).

**Justificativa**:
1. O backend tem **logica de negocios critica** (ciclos de contagem, snapshots, regras de maioria) que funciona e esta estabilizada
2. Reescrever 111 endpoints em NestJS seria arriscado e demorado sem ganho funcional
3. O frontend HTML/JS e o que mais impacta a experiencia do usuario — reescrevendo em React ganha-se consistencia visual
4. A plataforma ja suporta multiplos backends (nginx como reverse proxy)
5. Futuramente, se desejado, o backend pode ser migrado para NestJS de forma incremental

### 3.3 Arquitetura Final

```
                    ┌─────────────┐
                    │   NGINX     │ porta 80
                    │  (reverse   │
                    │   proxy)    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐──────────────────┐
        │                  │                  │                  │
   /api/v1/auth/      /api/v1/gestao-ti/ /api/v1/inventory/    / + /gestao-ti/ + /inventario/
        │                  │                  │                  │
   ┌────┴────┐      ┌─────┴─────┐     ┌─────┴─────┐     ┌─────┴─────┐
   │  Auth   │      │ Gestao TI │     │Inventario │     │    Hub    │
   │ Gateway │      │  Backend  │     │  Backend  │     │ Frontend  │
   │ NestJS  │      │  NestJS   │     │  FastAPI  │     │  React    │
   │ :3000   │      │  :3001    │     │  :8000    │     │  :5170    │
   └────┬────┘      └─────┬─────┘     └─────┬─────┘     └───────────┘
        │                  │                  │           + Gestao TI Web (:5173)
        │                  │                  │           + Inventario Web (:5174)
        │                  │                  │
        └──────────────────┴──────────────────┘
                           │
                    ┌──────┴──────┐
                    │ PostgreSQL  │
                    │ core │      │
                    │ gestao_ti │ │
                    │ inventario  │
                    └─────────────┘
```

---

## 4. PLANO DE SPRINTS

### Sprint 0: Infraestrutura, Auth e Sincronizacao Core ↔ Inventario (2-3 dias)

**Objetivo**: Unificar auth, resolver sincronizacao de filiais/usuarios, e conectar via nginx.

> **DECISAO**: Abordagem B — FastAPI consulta diretamente `core.filiais` e `core.usuarios`.
> Tabelas `inventario.stores`, `inventario.users`, `inventario.user_stores` ficam deprecated.
> Migrations 002-005 (views/triggers) NAO serao usadas.

---

#### 0.1 PROBLEMA IDENTIFICADO: Sincronizacao Quebrada

**Estado atual do banco**:
- `core.filiais`: 1 registro (codigo='01', UUID `35fe703e-...`)
- `core.usuarios`: 7 registros (admin, marco, etc.)
- `inventario.stores`: **0 registros** (VAZIO)
- `inventario.users`: **0 registros** (VAZIO)
- Views/Triggers: **NAO existem** (migrations 002-005 nunca executadas)

**JWT do Auth Gateway envia**:
```json
{
  "sub": "834567bb-...",
  "username": "admin",
  "filialId": "35fe703e-...",
  "filialCodigo": "01",
  "modulos": [{"codigo": "INVENTARIO", "role": "ADMIN"}]
}
```

**Inventario espera**:
```python
store_id = payload.get("store_id")   # ← NUNCA encontra! (campo nao existe)
role = payload.get("role")           # ← NUNCA encontra! (esta dentro de modulos[])
```

---

#### 0.2 Solucao: Adaptar FastAPI para ler direto do core (Abordagem B)

**Principio**: core.filiais e core.usuarios sao a **unica fonte de verdade**.
O inventario nao mantem mais copias — consulta direto no schema core.

**Passo 1 — Adicionar models SQLAlchemy para tabelas core** (read-only)

**Arquivo**: `inventario/backend/app/models/core_models.py` (NOVO)

```python
from sqlalchemy import Column, String, Boolean, DateTime
from app.core.database import Base

class CoreFilial(Base):
    """Read-only: core.filiais (gerenciada pelo Auth Gateway)"""
    __tablename__ = 'filiais'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    codigo = Column(String(10))
    nome_fantasia = Column(String(200))
    ativo = Column(Boolean, default=True)

class CoreUsuario(Base):
    """Read-only: core.usuarios (gerenciada pelo Auth Gateway)"""
    __tablename__ = 'usuarios'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    login = Column(String(50))
    nome = Column(String(200))
    email = Column(String(200))
    ativo = Column(Boolean, default=True)

class CoreUsuarioFilial(Base):
    """Read-only: core.usuario_filiais"""
    __tablename__ = 'usuario_filiais'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    usuario_id = Column(String)
    filial_id = Column(String)
    is_default = Column(Boolean)
```

**Passo 2 — Reescrever `security.py` para JWT da plataforma**

**Arquivo**: `inventario/backend/app/core/security.py`

```python
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    # --- NOVO: Extrair campos do JWT da plataforma ---
    filial_id = payload.get("filialId")        # camelCase do Auth Gateway
    filial_codigo = payload.get("filialCodigo")

    # Extrair role do modulo INVENTARIO
    modulos = payload.get("modulos", [])
    inv_modulo = next((m for m in modulos if m.get("codigo") == "INVENTARIO"), None)
    if not inv_modulo:
        raise HTTPException(403, "Usuario sem acesso ao modulo Inventario")
    role = inv_modulo.get("role")  # ADMIN, SUPERVISOR ou OPERATOR

    # Buscar usuario no core
    usuario = db.query(CoreUsuario).filter_by(id=user_id).first()
    if not usuario or not usuario.ativo:
        raise credentials_exception

    # Montar objeto usuario compativel com o restante do sistema
    user = UserSession(
        id=user_id,
        username=payload.get("username", usuario.login),
        full_name=usuario.nome,
        email=usuario.email,
        role=role,
        store_id=filial_id,          # filialId do JWT → store_id interno
        store_code=filial_codigo,     # "01", "02", etc.
        is_active=True,
    )
    return user
```

**Classe `UserSession`** (substitui dependencia da tabela `inventario.users`):
```python
from dataclasses import dataclass

@dataclass
class UserSession:
    """Objeto de sessao do usuario, construido a partir do JWT + core"""
    id: str
    username: str
    full_name: str
    email: str
    role: str           # ADMIN | SUPERVISOR | OPERATOR
    store_id: str       # UUID da filial ativa (core.filiais.id)
    store_code: str     # Codigo da filial ("01")
    is_active: bool
```

**Passo 3 — Adaptar `add_store_filter()` e queries**

Todas as queries que fazem `model.store_id == current_user.store_id` continuam funcionando — o `store_id` agora vem do JWT (`filialId`) que e o UUID de `core.filiais`.

**Ponto critico**: as FKs de `inventory_lists.store_id`, `products.store_id`, etc. precisam ter os mesmos UUIDs de `core.filiais`.

**Solucao**: Migration SQL para popular `inventario.stores` com IDs do core (one-time sync):

```sql
-- Sprint 0: Sincronizar stores com mesmos IDs do core
INSERT INTO inventario.stores (id, code, name, is_active, created_at, updated_at)
SELECT f.id, f.codigo, f.nome_fantasia, f.ativo, NOW(), NOW()
FROM core.filiais f
WHERE NOT EXISTS (SELECT 1 FROM inventario.stores s WHERE s.id = f.id);
```

Isso garante que `inventory_lists.store_id` = `core.filiais.id` = `JWT.filialId`.

**Passo 4 — Listar filiais disponiveis do usuario**

Para funcionalidades que precisam listar as filiais do usuario (ex: troca de filial):

```python
# Buscar filiais do usuario no core
filiais = db.query(CoreFilial).join(
    CoreUsuarioFilial, CoreUsuarioFilial.filial_id == CoreFilial.id
).filter(
    CoreUsuarioFilial.usuario_id == current_user.id
).all()
```

**Passo 5 — Listar usuarios disponiveis (para atribuir contadores)**

Endpoints que listam usuarios (ex: atribuir contador a uma lista) devem consultar core:

```python
# Buscar usuarios com acesso ao INVENTARIO na filial atual
from sqlalchemy import text

usuarios = db.execute(text("""
    SELECT u.id, u.login, u.nome, u.email, rm.codigo as role
    FROM core.usuarios u
    JOIN core.permissoes_modulo pm ON pm.usuario_id = u.id
    JOIN core.modulos_sistema ms ON ms.id = pm.modulo_id AND ms.codigo = 'INVENTARIO'
    JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id
    JOIN core.usuario_filiais uf ON uf.usuario_id = u.id AND uf.filial_id = :filial_id
    WHERE u.ativo = true
"""), {"filial_id": current_user.store_id}).fetchall()
```

---

#### 0.3 Backend FastAPI — Desativar auth propria

- **Desativar** endpoints `/api/v1/auth/login`, `/api/v1/auth/validate-credentials`, `/api/v1/auth/login-with-store`
- **Manter** `/api/v1/auth/me` adaptado (retorna dados do JWT + core)
- **Desativar** endpoints `/api/v1/users/*` e `/api/v1/stores/*` (gerenciados pelo Auth Gateway)
- Adicionar comentario: "Usuarios e filiais gerenciados pela plataforma — modulo Auth Gateway"

---

#### 0.4 Nginx — Adicionar rotas inventario

**Arquivo**: `nginx/nginx.conf`

```nginx
# Inventario API
location /api/v1/inventory/ {
    proxy_pass http://inventario-backend:8000/api/v1/inventory/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50M;
}

# Inventario — Sync Protheus
location /api/v1/sync/ {
    proxy_pass http://inventario-backend:8000/api/v1/sync/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Inventario — Integracao Protheus
location /api/v1/integration/ {
    proxy_pass http://inventario-backend:8000/api/v1/integration/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Inventario — Import
location /api/v1/import/ {
    proxy_pass http://inventario-backend:8000/api/v1/import/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 50M;
}

# Inventario Frontend (React SPA)
location /inventario/ {
    proxy_pass http://inventario-frontend:80/;
    proxy_set_header Host $host;
}
```

---

#### 0.5 Docker Compose — Ajustar environment

**Arquivo**: `docker-compose.yml`

```yaml
inventario-backend:
  environment:
    - JWT_SECRET=${JWT_SECRET}       # Mesma chave do Auth Gateway
    - UNIFIED_AUTH=true              # Flag para usar JWT da plataforma
    - CORE_SCHEMA=core
    - DB_SCHEMA=inventario
    - PROTHEUS_API_URL=${PROTHEUS_API_URL}
    - PROTHEUS_API_AUTH=${PROTHEUS_API_AUTH}
```

---

#### 0.6 Migration SQL — Sincronizar IDs

**Arquivo**: `database/migrations/006-sync-inventario-stores.sql` (NOVO)

```sql
-- Sincronizar inventario.stores com core.filiais (mesmos UUIDs)
-- Isso garante que FKs em inventory_lists.store_id apontem para IDs validos
INSERT INTO inventario.stores (id, code, name, is_active, created_at, updated_at)
SELECT f.id, f.codigo, f.nome_fantasia, f.ativo, NOW(), NOW()
FROM core.filiais f
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Popular inventario.users com usuarios que tem acesso ao INVENTARIO
INSERT INTO inventario.users (id, username, password_hash, full_name, email, role, store_id, is_active, created_at, updated_at)
SELECT
    u.id,
    u.login,
    u.senha,
    u.nome,
    COALESCE(u.email, ''),
    rm.codigo,  -- ADMIN, SUPERVISOR, OPERATOR
    uf.filial_id,
    u.ativo,
    NOW(),
    NOW()
FROM core.usuarios u
JOIN core.permissoes_modulo pm ON pm.usuario_id = u.id
JOIN core.modulos_sistema ms ON ms.id = pm.modulo_id AND ms.codigo = 'INVENTARIO'
JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id
LEFT JOIN core.usuario_filiais uf ON uf.usuario_id = u.id AND uf.is_default = true
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
```

**Por que popular inventario.users mesmo com Abordagem B?**
Porque tabelas como `countings.counted_by`, `counting_assignments.assigned_to` tem FK para `inventario.users.id`.
Essas FKs precisam existir. A migration garante que os IDs sao os **mesmos** do core.
No dia-a-dia, o `security.py` le do core, mas as FKs apontam para inventario.users como cache.

---

#### 0.7 Validacao do Sprint 0

Checklist antes de prosseguir:

- [ ] `curl -H "Authorization: Bearer <token_hub>" http://localhost/api/v1/inventory/lists` → 200 OK
- [ ] JWT do Hub e aceito pelo FastAPI sem erros
- [ ] `store_id` correto (mesmo UUID de `core.filiais`)
- [ ] Role extraido corretamente do JWT (`modulos[].role`)
- [ ] Listar usuarios disponveis retorna dados do core
- [ ] Endpoints de auth propria desativados (retornam 410 Gone)
- [ ] Nginx roteando corretamente todas as rotas do inventario

---

### Sprint 1: Frontend React — Estrutura Base + Dashboard (2-3 dias)

**Objetivo**: Criar o projeto React e implementar as paginas simples primeiro.

#### 1.1 Scaffold do projeto

```
inventario/frontend-react/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx        (reutilizar padrao gestao-ti)
│   ├── layouts/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── services/
│   │   ├── api.ts                 (axios + interceptor JWT)
│   │   ├── inventory.service.ts
│   │   ├── counting.service.ts
│   │   ├── product.service.ts
│   │   ├── warehouse.service.ts
│   │   ├── protheus.service.ts
│   │   └── report.service.ts
│   ├── types/
│   │   └── index.ts
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── inventario/
│   │   ├── contagem/
│   │   ├── produtos/
│   │   ├── armazens/
│   │   ├── relatorios/
│   │   └── integracao/
│   └── components/
│       ├── StatusBadge.tsx
│       ├── CycleIndicator.tsx
│       └── ...
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── Dockerfile
└── nginx.conf
```

#### 1.2 Sidebar (menu lateral)

Estrutura de navegacao:

```
INVENTARIO
├── Dashboard
├── ─── OPERACAO ───
├── Contagem              (counting_improved → ContagemPage)
├── ─── GESTAO ───
├── Inventarios           (inventory → InventariosListPage)
├── Novo Inventario       (→ InventarioCreatePage)
├── ─── CADASTROS ───
├── Produtos              (products → ProdutosPage)
├── Armazens              (warehouses → ArmazensPage)
├── ─── RELATORIOS ───
├── Analise               (reports → RelatoriosPage)
├── Divergencias          (discrepancies → DivergenciasPage)
├── ─── INTEGRACAO ───
├── Protheus              (integration_protheus → ProtheusPage)
├── Importacao            (import → ImportPage)
```

#### 1.3 Types (interfaces TypeScript)

```typescript
// Tipos principais baseados nos models SQLAlchemy

interface Store {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  storeId: string;
  isActive: boolean;
}

interface Product {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  hasLot: boolean;
  hasSerial: boolean;
  warehouse: string;
  storeId: string;
  isActive: boolean;
}

type InventoryStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
type ListStatus = 'ABERTA' | 'EM_CONTAGEM' | 'ENCERRADA';
type CountingStatus = 'PENDING' | 'COUNTED' | 'REVIEWED' | 'APPROVED' | 'ZERO_CONFIRMED';

interface InventoryList {
  id: string;
  name: string;
  description: string;
  referenceDate: string;
  countDeadline: string;
  warehouse: string;
  status: InventoryStatus;
  listStatus: ListStatus;
  cycleNumber: number;
  currentCycle: number;
  counterCycle1?: string;
  counterCycle2?: string;
  counterCycle3?: string;
  useMultipleLists: boolean;
  totalLists: number;
  storeId: string;
  createdBy: string;
  releasedAt?: string;
  closedAt?: string;
  // ... relacoes
  items?: InventoryItem[];
  countingLists?: CountingList[];
}

interface InventoryItem {
  id: string;
  inventoryListId: string;
  productId?: string;
  productCode: string;
  sequence: number;
  expectedQuantity: number;
  b2Qatu: number;
  warehouse: string;
  status: CountingStatus;
  needsRecountCycle1: boolean;
  needsRecountCycle2: boolean;
  needsRecountCycle3: boolean;
  countCycle1?: number;
  countCycle2?: number;
  countCycle3?: number;
  lastCountedAt?: string;
  // snapshot
  snapshot?: InventoryItemSnapshot;
  lotSnapshots?: InventoryLotSnapshot[];
}

interface InventoryItemSnapshot {
  id: string;
  b2Filial: string;
  b2Cod: string;
  b2Local: string;
  b2Qatu: number;
  b2Cm1: number;
  b1Desc: string;
  b1Rastro: 'L' | 'S' | 'N';
  b1Grupo: string;
  b1Xcatgor: string;
  bzXlocal1?: string;
  bzXlocal2?: string;
  bzXlocal3?: string;
}

interface InventoryLotSnapshot {
  id: string;
  b8Lotectl: string;
  b8Lotefor: string;
  b8Saldo: number;
}

interface CountingList {
  id: string;
  inventoryId: string;
  listName: string;
  counterCycle1?: string;
  counterCycle2?: string;
  counterCycle3?: string;
  currentCycle: number;
  listStatus: ListStatus;
  items?: CountingListItem[];
}

interface Counting {
  id: string;
  inventoryItemId: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
  observation?: string;
  countedBy: string;
  countNumber: number;
  createdAt: string;
}

interface Discrepancy {
  id: string;
  inventoryItemId: string;
  varianceQuantity: number;
  variancePercentage: number;
  toleranceExceeded: boolean;
  status: 'PENDING' | 'RESOLVED';
  observation?: string;
  resolution?: string;
}
```

#### 1.4 Paginas simples (Sprint 1)

- **DashboardPage**: Cards resumo (inventarios ativos, pendentes, contados %, divergencias)
- **ArmazensPage**: CRUD simples de warehouses
- **ProdutosPage**: Listagem de produtos com filtros (codigo, nome, categoria, armazem)

---

### Sprint 2: Listagem e Criacao de Inventarios (2-3 dias)

#### 2.1 InventariosListPage

- Tabela com inventarios: nome, armazem, status (badges coloridos), ciclo atual, data referencia, prazo
- Filtros: status, armazem, periodo
- Botao "Novo Inventario"
- Click na linha → InventarioDetalhePage

#### 2.2 InventarioCreatePage

Form com:
- Nome, descricao
- Data referencia, prazo contagem
- Armazem (select)
- Modo: lista unica ou multiplas listas

#### 2.3 InventarioDetalhePage (estrutura base)

Cabecalho com info do inventario + tabs:
- **Itens**: Lista de produtos do inventario (com status, quantidades esperadas, snapshot)
- **Listas**: Gerenciamento de listas de contagem (o NUCLEO)
- **Analise**: Comparacao de ciclos, divergencias
- **Historico**: Audit log de acoes

---

### Sprint 3: NUCLEO — Gerenciamento de Listas e Ciclos (5-7 dias)

**Este e o sprint mais critico.** Reimplementa o `inventory.html` (24.000 linhas) em React.

#### 3.1 Tab "Listas" do InventarioDetalhePage

**Componentes**:

```
InventarioDetalhePage
  └── Tab "Listas"
      ├── ListasToolbar
      │   ├── BotaoCriarLista
      │   ├── BotaoAdicionarProdutos
      │   └── FiltroStatus
      │
      ├── ListasTable
      │   ├── Colunas: Nome, Ciclo, Status, Qtd Produtos, Contador, Acoes
      │   ├── Badge ciclo: 1a (verde), 2a (amarelo), 3a (vermelho)
      │   ├── Badge status: ABERTA, EM_CONTAGEM, ENCERRADA
      │   └── Acoes: Ver Detalhes, Liberar, Reatribuir, Encerrar
      │
      └── ListaDetalheModal (ou pagina separada)
          ├── Header: Info da lista + stats (total, contados, pendentes, divergentes)
          │
          ├── TabelaProdutos
          │   ├── Linhas sinteticas (totais por produto) — fundo amarelo
          │   ├── Linhas analiticas (detalhe por lote) — fundo verde, indentadas
          │   ├── Colunas: Seq, Codigo, Descricao, Local, Saldo Sistema,
          │   │            Entregas Post., Total Esperado, Contagem C1, C2, C3,
          │   │            Diferenca, Status
          │   └── Ordenacao/filtro por status
          │
          └── AcoesLista
              ├── LiberarParaContagem (muda status ABERTA → EM_CONTAGEM)
              ├── AvancarCiclo (analisa divergencias → prepara ciclo 2 ou 3)
              ├── ReatribuirContador (muda contador para proximo ciclo)
              └── EncerrarContagem (finaliza a lista)
```

#### 3.2 Logica de Ciclos no Frontend

```typescript
// Regra de quantidade final por maioria
function calcularQuantidadeFinal(
  count1: number | null,
  count2: number | null,
  count3: number | null,
  systemQty: number,
  currentCycle: number
): number {
  // Regra 1: C2 == sistema → usa C2
  if (count2 !== null && Math.abs(count2 - systemQty) < 0.01) return count2;

  // Regra 2: Somente C1 → usa C1
  if (count1 !== null && count2 === null && count3 === null) return count1;

  // Regra 3: C1 == C2 → usa qualquer
  if (count1 !== null && count2 !== null && Math.abs(count1 - count2) < 0.01) return count1;

  // Regra 4: Desempate com C3
  if (count3 !== null) {
    if (count1 !== null && Math.abs(count1 - count3) < 0.01) return count1;
    if (count2 !== null && Math.abs(count2 - count3) < 0.01) return count2;
    return count3;
  }

  return count3 ?? count2 ?? count1 ?? 0;
}

// Verificar necessidade de proximo ciclo
function precisaProximoCiclo(
  count1: number | null,
  count2: number | null,
  cycleNumber: number
): boolean {
  if (cycleNumber === 1 && count1 !== null) return true;
  if (cycleNumber === 2 && count1 !== null && count2 !== null) {
    return Math.abs(count1 - count2) >= 0.01;
  }
  return false;
}
```

#### 3.3 Adicionar Produtos ao Inventario

Modal/pagina para selecionar produtos:
- Busca por codigo, nome, codigo de barras
- Filtro por categoria, grupo, armazem
- Checkbox multi-select com "selecionar todos"
- Paginacao (25, 50, 100, 250 itens)
- Preview de quantidade esperada (SB2010.B2_QATU)
- Botao "Adicionar Selecionados" → POST batch

#### 3.4 Criar Listas de Contagem

Modal para criar lista:
- Nome da lista
- Atribuir contador (ciclo 1)
- Selecionar produtos da lista principal ou auto-distribuir
- Opcao: dividir igualmente entre N listas

---

### Sprint 4: Paginas de Contagem — Desktop + Mobile (5-7 dias)

Reimplementa `counting_improved.html` e `counting_mobile.html` em React.
Ambas compartilham os mesmos services, types e logica de negocio — diferem no layout/UX.

**Estrutura de arquivos**:
```
pages/contagem/
├── ContagemSelectorPage.tsx       # Tela inicial: selecionar inventario + modo
├── ContagemDesktopPage.tsx        # Modo DESKTOP (tabela completa)
├── ContagemMobilePage.tsx         # Modo MOBILE (contagem cega, touch)
├── components/
│   ├── InventarioSelectModal.tsx  # Modal selecao de inventario
│   ├── ModoSelectModal.tsx        # Modal selecao Desktop vs Mobile
│   ├── ScannerInput.tsx           # Input scanner codigo barras (reusavel)
│   ├── ProductTable.tsx           # Tabela de produtos (desktop)
│   ├── ProductCard.tsx            # Card de produto (mobile, um por vez)
│   ├── LotCountModal.tsx          # Modal contagem de lotes
│   ├── CountingProgress.tsx       # Barra progresso + stats
│   └── CycleStatusBadge.tsx       # Badge ciclo (1a/2a/3a)
└── hooks/
    ├── useCountingData.ts         # Hook: carregar produtos, filtrar, stats
    ├── useScanner.ts              # Hook: logica scanner (Enter, focus, beep)
    └── useLotDraft.ts             # Hook: rascunho lotes (localStorage + sync)
```

#### 4.1 ContagemSelectorPage — Selecao de Inventario e Modo

Tela de entrada que o operador ve ao acessar "Contagem" no menu.

**Fluxo**:
```
1. Carregar inventarios disponiveis (status EM_CONTAGEM ou LIBERADA)
   GET /api/v1/inventory/lists?status=IN_PROGRESS

2. Filtrar por: inventarios onde o usuario e contador atribuido
   GET /api/v1/inventory/my-assignments

3. Exibir lista de inventarios com:
   - Nome, armazem, ciclo atual, qtd produtos, prazo
   - Badge status (EM_CONTAGEM)
   - Botao "Iniciar Contagem"

4. Ao selecionar inventario → Modal de modo:
   ┌─────────────────────────────────────┐
   │   Como deseja contar?               │
   │                                     │
   │   ○ Desktop (visualizacao completa) │
   │     Saldo sistema visivel           │
   │     Diferencas em tempo real        │
   │     Para: SUPERVISOR / ADMIN        │
   │                                     │
   │   ○ Mobile (contagem cega)          │
   │     Saldo sistema OCULTO            │
   │     Interface touch-optimized       │
   │     Para: OPERATOR                  │
   │                                     │
   │          [Continuar]                │
   └─────────────────────────────────────┘

5. OPERATOR → auto-redireciona para Mobile (sem escolha)
   SUPERVISOR/ADMIN → escolhe modo

6. Redireciona para:
   /inventario/contagem/:inventoryId/desktop
   /inventario/contagem/:inventoryId/mobile
```

**Layout** (seguindo padrao Gestao TI):
```tsx
<Header title="Contagem" />
<div className="p-6">
  {/* Cards resumo */}
  <div className="grid grid-cols-3 gap-4 mb-6">
    <Card label="Inventarios Disponiveis" value={count} ... />
    <Card label="Meus Pendentes" value={pending} ... />
    <Card label="Produtos a Contar" value={total} ... />
  </div>

  {/* Tabela de inventarios */}
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <table className="w-full text-sm">...</table>
  </div>
</div>
```

---

#### 4.2 ContagemDesktopPage — Modo Completo (SUPERVISOR/ADMIN)

Reimplementa `counting_improved.html` modo DESKTOP.

**Layout**:
```
┌────────────────────────────────────────────────────────────────┐
│ HEADER: "Contagem — Inventario Outubro 2025"                   │
├────────────────────────────────────────────────────────────────┤
│ INFO BAR (bg-white rounded-xl border p-4 mb-4)                │
│ ┌──────────┬──────────┬────────────┬────────────┬───────────┐ │
│ │Armazem:01│Ciclo: 1a │Total: 250  │Contados:180│Pend.: 70  │ │
│ └──────────┴──────────┴────────────┴────────────┴───────────┘ │
├────────────────────────────────────────────────────────────────┤
│ TOOLBAR (flex items-center justify-between mb-4)               │
│ ┌─────────────────────────────────┐  ┌──────┐ ┌────────────┐ │
│ │ 🔍 Scanner: [_______________]  │  │Todos │ │ Pendentes  │ │
│ └─────────────────────────────────┘  └──────┘ └────────────┘ │
├────────────────────────────────────────────────────────────────┤
│ TABELA DE PRODUTOS (bg-white rounded-xl border)                │
│ ┌───┬────────┬──────────┬──────┬────────┬───────┬─────┬─────┐ │
│ │ # │Codigo  │Descricao │Local │Sist.   │Entr.P.│Esper│Cont.│ │
│ │   │        │          │      │(SB2)   │(xent) │Total│[inp]│ │
│ ├───┼────────┼──────────┼──────┼────────┼───────┼─────┼─────┤ │
│ │ 1 │000123  │Prod A    │01    │  100,00│   5,00│  105│[   ]│ │
│ │ 2 │000456  │Prod B    │01    │   50,00│   0,00│   50│[ 50]│✓│
│ │ 3 │000789  │Prod C*   │01    │   30,00│   0,00│   30│[lot]│ │
│ │ 4 │001234  │Prod D    │01    │   20,00│   0,00│   20│[ 18]│⚠│
│ └───┴────────┴──────────┴──────┴────────┴───────┴─────┴─────┘ │
│ * = produto com controle de lote (click abre modal lotes)      │
│ ✓ = contado OK  ⚠ = divergencia                               │
├────────────────────────────────────────────────────────────────┤
│ FOOTER (flex items-center justify-between px-4 py-3)           │
│ Progresso: ████████░░ 72% (180/250)  │ 68 OK │ 2 Diverg.     │
└────────────────────────────────────────────────────────────────┘
```

**Colunas da tabela Desktop**:
| Coluna | Dados | Editavel | Visivel |
|--------|-------|----------|---------|
| # | Sequencia | Nao | Sempre |
| Codigo | product_code | Nao | Sempre |
| Descricao | snapshot.b1_desc | Nao | Sempre |
| Local | snapshot.bz_xlocal1 + bz_xlocal2 + bz_xlocal3 | Nao | Sempre |
| Saldo Sistema | snapshot.b2_qatu | Nao | **DESKTOP only** |
| Entregas Post. | snapshot.b2_xentpos | Nao | **DESKTOP only** |
| Total Esperado | b2_qatu + b2_xentpos | Nao | **DESKTOP only** |
| **Qtd Contada** | count_cycle_X | **SIM** | Sempre |
| Diferenca | contado - esperado | Nao | **DESKTOP only** |
| Status | badge calculado | Nao | Sempre |
| Acoes | salvar/editar | - | Sempre |

**Interacoes**:

1. **Scanner**: Input sempre visivel no topo
   - Operador escaneia codigo de barras → Enter
   - Sistema busca produto na lista (por code ou barcode)
   - Se encontrado: scroll ate o produto, highlight amarelo, focus no campo quantidade
   - Se nao encontrado: toast "Produto nao encontrado nesta lista"
   - Audio beep ao salvar contagem (feedback sonoro)

2. **Edicao inline**: Click no campo "Qtd Contada"
   - Campo vira input numerico
   - Enter ou Tab → salva automaticamente (POST /api/v1/inventory/items/:id/count)
   - Escape → cancela edicao
   - Background da linha muda conforme status:
     - Verde claro: contado == esperado
     - Amarelo: divergencia
     - Branco: pendente

3. **Produto com lote**: Click na linha ou icone de lote
   - Abre `LotCountModal`
   - Nao permite editar quantidade diretamente na tabela

4. **Filtros**: Botoes "Todos" | "Pendentes" | "Divergentes" | "Contados"
   - Filtram lista sem recarregar do backend

5. **Salvar em lote**: Botao "Salvar Todos" para gravar multiplas contagens de uma vez

**Componentes reutilizaveis** (padrao Gestao TI):
```tsx
// Info bar — mesmo padrao CardGrid do Dashboard
<div className="grid grid-cols-5 gap-4 mb-4">
  <div className="bg-white rounded-xl p-4 border border-slate-200">
    <p className="text-xs text-slate-500">Armazem</p>
    <p className="text-lg font-bold text-slate-800">01</p>
  </div>
  ...
</div>

// Tabela — mesmo padrao de list pages
<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-slate-50 border-b border-slate-200">
        <th className="text-left px-4 py-3 font-medium text-slate-600">...</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      ...
    </tbody>
  </table>
</div>

// Status badges
<span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
  Contado
</span>
```

---

#### 4.3 ContagemMobilePage — Contagem Cega (OPERATOR)

Reimplementa `counting_mobile.html` em React. Interface touch-optimized para coletores e celulares.

**Principio fundamental**: **Contagem cega** — operador NAO ve o saldo sistema para nao ser influenciado.

**Layout** (fullscreen, sem sidebar):
```
┌────────────────────────────────────┐
│ ← Voltar    Contagem    ☰ Menu    │ Header fino
├────────────────────────────────────┤
│                                    │
│   ████████████░░░░  180 / 250     │ Barra progresso
│                                    │
├────────────────────────────────────┤
│                                    │
│   🔍 [Scanner / Codigo barras]    │ Input grande
│                                    │
├────────────────────────────────────┤
│                                    │
│   ┌──────────────────────────────┐ │
│   │  Codigo: 000123              │ │
│   │  Descricao: Produto A        │ │
│   │  Local: Corredor 2 / Prat. 3 │ │
│   │  Armazem: 01                 │ │
│   │                              │ │
│   │  Quantidade:                 │ │
│   │  ┌────────────────────────┐  │ │ Input GRANDE
│   │  │        [    ]          │  │ │ (numerico nativo)
│   │  └────────────────────────┘  │ │
│   │                              │ │
│   │  ┌──────────┐ ┌──────────┐  │ │
│   │  │  Limpar  │ │  Salvar  │  │ │ Botoes GRANDES
│   │  └──────────┘ └──────────┘  │ │ (min-h 48px)
│   │                              │ │
│   │  Obs: [___________________]  │ │ Observacao (opcional)
│   └──────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│                                    │
│  ┌──────┐              ┌────────┐ │
│  │ ← Ant│   3 de 250   │ Prox →│ │ Navegacao
│  └──────┘              └────────┘ │
│                                    │
├────────────────────────────────────┤
│  Pendentes: 70  │  Contados: 180  │ Status bar
└────────────────────────────────────┘
```

**Caracteristicas exclusivas do modo MOBILE**:

1. **Contagem cega**: Campos OCULTOS:
   - Saldo sistema (b2_qatu) — NAO aparece
   - Entregas posteriores (b2_xentpos) — NAO aparece
   - Total esperado — NAO aparece
   - Diferenca — NAO aparece
   - Operador conta sem saber o saldo, evitando vies

2. **Um produto por vez**: Nao usa tabela
   - Card centralizado com dados do produto
   - Navegacao: botoes "Anterior" / "Proximo" ou swipe
   - Pode pular para qualquer produto via scanner ou busca

3. **Interface touch-friendly**:
   - Botoes minimo 48px de altura (acessibilidade mobile)
   - Input numerico com `inputMode="decimal"` (teclado numerico nativo)
   - Espacamento generoso entre elementos (evitar toques acidentais)
   - Font-size maior: base 16px+ (sem zoom indesejado no iOS)

4. **Scanner otimizado**:
   - Input scanner sempre acessivel no topo
   - Auto-focus apos salvar (pronto para proximo scan)
   - Suporte a leitor Bluetooth e camera (via API)
   - Feedback visual (flash verde) + sonoro (beep) ao salvar

5. **Lotes no mobile**:
   - Ao navegar para produto com lote → tela especifica de lotes
   - Lista vertical de lotes (cards empilhados, nao tabela)
   - Input por lote + total automatico
   - "Adicionar Lote" botao grande no fim

6. **Offline/Draft**:
   - Contagens salvas em `localStorage` antes do POST
   - Se offline: acumula e sincroniza quando voltar
   - Indicador visual: "3 contagens pendentes de sincronizacao"

7. **Fullscreen mode**:
   - Opcao de esconder sidebar completamente
   - Maximiza area util em telas pequenas
   - Header reduzido (apenas titulo + voltar)

**Layout sem sidebar** (mobile-first):
```tsx
// ContagemMobilePage nao usa <MainLayout> (sem sidebar)
// Tem seu proprio layout fullscreen
export function ContagemMobilePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header fino */}
      <div className="bg-capul-600 text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-medium text-sm">Contagem</span>
        <button onClick={toggleMenu}>
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Progresso */}
      <div className="px-4 py-2 bg-white border-b">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{counted}/{total}</span>
          <span>{Math.round(counted/total*100)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-capul-600 h-2 rounded-full" style={{width: `${pct}%`}} />
        </div>
      </div>

      {/* Scanner */}
      <div className="px-4 py-3 bg-white border-b">
        <ScannerInput onScan={handleScan} autoFocus />
      </div>

      {/* Card produto (flex-1 area principal) */}
      <div className="flex-1 p-4">
        <ProductCard product={currentProduct} blind={true} />
      </div>

      {/* Navegacao */}
      <div className="px-4 py-3 bg-white border-t flex items-center justify-between">
        <button onClick={prev} className="bg-slate-100 px-6 py-3 rounded-lg text-sm">
          ← Anterior
        </button>
        <span className="text-sm text-slate-500">{index + 1} de {total}</span>
        <button onClick={next} className="bg-capul-600 text-white px-6 py-3 rounded-lg text-sm">
          Proximo →
        </button>
      </div>
    </div>
  );
}
```

---

#### 4.4 LotCountModal — Contagem de Lotes (compartilhado)

Usado tanto no Desktop quanto no Mobile. Para produtos com `b1_rastro = 'L'`.

**Layout Desktop** (modal padrao Gestao TI):
```
┌──────────────────────────────────────────────────────┐
│ Contagem de Lotes — Produto 000789                   │  X
├──────────────────────────────────────────────────────┤
│ Codigo: 000789  │  Descricao: Produto C              │
│ Armazem: 01     │  Saldo Total: 30,00                │
├──────────────────────────────────────────────────────┤
│ Scanner Lote: [_________________________] 🔍         │
├──────────────────────────────────────────────────────┤
│ ┌───┬──────────────┬──────────┬──────────┬─────────┐ │
│ │ # │ Lote         │ Saldo SB8│ Contado  │ Dif.    │ │
│ ├───┼──────────────┼──────────┼──────────┼─────────┤ │
│ │ 1 │ 000000019208 │   15,00  │ [      ] │         │ │
│ │ 2 │ 000000019209 │   10,00  │ [      ] │         │ │
│ │ 3 │ 000000019210 │    5,00  │ [      ] │         │ │
│ └───┴──────────────┴──────────┴──────────┴─────────┘ │
│                                                      │
│ [+ Adicionar Lote Nao Previsto]                      │
│                                                      │
│ TOTAL CONTADO: ___  │  TOTAL ESPERADO: 30,00         │
├──────────────────────────────────────────────────────┤
│                    [Cancelar]  [Salvar Contagem]     │
└──────────────────────────────────────────────────────┘
```

**Layout Mobile** (tela cheia, cards empilhados):
```
┌────────────────────────────────────┐
│ ← Voltar      Lotes      Prod C   │
├────────────────────────────────────┤
│ 🔍 [Scanner de lote]              │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ Lote: 000000019208             │ │
│ │ Saldo: 15,00 (blind: oculto)  │ │
│ │ Contado: [___________]        │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Lote: 000000019209             │ │
│ │ Saldo: 10,00 (blind: oculto)  │ │
│ │ Contado: [___________]        │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Lote: 000000019210             │ │
│ │ Saldo:  5,00 (blind: oculto)  │ │
│ │ Contado: [___________]        │ │
│ └────────────────────────────────┘ │
│                                    │
│ [+ Adicionar Lote Nao Previsto]    │
│                                    │
│ Total Contado: ___                 │
├────────────────────────────────────┤
│      [Salvar Contagem de Lotes]    │ Botao grande
└────────────────────────────────────┘
```

**Logica compartilhada** (hook `useLotDraft`):
- Carregar lotes do snapshot: `GET /api/v1/inventory/items/:id/lots-snapshot`
- Carregar contagens existentes: `GET /api/v1/inventory/items/:id/counts`
- Rascunho em localStorage: chave `lotDraft_${inventoryId}_${itemId}`
- Ao salvar: `POST /api/v1/inventory/items/:id/count` com array de lotes
- Totalizacao automatica (soma de todos os lotes)
- Validacao: quantidade >= 0, pelo menos 1 lote preenchido
- "Adicionar Lote Nao Previsto": input manual de numero de lote

---

#### 4.5 ScannerInput — Componente de Scanner (compartilhado)

```tsx
interface ScannerInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'default' | 'large';  // large para mobile
}

export function ScannerInput({ onScan, placeholder, autoFocus, size = 'default' }: ScannerInputProps) {
  // - Input com icone Search
  // - Enter → dispara onScan(value) → limpa input
  // - Debounce para evitar duplicatas de scanner fisico
  // - size='large': py-4 text-lg (mobile)
  // - size='default': py-2 text-sm (desktop)
  // - Audio beep configuravel
}
```

---

#### 4.6 CountingProgress — Barra de Progresso (compartilhado)

```tsx
interface CountingProgressProps {
  total: number;
  counted: number;
  divergent: number;
  pending: number;
  compact?: boolean;  // true para mobile (sem labels detalhados)
}

// Desktop: barra horizontal + 4 stats inline
// Mobile: barra horizontal + percentual (compacto)
```

---

#### 4.7 Roteamento das paginas de contagem

```tsx
// Em App.tsx
<Route path="contagem" element={<ContagemSelectorPage />} />
<Route path="contagem/:inventoryId/desktop" element={<ContagemDesktopPage />} />
<Route path="contagem/:inventoryId/mobile" element={<ContagemMobileLayout />}>
  {/* Mobile usa layout proprio, sem sidebar */}
</Route>

// ContagemMobileLayout: wrapper sem sidebar
function ContagemMobileLayout() {
  return <Outlet />;  // Renderiza ContagemMobilePage diretamente
}
```

**Nota sobre sidebar no mobile**:
- `ContagemDesktopPage` usa `MainLayout` normal (com sidebar)
- `ContagemMobilePage` usa layout proprio fullscreen (SEM sidebar)
- Operador acessa via menu "Contagem" → seleciona inventario → modo Mobile → tela cheia

---

### Sprint 5: Relatorios e Divergencias (2-3 dias)

#### 5.1 AnalisePage

- Resumo do inventario (total produtos, contados, pendentes, divergentes)
- Grafico pizza de status
- Tabela de divergencias ordenada por % variancia
- Comparacao ciclo a ciclo (C1 vs C2 vs C3)
- Exportar para Excel

#### 5.2 DivergenciasPage

- Lista de divergencias com filtros (status, tolerancia)
- Detalhes: produto, contagem por ciclo, variancia, resolucao
- Acao: Resolver divergencia (com observacao)

#### 5.3 ExportacaoExcel

- Botoes "Exportar" nas paginas de listagem
- Gerar arquivo Excel via backend (endpoint existente) ou frontend (SheetJS)

---

### Sprint 6: Integracao Protheus, Sync e Import (3-4 dias)

A integracao com o Protheus e um pilar fundamental do inventario. O sistema espelha dados
do ERP para garantir que a contagem seja comparada com saldos reais.

#### 6.1 Visao Geral da Integracao Protheus

**API Protheus**:
- URL: `https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/hierarquiaMercadologica`
- Auth: Basic Auth (credenciais em `.env`)
- Timeout: 30 segundos

**Fluxo de dados**:
```
PROTHEUS (ERP)                      INVENTARIO (PostgreSQL)

SB1010 (Produtos)      ──sync──→   inventario.sb1010
SB2010 (Saldos)        ──sync──→   inventario.sb2010 (SB2 standalone)
SB8010 (Lotes)         ──sync──→   inventario.sb8010
SBZ010 (Localizacoes)  ──sync──→   inventario.sbz010
SLK010 (Cod. Barras)   ──sync──→   inventario.slk010 → product_barcodes
DA1010 (Precos)        ──sync──→   inventario.da1010 → product_prices
SBM010 (Grupos)        ──sync──→   inventario.sbm010
SZD010 (Categorias)    ──sync──→   inventario.szd010
SZE010 (Subcategorias) ──sync──→   inventario.sze010
SZF010 (Segmentos)     ──sync──→   inventario.szf010
```

**Quando os dados sao usados**:
1. **Na criacao do inventario**: Saldos SB2/SB8 congelados em snapshots
2. **Na contagem**: Comparacao contado vs esperado (snapshot)
3. **Na finalizacao**: Resultado enviado de volta ao Protheus via integracao

**Endpoints existentes no backend** (7 rotas sync + 7 rotas integration):

```
SYNC (populacao de tabelas espelho):
POST /api/v1/sync/protheus/hierarchy     → Sincronizar hierarquia completa
POST /api/v1/sync/protheus/products      → Sincronizar cache de produtos

INTEGRATION (envio de resultados ao Protheus):
GET  /api/v1/integration/compatible-inventories/:id  → Inventarios compativeis
GET  /api/v1/integration/existing-integration/:id    → Integracao existente
POST /api/v1/integration/preview                     → Preview antes de enviar
POST /api/v1/integration/save                        → Salvar integracao
POST /api/v1/integration/send/:id                    → Enviar ao Protheus
GET  /api/v1/integration/:id                         → Consultar integracao
PATCH /api/v1/integration/:id/cancel                 → Cancelar integracao
```

---

#### 6.2 ProtheusPage — Pagina de Integracao React

**Layout** (seguindo padrao Gestao TI — tabs):

```tsx
<Header title="Integracao Protheus" />
<div className="p-6">
  {/* Cards resumo */}
  <div className="grid grid-cols-4 gap-4 mb-6">
    <Card label="Ultima Sync" value="25/02/2026 14:30" icon={RefreshCw} />
    <Card label="Produtos Sync" value="12.450" icon={Package} />
    <Card label="Saldos Atualizados" value="12.450" icon={Database} />
    <Card label="Integracoes Pendentes" value="2" icon={Send} />
  </div>

  {/* Tabs */}
  <Tabs>
    <Tab "Sincronizacao">     → SyncTab
    <Tab "Envio ao Protheus"> → IntegrationTab
    <Tab "Historico">         → HistoryTab
  </Tabs>
</div>
```

**Tab "Sincronizacao"** — Populacao das tabelas espelho:

```
┌──────────────────────────────────────────────────────────────┐
│ SINCRONIZACAO DE DADOS DO PROTHEUS                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Hierarquia Mercadologica                               │   │
│ │ Ultima sync: 25/02/2026 14:30 — 12.450 registros      │   │
│ │ Tabelas: SB1, SBM, SZD, SZE, SZF, SBZ, SLK, DA1     │   │
│ │                                     [Sincronizar Agora]│   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Saldos e Lotes                                         │   │
│ │ Ultima sync: 25/02/2026 14:30 — 8.320 saldos          │   │
│ │ Tabelas: SB2, SB8                                      │   │
│ │                                     [Sincronizar Agora]│   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ⚠️ A sincronizacao pode levar alguns minutos.               │
│    Nao feche esta pagina durante o processo.                 │
│                                                              │
│ Progresso: ████████████░░░░  75% (9.337 / 12.450)          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Tab "Envio ao Protheus"** — Enviar resultado do inventario para o ERP:

```
┌──────────────────────────────────────────────────────────────┐
│ ENVIAR RESULTADO AO PROTHEUS                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Inventarios finalizados (prontos para envio):                │
│                                                              │
│ ┌────┬──────────────────┬──────────┬────────┬──────────────┐ │
│ │ #  │ Inventario        │ Armazem  │ Itens  │ Acao         │ │
│ ├────┼──────────────────┼──────────┼────────┼──────────────┤ │
│ │ 1  │ Inv. Out/2025     │ 01       │ 250    │ [Preview]    │ │
│ │ 2  │ Inv. Nov/2025     │ 02       │ 180    │ [Ja Enviado] │ │
│ └────┴──────────────────┴──────────┴────────┴──────────────┘ │
│                                                              │
│ Workflow:                                                    │
│ 1. [Preview] → Visualizar o que sera enviado                 │
│ 2. [Salvar]  → Gravar integracao localmente                  │
│ 3. [Enviar]  → POST ao Protheus (irreversivel)               │
│ 4. Status: Pendente → Enviado → Confirmado / Erro            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Tab "Historico"**:
- Tabela com todas as sincronizacoes e integracoes passadas
- Colunas: Data, Tipo (Sync/Integracao), Registros, Status, Usuario
- Filtro por periodo

---

#### 6.3 Impacto no Backend — Protheus

**Mudancas necessarias**: NENHUMA nos endpoints Protheus.

Os 14 endpoints de sync e integration continuam **inalterados**:
- Mesma logica de chamada a API Protheus
- Mesmas tabelas espelho
- Mesmo fluxo de preview → save → send

**Unica mudanca**: o `current_user` agora vem do JWT da plataforma (Sprint 0),
mas o formato `UserSession` e compativel — os endpoints so usam `current_user.id`
e `current_user.store_id` que continuam disponveis.

**Configuracao necessaria no `.env`**:
```env
PROTHEUS_API_URL=https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/hierarquiaMercadologica
PROTHEUS_API_AUTH=Basic <credenciais_base64>
PROTHEUS_API_TIMEOUT=30
```

Essas variaveis ja existem no `.env` do inventario standalone. Precisam ser adicionadas
ao `docker-compose.yml` da plataforma (Sprint 0.5).

---

#### 6.4 SyncProductsPage — Sincronizacao de Produtos (cache Redis)

Alem da sync Protheus, existe um cache Redis para produtos frequentemente consultados:

```
POST /api/v1/sync/products → Popula cache Redis com lista de produtos
```

**No frontend React**: Botao "Atualizar Cache" na pagina de Produtos ou no Dashboard.

---

#### 6.5 ImportPage — Importacao de Dados

**Wizard 3 etapas** (mesmo padrao do ImportPage do Gestao TI):

```
Etapa 1: Upload
┌─────────────────────────────────┐
│ Arrastar arquivo ou [Selecionar]│
│ Formatos: CSV, Excel (.xlsx)    │
│ Tipo: Produtos / Saldos / SZB  │
└─────────────────────────────────┘

Etapa 2: Preview + Validacao
┌─────────────────────────────────┐
│ 1.250 registros encontrados     │
│ 1.230 validos | 20 com erro     │
│                                 │
│ [Tabela preview com 10 linhas]  │
│                                 │
│ Erros:                          │
│ - Linha 45: codigo duplicado    │
│ - Linha 123: campo obrigatorio  │
│                                 │
│ [Cancelar]  [Importar Validos]  │
└─────────────────────────────────┘

Etapa 3: Resultado
┌─────────────────────────────────┐
│ ✓ 1.230 registros importados    │
│ ✗ 20 registros ignorados        │
│                                 │
│ [Baixar Log]  [Nova Importacao] │
└─────────────────────────────────┘
```

**Endpoints existentes**:
```
POST /api/v1/import/bulk          → Upload e importar
GET  /api/v1/import/tables        → Listar tabelas importaveis
POST /api/v1/import/validate      → Validar antes de importar
DELETE /api/v1/import/clear/:table → Limpar tabela
POST /api/v1/import/szb010        → Importar SZB010 especifico
POST /api/v1/import-produtos      → Importar produtos
```

---

### Sprint 7: Polimento e Testes (2-3 dias)

#### 7.1 Refinamentos de UX

- Loading states em todas as paginas
- Tratamento de erros com mensagens amigaveis
- Responsividade mobile
- Animacoes e transicoes

#### 7.2 Testes funcionais

- Fluxo completo: criar inventario → adicionar produtos → criar lista → contar → avancar ciclo → finalizar
- Testar com produtos com e sem lote
- Testar modo multiplas listas
- Testar controle de acesso por role (ADMIN, SUPERVISOR, OPERATOR)

#### 7.3 Build e Deploy

- Dockerfile (node:22 → build → nginx:alpine)
- Ajustar docker-compose.yml
- Testar no ambiente Docker completo

---

## 5. AJUSTES NO BACKEND FASTAPI

### 5.1 Mudancas necessarias (Abordagem B)

| Mudanca | Arquivo(s) | Risco | Sprint |
|---------|-----------|-------|--------|
| Criar `core_models.py` (read-only) | `models/core_models.py` (NOVO) | Baixo | 0 |
| Reescrever `security.py` para JWT plataforma | `core/security.py` | **Medio** | 0 |
| Criar classe `UserSession` (dataclass) | `core/security.py` | Baixo | 0 |
| Desativar endpoints auth/users/stores | `api/auth.py`, `endpoints/users.py`, `endpoints/stores.py` | Baixo | 0 |
| Adaptar listagem de usuarios (core) | `endpoints/assignments.py`, `endpoints/cycle_control.py` | Medio | 0 |
| Migration sync IDs core → inventario | `database/migrations/006-sync.sql` | Baixo | 0 |
| Ajustar CORS para nginx | `main.py` | Baixo | 0 |
| Adicionar camelCase nas respostas | `schemas/*.py` | Baixo | 1 |

### 5.2 Mudancas NAO necessarias

- **NAO** reescrever logica de ciclos (inventory_state_machine.py)
- **NAO** alterar schema do banco inventario (tabelas de dominio)
- **NAO** migrar models SQLAlchemy para Prisma
- **NAO** alterar endpoints de contagem (counting, counting_lists, cycle_control)
- **NAO** alterar endpoints de integracao Protheus (sync, integration)
- **NAO** alterar endpoints de import/export
- **NAO** executar migrations 002-005 (views/triggers — substituidas pela Abordagem B)

### 5.3 Compatibilidade de campo (snake_case vs camelCase)

O backend FastAPI retorna campos em `snake_case`. O frontend React espera `camelCase`.

**Opcoes**:
1. Adicionar middleware FastAPI para converter respostas para camelCase
2. Converter no frontend via funcao utility
3. Usar Pydantic `model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)`

**Recomendacao**: Opcao 3 (converter no Pydantic schema) — menor impacto.
Aplicar em todos os schemas de resposta do Pydantic durante Sprint 1.

---

## 6. MAPEAMENTO ENTIDADES core ↔ inventario (Abordagem B)

### 6.1 Fonte de Verdade

| Entidade | Fonte de Verdade | Inventario | Notas |
|----------|-----------------|------------|-------|
| **Usuarios** | `core.usuarios` | `inventario.users` (cache com mesmos IDs) | FastAPI le do core via JWT; FKs apontam para cache |
| **Filiais** | `core.filiais` | `inventario.stores` (cache com mesmos IDs) | FastAPI recebe `filialId` do JWT; FKs apontam para cache |
| **Roles** | `core.permissoes_modulo` | JWT `modulos[].role` | Nao ha tabela de roles no inventario |
| **Multi-filial** | `core.usuario_filiais` | Consulta direta ao core | `UserSession.store_id` = filial ativa do JWT |

### 6.2 Mapeamento de Campos

**Usuarios**:
| core.usuarios | JWT (Auth Gateway) | UserSession (FastAPI) | inventario.users (cache) |
|---------------|-------------------|----------------------|-------------------------|
| id | sub | id | id (MESMO UUID) |
| login | username | username | username |
| nome | — | full_name (do core) | full_name |
| email | — | email (do core) | email |
| — | modulos[INVENTARIO].role | role | role |
| — | filialId | store_id | store_id |

**Filiais**:
| core.filiais | JWT (Auth Gateway) | Uso no Inventario |
|-------------|-------------------|-------------------|
| id | filialId | `inventory_lists.store_id`, `products.store_id`, filtros |
| codigo | filialCodigo | Exibicao na UI, filtros Protheus (b2_filial) |
| nomeFantasia | — | Exibicao na UI |

### 6.3 Fluxo de Dados Pos-Migracao

```
HUB LOGIN
  │
  ├─ Auth Gateway valida credenciais em core.usuarios
  ├─ Gera JWT com: sub, filialId, filialCodigo, modulos[{INVENTARIO, ADMIN}]
  │
  └─→ INVENTARIO FRONTEND (React)
        │
        ├─ Token no localStorage (mesmo padrao Gestao TI)
        ├─ AuthContext extrai: usuario, role INVENTARIO, filial ativa
        │
        └─→ INVENTARIO BACKEND (FastAPI)
              │
              ├─ security.py decodifica JWT
              ├─ Extrai filialId → UserSession.store_id
              ├─ Extrai modulos[INVENTARIO].role → UserSession.role
              ├─ Busca dados complementares em core.usuarios (se necessario)
              │
              ├─ Queries de dominio: filtram por store_id (= core.filiais.id)
              ├─ FKs: inventory_lists.store_id, inventory_lists.created_by
              │        → apontam para inventario.stores.id / inventario.users.id
              │        → que tem os MESMOS UUIDs do core (via migration 006)
              │
              └─ Protheus: usa filialCodigo ("01") para filtrar por filial
```

### 6.4 Views/Triggers — NAO utilizadas

As migrations 002-005 (views de compatibilidade + triggers INSTEAD OF) **NAO serao executadas**.
A Abordagem B e mais simples e direta:
- Sem camada intermediaria de views
- Sem triggers que podem ter edge cases
- FastAPI consulta direto o core quando precisa de dados de usuario/filial
- Tabelas inventario.stores/users servem apenas como cache para FKs existentes

---

## 7. PAGINAS REACT — MAPEAMENTO COMPLETO

| Pagina HTML Original | Pagina React | Sprint | Complexidade |
|---------------------|-------------|--------|--------------|
| login.html | — (removida, login pelo Hub) | 0 | — |
| dashboard.html | DashboardPage.tsx | 1 | Media |
| products.html | ProdutosPage.tsx | 1 | Media |
| stores.html | — (removida, gerenciado pelo core) | — | — |
| users.html | — (removida, gerenciado pelo Auth Gateway) | — | — |
| warehouses (novo) | ArmazensPage.tsx | 1 | Baixa |
| inventory.html | InventariosListPage.tsx | 2 | Media |
| inventory.html | InventarioCreatePage.tsx | 2 | Media |
| inventory.html | InventarioDetalhePage.tsx | 2-3 | **MUITO ALTA** |
| — (novo) | ContagemSelectorPage.tsx | 4 | Media |
| counting_improved.html | ContagemDesktopPage.tsx | 4 | **ALTA** |
| counting_mobile.html | ContagemMobilePage.tsx | 4 | **ALTA** |
| reports.html | RelatoriosPage.tsx | 5 | Media |
| discrepancies.html | DivergenciasPage.tsx | 5 | Media |
| comparison_results.html | (integrado em InventarioDetalhePage) | 3 | Media |
| import.html | ImportPage.tsx | 6 | Media |
| integration_protheus.html | ProtheusPage.tsx | 6 | Media-Alta |
| admin_monitoring.html | (removida ou integrada no dashboard) | 7 | Baixa |
| inventory_transfer_report.html | (integrado em relatorios) | 5 | Baixa |

**Paginas removidas**: 3 (login, stores, users — fornecidas pela plataforma)
**Paginas novas React**: ~14 (incluindo ContagemSelectorPage + Desktop + Mobile)

---

## 8. ESTIMATIVA DE ESFORCO

| Sprint | Descricao | Dias | Dependencias |
|--------|-----------|------|--------------|
| **0** | **Infra + Auth + Sync Core ↔ Inventario** | **2-3** | Nenhuma |
| 1 | Scaffold React + Dashboard + Cadastros | 2-3 | Sprint 0 |
| 2 | Inventarios List + Create + Detalhe (base) | 2-3 | Sprint 1 |
| **3** | **NUCLEO: Listas + Ciclos + Analise** | **5-7** | Sprint 2 |
| **4** | **Contagem Desktop + Mobile + Lotes** | **5-7** | Sprint 3 |
| 5 | Relatorios + Divergencias + Export | 2-3 | Sprint 4 |
| 6 | Protheus + Sync + Import | 3-4 | Sprint 5 |
| 7 | Polimento + Testes + Deploy | 2-3 | Sprint 6 |
| **TOTAL** | | **~24-33 dias** | |

---

## 9. RISCOS E MITIGACOES

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| IDs core ↔ inventario nao sincronizados | **Alta** | **Alto** | Migration 006 roda ANTES de qualquer outra coisa; validar via SQL |
| JWT mismatch (filialId vs store_id) | **Alta** | **Alto** | Reescrever security.py com testes no Sprint 0; checklist de validacao |
| Logica de ciclos tem edge cases nao documentados | Alta | Alto | Testar exaustivamente cada cenario de ciclo |
| Performance com inventarios grandes (1000+ itens) | Media | Medio | Paginacao no backend, lazy loading no frontend |
| FKs quebradas ao mudar fonte de verdade | Media | Alto | Cache em inventario.users/stores com mesmos UUIDs do core |
| Integracao Protheus quebrar | Baixa | Medio | Manter endpoints Protheus inalterados; so muda auth |
| Frontend muito grande (inventory.html = 24K linhas) | Alta | Medio | Componentizar agressivamente, dividir em sub-paginas |
| Usuarios ja acostumados com interface atual | Media | Medio | Manter fluxo identico, apenas modernizar visual |
| Filial do Protheus (codigo "01") vs UUID | Baixa | Medio | JWT inclui `filialCodigo` para queries Protheus |

---

## 10. DECISOES ARQUITETURAIS

### 10.1 Backend: Manter FastAPI (Python)

**Razao**: 111 endpoints funcionando com logica de negocios complexa e testada. Reescrever em NestJS nao agrega valor funcional e introduz risco.

### 10.2 Frontend: React + Tailwind (novo)

**Razao**: Consistencia visual com Gestao TI, componentizacao, manutenibilidade. As 24.000 linhas de inventory.html sao insustentaveis a longo prazo.

### 10.3 Schema: Manter `inventario` separado

**Razao**: Schema ja existe, tabelas complexas com views e triggers de compatibilidade. Nao mexer no que funciona.

### 10.4 Auth: JWT unificado via Auth Gateway

**Razao**: Login unico, gerenciamento centralizado de usuarios e permissoes.

### 10.5 Stores/Users: Usar entidades do core

**Razao**: Eliminar duplicacao. Filiais e usuarios ja existem no schema core.

### 10.6 Nomenclatura: camelCase no frontend, snake_case no backend

**Razao**: Convencao padrao de cada ecosistema. Converter via Pydantic alias ou middleware.

---

## 11. PROXIMOS PASSOS

1. **Aprovacao deste plano**
2. **Sprint 0**: Configurar nginx + auth JWT — validar que o backend aceita tokens da plataforma
3. **Sprint 1**: Scaffold React + paginas simples — validar que a estrutura funciona
4. **Sprint 2-3**: Implementar o nucleo (listas + ciclos) — ponto mais critico
5. **Sprint 4-7**: Completar demais paginas
6. **Deploy**: Atualizar docker-compose, testar end-to-end

---

## APENDICE A: Tabelas do Schema `inventario`

### Tabelas de dominio (manter como estao)
1. warehouses
2. products
3. product_barcodes
4. product_stores
5. product_prices
6. inventory_lists
7. inventory_items
8. inventory_items_snapshot
9. inventory_lots_snapshot
10. counting_lists
11. counting_list_items
12. countings
13. counting_lots
14. counting_assignments
15. discrepancies
16. closed_counting_rounds
17. cycle_audit_log
18. system_config
19. system_logs

### Tabelas Protheus (manter como estao)
20. sb1010
21. sb2010 (incluindo SB2 standalone)
22. sb8010
23. sbz010
24. slk010
25. da1010
26. sbm010
27. szd010
28. sze010
29. szf010

### Tabelas a descontinuar (migram para core)
30. stores → usa core.filiais (via view)
31. users → usa core.usuarios (via view)
32. user_stores → usa core.usuario_filiais (via view)

---

## APENDICE B: API Endpoints — Mapeamento para Services React

### inventory.service.ts
```
GET    /api/v1/inventory/lists                    → listar()
POST   /api/v1/inventory/lists                    → criar()
GET    /api/v1/inventory/lists/:id                → buscar()
PUT    /api/v1/inventory/lists/:id                → atualizar()
DELETE /api/v1/inventory/lists/:id                → excluir()
POST   /api/v1/inventory/lists/:id/items          → adicionarItens()
GET    /api/v1/inventory/lists/:id/items          → listarItens()
POST   /api/v1/inventory/lists/:id/release        → liberarParaContagem()
POST   /api/v1/inventory/lists/:id/close-round    → encerrarRodada()
POST   /api/v1/inventory/lists/:id/finalize       → finalizarInventario()
POST   /api/v1/inventory/lists/:id/redistribute   → redistribuirProdutos()
GET    /api/v1/inventory/lists/:id/counters-by-round → contadoresPorRodada()
```

### counting.service.ts
```
GET    /api/v1/inventory/counting-lists/:id               → buscarLista()
POST   /api/v1/inventory/counting-lists                   → criarLista()
PUT    /api/v1/inventory/counting-lists/:id                → atualizarLista()
DELETE /api/v1/inventory/counting-lists/:id                → excluirLista()
POST   /api/v1/inventory/counting-lists/:id/release        → liberarLista()
POST   /api/v1/inventory/counting-lists/:id/finalize-cycle → finalizarCiclo()
POST   /api/v1/inventory/items/:id/count                   → registrarContagem()
GET    /api/v1/inventory/items/:id/counts                  → historicoContagens()
GET    /api/v1/inventory/items/:id/lots-snapshot            → lotesSnapshot()
GET    /api/v1/inventory/items/:id/next-count               → proximaContagem()
GET    /api/v1/inventory/my-products                        → meusProdutos()
POST   /api/v1/inventory/assign-by-criteria                 → atribuirPorCriterio()
```

### product.service.ts
```
GET    /api/v1/products/                          → listar()
GET    /api/v1/products/:id                       → buscar()
POST   /api/v1/products/                          → criar()
PUT    /api/v1/products/:id                       → atualizar()
DELETE /api/v1/products/:id                       → excluir()
```

### protheus.service.ts
```
POST   /api/v1/sync/protheus/hierarchy            → sincronizarHierarquia()
POST   /api/v1/sync/protheus/products             → sincronizarProdutos()
POST   /api/v1/integration/preview                → previewIntegracao()
POST   /api/v1/integration/save                   → salvarIntegracao()
POST   /api/v1/integration/send/:id               → enviarIntegracao()
```

---

*Fim do Plano de Migracao v1.0*
