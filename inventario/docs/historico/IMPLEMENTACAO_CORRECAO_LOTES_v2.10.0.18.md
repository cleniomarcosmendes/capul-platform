# IMPLEMENTAÇÃO - Correção de Qtde Esperada para Produtos com Lote

**Versão**: v2.10.0.18
**Data**: 18/10/2025
**Prioridade**: 🔴 **CRÍTICA**
**Status**: ✅ **IMPLEMENTADO**

---

## 📋 RESUMO DA IMPLEMENTAÇÃO

Implementada correção crítica para produtos com controle de lote (`b1_rastro='L'`).

### **Problema Corrigido**
- ❌ **Antes**: Todos produtos usavam `SB2010.B2_QATU` (estoque total)
- ✅ **Depois**: Produtos com lote usam `SUM(SB8010.B8_SALDO)` (soma de lotes por armazém)

### **Impacto**
- ✅ Divergências calculadas corretamente
- ✅ Relatórios com dados precisos
- ✅ Acertos de estoque baseados em valores reais
- ✅ Custo total do inventário correto

---

## 🔧 ARQUIVOS MODIFICADOS

### **1. backend/app/services/snapshot_service.py**
**Linhas modificadas**: 137-166

**Mudança**: Função `get_product_snapshot_data()` agora verifica `b1_rastro='L'` e calcula soma dos lotes:

```python
# ✅ v2.10.0.18 - CORREÇÃO CRÍTICA
if result.b1_rastro == 'L':
    logger.info(f"🔍 Produto {product_code} tem controle de lote - calculando soma de SB8010.B8_SALDO")

    # Calcular soma dos lotes no armazém específico
    lot_sum_query = text("""
        SELECT COALESCE(SUM(b8.b8_saldo), 0) as total_lot_qty
        FROM inventario.sb8010 b8
        WHERE b8.b8_produto = :product_code
          AND b8.b8_filial = :filial
          AND b8.b8_local = :warehouse
          AND b8.b8_saldo > 0
    """)

    lot_sum_result = db.execute(lot_sum_query, {...}).fetchone()
    total_lot_qty = float(lot_sum_result.total_lot_qty) if lot_sum_result else 0.0

    # Substituir b2_qatu pela soma dos lotes
    snapshot_data['b2_qatu'] = total_lot_qty
```

**Resultado**: Snapshots criados agora têm `b2_qatu` correto para produtos com lote.

---

### **2. backend/app/main.py**
**Linhas modificadas**: 1868-1924

**Mudança**: Ao adicionar produtos ao inventário, verifica tipo de rastreamento ANTES de buscar quantidade:

```python
# ✅ v2.10.0.18 - CORREÇÃO CRÍTICA
has_lot_control = (product_sb1010.b1_rastro == 'L')

if has_lot_control:
    # Produto COM lote: usar SUM(B8_SALDO)
    logger.info(f"🔍 Produto {product_code} tem controle de lote - calculando soma de SB8010.B8_SALDO")

    # Buscar filial da store
    store = db.query(Store).filter(Store.id == inventory.store_id).first()
    filial = store.code if store else '01'

    # Calcular soma dos lotes no armazém específico
    lot_sum_query = text("""
        SELECT COALESCE(SUM(b8.b8_saldo), 0) as total_lot_qty
        FROM inventario.sb8010 b8
        WHERE b8.b8_produto = :product_code
          AND b8.b8_filial = :filial
          AND b8.b8_local = :warehouse
          AND b8.b8_saldo > 0
    """)

    lot_sum_result = safe_query(db, lambda: db.execute(lot_sum_query, {...}).fetchone(), ...)
    expected_qty = validator.safe_number(lot_sum_result.total_lot_qty if lot_sum_result else 0.0, default=0.0)

    logger.info(f"📦 Produto {product_code} com lote: SUM(B8_SALDO)={expected_qty}")
else:
    # Produto SEM lote: usar B2_QATU
    saldo_total = safe_query(db, lambda: db.query(SB2010.b2_qatu).filter(...).scalar(), ...)
    expected_qty = validator.safe_number(saldo_total or 0.0, default=0.0)

    logger.info(f"📊 Produto {product_code} sem lote: B2_QATU={expected_qty}")
```

**Resultado**: Produtos adicionados ao inventário têm `expected_quantity` correto desde o início.

---

### **3. database/migrations/fix_lot_controlled_products_quantity_v2.10.0.18.sql**
**Arquivo novo**: Migração SQL para corrigir dados existentes

