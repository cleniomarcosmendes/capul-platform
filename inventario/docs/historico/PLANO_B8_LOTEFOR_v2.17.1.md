# PLANO DE IMPLEMENTAÇÃO: Campo b8_lotefor (Lote do Fornecedor)

**Versão**: v2.17.1
**Data**: 31/10/2025
**Status**: 📋 PLANEJAMENTO

---

## 📋 RESUMO EXECUTIVO

### Objetivo
Adicionar campo `b8_lotefor` na tabela SB8010 para exibir lote do fornecedor como informação complementar ao lote do cliente.

### Problema Resolvido
**Cenário**: Produtos sem etiqueta com número do lote do cliente (B8_LOTECLT)
**Impacto**: Contadores não conseguem identificar o lote apenas pelo código do cliente
**Solução**: Exibir **lote do fornecedor** (B8_LOTEFOR) como alternativa/complemento

### Benefício
✅ Identificação física facilitada durante contagem
✅ Dois números de referência (cliente + fornecedor)
✅ Redução de erros de identificação de lotes

---

## 🎯 ESCOPO DO PROJETO

### O Que Será Feito
1. ✅ Adicionar coluna `b8_lotefor` na tabela `inventario.sb8010_saldo_lote`
2. ✅ Atualizar modelo SQLAlchemy (`SB8010`)
3. ✅ Modificar lógica de importação (`import_produtos.py`)
4. ✅ Implementar função `formatLoteDisplay()` (concatenação inteligente)
5. ✅ Atualizar TODAS as telas que exibem lotes:
   - Telas de contagem (desktop/mobile)
   - Modais (Ver Detalhes, Análise, Adicionar Produtos)
   - Relatórios (Final, Comparação, Transferências)
6. ✅ Atualizar exportações (CSV, Excel, JSON)

### O Que NÃO Será Feito (Fora do Escopo)
- ❌ Editar lotes manualmente (dados vêm do Protheus)
- ❌ Criar lógica de validação de lote (Protheus controla)
- ❌ Relatório específico por lote de fornecedor

---

## 📐 ARQUITETURA DA SOLUÇÃO

### Formato de Visualização (Concatenação Inteligente)

```javascript
Regra de Apresentação:

├── Ambos preenchidos: "LOTE_CLIENTE | LOTE_FORNECEDOR"
├── Só cliente: "LOTE_CLIENTE"
├── Só fornecedor: "LOTE_FORNECEDOR (Forn.)"
└── Nenhum: "-"

Exemplos Reais:
├── "123456789012 | FOR-2024-001"    → Ambos
├── "123456789012"                   → Só cliente
├── "FOR-2024-001 (Forn.)"           → Só fornecedor
└── "-"                              → Nenhum
```

### Justificativa da Concatenação Inteligente
- 🎨 Visual limpo (sem pipes desnecessários)
- 📊 Fácil leitura (só exibe o que existe)
- 🔍 Identificação clara da origem "(Forn.)"
- ✅ Compatível com dados legados (produtos sem B8_LOTEFOR)

---

## 🔧 ETAPAS DE IMPLEMENTAÇÃO

### **ETAPA 1: Database Migration**

#### 1.1 - Criar Migration SQL
**Arquivo**: `database/migrations/007_add_b8_lotefor.sql`

```sql
-- Migration: Adicionar campo b8_lotefor (Lote do Fornecedor)
-- Data: 31/10/2025
-- Versão: v2.17.1

BEGIN;

-- Adicionar coluna b8_lotefor na tabela sb8010_saldo_lote
ALTER TABLE inventario.sb8010_saldo_lote
ADD COLUMN b8_lotefor VARCHAR(18) DEFAULT '' NOT NULL;

-- Comentário descritivo
COMMENT ON COLUMN inventario.sb8010_saldo_lote.b8_lotefor IS
'Número do lote do fornecedor. Utilizado como informação complementar ao b8_lotectl para facilitar identificação física durante contagem.';

-- Criar índice para otimizar consultas
CREATE INDEX idx_sb8010_lotefor ON inventario.sb8010_saldo_lote(b8_lotefor)
WHERE b8_lotefor <> '';

COMMIT;
```

