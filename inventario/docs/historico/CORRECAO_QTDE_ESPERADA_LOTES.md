# CORREÇÃO CRÍTICA - Qtde Esperada para Produtos com Lote

**Data**: 18/10/2025
**Versão**: v2.10.0.18 (A IMPLEMENTAR)
**Prioridade**: 🔴 **CRÍTICA**
**Impacto**: Cálculos de Divergência, Relatórios, Acertos de Estoque

---

## 🐛 **PROBLEMA IDENTIFICADO**

### **Descrição**
Produtos com controle de lote (`b1_rastro = 'L'`) estão exibindo quantidade esperada INCORRETA.

### **Causa Raiz**
Sistema usa `B2_QATU` (estoque total) para **TODOS** os produtos, mas para produtos com lote deveria usar **SOMA de B8_SALDO** (soma dos lotes individuais).

### **Exemplo Real**
```sql
-- Produto: 00010037 (COLOSSO PULV.OF 25ML)
SELECT
    SB1.B1_COD,
    SB1.B1_RASTRO,
    SB2.B2_QATU AS qtd_total,
    SUM(SB8.B8_SALDO) AS qtd_por_lotes
FROM SB1010 SB1
JOIN SB2010 SB2 ON SB2.B2_COD = SB1.B1_COD
LEFT JOIN SB8010 SB8 ON SB8.B8_PRODUTO = SB1.B1_COD AND SB8.B8_LOCAL = SB2.B2_LOCAL
WHERE SB1.B1_COD = '00010037'
  AND SB2.B2_LOCAL = '02'
GROUP BY SB1.B1_COD, SB1.B1_RASTRO, SB2.B2_QATU;

-- Resultado (HIPOTÉTICO):
-- B1_COD   | B1_RASTRO | B2_QATU  | qtd_por_lotes
-- 00010037 | L         | 99999.00 | 550.00  ← DIVERGÊNCIA!
```

### **Impacto**
- ❌ **Divergências calculadas erradas** (base errada)
- ❌ **Relatórios mostram dados incorretos**
- ❌ **Acertos de estoque baseados em valor errado**
- ❌ **Custo total do inventário incorreto**

---

## ✅ **SOLUÇÃO TÉCNICA**

### **Regra de Negócio**

```python
if produto.b1_rastro == 'L':  # Produto COM controle de lote
    qtde_esperada = SUM(SB8.B8_SALDO WHERE B8_PRODUTO = produto AND B8_LOCAL = armazem)
else:  # Produto SEM controle de lote
    qtde_esperada = SB2.B2_QATU WHERE B2_COD = produto AND B2_LOCAL = armazem
```

### **Justificativa**
1. ✅ **Consistência**: Fonte da verdade para lotes é SB8010
2. ✅ **Segurança**: Mesmo se B2_QATU estiver desatualizado, lotes estarão corretos
3. ✅ **Rastreabilidade**: Acertos serão por lote, então qtde esperada deve refletir lotes
4. ✅ **Integridade**: Garante que snapshot congela dados corretos

---

## 📍 **LOCAIS QUE PRECISAM CORREÇÃO**

### **🔴 CRÍTICO - Backend (Sincronização Protheus)**

#### **1. Criação de Snapshots de Inventário**

**Arquivo**: `backend/app/main.py` ou equivalente
**Função**: Sincronização com Protheus ao criar/atualizar inventário

**Correção Necessária:**
```python
# ❌ ANTES (ERRADO):
product_data = {
    'product_code': sb1.B1_COD,
    'expected_quantity': sb2.B2_QATU,  # ← ERRADO para produtos com lote!
    'has_lot': sb1.B1_RASTRO == 'L'
}

# ✅ DEPOIS (CORRETO):
if sb1.B1_RASTRO == 'L':
    # Produto COM lote: somar B8_SALDO
    expected_qty = db.query(func.sum(SB8010.B8_SALDO)).filter(
        SB8010.B8_PRODUTO == sb1.B1_COD,
        SB8010.B8_LOCAL == warehouse,
        SB8010.D_E_L_E_T_ == ''
    ).scalar() or 0.0
else:
    # Produto SEM lote: usar B2_QATU
    expected_qty = sb2.B2_QATU

product_data = {
    'product_code': sb1.B1_COD,
    'expected_quantity': expected_qty,  # ← CORRETO!
    'has_lot': sb1.B1_RASTRO == 'L'
}
```

