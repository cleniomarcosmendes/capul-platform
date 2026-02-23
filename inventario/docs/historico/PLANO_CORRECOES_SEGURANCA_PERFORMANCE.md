# PLANO DE CORREÇÕES - Segurança e Performance

**Data da Análise**: 23/12/2025
**Versão do Sistema**: v2.19.12
**Total de Problemas Identificados**: 142+

---

## ÍNDICE

1. [Fase 1 - Correções Críticas de Segurança](#fase-1---correções-críticas-de-segurança)
2. [Fase 2 - Correções de Segurança Alta](#fase-2---correções-de-segurança-alta)
3. [Fase 3 - Correções de Performance](#fase-3---correções-de-performance)
4. [Fase 4 - Correções de Frontend](#fase-4---correções-de-frontend)
5. [Fase 5 - Refatoração e Manutenibilidade](#fase-5---refatoração-e-manutenibilidade)
6. [Checklist de Execução](#checklist-de-execução)

---

## FASE 1 - Correções Críticas de Segurança

**Prioridade**: CRÍTICA
**Estimativa**: 4-6 horas
**Impacto**: Previne ataques de SQL Injection e exposição de dados

### 1.1 SQL Injection - Corrigir queries com text()

#### Problema
Queries SQL usando `text(f"...")` com variáveis interpoladas permitem SQL Injection.

#### Arquivos Afetados
```
backend/app/main.py - linhas 10948, 10971, 11147
backend/app/api/v1/endpoints/sync_protheus.py - linhas 197, 213, 230, 245
backend/app/api/v1/endpoints/sync_products.py - linhas 194, 248, 257
backend/app/api/v1/endpoints/integration_protheus.py - linhas 1297-1323
backend/app/api/v1/endpoints/cycle_control.py - linhas 315-322
```

#### Solução

**Padrão ANTES (vulnerável):**
```python
query = text(f"""
    UPDATE inventario.inventory_items
    SET count_cycle_{current_cycle} = :quantity
    WHERE id = :item_id
""")
```

**Padrão DEPOIS (seguro):**
```python
# Opção 1: Usar dicionário de colunas válidas
VALID_CYCLE_COLUMNS = {
    1: "count_cycle_1",
    2: "count_cycle_2",
    3: "count_cycle_3"
}

if current_cycle not in VALID_CYCLE_COLUMNS:
    raise ValueError(f"Ciclo inválido: {current_cycle}")

column_name = VALID_CYCLE_COLUMNS[current_cycle]
query = text(f"""
    UPDATE inventario.inventory_items
    SET {column_name} = :quantity
    WHERE id = :item_id
""")

# Opção 2: Usar SQLAlchemy ORM (preferível)
from sqlalchemy import case
item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
if current_cycle == 1:
    item.count_cycle_1 = quantity
elif current_cycle == 2:
    item.count_cycle_2 = quantity
elif current_cycle == 3:
    item.count_cycle_3 = quantity
db.commit()
```

#### Tarefas
- [ ] 1.1.1 Criar constante `VALID_CYCLE_COLUMNS` em `main.py`
- [ ] 1.1.2 Refatorar queries em `main.py` (linhas 10948, 10971, 11147)
- [ ] 1.1.3 Criar constante `VALID_TABLES` em `sync_protheus.py`
- [ ] 1.1.4 Validar `table_name` antes de usar em queries
- [ ] 1.1.5 Refatorar SAVEPOINT em `sync_products.py` para usar nomes fixos
- [ ] 1.1.6 Refatorar `where_clause` em `integration_protheus.py` para usar bind parameters
- [ ] 1.1.7 Testar todas as funcionalidades afetadas

---

### 1.2 Remover Endpoints de Teste em Produção

#### Problema
Endpoints `/test/create-admin` e `/test-user` permitem criar/acessar usuário admin.

#### Arquivos Afetados
```
backend/app/main.py - linha 1464 (@app.post("/test/create-admin"))
backend/app/api/auth.py - linhas 89, 147 (/test-user, /test-assignments)
```

#### Solução
```python
# Opção 1: Remover completamente os endpoints

# Opção 2: Proteger com variável de ambiente
import os
ENABLE_TEST_ENDPOINTS = os.getenv("ENABLE_TEST_ENDPOINTS", "false").lower() == "true"

if ENABLE_TEST_ENDPOINTS:
    @app.post("/test/create-admin", tags=["Testing"])
    async def create_admin_user(...):
        ...
```

#### Tarefas
- [ ] 1.2.1 Remover ou proteger `/test/create-admin` em `main.py`
- [ ] 1.2.2 Remover ou proteger `/test-user` em `auth.py`
- [ ] 1.2.3 Remover ou proteger `/test-assignments` em `auth.py`
- [ ] 1.2.4 Adicionar `ENABLE_TEST_ENDPOINTS` ao `.env.example`

---

## FASE 2 - Correções de Segurança Alta

**Prioridade**: ALTA
**Estimativa**: 3-4 horas
**Impacto**: Protege credenciais e restringe acessos

### 2.1 Mover Secrets para Variáveis de Ambiente

#### Problema
Credenciais hardcoded no código fonte.

#### Arquivos Afetados
```
backend/app/core/database.py - linha 22
backend/app/core/config.py - linhas 24, 44, 54-57
backend/app/core/security.py - linha 21
backend/app/api/v1/endpoints/sync_protheus.py - linhas 28-29
```

#### Solução

**Criar/Atualizar `.env`:**
```env
# Database
DATABASE_URL=postgresql://inventario_user:SENHA_SEGURA@postgres:5432/inventario_protheus

# Security
SECRET_KEY=gerar-chave-256-bits-segura-aqui
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Protheus API
PROTHEUS_API_URL=http://192.168.0.251:8282
PROTHEUS_API_AUTH=Basic CREDENCIAL_SEGURA_BASE64
```

**Atualizar `config.py`:**
```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str  # Sem default!
    SECRET_KEY: str    # Sem default!
    PROTHEUS_API_AUTH: str  # Sem default!

    class Config:
        env_file = ".env"

settings = Settings()
```

#### Tarefas
- [ ] 2.1.1 Criar arquivo `.env.example` com placeholders
- [ ] 2.1.2 Atualizar `.gitignore` para ignorar `.env`
- [ ] 2.1.3 Remover defaults de `DATABASE_URL` em `database.py` e `config.py`
- [ ] 2.1.4 Remover default de `SECRET_KEY` em `config.py` e `security.py`
- [ ] 2.1.5 Remover default de `PROTHEUS_API_AUTH` em `config.py` e `sync_protheus.py`
- [ ] 2.1.6 Gerar nova `SECRET_KEY` segura (256 bits)
- [ ] 2.1.7 Atualizar documentação de deploy

---

### 2.2 Restringir CORS

#### Problema
CORS permite qualquer origem com credenciais.

#### Arquivo Afetado
```
backend/app/main.py - linhas 194-200
```

#### Solução
```python
# config.py
CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "https://localhost:8443").split(",")

# main.py
from app.core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Lista específica
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Métodos específicos
    allow_headers=["Authorization", "Content-Type"],  # Headers específicos
)
```

#### Tarefas
- [ ] 2.2.1 Adicionar `CORS_ORIGINS` ao `config.py`
- [ ] 2.2.2 Atualizar middleware CORS em `main.py`
- [ ] 2.2.3 Adicionar `CORS_ORIGINS` ao `.env.example`
- [ ] 2.2.4 Testar requisições do frontend

---

### 2.3 Sanitizar Mensagens de Erro

#### Problema
Exceções expõem detalhes internos do sistema.

#### Arquivos Afetados
```
backend/app/main.py - 30+ ocorrências de str(e) em HTTPException
backend/app/api/v1/endpoints/*.py - múltiplas ocorrências
```

#### Solução
```python
# Criar helper em core/exceptions.py
import logging
import traceback

logger = logging.getLogger(__name__)

def safe_error_response(e: Exception, context: str = "") -> str:
    """Retorna mensagem segura e loga detalhes internamente"""
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"[{error_id}] {context}: {str(e)}\n{traceback.format_exc()}")
    return f"Erro interno [{error_id}]. Contate o suporte."

# Uso
try:
    # operação
except Exception as e:
    raise HTTPException(
        status_code=500,
        detail=safe_error_response(e, "ao processar inventário")
    )
```

#### Tarefas
- [ ] 2.3.1 Criar `backend/app/core/exceptions.py` com helper
- [ ] 2.3.2 Refatorar `main.py` para usar `safe_error_response`
- [ ] 2.3.3 Refatorar endpoints em `api/v1/endpoints/`
- [ ] 2.3.4 Configurar logging para arquivo em produção

---

## FASE 3 - Correções de Performance

**Prioridade**: ALTA
**Estimativa**: 4-5 horas
**Impacto**: Melhora tempo de resposta e reduz carga no banco

### 3.1 Corrigir Queries N+1

#### Problema
Loops que executam queries individuais para cada item.

#### Arquivos Afetados
```
backend/app/api/v1/endpoints/inventory.py - linhas 115-131, 560-575, 1764-1773
backend/app/api/v1/endpoints/counting_lists.py - linhas 111-118
```

#### Solução

**Exemplo - `list_inventory_lists()` (inventory.py:115-131):**

```python
# ANTES (N+1)
inventories = db.query(InventoryList).filter(...).all()
for inventory in inventories:
    stats = db.query(...).filter(
        InventoryItem.inventory_list_id == inventory.id
    ).first()

# DEPOIS (1 query com subquery)
from sqlalchemy import func, case

stats_subquery = db.query(
    InventoryItem.inventory_list_id,
    func.count(InventoryItem.id).label('total_items'),
    func.sum(case((InventoryItem.count_cycle_1.isnot(None), 1), else_=0)).label('counted')
).group_by(InventoryItem.inventory_list_id).subquery()

inventories = db.query(
    InventoryList,
    stats_subquery.c.total_items,
    stats_subquery.c.counted
).outerjoin(
    stats_subquery,
    InventoryList.id == stats_subquery.c.inventory_list_id
).filter(...).all()
```

#### Tarefas
- [ ] 3.1.1 Refatorar `list_inventory_lists()` com subquery
- [ ] 3.1.2 Refatorar `list_inventory_items()` com JOIN
- [ ] 3.1.3 Refatorar `get_counters_by_round()` com JOIN
- [ ] 3.1.4 Refatorar `get_list_products()` em counting_lists.py
- [ ] 3.1.5 Adicionar testes de performance

---

### 3.2 Adicionar Paginação nos Endpoints Faltantes

#### Arquivos Afetados
```
backend/app/api/v1/endpoints/users.py - linha 31
backend/app/api/v1/endpoints/stores.py - linha 39
backend/app/main.py - linha 819
```

#### Solução
```python
# Schema de paginação
class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100)
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit

# Endpoint com paginação
@router.get("/users")
async def list_users(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db)
):
    total = db.query(func.count(User.id)).scalar()
    users = db.query(User).offset(pagination.offset).limit(pagination.limit).all()
    return {
        "items": users,
        "total": total,
        "page": pagination.page,
        "pages": (total + pagination.limit - 1) // pagination.limit
    }
```

#### Tarefas
- [ ] 3.2.1 Criar `PaginationParams` em `schemas/common.py`
- [ ] 3.2.2 Adicionar paginação em `list_users()`
- [ ] 3.2.3 Adicionar paginação em `list_stores()`
- [ ] 3.2.4 Adicionar paginação em `get_active_stores()`
- [ ] 3.2.5 Atualizar frontend para suportar paginação

---

### 3.3 Implementar Cache para Dados Estáticos

#### Problema
Queries repetidas para dados que raramente mudam.

#### Solução
```python
# Usar Redis já existente no projeto
import redis
import json
from functools import wraps

redis_client = redis.Redis(host='redis', port=6379, db=0)

def cache_response(ttl_seconds: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Tentar buscar do cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            # Executar função e cachear
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, ttl_seconds, json.dumps(result))
            return result
        return wrapper
    return decorator

# Uso
@app.get("/api/v1/products/filters")
@cache_response(ttl_seconds=600)  # 10 minutos
async def get_product_filters(...):
    ...
```

#### Tarefas
- [ ] 3.3.1 Criar decorator `cache_response` em `core/cache.py`
- [ ] 3.3.2 Aplicar cache em `/products/filters` (10 min)
- [ ] 3.3.3 Aplicar cache em `/stores` (5 min)
- [ ] 3.3.4 Adicionar endpoint para limpar cache manualmente
- [ ] 3.3.5 Documentar estratégia de invalidação de cache

---

## FASE 4 - Correções de Frontend

**Prioridade**: ALTA
**Estimativa**: 5-6 horas
**Impacto**: Previne XSS e memory leaks

### 4.1 Sanitizar innerHTML (Prevenir XSS)

#### Problema
Dados de API inseridos diretamente em innerHTML sem sanitização.

#### Arquivos Afetados
```
frontend/inventory.html - linha 1642
frontend/import.html - linha 2020
frontend/counting_improved.html - linhas 1675, 2680
frontend/dashboard.html - linha 717
frontend/products.html - múltiplas linhas
```

#### Solução

**Opção 1: Usar textContent (quando não precisa de HTML)**
```javascript
// ANTES (vulnerável)
element.innerHTML = userData.name;

// DEPOIS (seguro)
element.textContent = userData.name;
```

**Opção 2: Criar função de sanitização**
```javascript
// Adicionar em static/js/utils.js
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Uso quando PRECISA de HTML
element.innerHTML = `<strong>${sanitizeHTML(userData.name)}</strong>`;
```

**Opção 3: Usar DOMPurify (mais robusto)**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>
<script>
element.innerHTML = DOMPurify.sanitize(htmlContent);
</script>
```

#### Tarefas
- [ ] 4.1.1 Criar `frontend/static/js/utils.js` com `sanitizeHTML()`
- [ ] 4.1.2 Incluir utils.js em todos os HTML
- [ ] 4.1.3 Refatorar `inventory.html` - trocar innerHTML por textContent ou sanitizar
- [ ] 4.1.4 Refatorar `import.html` - linha 2020
- [ ] 4.1.5 Refatorar `counting_improved.html` - linhas 1675, 2680
- [ ] 4.1.6 Refatorar `products.html` - múltiplas ocorrências
- [ ] 4.1.7 Testar com payloads XSS

---

### 4.2 Corrigir Memory Leaks (Timers e Event Listeners)

#### Problema
setInterval/setTimeout sem cleanup e addEventListener sem removeEventListener.

#### Arquivos Afetados
```
frontend/inventory.html - 70+ timers, 49 event listeners sem cleanup
frontend/counting_improved.html - múltiplos setInterval
frontend/admin_monitoring.html - linha 496
frontend/login.html - linhas 828, 846-849
```

#### Solução

**Criar gerenciador de timers:**
```javascript
// utils.js
const TimerManager = {
    timers: [],
    intervals: [],

    setTimeout(callback, delay) {
        const id = window.setTimeout(callback, delay);
        this.timers.push(id);
        return id;
    },

    setInterval(callback, delay) {
        const id = window.setInterval(callback, delay);
        this.intervals.push(id);
        return id;
    },

    clearAll() {
        this.timers.forEach(id => window.clearTimeout(id));
        this.intervals.forEach(id => window.clearInterval(id));
        this.timers = [];
        this.intervals = [];
    }
};

// Limpar ao sair da página
window.addEventListener('beforeunload', () => TimerManager.clearAll());
window.addEventListener('pagehide', () => TimerManager.clearAll());

// Uso
TimerManager.setInterval(() => refreshData(), 30000);
```

**Criar gerenciador de event listeners:**
```javascript
const EventManager = {
    listeners: [],

    add(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });
    },

    removeAll() {
        this.listeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.listeners = [];
    }
};

// Limpar ao sair
window.addEventListener('beforeunload', () => EventManager.removeAll());
```

#### Tarefas
- [ ] 4.2.1 Criar `TimerManager` em `utils.js`
- [ ] 4.2.2 Criar `EventManager` em `utils.js`
- [ ] 4.2.3 Refatorar `inventory.html` para usar managers
- [ ] 4.2.4 Refatorar `counting_improved.html` para usar managers
- [ ] 4.2.5 Refatorar `admin_monitoring.html` para usar managers
- [ ] 4.2.6 Adicionar cleanup em navegação SPA (se aplicável)

---

### 4.3 Proteger localStorage

#### Problema
Tokens e dados sensíveis em localStorage sem proteção e JSON.parse sem try-catch.

#### Solução

**Criar wrapper seguro:**
```javascript
// utils.js
const SecureStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Erro ao salvar no storage:', e);
        }
    },

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Erro ao ler do storage:', e);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Erro ao remover do storage:', e);
        }
    },

    clear() {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Erro ao limpar storage:', e);
        }
    }
};