#### 1.2 - Executar Migration
```bash
# Via Docker
docker-compose exec postgres psql -U inventario_user -d inventario_db \
  -f /docker-entrypoint-initdb.d/007_add_b8_lotefor.sql

# Validar
docker-compose exec postgres psql -U inventario_user -d inventario_db \
  -c "SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_schema = 'inventario'
        AND table_name = 'sb8010_saldo_lote'
        AND column_name = 'b8_lotefor';"
```

**Resultado Esperado**:
```
 column_name | data_type | character_maximum_length | column_default
-------------+-----------+--------------------------+----------------
 b8_lotefor  | varchar   |                       18 | ''
```

---

### **ETAPA 2: Backend Model Update**

#### 2.1 - Atualizar Modelo SB8010
**Arquivo**: `backend/app/models/models.py` (buscar classe `SB8010`)

**Localização**: Adicionar após campo `b8_lotectl` (linha ~450-500)

```python
class SB8010(Base):
    __tablename__ = "sb8010_saldo_lote"
    __table_args__ = {"schema": "inventario"}

    # ... campos existentes ...
    b8_lotectl = Column(String(10), nullable=True, comment="Lote do cliente")

    # ✅ NOVO CAMPO
    b8_lotefor = Column(String(18), default="", nullable=False,
                        comment="Lote do fornecedor")
```

---

### **ETAPA 3: Import Logic Update**

#### 3.1 - Modificar Função `_prepare_sb8010()`
**Arquivo**: `backend/app/api/v1/endpoints/import_produtos.py` (linhas ~550-650)

**Antes**:
```python
def _prepare_sb8010(saldo_lote: dict, filial: str) -> dict:
    return {
        "b8_filial": filial,
        "b8_cod": saldo_lote.get("b8_cod", "").strip(),
        "b8_local": saldo_lote.get("b8_local", "").strip(),
        "b8_lotectl": saldo_lote.get("b8_lotectl", "").strip(),
        "b8_saldo": float(saldo_lote.get("b8_saldo", 0)),
        # ... outros campos ...
    }
```

**Depois**:
```python
def _prepare_sb8010(saldo_lote: dict, filial: str) -> dict:
    return {
        "b8_filial": filial,
        "b8_cod": saldo_lote.get("b8_cod", "").strip(),
        "b8_local": saldo_lote.get("b8_local", "").strip(),
        "b8_lotectl": saldo_lote.get("b8_lotectl", "").strip(),
        "b8_lotefor": saldo_lote.get("b8_lotefor", "").strip(),  # ✅ NOVO
        "b8_saldo": float(saldo_lote.get("b8_saldo", 0)),
        # ... outros campos ...
    }
```

#### 3.2 - Atualizar Schema Pydantic (se existir)
**Arquivo**: `backend/app/schemas/` (buscar schema de SB8010)

```python
class SB8010Schema(BaseModel):
    # ... campos existentes ...
    b8_lotectl: Optional[str] = ""
    b8_lotefor: Optional[str] = ""  # ✅ NOVO
```

---

### **ETAPA 4: Frontend - Função de Formatação**

#### 4.1 - Criar Função Global `formatLoteDisplay()`

**Arquivo**: `frontend/js/common.js` (ou adicionar em cada HTML se não houver arquivo comum)

```javascript
/**
 * Formata exibição de lote com concatenação inteligente
 * @param {string} lotectl - Lote do cliente (B8_LOTECLT)
 * @param {string} lotefor - Lote do fornecedor (B8_LOTEFOR)
 * @returns {string} Lote formatado
 */
function formatLoteDisplay(lotectl, lotefor) {
    const hasLotectl = lotectl && lotectl.trim() !== '' && lotectl !== 'null';
    const hasLotefor = lotefor && lotefor.trim() !== '' && lotefor !== 'null';

    if (hasLotectl && hasLotefor) {
        return `${lotectl} | ${lotefor}`;
    } else if (hasLotectl) {
        return lotectl;
    } else if (hasLotefor) {
        return `${lotefor} (Forn.)`;
    } else {
        return '-';
    }
}
```