**Arquivos para verificar:**
- [ ] `backend/app/main.py` - Função de sincronização
- [ ] `backend/app/services/protheus_sync.py` (se existir)
- [ ] Endpoint que cria `inventory_items`
- [ ] Endpoint que cria `inventory_items_snapshot`

---

#### **2. Snapshot de Lotes (inventory_lots_snapshot)**

**Arquivo**: Backend - criação de snapshots de lotes
**Tabela**: `inventario.inventory_lots_snapshot`

**Verificar:**
```python
# Ao criar snapshot de lotes, TAMBÉM salvar qtde esperada correta
for lot in sb8_lots:
    lot_snapshot = {
        'inventory_item_id': item_id,
        'lot_number': lot.B8_LOTECTL,
        'expected_quantity': lot.B8_SALDO,  # ✅ Quantidade esperada POR LOTE
        'location': lot.B8_LOCALI1,
        'expiry_date': lot.B8_DTVALID
    }
```

**Arquivos para verificar:**
- [ ] Função que cria `inventory_lots_snapshot`
- [ ] Endpoint POST/PUT de inventário

---

### **🟡 IMPORTANTE - Backend (Endpoints de API)**

#### **3. Endpoint: GET /api/v1/counting-lists/{id}/products**

**Arquivo**: `backend/app/api/v1/endpoints/counting_lists.py` ou `backend/app/main.py`

**Correção Necessária:**
```python
# Ao retornar produtos, garantir que expected_quantity está correto
for item in items:
    if item.inventory_item.has_lot:
        # Recalcular a partir de lotes
        expected_qty = db.query(func.sum(InventoryLotsSnapshot.expected_quantity)).filter(
            InventoryLotsSnapshot.inventory_item_id == item.inventory_item_id
        ).scalar() or item.inventory_item.expected_quantity
    else:
        expected_qty = item.inventory_item.expected_quantity

    item_data = {
        'product_code': item.inventory_item.product_code,
        'expected_quantity': expected_qty,  # ✅ CORRETO
        'system_qty': expected_qty,         # ✅ Alias
        # ...
    }
```

**Arquivos para verificar:**
- [ ] `backend/app/api/v1/endpoints/counting_lists.py`
- [ ] `backend/app/main.py` - Endpoints de produtos
- [ ] Qualquer endpoint que retorne `expected_quantity` ou `system_qty`

---

#### **4. Endpoint: GET /api/v1/inventories/{id}/counting-lists**

**Arquivo**: `backend/app/main.py` (linha 7909+)

**Verificar:**
- Garante que produtos agregados têm `expected_quantity` correto

---

### **🟢 DESEJÁVEL - Frontend (Exibição)**

#### **5. Modal "Gerenciar Lista"**

**Arquivo**: `frontend/inventory.html` ou `frontend/counting_improved.html`

**Ação:**
- ✅ Se backend corrigir, frontend automaticamente exibirá valores corretos
- ⚠️ Verificar se há algum cálculo local de `expected_quantity`

**Locais para verificar:**
- [ ] Função `loadProducts()` ou similar
- [ ] Renderização de tabela de produtos
- [ ] Cálculo de divergências

---

#### **6. Modal "Análise de Inventário"**

**Arquivo**: `frontend/inventory.html` (linha 17800+)

**Ação:**
- ✅ Se backend corrigir, frontend automaticamente exibirá valores corretos
- ⚠️ Verificar cálculos de `difference` e `% Diverg`

**Locais para verificar:**
- [ ] Função `showInventoryAnalysisModal()`
- [ ] Cálculo de `systemQty`
- [ ] Cálculo de `difference`

---

#### **7. Relatórios**

**Arquivos**: Qualquer geração de relatórios (CSV, Excel, JSON)

**Verificar:**
- [ ] Coluna "Qtde Esperada" usa valor correto
- [ ] Cálculos de divergência baseados em valor correto

---

### **🔵 OPCIONAL - Banco de Dados**

#### **8. Migração de Dados Existentes**

**Ação**: Corrigir `expected_quantity` em inventários já criados

