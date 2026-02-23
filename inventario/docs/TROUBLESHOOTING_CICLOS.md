# 🔧 TROUBLESHOOTING - Sistema de Ciclos

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### 🔥🔥🔥 CORREÇÃO CRÍTICA v2.19.41 (08/01/2026) - NULL = 0 em Ciclos Encerrados

### **🔥 Quantidade Final Incorreta - Produto Não Contado no Ciclo 2/3**

**Sintoma**:
- Produto marcado para recontagem no ciclo 2
- Operador NÃO informa quantidade (deixa campo vazio/NULL)
- Sistema usa valor do ciclo 1 como quantidade final (ERRADO!)
- Relatórios e análises mostram valores incorretos

**Exemplo Real (Inventário 'emanoel', produto 00010119)**:
```
count_cycle_1 = 10    (operador encontrou 10 unidades no ciclo 1)
count_cycle_2 = NULL  (não informou no ciclo 2)
count_cycle_3 = NULL  (não informou no ciclo 3)
expected = 0

❌ ANTES: Sistema usava 10 como quantidade final
✅ DEPOIS: Sistema usa 0 como quantidade final (NULL = 0)
```

**Causa Raiz**:
- Quando `count_cycle_2 = NULL`, a função `calculateFinalQuantityByMajority` fazia fallback para `count_cycle_1`
- A lógica não tratava NULL como 0 quando o ciclo já foi encerrado
- Condição `hasCount2 = (count2 !== null)` retornava `false`, ignorando a recontagem

**Regra de Negócio**:
> Quando o ciclo é encerrado, produtos que o operador NÃO informou quantidade (NULL) devem ser tratados como quantidade 0 (não encontrado = não existe fisicamente).

**Lógica Corrigida**:
```javascript
// Se ciclo >= 2 e count2 é NULL mas count1 divergia do expected:
//    → count2 efetivo = 0 (não contado após divergência = confirmação de zero)

// Se ciclo >= 3 e count3 é NULL:
//    → count3 efetivo = 0 (não contado = quantidade zero)
```

**Arquivos Corrigidos**:
- `frontend/inventory.html` - Funções `getProductStatusIntel()` e `calculateFinalQuantityByMajority()`
- `frontend/counting_improved.html` - Função `calculateFinalQuantityByMajority()`
- `backend/app/main.py` - Cálculo de `finalQuantity`
- `backend/app/api/v1/endpoints/counting_lists.py` - Cálculo de `finalQuantity`

**Como Verificar**:
1. Criar inventário de teste com produtos
2. No ciclo 1, informar quantidade divergente do esperado
3. Encerrar ciclo 1, liberar ciclo 2
4. No ciclo 2, NÃO informar quantidade (deixar vazio)
5. Encerrar ciclo 2
6. Verificar que quantidade final = 0 (não count1)