**Se não houver arquivo comum**: Adicionar função no início do `<script>` de cada HTML afetado.

---

### **ETAPA 5: Frontend - Telas de Contagem**

#### 5.1 - Atualizar `counting_improved.html` (Desktop)

**Localização**: Tabela de produtos (linha ~1500-1800)

**Antes**:
```html
<td>
    <span class="badge bg-secondary">${product.lot_number || '-'}</span>
</td>
```

**Depois**:
```html
<td>
    <span class="badge bg-secondary">
        ${formatLoteDisplay(product.b8_lotectl, product.b8_lotefor)}
    </span>
</td>
```

#### 5.2 - Atualizar `counting_mobile.html` (Mobile)

**Localização**: Card de produto (linha ~800-1000)

**Antes**:
```html
<div class="mb-2">
    <strong>Lote:</strong> <span id="productLot">${product.lot_number || '-'}</span>
</div>
```

**Depois**:
```html
<div class="mb-2">
    <strong>Lote:</strong>
    <span id="productLot">${formatLoteDisplay(product.b8_lotectl, product.b8_lotefor)}</span>
</div>
```

---

### **ETAPA 6: Frontend - Modais**

#### 6.1 - Modal "Ver Detalhes" (`inventory.html`)

**Localização**: Função `showProductDetailsModal()` (linha ~22800)

**Antes**:
```html
<tr>
    <td style="font-weight: 600; color: #6c757d;">Lote:</td>
    <td>
        <span class="badge bg-secondary">${product.lot_number || '-'}</span>
    </td>
</tr>
```

**Depois**:
```html
<tr>
    <td style="font-weight: 600; color: #6c757d;">Lote Cliente:</td>
    <td>
        <span class="badge bg-secondary">${product.b8_lotectl || '-'}</span>
    </td>
</tr>
<tr>
    <td style="font-weight: 600; color: #6c757d;">Lote Fornecedor:</td>
    <td>
        <span class="badge bg-info">${product.b8_lotefor || '-'}</span>
    </td>
</tr>
<tr>
    <td style="font-weight: 600; color: #6c757d;">Lote Completo:</td>
    <td>
        <span class="badge bg-primary">
            ${formatLoteDisplay(product.b8_lotectl, product.b8_lotefor)}
        </span>
    </td>
</tr>
```

**OBS**: No modal "Ver Detalhes" vamos exibir os 3 campos (separados + concatenado) para clareza máxima.

#### 6.2 - Modal "Análise de Inventário" (`inventory.html`)

**Localização**: Função `showAnalysisModal()` (linha ~22500)

**Aplicar mesma lógica**: Usar `formatLoteDisplay()` na coluna "Lote".

#### 6.3 - Modal "Adicionar Produtos" (`inventory.html`)

**Localização**: Função `showAddProductsModal()` (linha ~21800)

**Aplicar mesma lógica**: Usar `formatLoteDisplay()` na coluna "Lote".

---

### **ETAPA 7: Frontend - Relatórios**

#### 7.1 - Relatório Final (`reports.html`)

**Localização**: Tabela principal (linha ~1200-1500)

**Antes**:
```html
<tbody>
    ${products.map(p => `
        <tr>
            <td>${p.product_code}</td>
            <td>${p.product_description}</td>
            <td>${p.lot_number || '-'}</td>
            <!-- ... outras colunas ... -->
        </tr>
    `).join('')}
</tbody>
```

**Depois**:
```html
<tbody>
    ${products.map(p => `
        <tr>
            <td>${p.product_code}</td>
            <td>${p.product_description}</td>
            <td>${formatLoteDisplay(p.b8_lotectl, p.b8_lotefor)}</td>
            <!-- ... outras colunas ... -->
        </tr>
    `).join('')}
</tbody>
```