```sql
-- Atualizar inventory_items para produtos com lote
UPDATE inventario.inventory_items ii
SET expected_quantity = (
    SELECT COALESCE(SUM(ils.expected_quantity), 0)
    FROM inventario.inventory_lots_snapshot ils
    WHERE ils.inventory_item_id = ii.id
)
WHERE ii.id IN (
    SELECT id FROM inventario.inventory_items
    WHERE product_id IN (
        SELECT id FROM inventario.products WHERE has_lot = true
    )
);
```

**Executar após correção do backend!**

---

## 🧪 **PLANO DE TESTES**

### **Teste 1: Produto COM Lote**

**Produto**: 00010037 (COLOSSO PULV.OF 25ML)

1. Verificar no Protheus:
   ```sql
   SELECT B8_PRODUTO, B8_LOTECTL, B8_SALDO
   FROM SB8010
   WHERE B8_PRODUTO = '00010037'
     AND B8_LOCAL = '02'
     AND D_E_L_E_T_ = '';
   ```

2. Somar lotes manualmente

3. Verificar no sistema:
   - Modal "Gerenciar Lista" → Qtde Esperada = SOMA DOS LOTES
   - Modal "Análise de Inventário" → Qtde Esperada = SOMA DOS LOTES

**Resultado Esperado:**
- ✅ Qtde Esperada = Soma de B8_SALDO (NÃO B2_QATU)

---

### **Teste 2: Produto SEM Lote**

**Produto**: 00010008 (CHAVE COMUT.FASE CM8450)

1. Verificar no Protheus:
   ```sql
   SELECT B2_COD, B2_QATU
   FROM SB2010
   WHERE B2_COD = '00010008'
     AND B2_LOCAL = '02'
     AND D_E_L_E_T_ = '';
   ```

2. Verificar no sistema:
   - Modal "Gerenciar Lista" → Qtde Esperada = B2_QATU
   - Modal "Análise de Inventário" → Qtde Esperada = B2_QATU

**Resultado Esperado:**
- ✅ Qtde Esperada = B2_QATU (comportamento atual mantido)

---

## 📊 **IMPACTO DA CORREÇÃO**

### **Antes da Correção:**
```
Produto 00010037 (COM LOTE):
- Qtde Esperada: 99999.00 (B2_QATU) ❌
- 1ª Contagem: 400.00 (lote 19201)
- Divergência: -99599.00 ❌ ERRADO!
```

### **Depois da Correção:**
```
Produto 00010037 (COM LOTE):
- Qtde Esperada: 550.00 (soma lotes SB8) ✅
- 1ª Contagem: 400.00 (lote 19201)
- Divergência: -150.00 ✅ CORRETO!
```

---

## 🎯 **PRIORIZAÇÃO**

### **Fase 1 - CRÍTICO (Implementar AGORA)**
1. ✅ Correção no backend - Sincronização com Protheus
2. ✅ Correção no backend - Criação de snapshots
3. ✅ Endpoint GET /counting-lists/{id}/products

### **Fase 2 - IMPORTANTE (Próxima Sprint)**
4. ✅ Migração de dados existentes
5. ✅ Testes completos em todos modais
6. ✅ Validação de relatórios

### **Fase 3 - DESEJÁVEL (Backlog)**
7. ✅ Auditoria de outros endpoints
8. ✅ Documentação de usuário atualizada

---

## 📝 **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] Identificar função de sincronização com Protheus
- [ ] Adicionar lógica condicional (SE lote, ENTÃO soma SB8)
- [ ] Atualizar criação de `inventory_items_snapshot`
- [ ] Atualizar criação de `inventory_lots_snapshot`
- [ ] Atualizar endpoints de API
- [ ] Criar migração de dados
- [ ] Executar testes (Teste 1 e Teste 2)
- [ ] Validar em ambiente de staging
- [ ] Deploy em produção
- [ ] Monitorar cálculos de divergência

---

## 👥 **STAKEHOLDERS**

- **Desenvolvedor Backend**: Correção de sincronização Protheus
- **Desenvolvedor Frontend**: Validação de exibição
- **DBA**: Migração de dados existentes
- **QA**: Testes de regressão completos
- **Usuário Final**: Validação de divergências

---

**Documento criado em**: 18/10/2025
**Status**: ✅ **IMPLEMENTADO v2.10.0.18**
**Responsável**: Claude Code
**Implementação**: Ver [IMPLEMENTACAO_CORRECAO_LOTES_v2.10.0.18.md](IMPLEMENTACAO_CORRECAO_LOTES_v2.10.0.18.md)
