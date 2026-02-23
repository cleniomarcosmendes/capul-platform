# 🔧 GUIA TÉCNICO - Sistema de Inventário Protheus v4.2

**Para:** Desenvolvedores e Equipe Técnica
**Status:** Sistema Funcional Completo
**Última Atualização:** 24/09/2025

---

## 🎯 ARQUITETURA TÉCNICA

### **Stack Tecnológico**
- **Backend**: FastAPI (Python 3.11) + SQLAlchemy ORM
- **Database**: PostgreSQL 15 + Schema `inventario`
- **Frontend**: HTML5 + JavaScript ES6+ + Bootstrap 5
- **Infrastructure**: Docker + Docker Compose + Nginx
- **Authentication**: JWT + Bearer Token

### **Padrões Arquiteturais**
- **API RESTful** com OpenAPI/Swagger
- **MVC Pattern** (Models-Views-Controllers)
- **Dependency Injection** (FastAPI Depends)
- **Repository Pattern** (Services layer)
- **Event-Driven** (State machine para ciclos)

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS

### **Schema Principal: `inventario`**

**Tabelas Core:**
- `inventory_lists` - Inventários principais
- `inventory_items` - Produtos dentro dos inventários
- `counting_assignments` - Atribuições de contagem
- `countings` - Registros de contagem física
- `counting_lists` - Listas de contagem específicas

**Tabelas Protheus (Integração):**
- `sb1010` - Cadastro de produtos
- `sb2010` - Saldos por armazém
- `sb8010` - Controle de lotes
- `szd010` - Parâmetros de localização

**Campos Críticos para Sistema de Lotes:**

```sql
-- inventory_items
count_cycle_1, count_cycle_2, count_cycle_3  -- Totais por ciclo
needs_recount_cycle_1, needs_recount_cycle_2, needs_recount_cycle_3  -- Flags de controle

-- countings
inventory_item_id, quantity, lot_number, count_number  -- Detalhes de lote

-- sb1010
b1_rastro IN ('L', 'S')  -- Produtos com controle de lote
```

---

## 🚀 CORREÇÕES CRÍTICAS IMPLEMENTADAS

### **1. Sistema de Lotes - Backend**

**Problema Original:**
```python
# ❌ INCORRETO - Buscava apenas primeira contagem
countings_query = db.query(Counting).filter(
    Counting.inventory_item_id.in_(item_ids),
    Counting.count_number == 1  # Limitava a 1ª contagem
).all()
```

**Solução Implementada:**
```python
# ✅ CORRETO - Soma TODAS as contagens de lotes
from sqlalchemy import func

countings_sum_query = db.query(
    Counting.inventory_item_id,
    func.sum(Counting.quantity).label('total_quantity')
).filter(
    Counting.inventory_item_id.in_(item_ids)
).group_by(Counting.inventory_item_id).all()
```

**Arquivo:** `backend/app/api/v1/endpoints/assignments.py:823-837`

### **2. Mapeamento de Dados - Frontend**

**Problema Original:**
```javascript
// ❌ INCORRETO - Campo inexistente no endpoint de lista
counted_quantity: item.counted_quantity  // undefined
```

**Solução Implementada:**
```javascript
// ✅ CORRETO - Suporte a ambos os formatos
counted_quantity: item.requires_lot ?
    (item.counted_quantity || item.counted_qty || 0) :
    getCurrentCycleQuantity(item, currentCycleNumber)
```

**Arquivo:** `frontend/counting_improved.html:2389`

### **3. Modal de Lotes - Inputs Vazios**

**Problema Original:**
```javascript
// ❌ INCORRETO - Valor hardcoded vazio
<input value="" class="lot-count-input">
```

**Solução Implementada:**
```javascript
// ✅ CORRETO - Valor do lote salvo
<input value="${lot.counted_qty || ''}" class="lot-count-input">
```