#### 7.2 - Comparação de Inventários (`comparison_results.html`)

**Localização**: Tabelas de resultados (linha ~200-400)

**Aplicar mesma lógica**: Usar `formatLoteDisplay()` na coluna "Lote".

#### 7.3 - Relatório de Transferências (`inventory_transfer_report.html`)

**Localização**: Tabela de produtos (linha ~150-250)

**Aplicar mesma lógica**: Usar `formatLoteDisplay()` na coluna "Lote".

---

### **ETAPA 8: Frontend - Exportações**

#### 8.1 - Exportação CSV

**Localização**: Função `exportToCSV()` em `reports.html` (linha ~1800)

**Antes**:
```javascript
const headers = ['Código', 'Descrição', 'Lote', 'Qtde Sistema', 'Qtde Contada'];

const rows = products.map(p => [
    p.product_code,
    p.product_description,
    p.lot_number || '-',
    p.system_qty,
    p.final_count
]);
```

**Depois**:
```javascript
const headers = [
    'Código', 'Descrição',
    'Lote Cliente', 'Lote Fornecedor', 'Lote Completo',  // ✅ 3 colunas
    'Qtde Sistema', 'Qtde Contada'
];

const rows = products.map(p => [
    p.product_code,
    p.product_description,
    p.b8_lotectl || '-',  // ✅ Cliente
    p.b8_lotefor || '-',  // ✅ Fornecedor
    formatLoteDisplay(p.b8_lotectl, p.b8_lotefor),  // ✅ Concatenado
    p.system_qty,
    p.final_count
]);
```

#### 8.2 - Exportação Excel

**Localização**: Função `exportToExcel()` em `reports.html` (linha ~1900)

**Aplicar mesma lógica**: Adicionar 3 colunas (cliente, fornecedor, concatenado).

#### 8.3 - Exportação JSON

**Localização**: Função `exportToJSON()` em `reports.html` (linha ~2000)

**Antes**:
```javascript
const data = products.map(p => ({
    codigo: p.product_code,
    descricao: p.product_description,
    lote: p.lot_number || '-',
    // ... outros campos ...
}));
```

**Depois**:
```javascript
const data = products.map(p => ({
    codigo: p.product_code,
    descricao: p.product_description,
    lote_cliente: p.b8_lotectl || '-',
    lote_fornecedor: p.b8_lotefor || '-',
    lote_completo: formatLoteDisplay(p.b8_lotectl, p.b8_lotefor),
    // ... outros campos ...
}));
```

---

### **ETAPA 9: Backend - Atualizar Endpoints**

#### 9.1 - Garantir que APIs Retornam `b8_lotefor`

**Endpoints Afetados**:
1. `GET /api/v1/inventory/{id}/products`
2. `GET /api/v1/inventory/final-report`
3. `GET /api/v1/inventory/{id}/details`
4. `POST /api/v1/inventory/compare`

**Exemplo (`main.py` ou `inventory.py`)**:
```python
# Query que busca produtos com lotes
query = db.query(
    InventoryItem.product_code,
    InventoryItem.product_description,
    SB8010.b8_lotectl,  # ✅ Já existe
    SB8010.b8_lotefor,  # ✅ ADICIONAR
    # ... outros campos ...
).join(
    SB8010,
    and_(
        SB8010.b8_cod == InventoryItem.product_code,
        SB8010.b8_filial == InventoryList.store_id
    ),
    isouter=True  # LEFT JOIN para produtos sem lote
).all()

# Resposta JSON
return {
    "products": [
        {
            "product_code": p.product_code,
            "b8_lotectl": p.b8_lotectl or "",
            "b8_lotefor": p.b8_lotefor or "",  # ✅ ADICIONAR
            # ... outros campos ...
        }
        for p in products
    ]
}
```

---

### **ETAPA 10: Testing Strategy**

#### 10.1 - Testes Unitários

**Arquivo**: `backend/tests/test_b8_lotefor.py` (NOVO)