**Passos da migração**:
1. ✅ Criar backups de `inventory_items` e `inventory_items_snapshot`
2. ✅ Atualizar `inventory_items.expected_quantity` usando soma de `inventory_lots_snapshot`
3. ✅ Atualizar `inventory_items_snapshot.b2_qatu` usando soma de `inventory_lots_snapshot`
4. ✅ Queries de verificação e validação
5. ✅ Estatísticas da migração
6. ✅ Script de rollback se necessário

**Quando executar**: Após deploy do código corrigido, executar UMA VEZ no banco de produção.

---

## 🧪 PLANO DE TESTES

### **Teste 1: Produto COM Lote - Novo Inventário**

**Objetivo**: Verificar que produtos com lote usam soma de SB8

**Passos**:
1. Criar novo inventário (após deploy v2.10.0.18)
2. Adicionar produto com lote (ex: `00010037`)
3. Verificar logs do backend:
   ```
   🔍 Produto 00010037 tem controle de lote - calculando soma de SB8010.B8_SALDO
   📦 Produto 00010037 com lote: SUM(B8_SALDO)=550.00
   ✅ Snapshot capturado: 00010037 | Qty: 550.00 | Custo: ...
   ```

4. Verificar no banco:
   ```sql
   SELECT
       ii.product_code,
       ii.expected_quantity,
       iis.b2_qatu,
       (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id) AS sum_lots
   FROM inventario.inventory_items ii
   LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
   WHERE ii.product_code = '00010037';
   ```

**Resultado Esperado**:
- ✅ `expected_quantity` = soma de B8_SALDO (ex: 550.00)
- ✅ `b2_qatu` (snapshot) = soma de B8_SALDO (ex: 550.00)
- ✅ Valores consistentes entre `inventory_items` e `inventory_items_snapshot`

---

### **Teste 2: Produto SEM Lote - Novo Inventário**

**Objetivo**: Verificar que produtos sem lote continuam usando B2_QATU

**Passos**:
1. Criar novo inventário (após deploy v2.10.0.18)
2. Adicionar produto sem lote (ex: `00010008`)
3. Verificar logs do backend:
   ```
   📊 Produto 00010008 sem lote: B2_QATU=99999.00
   ✅ Snapshot capturado: 00010008 | Qty: 99999.00 | Custo: ...
   ```

4. Verificar no banco:
   ```sql
   SELECT
       ii.product_code,
       ii.expected_quantity,
       iis.b2_qatu,
       iis.b1_rastro
   FROM inventario.inventory_items ii
   LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
   WHERE ii.product_code = '00010008';
   ```

**Resultado Esperado**:
- ✅ `expected_quantity` = B2_QATU da SB2010
- ✅ `b1_rastro` != 'L'
- ✅ Comportamento mantido (sem quebras)

---

### **Teste 3: Migração de Dados Existentes**

**Objetivo**: Corrigir inventários criados ANTES da correção

**Passos**:
1. **Antes da migração**: Verificar produtos com lote que têm valores errados
   ```sql
   SELECT
       ii.product_code,
       iis.b1_desc,
       ii.expected_quantity AS qty_before,
       (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id) AS sum_lots,
       ABS(ii.expected_quantity - (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id)) AS difference
   FROM inventario.inventory_items ii
   LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
   WHERE iis.b1_rastro = 'L'
     AND ABS(ii.expected_quantity - (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id)) > 0.01
   LIMIT 10;
   ```

2. **Executar migração**: Rodar script SQL
   ```bash
   docker-compose exec postgres psql -U inventario_user -d inventario_db \
     -f /docker-entrypoint-initdb.d/migrations/fix_lot_controlled_products_quantity_v2.10.0.18.sql
   ```

3. **Após migração**: Verificar que valores foram corrigidos
   ```sql
   -- Deve retornar 0 linhas (nenhum produto com divergência)
   SELECT
       ii.product_code,
       ii.expected_quantity,
       (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id) AS sum_lots
   FROM inventario.inventory_items ii
   LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
   WHERE iis.b1_rastro = 'L'
     AND ABS(ii.expected_quantity - (SELECT SUM(ils.b8_saldo) FROM inventario.inventory_lots_snapshot ils WHERE ils.inventory_item_id = ii.id)) > 0.01;
   ```

**Resultado Esperado**:
- ✅ Query retorna 0 linhas (todos os produtos corrigidos)
- ✅ Backups criados (`inventory_items_backup_20251018`, etc.)
- ✅ Estatísticas mostram quantos produtos foram atualizados