// Uso
const userData = SecureStorage.get('user_data', {});
SecureStorage.set('user_data', { name: 'Admin' });
```

#### Tarefas
- [ ] 4.3.1 Criar `SecureStorage` em `utils.js`
- [ ] 4.3.2 Refatorar todos os `JSON.parse(localStorage.getItem(...))` para usar `SecureStorage.get()`
- [ ] 4.3.3 Refatorar todos os `localStorage.setItem()` para usar `SecureStorage.set()`
- [ ] 4.3.4 Testar com localStorage vazio/corrompido

---

## FASE 5 - Refatoração e Manutenibilidade

**Prioridade**: MÉDIA
**Estimativa**: 6-8 horas
**Impacto**: Facilita manutenção futura

### 5.1 Consolidar Funções Duplicadas do Frontend

#### Problema
20 funções duplicadas em múltiplos arquivos HTML.

#### Solução
```
frontend/static/js/
├── utils.js          # Funções utilitárias (formatDate, formatCurrency, etc.)
├── auth.js           # Autenticação (checkAuthentication, logout, getAuthHeaders)
├── storage.js        # SecureStorage, TimerManager, EventManager
├── export.js         # Exportação (exportToCSV, exportToExcel, exportToJSON)
└── ui.js             # Interface (getStatusBadge, getStatusClass, showToast)
```

#### Tarefas
- [ ] 5.1.1 Criar estrutura de diretórios `frontend/static/js/`
- [ ] 5.1.2 Criar `utils.js` com funções utilitárias
- [ ] 5.1.3 Criar `auth.js` com funções de autenticação
- [ ] 5.1.4 Criar `export.js` com funções de exportação
- [ ] 5.1.5 Atualizar todos os HTML para incluir os novos arquivos JS
- [ ] 5.1.6 Remover funções duplicadas dos HTML
- [ ] 5.1.7 Testar todas as páginas

---

### 5.2 Dividir inventory.html (24.525 linhas)

#### Problema
Arquivo muito grande, difícil de manter.

#### Solução
```
frontend/
├── inventory.html              # Página principal (estrutura HTML)
├── static/js/inventory/
│   ├── main.js                 # Inicialização e event handlers
│   ├── api.js                  # Chamadas de API
│   ├── modals.js               # Gerenciamento de modais
│   ├── tables.js               # Renderização de tabelas
│   ├── filters.js              # Lógica de filtros
│   ├── cycles.js               # Lógica de ciclos
│   └── export.js               # Exportação específica
└── static/css/inventory.css    # Estilos específicos
```

#### Tarefas
- [ ] 5.2.1 Criar estrutura de diretórios
- [ ] 5.2.2 Extrair funções de API para `api.js`
- [ ] 5.2.3 Extrair gerenciamento de modais para `modals.js`
- [ ] 5.2.4 Extrair renderização de tabelas para `tables.js`
- [ ] 5.2.5 Extrair lógica de filtros para `filters.js`
- [ ] 5.2.6 Extrair lógica de ciclos para `cycles.js`
- [ ] 5.2.7 Atualizar imports no HTML
- [ ] 5.2.8 Testar todas as funcionalidades

---

## CHECKLIST DE EXECUÇÃO

### Pré-requisitos
- [ ] Backup do banco de dados
- [ ] Branch separada para correções (`git checkout -b fix/security-performance`)
- [ ] Ambiente de teste configurado

### Fase 1 - Crítico (4-6h)
- [ ] 1.1 SQL Injection corrigido
- [ ] 1.2 Endpoints de teste removidos/protegidos
- [ ] Testes de regressão executados

### Fase 2 - Alto (3-4h)
- [ ] 2.1 Secrets movidos para .env
- [ ] 2.2 CORS restringido
- [ ] 2.3 Mensagens de erro sanitizadas
- [ ] Testes de regressão executados

### Fase 3 - Performance (4-5h)
- [ ] 3.1 Queries N+1 corrigidas
- [ ] 3.2 Paginação adicionada
- [ ] 3.3 Cache implementado
- [ ] Testes de performance executados

### Fase 4 - Frontend (5-6h)
- [ ] 4.1 XSS prevenido (innerHTML sanitizado)
- [ ] 4.2 Memory leaks corrigidos
- [ ] 4.3 localStorage protegido
- [ ] Testes de segurança frontend executados

### Fase 5 - Refatoração (6-8h)
- [ ] 5.1 Funções consolidadas em arquivos JS
- [ ] 5.2 inventory.html dividido
- [ ] Testes de regressão completos

### Pós-implementação
- [ ] Code review
- [ ] Testes de penetração básicos
- [ ] Atualizar documentação
- [ ] Merge para main
- [ ] Deploy em produção
- [ ] Monitorar logs por 24h

---

## ESTIMATIVA TOTAL

| Fase | Tempo Estimado | Prioridade |
|------|----------------|------------|
| Fase 1 | 4-6 horas | CRÍTICA |
| Fase 2 | 3-4 horas | ALTA |
| Fase 3 | 4-5 horas | ALTA |
| Fase 4 | 5-6 horas | ALTA |
| Fase 5 | 6-8 horas | MÉDIA |
| **TOTAL** | **22-29 horas** | - |

---

## ORDEM DE EXECUÇÃO RECOMENDADA

1. **Dia 1**: Fase 1 (SQL Injection - CRÍTICO)
2. **Dia 2**: Fase 2 (Secrets, CORS, Erros)
3. **Dia 3**: Fase 4.1 (XSS Frontend)
4. **Dia 4**: Fase 3 (Performance Backend)
5. **Dia 5**: Fase 4.2 e 4.3 (Memory Leaks, Storage)
6. **Dia 6-7**: Fase 5 (Refatoração)

---

**Documento criado em**: 23/12/2025
**Autor**: Claude AI
**Versão**: 1.0