```python
import pytest
from app.models.models import SB8010

def test_b8_lotefor_default_value(db_session):
    """Testa se b8_lotefor tem valor padrão vazio"""
    lote = SB8010(
        b8_filial="01",
        b8_cod="00000001",
        b8_local="01",
        b8_lotectl="123456",
        b8_saldo=100.0
        # b8_lotefor não fornecido → deve ser ''
    )
    db_session.add(lote)
    db_session.commit()

    assert lote.b8_lotefor == ""

def test_format_lote_display():
    """Testa função de formatação de lote"""
    # Ambos
    assert formatLoteDisplay("123456", "FOR-001") == "123456 | FOR-001"

    # Só cliente
    assert formatLoteDisplay("123456", "") == "123456"

    # Só fornecedor
    assert formatLoteDisplay("", "FOR-001") == "FOR-001 (Forn.)"

    # Nenhum
    assert formatLoteDisplay("", "") == "-"
```

#### 10.2 - Testes de Integração

**Cenário 1: Importação com b8_lotefor**
```bash
# 1. Preparar JSON de teste
echo '{
  "saldoLote": [
    {
      "b8_cod": "00000001",
      "b8_local": "01",
      "b8_lotectl": "123456789012",
      "b8_lotefor": "FOR-2024-001",
      "b8_saldo": 50
    }
  ]
}' > /tmp/test_lotefor.json

# 2. Fazer POST para endpoint de importação
curl -X POST http://localhost:8000/api/v1/import/produtos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_lotefor.json

# 3. Validar no banco
docker-compose exec postgres psql -U inventario_user -d inventario_db \
  -c "SELECT b8_cod, b8_lotectl, b8_lotefor FROM inventario.sb8010_saldo_lote WHERE b8_cod = '00000001';"

# Resultado esperado:
#   b8_cod   | b8_lotectl   | b8_lotefor
# -----------+--------------+---------------
#  00000001  | 123456789012 | FOR-2024-001
```

**Cenário 2: Frontend Exibe Formatação Correta**
```javascript
// Console do navegador (após carregar tela de contagem)
console.log(formatLoteDisplay("123456", "FOR-001"));  // "123456 | FOR-001"
console.log(formatLoteDisplay("123456", ""));         // "123456"
console.log(formatLoteDisplay("", "FOR-001"));        // "FOR-001 (Forn.)"
console.log(formatLoteDisplay("", ""));               // "-"
```

#### 10.3 - Testes Manuais (Checklist)

**Antes de Implementar**:
- [ ] Criar backup do banco de dados
- [ ] Criar branch `feature/b8_lotefor_v2.17.1`

**Após ETAPA 1 (Database)**:
- [ ] Executar migration
- [ ] Validar coluna criada com tipo VARCHAR(18)
- [ ] Verificar índice criado

**Após ETAPA 2 (Backend Model)**:
- [ ] Reiniciar backend: `docker-compose restart backend`
- [ ] Verificar logs sem erros
- [ ] Testar endpoint health

**Após ETAPA 3 (Import)**:
- [ ] Fazer importação de produtos
- [ ] Verificar se `b8_lotefor` foi importado
- [ ] SQL: `SELECT b8_lotectl, b8_lotefor FROM inventario.sb8010_saldo_lote LIMIT 10;`

**Após ETAPA 4 (Função JS)**:
- [ ] Testar função `formatLoteDisplay()` no console
- [ ] Validar 4 cenários (ambos, só cliente, só fornecedor, nenhum)

**Após ETAPA 5 (Telas Contagem)**:
- [ ] Abrir `counting_improved.html`
- [ ] Verificar coluna "Lote" exibe formato concatenado
- [ ] Testar em `counting_mobile.html`

**Após ETAPA 6 (Modais)**:
- [ ] Modal "Ver Detalhes" → 3 linhas (cliente, fornecedor, completo)
- [ ] Modal "Análise" → lote concatenado
- [ ] Modal "Adicionar Produtos" → lote concatenado

