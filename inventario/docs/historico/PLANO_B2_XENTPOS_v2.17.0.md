# Plano de Implementação: Visualização b2_xentpos v2.17.0

**Data**: 31/10/2025
**Versão**: 2.17.0
**Status**: 📋 **PLANEJAMENTO** (Aguardando aprovação)

---

## 🎯 Objetivo

Implementar visualização completa do campo `b2_xentpos` (Entregas Posteriores) nas páginas de contagem e gerenciamento de listas, utilizando **3 colunas separadas** para transparência total dos cálculos.

### Motivação
- ✅ Campo já implementado no backend (v2.17.0)
- ✅ Campo já funcional na adição de produtos
- ❌ **Falta visualização nas páginas de contagem e relatórios**
- ❌ Usuários não entendem de onde vem o "Saldo Esperado"

---

## 📊 Layout Aprovado (Opção B)

### Nomenclatura Protheus (Aprovada pelo Usuário)
```
┌─────────────────┬──────────────────┬────────────────┬─────────┬────────────┐
│ Saldo Estoque   │ Entregas Post.   │ Total Esperado │ 1ª Cont │ Diferença  │
├─────────────────┼──────────────────┼────────────────┼─────────┼────────────┤
│ 30.00           │ +10.84           │ 40.84          │ 60.00   │ +19.16     │
│ (b2_qatu)       │ (b2_xentpos)     │ (soma)         │ (count) │ (diferença)│
└─────────────────┴──────────────────┴────────────────┴─────────┴────────────┘
```

### Cálculos Atualizados
```javascript
// ANTES (v2.16.2):
total_esperado = b2_qatu  // Apenas saldo em estoque
diferenca = count_cycle_1 - b2_qatu

// DEPOIS (v2.17.0):
saldo_estoque = b2_qatu
entregas_posteriores = b2_xentpos || 0
total_esperado = b2_qatu + b2_xentpos
diferenca = count_cycle_1 - (b2_qatu + b2_xentpos)
```

### Formatação Visual
- **Saldo Estoque**: Número com 2 casas decimais (`30.00`)
- **Entregas Post.**: Prefixo `+` se positivo (`+10.84`), sem prefixo se zero (`0.00`)
- **Total Esperado**: Número com 2 casas decimais (`40.84`)
- **Diferença**:
  - Verde (`text-success`) se zero (`0.00`)
  - Vermelho (`text-danger`) se divergente (`+19.16` ou `-5.00`)

---

## 🗂️ Escopo de Alterações

### 1. **counting_improved.html** (Contagem Desktop)

#### 1.1. Tabela Principal (Linha ~200-300)
**Localização**: `<table id="countingProductsTable">`

**ANTES**:
```html
<thead>
  <tr>
    <th>Código</th>
    <th>Descrição</th>
    <th>Qtd Esperada</th>  <!-- ❌ COLUNA ÚNICA -->
    <th>1ª Contagem</th>
    <th>Diferença</th>
  </tr>
</thead>
```

**DEPOIS**:
```html
<thead>
  <tr>
    <th>Código</th>
    <th>Descrição</th>
    <th>Saldo Estoque</th>        <!-- ✅ NOVA COLUNA 1 -->
    <th>Entregas Post.</th>        <!-- ✅ NOVA COLUNA 2 -->
    <th>Total Esperado</th>        <!-- ✅ NOVA COLUNA 3 -->
    <th>1ª Contagem</th>
    <th>Diferença</th>
  </tr>
</thead>
```

#### 1.2. Função `renderCountingProducts()` (Linha ~1500-1700)
**Localização**: Função que popula tabela

**ALTERAÇÕES**:
```javascript
// ANTES:
const expectedQty = item.expected_quantity || 0;
html += `<td class="text-end">${expectedQty.toFixed(2)}</td>`;

// DEPOIS:
const b2Qatu = item.b2_qatu || 0;
const b2Xentpos = item.b2_xentpos || 0;
const totalEsperado = b2Qatu + b2Xentpos;

html += `<td class="text-end">${b2Qatu.toFixed(2)}</td>`;
html += `<td class="text-end text-primary">${b2Xentpos > 0 ? '+' : ''}${b2Xentpos.toFixed(2)}</td>`;
html += `<td class="text-end fw-bold">${totalEsperado.toFixed(2)}</td>`;

// Recalcular diferença
const count1 = parseFloat(item.count_cycle_1) || 0;
const diferenca = count1 - totalEsperado;
const diffClass = Math.abs(diferenca) < 0.01 ? 'text-success' : 'text-danger';
html += `<td class="text-end ${diffClass}">${diferenca.toFixed(2)}</td>`;
```