**Arquivo:** `frontend/counting_improved.html:3942`

### **4. Seletor CSS - Elemento Não Encontrado**

**Problema Original:**
```javascript
// ❌ INCORRETO - Atributo inexistente
const row = document.createElement('tr');
// Sem data-product-id
```

**Solução Implementada:**
```javascript
// ✅ CORRETO - Atributo adicionado
const row = document.createElement('tr');
row.setAttribute('data-product-id', product.id);
```

**Arquivo:** `frontend/counting_improved.html:2841`

---

## 📡 ENDPOINTS CRÍTICOS

### **1. Produtos com Soma de Lotes**
```http
GET /api/v1/assignments/inventory/{inventory_id}/my-products
Authorization: Bearer token_usuario_timestamp
```

**Retorna:** Lista de produtos com `counted_quantity` sendo soma total de lotes

### **2. Produtos por Lista Específica**
```http
GET /api/v1/counting-lists/{list_id}/products
Authorization: Bearer token_usuario_timestamp
```

**Retorna:** Produtos com campo `counted_qty` (formato diferente)

### **3. Rascunho de Lotes**
```http
GET /api/v1/lot-draft/inventory/{inventory_id}/items/{item_id}/lot-draft
POST /api/v1/lot-draft/inventory/{inventory_id}/items/{item_id}/lot-draft
```

**Funcionalidade:** Sistema de persistência para modal de lotes

---

## 🎨 COMPONENTES FRONTEND

### **Função Principal: getTotalLotQuantity()**
```javascript
function getTotalLotQuantity(productId) {
    try {
        const product = products.find(p => p.id === productId);
        if (product) {
            // Debug detalhado
            console.log(`🔢 [getTotalLotQuantity] Debug - Produto ${productId}:`, {
                counted_quantity: product.counted_quantity,
                type: typeof product.counted_quantity,
                requires_lot: product.requires_lot,
                count_1: product.count_1,
                count_2: product.count_2,
                count_3: product.count_3,
                code: product.code
            });

            if (product.counted_quantity !== null && product.counted_quantity !== undefined) {
                return product.counted_quantity;
            }
        }
        return '-';
    } catch (error) {
        console.error('❌ Erro ao calcular total de lotes:', error);
        return '-';
    }
}
```

### **Atualização Forçada: updateQuantityCountedFields()**
```javascript
function updateQuantityCountedFields() {
    products.forEach(product => {
        if (product.requires_lot) {
            const quantitySpan = document.querySelector(`tr[data-product-id="${product.id}"] .quantity-counted`);
            if (quantitySpan) {
                const newValue = getTotalLotQuantity(product.id);
                quantitySpan.textContent = newValue;
                console.log(`🔄 [updateQuantityCountedFields] Produto ${product.code}: "${oldValue}" → "${newValue}"`);
            }
        }
    });
}
```

---

## 🔄 FLUXO DE DADOS

### **Carregamento de Produtos com Lote**

```
1. Frontend solicita: /api/v1/counting-lists/{id}/products
   ↓
2. Backend executa: SUM(quantity) GROUP BY inventory_item_id
   ↓
3. Retorna: { counted_qty: 1600 }  (soma total de lotes)
   ↓
4. Frontend mapeia: counted_quantity = counted_qty
   ↓
5. Exibe: <span class="quantity-counted">1600</span>
```

### **Modal de Lotes**

```
1. Usuário clica produto com lote
   ↓
2. loadLotDataFromStorage(productId)
   ↓
3. loadLotDraftFromBackend() → GET /lot-draft/...
   ↓
4. renderLotTable() com inputs preenchidos
   ↓
5. updateLotTotals() → salva no localStorage + backend
```

---

## 🧪 TESTES E VALIDAÇÃO

### **Cenários de Teste Críticos**