**Após ETAPA 7 (Relatórios)**:
- [ ] `reports.html` → lote concatenado
- [ ] `comparison_results.html` → lote concatenado
- [ ] `inventory_transfer_report.html` → lote concatenado

**Após ETAPA 8 (Exportações)**:
- [ ] CSV → 3 colunas de lote
- [ ] Excel → 3 colunas de lote
- [ ] JSON → 3 campos de lote

**Após ETAPA 9 (Endpoints)**:
- [ ] Testar APIs retornam `b8_lotefor`
- [ ] Validar resposta JSON via Postman/curl

---

## 📊 IMPACTO E ESTIMATIVAS

### Arquivos a Modificar
| Arquivo | Tipo | Linhas Estimadas | Complexidade |
|---------|------|------------------|--------------|
| `database/migrations/007_add_b8_lotefor.sql` | SQL | 25 | Baixa |
| `backend/app/models/models.py` | Python | 5 | Baixa |
| `backend/app/api/v1/endpoints/import_produtos.py` | Python | 10 | Baixa |
| `backend/app/main.py` (ou inventory.py) | Python | 20 | Média |
| `frontend/js/common.js` (ou inline) | JavaScript | 15 | Baixa |
| `frontend/inventory.html` | HTML/JS | 80 | Média |
| `frontend/counting_improved.html` | HTML/JS | 30 | Baixa |
| `frontend/counting_mobile.html` | HTML/JS | 20 | Baixa |
| `frontend/reports.html` | HTML/JS | 60 | Média |
| `frontend/comparison_results.html` | HTML/JS | 30 | Baixa |
| `frontend/inventory_transfer_report.html` | HTML/JS | 20 | Baixa |
| **TOTAL** | - | **~315 linhas** | **Média** |

### Estimativa de Tempo
- 🕒 **ETAPA 1 (Database)**: 20 minutos
- 🕒 **ETAPA 2 (Backend Model)**: 10 minutos
- 🕒 **ETAPA 3 (Import)**: 15 minutos
- 🕒 **ETAPA 4 (Função JS)**: 20 minutos
- 🕒 **ETAPA 5 (Telas Contagem)**: 30 minutos
- 🕒 **ETAPA 6 (Modais)**: 40 minutos
- 🕒 **ETAPA 7 (Relatórios)**: 40 minutos
- 🕒 **ETAPA 8 (Exportações)**: 30 minutos
- 🕒 **ETAPA 9 (Endpoints)**: 20 minutos
- 🕒 **ETAPA 10 (Testing)**: 45 minutos
- ⏱️ **TOTAL**: **~4 horas** (execução) + **45 minutos** (testes) = **4h45min**

### Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migration falhar | Baixa | Alto | Testar em staging, criar backup antes |
| Campo não vir do Protheus | Média | Médio | Validar JSON da API, usar fallback vazio '' |
| Função JS quebrar em navegadores antigos | Baixa | Baixo | Testar em Chrome/Firefox/Edge |
| Exportações com colunas extras confundirem usuário | Baixa | Baixo | Documentar no manual, treinar usuário |

---

## 🚀 ROTEIRO DE EXECUÇÃO

### Preparação (10 min)
```bash
# 1. Criar backup
docker-compose exec postgres pg_dump -U inventario_user inventario_db > backup_pre_lotefor_$(date +%Y%m%d_%H%M%S).sql

# 2. Criar branch
git checkout -b feature/b8_lotefor_v2.17.1

# 3. Validar ambiente
docker-compose ps
curl http://localhost:8000/health
```

### Desenvolvimento (4 horas)
1. ✅ Executar ETAPA 1 → Validar SQL
2. ✅ Executar ETAPA 2 → Reiniciar backend
3. ✅ Executar ETAPA 3 → Testar importação
4. ✅ Executar ETAPA 4 → Testar função JS no console
5. ✅ Executar ETAPA 5 → Testar contagem desktop/mobile
6. ✅ Executar ETAPA 6 → Testar todos os modais
7. ✅ Executar ETAPA 7 → Testar todos os relatórios
8. ✅ Executar ETAPA 8 → Testar exportações (CSV/Excel/JSON)
9. ✅ Executar ETAPA 9 → Testar APIs via Postman