#### 1.3. Filtros de Ciclo 2 e 3 (Linhas ~2700-2900)
**Localização**: Funções `loadCountingListProducts()` com filtros de divergência

**ALTERAÇÕES**:
```javascript
// ANTES:
const systemQty = parseFloat(product.expected_quantity) || 0;

// DEPOIS:
const b2Qatu = parseFloat(product.b2_qatu) || 0;
const b2Xentpos = parseFloat(product.b2_xentpos) || 0;
const systemQty = b2Qatu + b2Xentpos;
```

---

### 2. **counting_mobile.html** (Contagem Mobile)

#### 2.1. Cards de Produto (Linha ~400-600)
**Localização**: `<div class="product-card">`

**ESTRATÉGIA**: Exibição condicional baseada em perfil

**OPERATOR (Contagem Cega)**:
```html
<!-- NÃO exibir nenhuma informação de quantidade esperada -->
<div class="product-info">
  <div class="product-code">00082027</div>
  <div class="product-name">PROLONGADOR ESG 150X200MM90001</div>
  <!-- ❌ SEM quantidade esperada -->
</div>
```

**SUPERVISOR (Visualização Completa)**:
```html
<div class="product-info">
  <div class="product-code">00082027</div>
  <div class="product-name">PROLONGADOR ESG 150X200MM90001</div>
  <!-- ✅ COM breakdown detalhado -->
  <div class="expected-qty-details mt-2 text-muted small">
    <span>Estoque: <b>30.00</b></span> |
    <span class="text-primary">Entregas: <b>+10.84</b></span> |
    <span class="fw-bold">Total: <b>40.84</b></span>
  </div>
</div>
```

#### 2.2. Função `renderMobileProducts()` (Linha ~800-1000)
**ALTERAÇÕES**:
```javascript
// Detectar perfil do usuário
const userRole = localStorage.getItem('user_role');

// Se OPERATOR: não renderizar quantidade esperada
if (userRole === 'OPERATOR') {
    // Modo cego: apenas código e descrição
    return `<div class="product-card">...</div>`;
}

// Se SUPERVISOR/ADMIN: renderizar breakdown completo
const b2Qatu = item.b2_qatu || 0;
const b2Xentpos = item.b2_xentpos || 0;
const totalEsperado = b2Qatu + b2Xentpos;

return `
  <div class="expected-qty-details">
    <span>Estoque: <b>${b2Qatu.toFixed(2)}</b></span> |
    <span class="text-primary">Entregas: <b>${b2Xentpos > 0 ? '+' : ''}${b2Xentpos.toFixed(2)}</b></span> |
    <span class="fw-bold">Total: <b>${totalEsperado.toFixed(2)}</b></span>
  </div>
`;
```

---

### 3. **inventory.html** (Modais)

#### 3.1. Modal "Ver Detalhes" (Linha ~21000-21500)
**Localização**: `<div id="inventoryDetailsModal">`

**TABELA SINTÉTICA** (Primeira tabela):
```html
<!-- ANTES -->
<th>Qtd Esperada</th>

<!-- DEPOIS -->
<th>Saldo Estoque</th>
<th>Entregas Post.</th>
<th>Total Esperado</th>
```

**TABELA ANALÍTICA** (Tabela de lotes):
```html
<!-- Manter mesma estrutura (já usa snapshot) -->
<th>Lote</th>
<th>Qtd Esperada</th>  <!-- Snapshot por lote -->
<th>Contagem</th>
```

#### 3.2. Modal "Análise de Inventário" (Linha ~22000-22500)
**Localização**: `<div id="inventoryAnalysisModal">`

**ALTERAÇÕES**:
```javascript
// ANTES:
<td>${product.expected_quantity || 0}</td>

// DEPOIS:
const b2Qatu = product.b2_qatu || 0;
const b2Xentpos = product.b2_xentpos || 0;
const totalEsperado = b2Qatu + b2Xentpos;

html += `
  <td class="text-end">${b2Qatu.toFixed(2)}</td>
  <td class="text-end text-primary">${b2Xentpos > 0 ? '+' : ''}${b2Xentpos.toFixed(2)}</td>
  <td class="text-end fw-bold">${totalEsperado.toFixed(2)}</td>