**1. Produto com Múltiplos Lotes:**
```javascript
// Dados de teste
produto_00010037: {
    requires_lot: true,
    lotes: [
        { lot_number: "L001", counted_qty: 400 },
        { lot_number: "L002", counted_qty: 600 },
        { lot_number: "L003", counted_qty: 600 }
    ],
    expected_total: 1600
}
```

**2. Transição Entre Endpoints:**
```javascript
// Endpoint A: assignments/my-products
{ counted_quantity: 1600 }

// Endpoint B: counting-lists/products
{ counted_qty: 1600 }

// Frontend deve suportar ambos
```

### **Scripts de Teste Automatizado**
- `test_ciclo_completo.sh` - Fluxo completo 3 ciclos
- `test_counting_lists_api.sh` - Validação endpoints
- `test_sistema_funcionamento.sh` - Integração geral

---

## 🛠️ DEBUGGING E MONITORAMENTO

### **Logs Importantes - Backend**
```python
logging.info(f"🔄 Total calculated for product {item_id}: {total_quantity}")
logging.debug(f"Found {len(countings)} lot entries for product")
```

### **Logs Importantes - Frontend**
```javascript
console.log('🔢 [getTotalLotQuantity] Debug - Produto:', productData);
console.log('🔄 [updateQuantityCountedFields] Atualizando campos...');
```

### **Pontos de Debugging**
1. **Network Tab**: Verificar requests/responses dos endpoints
2. **Console**: Logs detalhados de getTotalLotQuantity
3. **Application**: localStorage com dados de lotes
4. **Elements**: Verificar data-product-id nas rows

---

## 🚨 PONTOS DE ATENÇÃO

### **Compatibilidade de Dados**
```javascript
// SEMPRE usar mapeamento defensivo
const quantity = item.counted_quantity || item.counted_qty || 0;
```

### **Performance com Muitos Lotes**
```sql
-- Usar índices adequados
CREATE INDEX idx_countings_item_id ON inventario.countings(inventory_item_id);
CREATE INDEX idx_countings_lot ON inventario.countings(inventory_item_id, lot_number);
```

### **Concorrência Multi-usuário**
```python
# Usar transações para atomicidade
with db.begin():
    # Operações de contagem
    pass
```

---

## 📋 CHECKLIST DE MANUTENÇÃO

### **Antes de Modificar Sistema de Lotes**
- [ ] Backup do banco de dados
- [ ] Testar com produto sem lote
- [ ] Testar com produto com múltiplos lotes
- [ ] Verificar ambos endpoints (assignments + counting-lists)
- [ ] Validar localStorage + backend sync

### **Antes de Deploy**
- [ ] Executar suite de testes completa
- [ ] Verificar logs de erro no console
- [ ] Testar fluxo completo 3 ciclos
- [ ] Validar performance com lista grande
- [ ] Confirmar backup automático funcionando

---

## 🎯 EXTENSÕES FUTURAS

### **Funcionalidades Planejadas**
1. **Cache Redis** para performance
2. **WebSockets** para updates em tempo real
3. **API REST** para integração Protheus
4. **Relatórios PDF** automatizados
5. **Scanner QR Code** real via câmera

### **Otimizações Técnicas**
1. **Lazy Loading** para listas grandes
2. **Virtual Scrolling** no grid de produtos
3. **Service Worker** para modo offline
4. **Database Sharding** para multi-loja

---

## 📖 REFERÊNCIAS TÉCNICAS

**Documentação Relacionada:**
- `CLAUDE.md` - Configurações do projeto
- `docs/products_api_guide.md` - API de produtos
- `docs/TROUBLESHOOTING_CICLOS.md` - Resolução de problemas

**Arquivos de Configuração:**
- `docker-compose.yml` - Orquestração dos serviços
- `backend/requirements.txt` - Dependências Python
- `database/init.sql` - Schema inicial do banco

---

*Documentação técnica atualizada em 24/09/2025*
*Sistema validado e testado em ambiente de desenvolvimento* ✅