---

### **Teste 4: Interface Frontend - Modal "Análise de Inventário"**

**Objetivo**: Verificar que interface mostra valores corretos

**Passos**:
1. Abrir inventário com produtos de ambos os tipos (com e sem lote)
2. Clicar em "Analisar Inventário"
3. Verificar coluna "Qtde Esperada":
   - Produto com lote: deve mostrar soma de lotes
   - Produto sem lote: deve mostrar B2_QATU

4. Comparar com banco de dados (valores devem bater)

**Resultado Esperado**:
- ✅ Valores consistentes entre frontend e backend
- ✅ Divergências calculadas corretamente
- ✅ Status dos produtos corretos (Conferido, Falta, Sobra)

---

## 📊 CHECKLIST DE DEPLOY

### **Pré-Deploy**
- [x] Código corrigido em `snapshot_service.py`
- [x] Código corrigido em `main.py`
- [x] Migração SQL criada
- [x] Testes planejados
- [x] Documentação completa

### **Deploy**
- [ ] Fazer backup do banco de dados COMPLETO
- [ ] Deploy do código v2.10.0.18 (backend)
- [ ] Restart do backend: `docker-compose restart backend`
- [ ] Verificar logs: `docker-compose logs -f backend | grep "v2.10.0.18"`

### **Pós-Deploy**
- [ ] Executar Teste 1 (produto com lote - novo inventário)
- [ ] Executar Teste 2 (produto sem lote - novo inventário)
- [ ] Verificar logs do backend (sem erros)
- [ ] Executar migração SQL (corrigir dados existentes)
- [ ] Executar Teste 3 (validar migração)
- [ ] Executar Teste 4 (validar frontend)

### **Validação Final**
- [ ] Criar inventário de produção real
- [ ] Adicionar 5-10 produtos (mistura de com/sem lote)
- [ ] Verificar quantidade esperada de cada produto
- [ ] Fazer contagens de teste
- [ ] Verificar divergências calculadas
- [ ] Validar com usuário final

---

## 🐛 TROUBLESHOOTING

### **Problema**: Logs não aparecem "v2.10.0.18"
**Solução**: Backend não foi reiniciado. Execute `docker-compose restart backend`

### **Problema**: Migração SQL falha com erro de permissão
**Solução**: Executar como usuário `inventario_user` ou `postgres`

### **Problema**: Valores ainda incorretos após migração
**Solução**: Verificar se há snapshots de lotes (`inventory_lots_snapshot`). Se não houver, produto não pode ser corrigido automaticamente.

### **Problema**: Produto com lote mostra quantidade = 0
**Causas possíveis**:
1. Nenhum lote tem `b8_saldo > 0` na SB8010
2. Filtro por armazém está correto? Verificar `b8_local`
3. Filtro por filial está correto? Verificar `b8_filial`

**Debug**:
```sql
SELECT b8_produto, b8_lotectl, b8_saldo, b8_local, b8_filial
FROM inventario.sb8010
WHERE b8_produto = 'SEU_PRODUTO'
  AND b8_local = 'SEU_ARMAZEM'
  AND b8_saldo > 0;
```

---

## 📝 NOTAS TÉCNICAS

### **Por que usar inventory_lots_snapshot na migração?**
- Snapshots são imutáveis (dados congelados)
- Refletem o estado EXATO do momento da criação do inventário
- Não dependem de mudanças futuras nas tabelas do Protheus

### **Por que SUM(B8_SALDO) e não B2_QATU?**
- B2_QATU pode estar desatualizado ou dessincronizado
- Lotes são a fonte da verdade para produtos rastreados
- Acertos de estoque serão feitos POR LOTE, então qtde esperada deve refletir lotes

### **Impacto em Performance**
- Snapshots: sem impacto (dados já calculados no momento da criação)
- Endpoints GET: sem impacto (retornam dados do banco, já corrigidos)
- Migração SQL: uma vez só, não afeta produção após execução

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Implementação**: CONCLUÍDA
2. ⏳ **Testes**: EM EXECUÇÃO
3. ⏳ **Deploy**: AGUARDANDO VALIDAÇÃO
4. ⏳ **Migração**: AGUARDANDO DEPLOY
5. ⏳ **Validação**: AGUARDANDO USUÁRIO FINAL

---

**Documento criado em**: 18/10/2025
**Última atualização**: 18/10/2025
**Responsável**: Claude Code
**Aprovação**: Aguardando testes