`;
```

---

### 4. **reports.html** (Relatórios e Exportações)

#### 4.1. Tabela HTML de Relatório (Linha ~300-500)
**Localização**: `<table id="finalReportTable">`

**ALTERAÇÕES**:
```html
<!-- ANTES -->
<th>Qtd Sistema</th>
<th>1ª Contagem</th>

<!-- DEPOIS -->
<th>Saldo Estoque</th>
<th>Entregas Post.</th>
<th>Total Esperado</th>
<th>1ª Contagem</th>
```

#### 4.2. Função `exportToCSV()` (Linha ~1000-1200)
**ALTERAÇÕES**:
```javascript
// ANTES:
const headers = ['Código', 'Descrição', 'Qtd Sistema', '1ª Contagem', 'Diferença'];

// DEPOIS:
const headers = ['Código', 'Descrição', 'Saldo Estoque', 'Entregas Post.', 'Total Esperado', '1ª Contagem', 'Diferença'];

// Dados:
const b2Qatu = item.b2_qatu || 0;
const b2Xentpos = item.b2_xentpos || 0;
const totalEsperado = b2Qatu + b2Xentpos;

csvContent += `"${item.product_code}","${item.description}",${b2Qatu},${b2Xentpos},${totalEsperado},${count1},${diferenca}\n`;
```

#### 4.3. Função `exportToExcel()` (Linha ~1300-1500)
**ALTERAÇÕES**:
```javascript
// ANTES:
const excelData = data.map(item => ({
  'Código': item.product_code,
  'Descrição': item.description,
  'Qtd Sistema': item.expected_quantity || 0,
  '1ª Contagem': item.count_cycle_1 || 0
}));

// DEPOIS:
const excelData = data.map(item => {
  const b2Qatu = item.b2_qatu || 0;
  const b2Xentpos = item.b2_xentpos || 0;
  const totalEsperado = b2Qatu + b2Xentpos;

  return {
    'Código': item.product_code,
    'Descrição': item.description,
    'Saldo Estoque': b2Qatu,
    'Entregas Post.': b2Xentpos,
    'Total Esperado': totalEsperado,
    '1ª Contagem': item.count_cycle_1 || 0,
    'Diferença': (item.count_cycle_1 || 0) - totalEsperado
  };
});
```

#### 4.4. Função `exportToJSON()` (Linha ~1600-1700)
**ALTERAÇÕES**:
```javascript
// ANTES:
const jsonData = data.map(item => ({
  codigo: item.product_code,
  descricao: item.description,
  qtd_sistema: item.expected_quantity || 0,
  contagem_1: item.count_cycle_1 || 0
}));

// DEPOIS:
const jsonData = data.map(item => {
  const b2Qatu = item.b2_qatu || 0;
  const b2Xentpos = item.b2_xentpos || 0;
  const totalEsperado = b2Qatu + b2Xentpos;

  return {
    codigo: item.product_code,
    descricao: item.description,
    saldo_estoque: b2Qatu,
    entregas_posteriores: b2Xentpos,
    total_esperado: totalEsperado,
    contagem_1: item.count_cycle_1 || 0,
    diferenca: (item.count_cycle_1 || 0) - totalEsperado
  };
});
```

---

## 🔧 Backend (Verificação)

### Endpoints Afetados

#### 1. `GET /api/v1/inventory/lists/{list_id}/products` (counting_improved.html)
**Arquivo**: `backend/app/main.py` (linha ~5500)

**VALIDAÇÃO**: Confirmar que retorna `b2_qatu` e `b2_xentpos` separadamente
```python
# Deve retornar:
{
  "product_code": "00082027",
  "description": "PROLONGADOR ESG 150X200MM90001",
  "b2_qatu": 30.00,       # ✅ Saldo estoque
  "b2_xentpos": 10.84,    # ✅ Entregas posteriores
  "expected_quantity": 40.84,  # ✅ Total (calculado)
  "count_cycle_1": 60.00,
  # ...
}
```