**Referência**: [CHANGELOG_v2.19.md](../CHANGELOG_v2.19.md#v21941-08012026)

---

### 🔥🔥🔥🔥🔥 CORREÇÕES CRÍTICAS (v2.17.4 - 02/11/2025 - Tarde) - SISTEMA ESTÁVEL

### 1. **🔥 Erro 500 ao Abrir Modal "Criar Lista"** 🔥 CRÍTICO

**Sintoma**:
- Ao clicar em "Criar Lista", modal retorna erro 500
- Mensagem: "❌ Erro ao carregar produtos: Erro ao carregar produtos: 500"
- Backend retorna erro: `LookupError: 'ZERO_CONFIRMED' is not among the defined enum values`
- Sistema completamente travado

**Causa Raiz**:
- ENUM `counting_status` atualizado no banco de dados (migration 005) MAS não no modelo Python
- SQLAlchemy tentava ler produtos com status `ZERO_CONFIRMED` e falhava

**Log de Erro**:
```
ERROR: 'ZERO_CONFIRMED' is not among the defined enum values.
Enum name: countingstatus.
Possible values: PENDING, COUNTED, REVIEWED, APPROVED
```

**Solução** (`backend/app/models/models.py:40`):
```python
# ✅ ADICIONAR ZERO_CONFIRMED ao ENUM Python
class CountingStatus(str, enum.Enum):
    PENDING = "PENDING"
    COUNTED = "COUNTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    ZERO_CONFIRMED = "ZERO_CONFIRMED"  # ✅ v2.17.4
```

**Como Verificar**:
1. Reiniciar backend: `docker-compose restart backend`
2. Abrir modal "Criar Lista"
3. Verificar que produtos carregam sem erro

**Referência**: Bug #4 - [CORRECAO_ZERO_CONFIRMADO_v2.17.4.md](../CORRECAO_ZERO_CONFIRMADO_v2.17.4.md)

---

### 2. **🔥 Produtos com Expected=0 Subindo para Recontagem**

**Sintoma**:
- Produto com quantidade esperada = 0
- Usuário NÃO digitou nada (deixou campo vazio)
- Produto sobe para 2ª contagem (needs_count_cycle_2 = true)
- Comportamento incorreto (zero confirmado não precisa recontagem)

**Exemplo Real**:
- Produto: 00005910
- Quantidade Esperada: 0 (sem estoque)
- Ação do Usuário: Campo vazio (não digitou nada)
- Comportamento Errado: Subiu para 2ª contagem ❌
- Comportamento Correto: Zero confirmado (não sobe) ✅

**Causa Raiz**:
- Lógica de `needs_count_cycle` não considerava caso especial de zero confirmado
- Campo vazio + expected=0 deveria ser interpretado como "confirmei que não há estoque"

**Código Bugado** (`backend/app/main.py:9718-9729`):
```sql
-- ❌ ANTES: Não tratava zero confirmado
SET needs_count_cycle_2 = CASE
    WHEN cli.count_cycle_1 IS NOT NULL AND ... THEN true
    WHEN cli.count_cycle_1 IS NULL THEN true  -- ❌ SEMPRE true para campo vazio
    ELSE false
END
```

**Solução** (`backend/app/main.py:9718-9733, 9786-9801`):
```sql
-- ✅ DEPOIS: CASO ESPECIAL para zero confirmado
SET needs_count_cycle_2 = CASE
    -- ✅ CASO ESPECIAL v2.17.4: Zero confirmado
    WHEN ii.expected_quantity = 0 AND cli.count_cycle_1 IS NULL
    THEN false  -- NÃO precisa recontagem

    WHEN cli.count_cycle_1 IS NOT NULL AND ... THEN true
    WHEN cli.count_cycle_1 IS NULL THEN true
    ELSE false
END
```

**Como Verificar**:
1. Criar inventário com produto qty esperada = 0
2. NÃO digitar nada (deixar campo vazio)
3. Encerrar rodada e liberar 2ª contagem
4. Produto NÃO deve aparecer na lista (zero confirmado)

**Referência**: Bug #2 - [CORRECAO_ZERO_CONFIRMADO_v2.17.4.md](../CORRECAO_ZERO_CONFIRMADO_v2.17.4.md)

---

### 3. **🔥 Status Exibindo "Pendente" ao Invés de "Zero Confirmado"**

**Sintoma**:
- Produto com expected=0 + campo vazio
- Status exibe "⚠️ Pendente" ao invés de "✅ Zero Confirmado"
- Informação incorreta para o usuário

**Causa Raiz**:
- Trigger `calculate_counting_status()` não detectava cenário de zero confirmado
- Declarava PENDING antes de verificar expected=0

**Código Bugado** (`database/migration_status_triggers.sql:53-72`):
```sql
-- ❌ ANTES: Verificava se campo vazio e declarava PENDING
IF NEW.count_cycle_1 IS NULL THEN
    NEW.status := 'PENDING';  -- ❌ SEMPRE pending para campo vazio
    RETURN NEW;
END IF;
```

**Solução** (`database/migration_status_triggers.sql:57-72`):
```sql
-- ✅ DEPOIS: Verifica expected=0 ANTES de declarar PENDING
IF NEW.count_cycle_1 IS NULL AND ... IS NULL THEN
    IF expected_qty = 0 THEN
        NEW.status := 'ZERO_CONFIRMED';  -- ✅ Zero confirmado
        RETURN NEW;
    ELSE
        NEW.status := 'PENDING';  -- ⚠️ Pendente
        RETURN NEW;
    END IF;
END IF;
```

**Migração Necessária** (`database/migrations/005_add_zero_confirmed_enum.sql`):
```sql
-- Adicionar ZERO_CONFIRMED ao ENUM
ALTER TYPE inventario.counting_status
ADD VALUE IF NOT EXISTS 'ZERO_CONFIRMED';

-- Forçar recálculo de produtos existentes
UPDATE inventario.counting_list_items cli
SET count_cycle_1 = cli.count_cycle_1
FROM inventario.inventory_items ii
WHERE cli.inventory_item_id = ii.id
  AND ii.expected_quantity = 0
  AND cli.count_cycle_1 IS NULL ...;
```

**Como Verificar**:
1. Executar migration 005 no banco
2. Reiniciar backend
3. Produtos com expected=0 + campo vazio devem exibir "ZERO_CONFIRMED"

**Referência**: Bug #3 - [CORRECAO_ZERO_CONFIRMADO_v2.17.4.md](../CORRECAO_ZERO_CONFIRMADO_v2.17.4.md)

---

### 4. **🎨 Desalinhamento de Colunas no Modal "Criar Listas"**

**Sintoma**:
- Header "Entregas Post." sem coluna de dados correspondente
- Header "Ações" faltando
- Colunas desalinhadas (algumas células vazias)

**Causa Raiz**:
- Faltava adicionar coluna `b2_xentpos` na linha de dados
- Faltava header "Ações"
- Colspan incorreto (16 ao invés de 17)

**Solução** (`frontend/inventory.html`):
```javascript
// ✅ Adicionar coluna de dados (linha 15946)
const b2_xentpos = parseFloat(product.b2_xentpos || 0);
<td class="text-end">${b2_xentpos.toFixed(0)}</td>

// ✅ Adicionar header "Ações" (linha 17790)
<th>Ações</th>

// ✅ Corrigir colspan (linha 15889)
colspan="17"  // ✅ 17 (antes era 16)
```

**Como Verificar**:
1. Abrir modal "Criar Lista"
2. Verificar que todas as colunas estão alinhadas
3. Coluna "Entregas Post." deve ter valores

**Referência**: Bug #1 - [CORRECAO_ZERO_CONFIRMADO_v2.17.4.md](../CORRECAO_ZERO_CONFIRMADO_v2.17.4.md)

---

### ⭐⭐⭐⭐⭐ NOVÍSSIMOS (v2.17.2 - 02/11/2025) - UX E TABELAS

### 1. **🎨 Células Vazias no Modal "Análise do Inventário"**

**Sintoma**:
- Modal "Análise do Inventário" com células vazias nas colunas: "Qtd Final", "Diferença", "% Diverg"
- Produtos com controle de lote não exibem totalizações agregadas
- Tabela parece quebrada ou incompleta (má UX)
- Valores corretos no console.log mas não aparecem na tela

**Causa Raiz**:
- **Colunas faltando**: "Entregas Post." e "Total Esperado" ausentes causavam desalinhamento
- Linha sintética (totais) tinha 13 colunas mas header tinha 15 → últimas 2 colunas ficavam fora da tabela
- Validação `!== null` não capturava valores `undefined`
- Valores numéricos sem `parseFloat()` podiam ser strings

**Código Bugado** (`frontend/inventory.html:19300-19370`):
```javascript
// ❌ ANTES: Linha sintética SEM 2 colunas
<td style="text-align: right;">${systemQty.toFixed(2)}</td> <!-- Saldo Estoque -->
<!-- ❌ FALTAVA "Entregas Post." -->
<!-- ❌ FALTAVA "Total Esperado" -->
<td style="text-align: right;">
    ${aggregatedCount1 !== null ?  // ❌ !== não captura undefined
        aggregatedCount1.toFixed(2) :  // ❌ Sem parseFloat()
        ''  // ❌ Célula vazia (não força expansão)
    }
</td>
```

**Solução** (`frontend/inventory.html:19315-19316, 19330-19350`):
```javascript
// ✅ DEPOIS: Todas as 15 colunas presentes
<td style="text-align: right;">${systemQty.toFixed(2)}</td> <!-- Saldo Estoque -->
<td style="text-align: right;"><span class="text-muted">-</span></td> <!-- ✅ Entregas Post. -->
<td style="text-align: right;">${systemQty.toFixed(2)}</td> <!-- ✅ Total Esperado -->
<td style="text-align: right;">
    ${aggregatedCount1 != null ?  // ✅ != captura null E undefined
        `<strong class="text-info">${parseFloat(aggregatedCount1).toFixed(2)}</strong>` :  // ✅ parseFloat()
        '<span class="text-muted">-</span>'  // ✅ - força expansão
    }
</td>
```

**Como Corrigir**:
1. Verificar se versão é v2.17.2+
2. Abrir modal "Análise do Inventário" em um inventário
3. **Resultado esperado**: Todas as 15 colunas preenchidas (valores ou `-`)

**Como Diagnosticar**:
```javascript
// 1. Abrir console do navegador (F12)
// 2. Verificar se há console.log com valores:
console.log('aggregatedCount3:', aggregatedCount3);
console.log('aggregatedFinalQty:', aggregatedFinalQty);

// 3. Se valores aparecem no console mas NÃO na tabela → problema de alinhamento
// 4. Inspecionar HTML da linha sintética e contar <td> tags (deve ter 15)
```

**Versão Corrigida**: v2.17.2+

---

### ⭐⭐⭐⭐ ANTERIORES (v2.16.2 - 30/10/2025) - COMPARAÇÃO E IMPORTAÇÃO

### 1. **🐛 Produtos Sem Grupo/Categoria/Subcategoria/Segmento**

**Sintoma**:
- Produtos importados aparecem sem hierarquia mercadológica
- Campos grupo, categoria, subcategoria e segmento vazios no banco
- Exemplo: Produto 00003255 "DET.YPE NEUTRO 5LT" sem dados de hierarquia

**Causa Raiz**:
- Função `_prepare_sb1010()` mapeava campos errados do JSON da API Protheus
- Pegava `produto.get("b1_grupo")` (que vem vazio) ao invés de `hierarquia.get("bm_grupo")`
- Usava campos de **descrição** ao invés de **código** para categoria/subcategoria/segmento

**Código Bugado** (`backend/app/api/v1/endpoints/import_produtos.py:504-508`):
```python
# ❌ ANTES (ERRADO):
"b1_grupo": produto.get("b1_grupo", "").strip(),      # Vazio no JSON!
"b1_xcatgor": hierarquia.get("bm_desc", "").strip(),  # Descrição errada
"b1_xsubcat": categoria.get("zd_desc", "").strip(),   # Descrição errada
"b1_xsegmen": subcategoria.get("ze_desc", "").strip(), # Descrição errada
```

**Solução**:
```python
# ✅ DEPOIS (CORRETO):
"b1_grupo": hierarquia.get("bm_grupo", "").strip(),   # Código da hierarquia
"b1_xcatgor": categoria.get("zd_xcod", "").strip(),   # Código da categoria
"b1_xsubcat": subcategoria.get("ze_xcod", "").strip(), # Código da subcategoria
"b1_xsegmen": segmento.get("zf_xcod", "").strip(),    # Código do segmento
```

**Como Corrigir**:
1. Atualizar código do backend (já corrigido em v2.16.2)
2. Reiniciar backend: `docker-compose restart backend`
3. **Reimportar produtos** na página de Importação
4. Verificar produto 00003255 no banco (deve ter hierarquia completa)

**Versão Corrigida**: v2.16.2+

---

### 2. **🔄 Botão "Voltar" Não Reabre Modal de Comparação (5 Cards)**

**Sintoma**:
- Clicar em "Voltar" em `comparison_results.html` vai para `inventory.html` limpa
- Modal dos 5 cards NÃO reabre automaticamente
- Usuário perde contexto da comparação

**Causa Raiz**:
- Estrutura de dados no `sessionStorage` usava chaves diferentes das esperadas
- `sessionStorage`: `{invA, invB, manualReview}`
- Função esperava: `{inventory_a, inventory_b, manual_review}`

**Código Bugado** (`frontend/inventory.html:23606`):
```javascript
// ❌ ANTES: Estrutura incompatível
const comparisonData = JSON.parse(cachedData);
displayComparisonResults(comparisonData);  // Campos undefined!
```

**Solução** (`frontend/inventory.html:23607-23614`):
```javascript
// ✅ DEPOIS: Converter estrutura
const storedData = JSON.parse(cachedData);
const comparisonData = {
    inventory_a: storedData.invA,         // Converte invA → inventory_a
    inventory_b: storedData.invB,         // Converte invB → inventory_b
    matches: storedData.matches || [],
    manual_review: storedData.manualReview || [],  // Converte manualReview
    transfers: storedData.transfers || [],
    summary: storedData.summary || {}
};
displayComparisonResults(comparisonData);
```

**Navegação Implementada**:
- `comparison_results.html` → salva flag `reopenComparisonModal=true` no `sessionStorage`
- `inventory.html` → detecta flag e reabre modal automaticamente com os 5 cards

**Como Verificar**:
1. Comparar 2 inventários
2. Ver os 5 cards (Match, Manual, Transferências, Relatório A, Relatório B)
3. Clicar em qualquer card (ex: Match Perfeito)
4. Clicar em "← Voltar"
5. **Resultado esperado**: Modal reabre com os 5 cards ✅

**Versão Corrigida**: v2.16.2+

---

### ⭐⭐⭐⭐ ANTERIORES (v2.15.7.8 - 29/10/2025) - RELATÓRIOS E LOTES

### 1. **📊 Coluna "Qtde Lote" Vazia nos Relatórios**

**Sintoma**:
- Relatório mostra lotes mas coluna "Qtde Lote" está vazia (0.00)
- Mesmo com dados corretos no snapshot

**Causa Raiz**:
- Backend não retornava `snapshot_lots` no endpoint `final-report`
- Frontend esperava campo `snapshot_lots` para preencher coluna

**Solução** (`backend/app/main.py:7280-7291, 7317`):
```python
# ✅ Buscar lotes do snapshot
snapshot_lots = []
if product.b1_rastro == 'L':
    lot_snapshots = db.query(InventoryLotSnapshot).filter(
        InventoryLotSnapshot.inventory_item_id == item.id
    ).all()
    for lot_snap in lot_snapshots:
        snapshot_lots.append({
            "lot_number": lot_snap.b8_lotectl,
            "quantity": float(lot_snap.b8_saldo)
        })

item_data["snapshot_lots"] = snapshot_lots
```

**Como Verificar**: Acessar relatório → Ver produto com lote → Coluna "Qtde Lote" preenchida ✅

**Versão Corrigida**: v2.15.7.6+

---

### 2. **🔥 Lote Falso "09" Aparecendo em Múltiplos Produtos**

**Sintoma**:
- Lote "09" aparece em produtos diferentes (00010037, 00010070, 00010447)
- Qtde Esperada sempre 0.00 (não existe no snapshot)
- Qtde Contada varia (36.00, etc.)

**Causa Raiz**:
- Regex capturava **timestamp** como lote: `09:26:22` → lote "09"
- Regex anterior: `/(\d+)\s*:\s*([\d.]+)/g` (qualquer número seguido de ":")

**Exemplo de Observation**:
```
"Contagem por lotes: 000000000021555:72, 000000000022629:612 - 29/10/2025, 09:26:22"
                                                                                  ↑↑
                                                                            Hora: 09:26
```

**Solução** (`frontend/reports.html:1004`, `frontend/inventory.html:18499`):
```javascript
// ❌ ANTES: Capturava qualquer número
const regex = /(\d+)\s*:\s*([\d.]+)/g;

// ✅ DEPOIS: Apenas lotes válidos (10+ dígitos)
const regex = /(\d{10,}):(\d+(?:\.\d+)?)/g;
```

**Como Verificar**: Acessar relatório → Verificar que não há lote "09" ✅

**Versão Corrigida**: v2.15.7.8+

---

### 3. **📋 "MULTIPLOS_LOTES" Ao Invés de Lotes Separados**

**Sintoma**:
- Produto com múltiplos lotes mostra apenas linha "MULTIPLOS_LOTES"
- Não expande para mostrar cada lote individualmente
- Qtde Lote = 0.00

**Causa Raiz**:
- Função `extractLotNumber()` só extraía UM lote da observation
- Não suportava múltiplos lotes separados por vírgula

**Solução** (`frontend/reports.html:972-989`):
```javascript
// ✅ Nova função para extrair TODOS os lotes
function extractAllLotsFromObservation(observation) {
    const regex = /(\d{10,})\s*:\s*([\d.]+)/g;
    const lots = [];
    let match;

    while ((match = regex.exec(observation)) !== null) {
        lots.push({
            lotNumber: match[1],
            quantity: parseFloat(match[2]) || 0
        });
    }

    return lots;
}

// ✅ Usar estrutura {count_1, count_2, count_3} por lote
lotGroups[lotNum] = { count_1: null, count_2: null, count_3: null };
```

**Como Verificar**: Produto com múltiplos lotes → Ver linhas analíticas separadas ✅

**Versão Corrigida**: v2.15.7.7+

---

### 4. **📝 Nome do Inventário Mostrando "N/A" no Modal Análise**

**Sintoma**:
- Modal "Análise de Inventário" mostra "N/A" no campo Inventário

**Causa Raiz**:
- Endpoint incorreto: `/api/v1/inventories/${inventoryId}` (404 Not Found)
- Endpoint correto: `/api/v1/inventory/lists/${inventoryId}`

**Solução** (`frontend/inventory.html:18582`):
```javascript
// ❌ ANTES: Endpoint errado
const response = await fetch(`${API_BASE_URL}/api/v1/inventories/${inventoryId}`);

// ✅ DEPOIS: Endpoint correto
const response = await fetch(`${API_BASE_URL}/api/v1/inventory/lists/${inventoryId}`);
```

**Como Verificar**: Modal Análise → Campo "Inventário" mostra nome correto ✅

**Versão Corrigida**: v2.15.7.5+

---

### ⭐⭐⭐⭐⭐ CRÍTICOS (v2.15.5 - 28/10/2025)

### 1. **🔴 CRÍTICO FINANCEIRO - Produtos Não Contados NÃO Aparecem para Recontagem**

**Sintoma**:
- Produto não foi contado no 1º ciclo (usuário deixou campo em branco)
- Após encerrar e liberar 2ª contagem, produto **NÃO aparece** na lista
- Backend marca produto corretamente (`needs_count_cycle_2 = TRUE`)
- Mas frontend **exclui** o produto do filtro de visualização
- **Impacto Financeiro**: Sistema assume qty = 0, gera ajuste de estoque ERRADO (R$ 850/produto)

**Causa Raiz #1 - Backend**: Dessincronização de Ciclos
```python
# ❌ ANTES: Só avançava counting_lists.current_cycle
counting_list.current_cycle = new_cycle  # inventory_lists ficava em 1

# Resultado: produto marcado para ciclo 2, mas inventory_lists ainda em ciclo 1
# Frontend lê inventory_lists → não mostra produtos do ciclo 2
```

**Causa Raiz #2 - Frontend**: Filtro Excluía Produtos Não Contados
```javascript
// ❌ ANTES: Só mostrava produtos com divergência numérica
const hasDivergence = count1 !== null && Math.abs(count1 - systemQty) >= 0.01;
return hasDivergence;  // Excluía count1 = NULL!

// Resultado: produtos não contados (count1 = NULL) eram removidos do array
```

**Solução #1 - Backend** (`backend/app/main.py:9817-9840`):
```python
# ✅ DEPOIS: Sincronização condicional
# Contar quantas listas existem
total_lists = db.query(CountingList).filter(
    CountingList.inventory_id == counting_list.inventory_id
).count()

counting_list.current_cycle = new_cycle

if total_lists == 1:
    # ✅ Sincronizar inventory_lists com counting_lists
    inventory_list = db.query(InventoryListModel).filter(
        InventoryListModel.id == counting_list.inventory_id
    ).first()
    if inventory_list:
        inventory_list.current_cycle = new_cycle
```

**Solução #2 - Frontend** (`frontend/counting_improved.html:2720-2766`):
```javascript
// ✅ DEPOIS: Inclui produtos não contados
const wasNotCounted = count1 === null || count1 === undefined;
const hasDivergence = count1 !== null && Math.abs(count1 - systemQty) >= 0.01;
const needsRecount = wasNotCounted || hasDivergence;  // ✅ Inclui ambos!

if (needsRecount) {
    if (wasNotCounted) {
        console.log(`🎯 [CICLO 2] ${product_code}: NÃO CONTADO no ciclo 1 → PRECISA contar agora`);
    } else if (hasDivergence) {
        console.log(`🎯 [CICLO 2] ${product_code}: Count1=${count1} ≠ Sistema=${systemQty} → PRECISA recontagem`);
    }
}
return needsRecount;
```

**Como Testar**:
1. Criar inventário e liberar 1ª contagem
2. Contar **apenas 1 produto** (deixar outros em branco)
3. Encerrar lista (sistema deve marcar produtos não contados com `needs_count_cycle_2 = TRUE`)
4. Validar banco:
```sql
SELECT product_code, count_cycle_1, needs_count_cycle_2,
       il.current_cycle as inventory_cycle,
       cl.current_cycle as counting_cycle
FROM counting_list_items cli
JOIN inventory_lists il ON il.id = (SELECT inventory_id FROM counting_lists WHERE id = cli.counting_list_id)
JOIN counting_lists cl ON cl.id = cli.counting_list_id
WHERE counting_list_id = '{list_id}';
-- Esperado: needs_count_cycle_2 = TRUE para produtos não contados
-- Esperado: inventory_cycle = counting_cycle = 2 (sincronizados)
```
5. Liberar 2ª contagem
6. Abrir página de contagem
7. **VERIFICAR**: Produtos não contados **DEVEM aparecer** ✅

**Status**: ✅ CORRIGIDO em v2.15.5
**Documentação**: [CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md](../CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md)

---

### 2. **🔴 CRÍTICO - Página de Contagem Desktop Não Carrega Produtos** (v2.12.0)

**Sintoma**:
- Ao clicar "Iniciar Contagem" no modal "Gerenciar Lista", a página abre mas não exibe nenhum produto
- Console do navegador mostra erro: "Usuário não tem produtos atribuídos no inventário"
- Backend retorna HTTP 301 Moved Permanently em chamadas de API
- Log do backend mostra SQL error: "argument of AND must be type boolean, not type character varying"

**Causa Raiz**:
- **Implementação do SNAPSHOT (v2.10.0)** modificou a query SQL adicionando `ARRAY_AGG` e `GROUP BY`
- Filtro de ciclo foi **incorretamente posicionado APÓS** a cláusula `GROUP BY`
- SQL não permite condições WHERE após GROUP BY (sintaxe incorreta)

**3 Correções Sequenciais**:

**Fix #1 - Parâmetro Incorreto do Endpoint** (`frontend/counting_improved.html:2453-2474`):
```javascript
// ❌ ANTES: Chamava com list_id (parâmetro errado)
const response = await fetch(`${API_BASE_URL}/api/v1/counting-lists-new/${list_id}`, {...});

// ✅ DEPOIS: Chama com inventoryId (correto)
const listStatusResponse = await fetch(`${API_BASE_URL}/api/v1/counting-lists-new/${inventoryId}`, {...});

// Parse correto do array de resposta
const lists = listData.data || [];
const currentList = lists.find(list => list.id === currentListId);
```

**Fix #2 - Redirect HTTPS Quebrando APIs** (`backend/app/main.py:165-171`):
```python
# ❌ ANTES: Redirecionava TODAS as requisições HTTP→HTTPS
if ssl_enabled and request.url.scheme == "http":
    url = request.url.replace(scheme="https", port=8443)
    return RedirectResponse(url=str(url), status_code=301)

# ✅ DEPOIS: Exclui /api/* do redirect (compatibilidade HTTP)
if ssl_enabled and request.url.scheme == "http":
    if not request.url.path.startswith("/api/") and request.url.path not in ["/health", "/docs", "/redoc", "/openapi.json"]:
        url = request.url.replace(scheme="https", port=8443)
        return RedirectResponse(url=str(url), status_code=301)
```

**Fix #3 - SQL Syntax Error (DEFINITIVO)** (`backend/app/main.py:9002-9026`):
```sql
-- ❌ ANTES: Filtro APÓS GROUP BY (sintaxe incorreta)
WHERE cl.id = :list_id
GROUP BY ii.product_code, ii.description, ...
AND (  -- ❌ ERRO: condição após GROUP BY
    (cl.current_cycle = 1 AND ...)
    OR (cl.current_cycle = 2 AND ...)
    OR (cl.current_cycle = 3 AND ...)
)
ORDER BY ii.product_code

-- ✅ DEPOIS: Filtro DENTRO do WHERE (sintaxe correta)
WHERE cl.id = :list_id
AND (  -- ✅ CORRETO: condição no WHERE, antes do GROUP BY
    (cl.current_cycle = 1 AND COALESCE(cli.needs_count_cycle_1, ii.needs_recount_cycle_1, true) = true)
    OR (cl.current_cycle = 2 AND COALESCE(cli.needs_count_cycle_2, ii.needs_recount_cycle_2, false) = true)
    OR (cl.current_cycle = 3 AND COALESCE(cli.needs_count_cycle_3, ii.needs_recount_cycle_3, false) = true)
)
GROUP BY ii.product_code, ii.description, ...
ORDER BY ii.product_code
```

**Solução**: ✅ CORRIGIDO em v2.12.0 com 3 fixes sequenciais

**Como verificar**:
```bash
# 1. Verificar que endpoint retorna dados (não redirect 301)
curl -s http://localhost:8000/api/v1/counting-lists-new/INVENTORY_ID | jq

# 2. Abrir modal "Gerenciar Lista" → Clicar "Iniciar Contagem"
# 3. Verificar que produtos carregam corretamente na tabela

# 4. Console do navegador NÃO deve mostrar erros
# 5. Backend logs devem mostrar query SQL bem-sucedida
docker-compose logs -f backend | grep "produtos da lista"
```

**Impacto**:
- ✅ Página de contagem desktop 100% funcional
- ✅ Sistema de ciclos funcionando sem erros SQL
- ✅ APIs compatíveis com HTTP e HTTPS
- ✅ Modal "Gerenciar Lista" → "Iniciar Contagem" operacional

**Arquivos Modificados**:
- `frontend/counting_improved.html:2453-2474`
- `backend/app/main.py:165-171` (middleware HTTPS)
- `backend/app/main.py:9002-9026` (query SQL corrigida)

**Validação**: Usuário confirmou "agora deu certo" após Fix #3 ✅

---

### ⭐⭐⭐ NOVOS (v2.10.1 - 19/10/2025)

### 2. **Campo `status` não é atualizado ao salvar contagens**

**Sintoma**:
- Produto contado mas status permanece 'PENDING' no banco de dados
- Queries SQL que filtram por `status` retornam dados incorretos
- Relatórios mostram estatísticas erradas (produtos contados aparecem como pendentes)

**Causa**:
- Status era calculado apenas no frontend JavaScript
- Banco de dados não era atualizado quando contagens eram salvas
- Queries dependiam de lógica duplicada em cada endpoint

**Solução**: ✅ CORRIGIDO em v2.10.1 com Triggers PostgreSQL

**Triggers Implementados**:
```sql
-- Função de cálculo automático
CREATE OR REPLACE FUNCTION inventario.calculate_counting_status()
RETURNS TRIGGER AS $$
DECLARE
    final_qty NUMERIC(15,4);
    expected_qty NUMERIC(15,4);
    tolerance NUMERIC(15,4) := 0.01;
BEGIN
    -- Prioridade: count_3 > count_2 > count_1
    final_qty := COALESCE(NEW.count_cycle_3, NEW.count_cycle_2, NEW.count_cycle_1);

    -- Buscar quantidade esperada
    IF TG_TABLE_NAME = 'counting_list_items' THEN
        SELECT expected_quantity INTO expected_qty
        FROM inventario.inventory_items
        WHERE id = NEW.inventory_item_id;
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
        expected_qty := NEW.expected_quantity;
    END IF;

    -- Comparar e definir status
    IF ABS(final_qty - COALESCE(expected_qty, 0)) < tolerance THEN
        NEW.status := 'COUNTED';
    ELSE
        NEW.status := 'PENDING';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicado em 2 tabelas
CREATE TRIGGER trg_update_counting_list_items_status
    BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3
    ON inventario.counting_list_items
    FOR EACH ROW EXECUTE FUNCTION inventario.calculate_counting_status();

CREATE TRIGGER trg_update_inventory_items_status
    BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3
    ON inventario.inventory_items
    FOR EACH ROW EXECUTE FUNCTION inventario.calculate_counting_status();
```

**Como verificar**:
```sql
-- Antes do trigger: Status desatualizado
SELECT product_code, count_cycle_1, expected_quantity, status
FROM inventario.inventory_items
WHERE id = '814b8901-9874-45cc-84c0-34fb333b59d3';
-- count_1=99999, expected=99999, status='PENDING' ❌

-- Forçar trigger
UPDATE inventario.inventory_items
SET count_cycle_1 = count_cycle_1
WHERE id = '814b8901-9874-45cc-84c0-34fb333b59d3';

-- Depois do trigger: Status atualizado
SELECT product_code, count_cycle_1, expected_quantity, status
FROM inventario.inventory_items
WHERE id = '814b8901-9874-45cc-84c0-34fb333b59d3';
-- count_1=99999, expected=99999, status='COUNTED' ✅
```

**Performance**:
- ⚡ < 1ms por atualização
- 🚀 Nenhum impacto perceptível
- 📊 27 produtos testados: 23→21 PENDING, 4→6 COUNTED

**Arquivos**:
- `database/migration_status_triggers.sql` - Migration
- `database/fix_existing_status.sql` - Correção de dados existentes
- [IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md](../IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md) - Doc completa

**Referência**: [PENDENCIA_CAMPO_STATUS.md](../PENDENCIA_CAMPO_STATUS.md)

---

### 2. **Modais mostram quantidade incorreta para produtos com controle de lote**

**Sintoma**:
- Produto com lote (b1_rastro='L') mostra quantidade errada no grid
- Exemplo: Produto 00010037 exibe 99999.00 em vez de 288.00
- Acontece em 2 modais: "Adicionar Produtos" e "Criar Lista"

**Causa**:
Endpoints usavam `SB2010.B2_QATU` direto sem verificar se produto tinha controle de lote:
```python
# ❌ ERRADO - Ignorava lotes
"current_quantity": float(sb2_estoque.b2_qatu) if sb2_estoque else 0.0
```

Para produtos com lote, deveria somar `SB8010.B8_SALDO` (soma dos lotes) em vez de usar `B2_QATU`.

**Solução**: ✅ CORRIGIDO em v2.10.1 - Lógica bifurcada implementada

```python
# ✅ CORRETO - Verifica controle de lote
has_lot_control = (sb1_produto.b1_rastro == 'L')

if has_lot_control:
    # Produto COM lote → Somar SB8010.B8_SALDO
    lot_sum_query = text("""
        SELECT COALESCE(SUM(b8.b8_saldo), 0) as total_lot_qty
        FROM inventario.sb8010 b8
        WHERE b8.b8_produto = :product_code
          AND b8.b8_filial = :filial
          AND b8.b8_local = :warehouse
          AND b8.b8_saldo > 0
    """)
    calculated_quantity = SUM(lotes)
else:
    # Produto SEM lote → Usar B2_QATU
    calculated_quantity = B2_QATU
```

**Bug Adicional - Modal "Criar Lista"**:
- Campo `b1_rastro` não estava mapeado no frontend
- Grid mostrava "Não controlado" para produtos com lote
- **Solução**: Mapeamento adicionado em `loadProductsByCycle()`

**Como verificar**:
```sql
-- Teste no banco
SELECT
    b1.b1_cod AS produto,
    b1.b1_rastro AS controle_lote,
    b2.b2_qatu AS saldo_sb2010,
    COALESCE(SUM(b8.b8_saldo), 0) AS saldo_lotes_sb8010
FROM inventario.sb1010 b1
LEFT JOIN inventario.sb2010 b2 ON b1.b1_cod = b2.b2_cod
LEFT JOIN inventario.sb8010 b8 ON b1.b1_cod = b8.b8_produto
WHERE b1.b1_cod = '00010037'
  AND b2.b2_filial = '01' AND b2.b2_local = '02'
GROUP BY b1.b1_cod, b1.b1_rastro, b2.b2_qatu;

-- Resultado esperado:
-- produto  | controle_lote | saldo_sb2010 | saldo_lotes_sb8010
-- 00010037 | L             | 99999.00     | 288.00 ✅
```

**Teste Manual**:
1. Login no sistema
2. Abrir qualquer inventário
3. Clicar em "Configurar Produtos"
4. Filtrar produto: `00010037`
5. ✅ Verificar coluna quantidade: deve mostrar `288.00` (não 99999.00)
6. ✅ Verificar coluna lote: deve mostrar `Controlado` (não "Não controlado")

**Arquivos Modificados**:
- `backend/app/main.py:1482,1676-1721` - Modal "Adicionar Produtos"
- `backend/app/api/v1/endpoints/assignments.py:262-263,337-364` - Modal "Criar Lista"
- `frontend/inventory.html:13979-13985,14807-14817,16057-16089` - Mapeamento + logs

**Referência**: [CORRECAO_LOTES_FILTER_PRODUCTS_v2.10.1.md](../CORRECAO_LOTES_FILTER_PRODUCTS_v2.10.1.md)

---

### 3. **Erro ao salvar contagem: "record new has no field system_qty"**

**Sintoma**:
```
psycopg2.errors.UndefinedColumn: record "new" has no field "system_qty"
CONTEXT: PL/pgSQL assignment "expected_qty := NEW.system_qty"
```

**Causa**:
Trigger `calculate_counting_status()` tentava acessar campo inexistente:
```sql
-- ❌ ERRADO
ELSIF TG_TABLE_NAME = 'inventory_items' THEN
    expected_qty := NEW.system_qty;  -- Campo não existe!
```

Tabela `inventory_items` usa `expected_quantity`, não `system_qty`.

**Solução**: ✅ CORRIGIDO em v2.10.1 - Trigger atualizado

```sql
-- ✅ CORRETO
ELSIF TG_TABLE_NAME = 'inventory_items' THEN
    expected_qty := NEW.expected_quantity;
```

**Como verificar**:
```sql
-- Ver função corrigida
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'calculate_counting_status'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'inventario');

-- Deve conter: NEW.expected_quantity (não NEW.system_qty)
```

**Teste**:
1. Abrir modal de contagem
2. Inserir quantidade para qualquer produto
3. Clicar em "Salvar"
4. ✅ Deve salvar sem erros
5. ✅ Status deve ser atualizado automaticamente

**Arquivo**: `database/migration_status_triggers.sql:66`

---

### ⭐ NOVOS (v2.9.3.2 - 13/10/2025)

### 1. **Filtro "Pendentes" mostra produtos incorretos no modal "Ver Detalhes"**

**Sintoma**:
- Filtro "Pendentes" lista produtos com `count_2` mesmo quando lista está no ciclo 1
- Produtos que já foram contados aparecem como pendentes
- Produtos sem contagem no ciclo atual não aparecem

**Causa**:
- Endpoint `/api/v1/counting-lists/{list_id}` não existia (404)
- Frontend usava valor padrão `current_cycle = 1` quando endpoint falhava
- Filtro comparava produtos com ciclo errado

**Solução**: ✅ CORRIGIDO em v2.9.3.2 - `backend/app/main.py:8689-8758`

**Como verificar**:
```bash
# Testar endpoint criado
curl -H "Authorization: Bearer token_clenio_123" \
  http://localhost:8000/api/v1/counting-lists/385d6d25-b5d4-4d0a-a2b4-e74b6a2f53db

# Deve retornar:
{
  "success": true,
  "data": {
    "current_cycle": 3,  # ✅ Valor correto do banco
    "list_name": "Lista Clenio",
    "list_status": "EM_CONTAGEM"
  }
}
```

**Validação no Banco**:
```sql
-- Verificar ciclo real vs produtos contados
SELECT current_cycle FROM inventario.counting_lists
WHERE id = '385d6d25-b5d4-4d0a-a2b4-e74b6a2f53db';
-- 3 (correto)

SELECT product_code, count_cycle_1, count_cycle_2, count_cycle_3
FROM inventario.counting_list_items
WHERE counting_list_id = '385d6d25-b5d4-4d0a-a2b4-e74b6a2f53db';
-- Deve mostrar count_cycle_3 = null para produtos pendentes
```

**Teste Manual**:
1. Fazer login como usuário com lista no ciclo 3
2. Acessar página de inventários → "Gerenciar Lista" → "Ver Detalhes"
3. Clicar no botão "Pendentes" (🟡)
4. ✅ Deve mostrar APENAS produtos sem `count_cycle_3`

**Documentação**: Sessão 13/10/2025

---

### 2. **Inventários COMPLETED com nomes inconsistentes**

**Sintoma**:
- Alguns inventários mostram: `clenio_00` (nome limpo)
- Outros inventários mostram: `[FINALIZADO] clenio_01` (com prefixo)
- Ambos têm mesmo status `COMPLETED` no banco de dados

**Causa**:
- Sistema usava **localStorage do navegador** para adicionar prefixo
- Inventário encerrado **nesta sessão**: salvo em localStorage → prefixo adicionado
- Inventário encerrado **em outra sessão**: não estava em localStorage → sem prefixo
- Código tinha fallback perigoso que tentava alterar nome no banco (linha 18899)

**Solução**: ✅ CORRIGIDO em v2.9.3.2 - `frontend/inventory.html` (3 locais)

**Como verificar**:
```javascript
// Frontend NÃO deve mais usar localStorage
const isLocallyClosed = locallyClosedInventories.has(inventory.id);  // ❌ REMOVIDO

// Frontend deve usar APENAS status do banco
const effectiveStatus = inventory.status;  // ✅ CORRETO
const effectiveName = inventory.name;      // ✅ Sempre nome original
```

**Validação no Banco**:
```sql
-- Nenhum nome deve conter prefixo [FINALIZADO]
SELECT id, name, status FROM inventario.inventory_lists
WHERE name LIKE '%FINALIZADO%';
-- 0 rows (correto)
```

**Teste Manual**:
1. Fazer login e acessar página de inventários
2. Verificar inventários com status "✅ Encerrado"
3. ✅ Todos devem mostrar nome original (sem prefixo)
4. ✅ Apresentação deve ser consistente

**Documentação**: Sessão 13/10/2025

---

### 3. **Interface confusa com 10+ status diferentes**

**Sintoma**:
- Usuário vê status confusos: "Em Preparação", "Em Contagem", "Liberada", "DRAFT", "ABERTA"
- Não fica claro qual a diferença entre os status
- Sistema tem apenas 2 ações (Criar e Encerrar) mas mostra muitos estados

**Causa**:
- Interface herdada de sistema complexo com múltiplos workflows
- Mapeamento direto de status técnicos do banco para interface
- Falta de simplificação baseada no fluxo real do usuário

**Solução**: ✅ CORRIGIDO em v2.9.3.2 - `frontend/inventory.html:19988-20051`

**Status Simplificados**:
- **🔵 Em Andamento**: Qualquer status exceto COMPLETED (DRAFT, IN_PROGRESS, RELEASED, etc.)
- **✅ Encerrado**: Status COMPLETED ou equivalentes (FINALIZADO, CLOSED)

**Como verificar**:
```javascript
// Função getStatusText() agora simplificada
function getStatusText(status) {
    if (status === 'COMPLETED' || status === 'FINALIZADO' || status === 'CLOSED') {
        return '✅ Encerrado';
    } else {
        return '🔵 Em Andamento';
    }
}
```

**Teste Manual**:
1. Fazer login e criar novo inventário
2. ✅ Deve mostrar "🔵 Em Andamento" (badge azul)
3. Encerrar o inventário
4. ✅ Deve mostrar "✅ Encerrado" (badge verde)
5. ✅ Não deve aparecer "Em Preparação", "Liberada", etc.

**Observação**:
- Status de **produtos** mantém detalhamento (Pendente, Contado, Divergência, Zero Confirmado)
- Simplificação aplica-se apenas a status de **inventário**

**Documentação**: Sessão 13/10/2025

---

### ⭐ SISTEMA DE SNAPSHOT (v2.10.0 - 15/10/2025)

### 4. **Dados dinâmicos causando inconsistências durante inventário**

**Sintoma**:
- Quantidade do sistema muda durante o inventário
- Lotes desaparecem ou aparecem novamente
- Custo médio altera entre a criação e o relatório final
- Relatórios financeiros com valores incorretos

**Causa RAIZ**:
- Sistema buscava dados **diretamente do ERP** (tabelas SB1, SB2, SB8, SBZ)
- ERP **atualiza constantemente** (vendas, compras, transferências)
- Inventário deveria "congelar" dados no momento da criação
- **Exemplo real**: Produto com 100 unidades → venda de 20 → inventário mostra 80 (incorreto)

**Problema 1: Quantidade do Sistema Muda**
```sql
-- Hoje: Produto com 100 unidades
SELECT b2_qatu FROM inventario.sb2010 WHERE b2_cod = '00015210';
-- Resultado: 100

-- Durante inventário: Ocorre venda de 20 unidades
-- (ERP atualiza SB2010 automaticamente)

-- Amanhã: Mesmo produto agora mostra 80 unidades
SELECT b2_qatu FROM inventario.sb2010 WHERE b2_cod = '00015210';
-- Resultado: 80 ❌ PROBLEMA!
```

**Problema 2: Lotes Dinâmicos**
```sql
-- Início: Lote A com 50 unidades, Lote B com 50 unidades
SELECT b8_lotectl, b8_saldo FROM inventario.sb8010
WHERE b8_produto = '00015210';
-- Lote A: 50
-- Lote B: 50

-- Durante inventário: Lote A é totalmente consumido
-- (ERP remove lote da SB8010)

-- Depois: Lote A desapareceu!
SELECT b8_lotectl, b8_saldo FROM inventario.sb8010
WHERE b8_produto = '00015210';
-- Lote B: 50 ❌ Onde está o Lote A que eu contei?
```

**Problema 3: Custo Médio Variável**
```sql
-- Criação: Custo médio R$ 10,00
SELECT b2_cm1 FROM inventario.sb2010 WHERE b2_cod = '00015210';
-- Resultado: 10.00

-- Durante inventário: Compra com custo R$ 12,00
-- (ERP recalcula custo médio automaticamente)

-- Relatório: Custo médio R$ 11,00
SELECT b2_cm1 FROM inventario.sb2010 WHERE b2_cod = '00015210';
-- Resultado: 11.00 ❌ Valor financeiro errado!
```

**Solução**: ✅ IMPLEMENTADO em v2.10.0 - **Sistema de Snapshot Imutável**

**Arquitetura do Snapshot**:
```
┌─────────────────────────────────────────────────────────────┐
│ MOMENTO DA INCLUSÃO DO PRODUTO NO INVENTÁRIO                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Produto adicionado ao inventário                         │
│     ↓                                                        │
│  2. Sistema busca dados ATUAIS do ERP:                       │
│     - SB1: Descrição, rastreamento, grupo, categoria        │
│     - SB2: Quantidade atual, custo médio                     │
│     - SB8: Lotes e saldos (se rastreado)                     │
│     - SBZ: Localizações físicas                              │
│     ↓                                                        │
│  3. Dados CONGELADOS em 2 tabelas:                           │
│     ┌────────────────────────────────────────┐              │
│     │ inventory_items_snapshot (1:1)         │              │
│     │ - Descrição congelada                  │              │
│     │ - Quantidade congelada                 │              │
│     │ - Custo médio congelado                │              │
│     │ - Localização congelada                │              │
│     │ - Timestamp de criação                 │              │
│     └────────────────────────────────────────┘              │
│                                                               │
│     ┌────────────────────────────────────────┐              │
│     │ inventory_lots_snapshot (1:N)          │              │
│     │ - Lote A: 50 unidades (congelado)      │              │
│     │ - Lote B: 50 unidades (congelado)      │              │
│     │ - Timestamp de criação                 │              │
│     └────────────────────────────────────────┘              │
│                                                               │
│  4. Durante TODO o inventário:                               │
│     ✅ Quantidade NÃO muda (sempre 100)                      │
│     ✅ Lotes NÃO mudam (sempre A+B)                          │
│     ✅ Custo NÃO muda (sempre R$ 10,00)                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Tabelas Criadas**:
```sql
-- Tabela 1: Snapshot de dados únicos (1:1 com inventory_items)
CREATE TABLE inventory_items_snapshot (
    id UUID PRIMARY KEY,
    inventory_item_id UUID UNIQUE,  -- 1:1
    -- SB2: Estoque
    b2_qatu NUMERIC(15,4),  -- Quantidade CONGELADA
    b2_cm1 NUMERIC(15,4),   -- Custo médio CONGELADO
    -- SB1: Produto
    b1_desc VARCHAR(200),   -- Descrição CONGELADA
    b1_rastro VARCHAR(1),   -- Rastreamento
    -- SBZ: Localização
    bz_xlocal1/2/3 VARCHAR(50),  -- Localização física
    created_at TIMESTAMP,   -- Quando foi congelado
    -- ... outros campos
);

-- Tabela 2: Snapshot de lotes (1:N com inventory_items)
CREATE TABLE inventory_lots_snapshot (
    id UUID PRIMARY KEY,
    inventory_item_id UUID,  -- 1:N (múltiplos lotes por item)
    b8_lotectl VARCHAR(50),  -- Número do lote
    b8_saldo NUMERIC(15,4),  -- Saldo CONGELADO
    created_at TIMESTAMP,
    UNIQUE(inventory_item_id, b8_lotectl)  -- Não permite duplicatas
);
```

**Componentes Modificados**:

1. **Backend - Criação Automática** (`inventory.py:626-666, 995-1044`):
```python
# Ao adicionar produto ao inventário
item_snapshot = SnapshotService.create_item_snapshot(
    db=db,
    inventory_item_id=item.id,
    product_code=product.code,
    filial=filial,
    warehouse=inventory.warehouse,
    created_by=current_user.id
)

# Se produto rastreado, capturar lotes
if item_snapshot.b1_rastro == 'L':
    lot_snapshots = SnapshotService.create_lots_snapshots(...)
```

2. **Backend - Endpoint de Lotes** (`inventory.py:699-833`):
```python
# ANTES: Buscava da SB8010 (dados dinâmicos)
lots = db.query(SB8010).filter(...)  # ❌ Muda com o tempo

# DEPOIS: Busca do snapshot (dados congelados)
GET /api/v1/inventory/items/{item_id}/lots-snapshot
# ✅ Sempre retorna mesmos lotes
```

3. **Backend - Modal "Ver Detalhes"** (`main.py:8810-8949`):
```python
# Query com LEFT JOIN no snapshot
SELECT
    COALESCE(iis.b2_qatu, ii.expected_quantity) as system_qty,  -- Prioriza snapshot
    COALESCE(iis.b2_cm1, 0) as snapshot_cost,                   -- Custo congelado
    iis.created_at as snapshot_created_at
FROM counting_list_items cli
LEFT JOIN inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
```

4. **Backend - Relatórios** (`main.py:7044-7118`):
```python
# Query com snapshot
items_query = db.query(
    InventoryItem, SB1010, InventoryItemSnapshot  # 📸 Adicionado
).outerjoin(InventoryItemSnapshot, ...)

# Custo do snapshot
unit_price = float(snapshot.b2_cm1) if snapshot and snapshot.b2_cm1 else 0.0
# ✅ Antes: 10.0 (fixo)

# Cálculos financeiros
total_expected_value += expected_qty * unit_price  # ✅ Valor correto
```

5. **Frontend - Modal de Lotes** (`counting_improved.html:4370-4453`):
```javascript
// PRIORIDADE 1: Buscar do snapshot
if (itemId) {
    const snapshotResponse = await fetch(
        `${API_BASE_URL}/api/v1/inventory/items/${itemId}/lots-snapshot`
    );
    // ✅ Dados congelados
}

// FALLBACK: Buscar da SB8010 (compatibilidade)
const response = await fetch(
    `${API_BASE_URL}/api/v1/cycles/product/${productCode}/lots?warehouse=02`
);
// 🔄 Apenas se snapshot não existir
```

**Validação no Banco**:
```sql
-- 1. Verificar se snapshot foi criado
SELECT
    ii.product_code,
    iis.b2_qatu as qty_congelada,
    iis.b2_cm1 as custo_congelado,
    iis.created_at as congelado_em
FROM inventario.inventory_items ii
LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
WHERE ii.inventory_list_id = 'INVENTORY_ID_AQUI';

-- 2. Verificar lotes congelados
SELECT
    ii.product_code,
    ils.b8_lotectl as lote,
    ils.b8_saldo as saldo_congelado,
    ils.created_at
FROM inventario.inventory_items ii
JOIN inventario.inventory_lots_snapshot ils ON ils.inventory_item_id = ii.id
WHERE ii.inventory_list_id = 'INVENTORY_ID_AQUI';

-- 3. Comparar snapshot vs ERP atual (para debug)
SELECT
    ii.product_code,
    iis.b2_qatu as snapshot_qty,
    sb2.b2_qatu as current_qty,
    (sb2.b2_qatu - iis.b2_qatu) as diferenca
FROM inventario.inventory_items ii
JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
JOIN inventario.sb2010 sb2 ON sb2.b2_cod = ii.product_code
WHERE ii.inventory_list_id = 'INVENTORY_ID_AQUI'
  AND sb2.b2_qatu != iis.b2_qatu;  -- Mudou após snapshot
```

**Teste Manual**:
1. Adicionar produto ao inventário
2. ✅ Verificar criação do snapshot no banco
3. Simular mudança no ERP (UPDATE na SB2010)
4. ✅ Modal de lotes deve mostrar dados do snapshot (não mudaram)
5. ✅ Relatório deve usar custo do snapshot

**Logs de Debug**:
```bash
# Backend - Criação do snapshot
docker-compose logs backend | grep "📸"
# Saída esperada:
# INFO: 📸 Criando snapshot para item abc123 (produto: 00015210)
# INFO: ✅ Snapshot criado: qty=100, custo=10.00
# INFO: ✅ 2 snapshot(s) de lotes criados

# Frontend - Uso do snapshot
# Console do navegador (F12):
# 📸 [SNAPSHOT] Buscando lotes congelados para item abc123...
# ✅ [SNAPSHOT] 2 lote(s) congelado(s) encontrado(s)
# 📅 [SNAPSHOT] Snapshot criado em: 2025-10-15T14:30:00Z
```

**Benefícios Alcançados**:
- ✅ **Imutabilidade**: Dados não mudam durante inventário
- ✅ **Consistência**: Quantidade e custo sempre iguais
- ✅ **Precisão**: Cálculos financeiros exatos
- ✅ **Rastreabilidade**: Timestamp de quando foi congelado
- ✅ **Auditoria**: Possível comparar snapshot vs ERP atual

**Compatibilidade**:
- ✅ **Produtos antigos** (sem snapshot): Sistema usa fallback para `expected_quantity`
- ✅ **Produtos novos** (com snapshot): Sistema usa dados congelados
- ✅ **Transição suave**: Não requer migração de dados existentes

**Arquivos da Implementação**:
- Migration: `database/migrations/003_add_inventory_snapshot_tables.sql`
- Models: `backend/app/models/models.py:923-1005`
- Service: `backend/app/services/snapshot_service.py`
- Endpoints: `backend/app/api/v1/endpoints/inventory.py:699-833` (lotes)
- Endpoints: `backend/app/main.py:8810-8949` (modal), `7044-7118` (relatórios)
- Frontend: `frontend/counting_improved.html:4370-4453`

**Documentação**: [PLANO_SNAPSHOT_v2.10.0.md](../PLANO_SNAPSHOT_v2.10.0.md) ⭐

---

### ⭐ ANTERIORES (v2.7 - v2.8)

### 1. **Sistema não permite encerrar lista mesmo com produtos contados**

**Sintoma**: Erro "Ainda faltam N produto(s) para contar no ciclo X"
**Causa**: Flag `needs_count_cycle_*` não atualizada ao salvar contagem
**Solução**: ✅ CORRIGIDO em v2.8 - `backend/app/main.py:9613`

**Como verificar**:
```sql
-- Ver flags vs contagens
SELECT product_code, count_cycle_1, needs_count_cycle_1
FROM inventario.counting_list_items
WHERE counting_list_id = 'LIST_ID_AQUI';
```

**Documentação**: [SESSAO_08_10_2025.md](../SESSAO_08_10_2025.md)

### 2. **Bug de timing: Divergências não calculadas corretamente**

**Sintoma**: Encerramento falha com "Nenhum produto precisa ser contado no ciclo X"
**Causa**: Contagens salvas APÓS avanço de ciclo, flags desatualizadas
**Solução**: ✅ CORRIGIDO em v2.8 - Sistema de recálculo automático

**Arquitetura**:
- Função `recalculate_discrepancies_for_list()` recalcula ANTES de validar
- Integrado em endpoints de liberação e encerramento
- Elimina bugs de timing completamente

**Documentação**: [CORRECAO_DEFINITIVA_CICLOS_v2.8.md](../CORRECAO_DEFINITIVA_CICLOS_v2.8.md) ⭐

### 3. **Nomes de usuários trocados na tabela de listas**

**Sintoma**: Ao selecionar uma lista, nomes de TODAS as outras são trocados
**Causa**: Lógica de seleção não preservava nomes originais
**Solução**: ✅ CORRIGIDO em v2.7.1 - Data-attribute `data-original-counter-name`

**Documentação**: [CORRECAO_TROCA_NOMES_USUARIOS_v2.7.1.md](../CORRECAO_TROCA_NOMES_USUARIOS_v2.7.1.md)

### 4. **Confusão entre ENCERRAR e FINALIZAR**

**Sintoma**: Usuário não sabe qual botão usar
**Causa**: Botões não diferenciavam "avançar ciclo" vs "pular ciclos"
**Solução**: ✅ CORRIGIDO em v2.7 - Validações específicas + modais educativos

**Regras**:
- **ENCERRAR (🟠)**: Avança para próximo ciclo (validação obrigatória)
- **FINALIZAR (🔴)**: Encerra definitivamente (permite pular)

**Documentação**: [CORRECAO_BOTOES_ENCERRAR_FINALIZAR_v2.7.md](../CORRECAO_BOTOES_ENCERRAR_FINALIZAR_v2.7.md)

---

## 🚨 PROBLEMAS ANTERIORES (v2.6 e anteriores)

### 5. **Erro: "Multiple rows were found when exactly one was required"**

**Sintoma**: Botão "Encerrar Rodada" falha com erro de múltiplas linhas
**Causa**: Registros duplicados na tabela `countings`
**Solução**: ✅ CORRIGIDO em `assignments.py:2818-2835`

```sql
-- Verificar duplicatas
SELECT inventory_item_id, count_number, COUNT(*) as duplicates
FROM inventario.countings 
GROUP BY inventory_item_id, count_number
HAVING COUNT(*) > 1;
```

### 2. **Erro: "invalid input value for enum"**

**Sintoma**: Botão "Confirmar Zeros" falha com erro de enum
**Causa**: Uso de valor `ZERO_CONFIRMED` que não existe no enum
**Solução**: ✅ CORRIGIDO - usa apenas valores válidos: `PENDING`, `COUNTED`, `REVIEWED`, `APPROVED`

### 3. **Modal de Lotes mostra produtos errados**

**Sintoma**: Modal exibe lotes de todos os armazéns
**Causa**: Falta de filtro por armazém na consulta
**Solução**: ✅ CORRIGIDO - endpoint agora filtra por `warehouse=02`

### 4. **Página de contagem mostra ciclo errado**

**Sintoma**: 2º ciclo carrega dados do 1º ciclo
**Causa**: Campo `counted_quantity` genérico em vez de específico por ciclo
**Solução**: ✅ CORRIGIDO - usa `count_1`, `count_2`, `count_3` baseado no ciclo atual

### 5. **Botão "Liberar Contagem" sempre mostra "1ª"**

**Sintoma**: Texto não atualiza conforme o ciclo
**Causa**: Lógica não considerava detecção correta do ciclo
**Solução**: ✅ CORRIGIDO - detecção por badge + casos específicos por ciclo

### 6. **Erro: "Identifier 'inventoryId' has already been declared"**

**Sintoma**: Página `inventory.html` não carrega com erro de sintaxe
**Causa**: Declaração duplicada de variável no mesmo escopo
**Solução**: ✅ CORRIGIDO - renomeado para `currentInventoryId`

---

## 🔍 COMANDOS DE DIAGNÓSTICO

### **Verificar Estado do Inventário**
```sql
SELECT 
    il.name,
    il.current_cycle,
    il.list_status,
    il.counter_cycle_1,
    il.counter_cycle_2,
    il.counter_cycle_3
FROM inventario.inventory_lists il
WHERE il.id = 'INVENTORY_ID_AQUI';
```

### **Verificar Contagens por Ciclo**
```sql
SELECT 
    ii.product_code,
    ii.count_cycle_1,
    ii.count_cycle_2,
    ii.count_cycle_3,
    ii.status
FROM inventario.inventory_items ii
WHERE ii.inventory_list_id = 'INVENTORY_ID_AQUI'
ORDER BY ii.product_code;
```

### **Verificar Duplicatas de Contagem**
```sql
SELECT 
    c.inventory_item_id,
    c.count_number,
    COUNT(*) as duplicates,
    ARRAY_AGG(c.quantity) as quantities
FROM inventario.countings c
GROUP BY c.inventory_item_id, c.count_number
HAVING COUNT(*) > 1;
```

### **Verificar Atribuições por Usuário**
```sql
SELECT 
    ca.count_number,
    ca.status,
    ca.assigned_to,
    u.username,
    COUNT(*) as total_assignments
FROM inventario.counting_assignments ca
JOIN inventario.users u ON u.id = ca.assigned_to
WHERE ca.inventory_item_id IN (
    SELECT id FROM inventario.inventory_items 
    WHERE inventory_list_id = 'INVENTORY_ID_AQUI'
)
GROUP BY ca.count_number, ca.status, ca.assigned_to, u.username
ORDER BY ca.count_number, u.username;
```

---

## 🎯 ENDPOINTS PARA TESTE

### **APIs Principais**
- `GET /api/v1/cycles/inventory/{id}/my-products` - Produtos do usuário
- `PUT /api/v1/assignments/inventory/{id}/close-round/{user_id}` - Encerrar rodada
- `POST /api/v1/inventory/lists/{id}/confirm-zero-expected` - Confirmar zeros
- `GET /api/v1/cycles/product/{code}/lots?warehouse=02` - Lotes por armazém

### **Teste Rápido do Fluxo**
```bash
# 1. Login
curl -X POST "http://localhost:8000/test/simple-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"clenio","password":"123456"}'

# 2. Produtos do usuário
curl -X GET "http://localhost:8000/api/v1/cycles/inventory/INVENTORY_ID/my-products" \
  -H "Authorization: Bearer TOKEN"

# 3. Encerrar rodada
curl -X PUT "http://localhost:8000/api/v1/assignments/inventory/INVENTORY_ID/close-round/USER_ID" \
  -H "Authorization: Bearer TOKEN"
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### **Antes de Liberar uma Versão**
- [ ] Todos os ciclos (1º, 2º, 3º) funcionam
- [ ] Modais abrem sem erro de acessibilidade
- [ ] Botões mostram texto correto por ciclo
- [ ] Contagens salvas nos campos corretos
- [ ] APIs retornam dados filtrados corretamente
- [ ] Páginas carregam sem erros de sintaxe
- [ ] Banco de dados sem registros duplicados

### **Teste Funcional Completo**
1. [ ] Criar inventário
2. [ ] Liberar 1ª contagem ✓ "Liberar 1ª Contagem"
3. [ ] Fazer contagem e salvar
4. [ ] Encerrar 1ª rodada ✓ Avança para 2º ciclo
5. [ ] Liberar 2ª contagem ✓ "Liberar 2ª Contagem" 
6. [ ] Fazer recontagem
7. [ ] Encerrar 2ª rodada ✓ Avança para 3º ciclo
8. [ ] Liberar 3ª contagem ✓ "Liberar 3ª Contagem"
9. [ ] Fazer contagem final
10. [ ] Finalizar inventário ✓ Status ENCERRADA

---

## 🚨 SINAIS DE ALERTA

### **Problemas que Requerem Atenção Imediata**
- ❌ Modal não abre (erro de sintaxe)
- ❌ Botão sempre mostra mesmo texto
- ❌ Contagem não salva ou salva no ciclo errado
- ❌ Erro "Multiple rows" ao encerrar rodada
- ❌ Página não carrega (erro JavaScript)

### **Como Reverter Problemas**
1. **Backup do banco**: Sempre fazer antes de alterações
2. **Git reset**: Reverter commits específicos se necessário
3. **Restart serviços**: `docker-compose restart backend`
4. **Limpeza cache**: Ctrl+F5 no navegador

---

**Documento mantido por**: Equipe de Desenvolvimento
**Última atualização**: 15/10/2025
**Versão**: 2.1 (v2.10.0 - Sistema de Snapshot)