### Testing (45 min)
- ✅ Checklist manual completo
- ✅ Testes de integração (2 cenários)
- ✅ Validação com usuário final

### Finalização (30 min)
```bash
# 1. Commits organizados
git add database/migrations/007_add_b8_lotefor.sql
git commit -m "feat: adicionar migration para campo b8_lotefor na SB8010"

git add backend/app/models/models.py backend/app/api/v1/endpoints/import_produtos.py
git commit -m "feat: adicionar campo b8_lotefor no modelo SB8010 e importação"

git add backend/app/main.py
git commit -m "feat: incluir b8_lotefor nos endpoints de inventário"

git add frontend/js/common.js
git commit -m "feat: adicionar função formatLoteDisplay() (concatenação inteligente)"

git add frontend/*.html
git commit -m "feat: exibir lote do fornecedor em todas as telas (v2.17.1)"

# 2. Atualizar CLAUDE.md
# (Adicionar seção v2.17.1 com resumo da implementação)

git add CLAUDE.md PLANO_B8_LOTEFOR_v2.17.1.md
git commit -m "docs: atualizar documentação para v2.17.1 (campo b8_lotefor)"

# 3. Merge para main (após aprovação)
git checkout main
git merge feature/b8_lotefor_v2.17.1
```

---

## 📚 REFERÊNCIAS

### Documentação Relacionada
- [PLANO_B2_XENTPOS_v2.17.0.md](PLANO_B2_XENTPOS_v2.17.0.md) - Implementação anterior (campo b2_xentpos)
- [CLAUDE.md](CLAUDE.md) - Status do projeto
- [GUIA_TECNICO_DESENVOLVEDOR_v4.2.md](docs/GUIA_TECNICO_DESENVOLVEDOR_v4.2.md) - Padrões de código

### Arquitetura Protheus
```
Campo b8_lotefor: Lote do Fornecedor
├── Origem: Sistema Protheus (Tabela SB8)
├── Tipo: CHARACTER(18)
├── Uso: Identificação complementar durante contagem física
└── Relacionamento: 1:1 com b8_lotectl (lote do cliente)
```

### Formato de Visualização
```
Concatenação Inteligente:
├── formatLoteDisplay(lotectl, lotefor)
├── Prioridade: Exibir ambos quando disponível
├── Fallback: Cliente → Fornecedor → "-"
└── Clareza: Identificar origem "(Forn.)"
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO

### Funcional
- [ ] Campo `b8_lotefor` existe na tabela SB8010
- [ ] Importação sincroniza campo do Protheus
- [ ] Função `formatLoteDisplay()` retorna formato correto
- [ ] Telas de contagem exibem lote concatenado
- [ ] Modais exibem lotes separados + concatenado
- [ ] Relatórios exibem lote concatenado
- [ ] Exportações incluem 3 colunas de lote

### Técnico
- [ ] Migration executada sem erros
- [ ] Modelo SQLAlchemy atualizado
- [ ] Índice criado para otimização
- [ ] Endpoints retornam campo no JSON
- [ ] Fallback '' evita erros JavaScript

### Qualidade
- [ ] Testes unitários passam
- [ ] Testes de integração validados
- [ ] 4 cenários de formatação testados (ambos, cliente, fornecedor, nenhum)
- [ ] Performance mantida (< 1s para carregar 1000 produtos)
- [ ] Documentação atualizada (CLAUDE.md)

### Usuário
- [ ] Contador visualiza lote do fornecedor
- [ ] Identificação física facilitada
- [ ] Exportações contêm informações completas
- [ ] Visual limpo (sem pipes desnecessários)

---

**✍️ Elaborado por**: Claude Code
**📅 Data**: 31/10/2025
**🎯 Versão Alvo**: v2.17.1
**⏱️ Tempo Estimado**: 4h45min
**📦 Dependências**: v2.17.0 (B2_XENTPOS) concluída