#### 2. `GET /api/v1/inventory/lists/{list_id}/final-report` (reports.html)
**Arquivo**: `backend/app/main.py` (linha ~8500)

**VALIDAÇÃO**: Confirmar que retorna campos separados
```python
# Deve retornar:
{
  "products": [
    {
      "product_code": "00082027",
      "description": "PROLONGADOR ESG 150X200MM90001",
      "b2_qatu": 30.00,
      "b2_xentpos": 10.84,
      "expected_quantity": 40.84,
      # ...
    }
  ]
}
```

**⚠️ SE NÃO RETORNAR**: Adicionar campos explicitamente na query SQLAlchemy:
```python
# Modificar query para incluir:
.with_entities(
    InventoryItem.product_code,
    InventoryItem.description,
    InventoryItemSnapshot.b2_qatu,        # ✅ ADICIONAR
    InventoryItemSnapshot.b2_xentpos,     # ✅ ADICIONAR
    InventoryItemSnapshot.expected_quantity,
    # ...
)
```

---

## 📋 Checklist de Implementação

### Fase 1: Estrutura HTML (30 min)
- [ ] `counting_improved.html`: Adicionar 3 colunas no `<thead>`
- [ ] `counting_improved.html`: Atualizar estrutura de filtros (se necessário)
- [ ] `counting_mobile.html`: Preparar estrutura condicional (OPERATOR vs SUPERVISOR)
- [ ] `inventory.html`: Atualizar modal "Ver Detalhes"
- [ ] `inventory.html`: Atualizar modal "Análise de Inventário"
- [ ] `reports.html`: Adicionar 3 colunas na tabela HTML

### Fase 2: JavaScript de Renderização (1h)
- [ ] `counting_improved.html`: Modificar `renderCountingProducts()`
- [ ] `counting_improved.html`: Atualizar cálculo de divergência
- [ ] `counting_mobile.html`: Adicionar lógica condicional por perfil
- [ ] `inventory.html`: Atualizar função de detalhes
- [ ] `inventory.html`: Atualizar função de análise
- [ ] `reports.html`: Modificar renderização de tabela

### Fase 3: Exportações (30 min)
- [ ] `reports.html`: Atualizar `exportToCSV()`
- [ ] `reports.html`: Atualizar `exportToExcel()`
- [ ] `reports.html`: Atualizar `exportToJSON()`
- [ ] `reports.html`: Atualizar função de impressão

### Fase 4: Backend (Se Necessário) (30 min)
- [ ] Validar endpoint de produtos de contagem
- [ ] Validar endpoint de relatório final
- [ ] Adicionar campos `b2_qatu` e `b2_xentpos` nos retornos (se faltando)

### Fase 5: CSS e Estilo (15 min)
- [ ] Adicionar classes CSS para "Entregas Post." (cor azul/roxo)
- [ ] Garantir responsividade das novas colunas
- [ ] Validar tamanhos de coluna (não quebrar layout)

### Fase 6: Testes Funcionais (1h)
- [ ] **Teste 1**: Abrir `counting_improved.html` → Verificar 3 colunas visíveis
- [ ] **Teste 2**: Produto com `b2_xentpos > 0` → Verificar `+10.84` em azul
- [ ] **Teste 3**: Produto com `b2_xentpos = 0` → Verificar `0.00` sem prefixo
- [ ] **Teste 4**: Cálculo de diferença correto (`count - (b2_qatu + b2_xentpos)`)
- [ ] **Teste 5**: Mobile OPERATOR → NÃO mostrar quantidade esperada
- [ ] **Teste 6**: Mobile SUPERVISOR → Mostrar breakdown completo
- [ ] **Teste 7**: Exportar CSV → Verificar 3 colunas separadas
- [ ] **Teste 8**: Exportar Excel → Verificar 3 colunas separadas
- [ ] **Teste 9**: Exportar JSON → Verificar campos `saldo_estoque`, `entregas_posteriores`, `total_esperado`
- [ ] **Teste 10**: Imprimir relatório → Layout não quebrado

---

## 🧪 Casos de Teste

### Caso 1: Produto com Entregas Posteriores
**Produto**: `00082027` (PROLONGADOR ESG 150X200MM90001)

**Dados**:
- `b2_qatu`: 30.00
- `b2_xentpos`: 10.84
- `count_cycle_1`: 60.00

**Resultado Esperado**:
```
Saldo Estoque: 30.00
Entregas Post.: +10.84
Total Esperado: 40.84
1ª Contagem: 60.00
Diferença: +19.16 (VERMELHO)
```

### Caso 2: Produto SEM Entregas Posteriores
**Produto**: `00010009` (ANDROGENOL HERTAPE 5X10ML)

**Dados**:
- `b2_qatu`: 18.00
- `b2_xentpos`: 0.00
- `count_cycle_1`: 18.00

**Resultado Esperado**:
```
Saldo Estoque: 18.00
Entregas Post.: 0.00
Total Esperado: 18.00
1ª Contagem: 18.00
Diferença: 0.00 (VERDE)
```

### Caso 3: Produto com Contagem Menor que Esperado
**Produto**: `00012345` (PRODUTO TESTE)

**Dados**:
- `b2_qatu`: 50.00
- `b2_xentpos`: 5.00
- `count_cycle_1`: 40.00

**Resultado Esperado**:
```
Saldo Estoque: 50.00
Entregas Post.: +5.00
Total Esperado: 55.00
1ª Contagem: 40.00
Diferença: -15.00 (VERMELHO)
```

### Caso 4: Mobile OPERATOR (Contagem Cega)
**Perfil**: OPERATOR

**Resultado Esperado**:
```
┌─────────────────────────────────────┐
│ 00082027                            │
│ PROLONGADOR ESG 150X200MM90001      │
│                                     │
│ [Campo de Input para Contagem]     │
│ [Botão Salvar]                      │
└─────────────────────────────────────┘

❌ NÃO exibir: Saldo Estoque, Entregas Post., Total Esperado
```

### Caso 5: Mobile SUPERVISOR
**Perfil**: SUPERVISOR

**Resultado Esperado**:
```
┌─────────────────────────────────────┐
│ 00082027                            │
│ PROLONGADOR ESG 150X200MM90001      │
│                                     │
│ Estoque: 30.00 | Entregas: +10.84 | │
│ Total: 40.84                        │
│                                     │
│ [Campo de Input para Contagem]     │
│ [Botão Salvar]                      │
└─────────────────────────────────────┘

✅ Exibir breakdown completo
```

---

## 📦 Exportações - Estrutura de Dados

### CSV
```csv
Código,Descrição,Saldo Estoque,Entregas Post.,Total Esperado,1ª Contagem,Diferença
00082027,PROLONGADOR ESG 150X200MM90001,30.00,10.84,40.84,60.00,19.16
00010009,ANDROGENOL HERTAPE 5X10ML,18.00,0.00,18.00,18.00,0.00
```

### Excel
| Código   | Descrição                       | Saldo Estoque | Entregas Post. | Total Esperado | 1ª Contagem | Diferença |
|----------|---------------------------------|---------------|----------------|----------------|-------------|-----------|
| 00082027 | PROLONGADOR ESG 150X200MM90001  | 30.00         | 10.84          | 40.84          | 60.00       | 19.16     |
| 00010009 | ANDROGENOL HERTAPE 5X10ML       | 18.00         | 0.00           | 18.00          | 18.00       | 0.00      |

### JSON
```json
[
  {
    "codigo": "00082027",
    "descricao": "PROLONGADOR ESG 150X200MM90001",
    "saldo_estoque": 30.00,
    "entregas_posteriores": 10.84,
    "total_esperado": 40.84,
    "contagem_1": 60.00,
    "diferenca": 19.16
  },
  {
    "codigo": "00010009",
    "descricao": "ANDROGENOL HERTAPE 5X10ML",
    "saldo_estoque": 18.00,
    "entregas_posteriores": 0.00,
    "total_esperado": 18.00,
    "contagem_1": 18.00,
    "diferenca": 0.00
  }
]
```

---

## ⚠️ Riscos e Mitigações

### Risco 1: Quebra de Layout (Muitas Colunas)
**Impacto**: Tabela não cabe na tela (especialmente em resoluções menores)

**Mitigação**:
- Reduzir largura das colunas (`<th style="width: 100px;">`)
- Usar classes Bootstrap (`col-md-1`, `col-md-2`)
- Adicionar scroll horizontal em telas pequenas (`overflow-x: auto`)

### Risco 2: Performance (Recálculo de Diferença)
**Impacto**: Renderização lenta com muitos produtos (1000+)

**Mitigação**:
- Cálculo já feito no backend (campo `expected_quantity`)
- Frontend apenas exibe valores (não recalcula)
- Usar `DocumentFragment` para batch rendering

### Risco 3: Inconsistência de Dados (Backend não retorna campos)
**Impacto**: Campos vazios ou `undefined` no frontend

**Mitigação**:
- Validar retorno da API antes de implementar frontend
- Adicionar fallback: `const b2Xentpos = item.b2_xentpos || 0;`
- Testar com produto real (00082027)

### Risco 4: RBAC Mobile (OPERATOR vendo dados)
**Impacto**: Quebra do modo "contagem cega"

**Mitigação**:
- Validar `localStorage.getItem('user_role')` antes de renderizar
- Adicionar condicional explícita: `if (userRole === 'OPERATOR') return null;`
- Testar com usuário OPERATOR real

---

## 📅 Timeline de Implementação

### Estimativa Total: **3-4 horas**

```
┌─────────────────────────────────────────────────────────┐
│ Fase 1: HTML (30 min)                                   │
│ ├─ counting_improved.html                               │
│ ├─ counting_mobile.html                                 │
│ ├─ inventory.html                                       │
│ └─ reports.html                                         │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│ Fase 2: JavaScript (1h)                                 │
│ ├─ Funções de renderização                              │
│ ├─ Cálculo de diferença                                 │
│ └─ Lógica condicional mobile                            │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│ Fase 3: Exportações (30 min)                            │
│ ├─ CSV                                                  │
│ ├─ Excel                                                │
│ └─ JSON                                                 │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│ Fase 4: Backend (30 min)                                │
│ ├─ Validação de endpoints                               │
│ └─ Adicionar campos se necessário                       │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│ Fase 5: CSS (15 min)                                    │
│ ├─ Classes de estilo                                    │
│ └─ Responsividade                                       │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│ Fase 6: Testes (1h)                                     │
│ ├─ 10 casos de teste funcionais                         │
│ └─ Validação de exportações                             │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Critérios de Aceitação

### Funcional
- [ ] Todas as páginas exibem 3 colunas separadas (Saldo Estoque | Entregas Post. | Total Esperado)
- [ ] Cálculo de diferença usa `total_esperado` (b2_qatu + b2_xentpos)
- [ ] Entregas posteriores exibem prefixo `+` se > 0
- [ ] OPERATOR não vê quantidade esperada no mobile
- [ ] SUPERVISOR vê breakdown completo no mobile
- [ ] Exportações (CSV, Excel, JSON) incluem 3 campos separados

### Visual
- [ ] Layout não quebra em resoluções 1366x768 e superiores
- [ ] Cores aplicadas corretamente (azul para entregas, vermelho/verde para diferença)
- [ ] Tabelas responsivas com scroll horizontal em mobile

### Performance
- [ ] Renderização de 1000+ produtos em < 2 segundos
- [ ] Exportações não travam navegador

---

## 📝 Notas Finais

### Alinhamento com Protheus
- **"Saldo Em Estoque"**: Corresponde ao campo `b2_qatu` do Protheus
- **"Entregas Posteriores"**: Corresponde ao campo `b2_xentpos` do Protheus
- **"Total Esperado"**: Soma calculada (não existe campo nativo no Protheus)

### Decisões de Design
1. **Prefixo `+` em Entregas Post.**: Indica claramente que é uma adição ao estoque
2. **Cor azul para Entregas**: Diferencia visualmente de outras colunas
3. **Total Esperado em negrito**: Destaca o valor final usado no cálculo de diferença
4. **OPERATOR sem visualização**: Mantém integridade do processo de contagem cega

### Documentação Relacionada
- [PLANO_B2_XENTPOS_v2.17.0_OLD.md](PLANO_B2_XENTPOS_v2.17.0_OLD.md) - Plano original (desatualizado)
- [CORRECAO_BUG_FILTRO_PRODUTOS_v2.17.0.md](CORRECAO_BUG_FILTRO_PRODUTOS_v2.17.0.md) - Correções de filtro
- [CLAUDE.md](CLAUDE.md) - Documentação geral do projeto

---

**Aguardando aprovação para prosseguir com a implementação!** 🚀
