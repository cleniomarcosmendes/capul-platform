# Changelog v2.19.x

Histórico detalhado das versões 2.19.x do Sistema de Inventário Protheus.

---

## v2.19.54 (19/01/2026) - Validação DE/ATÉ nos Filtros

### FIX: Validação para impedir valor "Até" menor que "De" nos filtros

**Contexto**: Os filtros do tipo DE/ATÉ (range) permitiam que o usuário informasse um valor "Até" menor que o valor "De", causando buscas sem resultados ou comportamento inesperado.

**Correções Implementadas**:

1. **Função genérica de validação**:
   - `validateRangeFilter()` - Valida comparação alfanumérica entre DE e ATÉ
   - `setupRangeValidation()` - Configura event listeners (suporta Select2 e inputs)
   - `initRangeValidations()` - Inicializa validação em todos os campos

2. **Campos validados - Modal Adicionar Produtos** (9 pares):
   - Produto (código), Grupo, Categoria, Subcategoria, Segmento
   - Grupo Inventário, Localização 1, Localização 2, Localização 3

3. **Campos validados - Modal Criar Lista** (8 pares):
   - Grupo, Categoria, Subcategoria, Segmento
   - Grupo Inventário, Localização 1, Localização 2, Localização 3

4. **Campos validados - Página Principal** (1 par):
   - Data De/Até

**Comportamento**:
- Quando "Até" < "De": exibe alerta warning e limpa o campo "Até"
- Validação dispara no evento `change` e `select2:select`
- Compatível com Select2 (dropdowns com pesquisa) e inputs normais

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/inventory.html` | Funções de validação DE/ATÉ, event listeners nos 18 pares de campos |

---

## v2.19.53 (18/01/2026) - Interação entre Filtros de Data

### FIX: Filtros de data exclusivos e alertas melhorados

**Contexto**: Quando o usuário alterava as datas manualmente (Data De/Até), o filtro de período pré-definido (Hoje/Semana/Mês) sobrescrevia os valores. O botão "Atualizar" também não tinha feedback visual perceptível.

**Correções Implementadas**:

1. **Filtros de data exclusivos**:
   - Ao alterar `dateFrom` ou `dateTo` manualmente → limpa `dateFilter`
   - Ao selecionar período pré-definido → limpa `dateFrom` e `dateTo`
   - Comportamento intuitivo: usa UM ou OUTRO, não ambos

2. **Alertas visuais melhorados**:
   - Animação deslizante (slide-in da direita)
   - Ícones de status (✅ sucesso, ❌ erro, ℹ️ info)
   - Borda colorida lateral para destaque
   - Posição ajustada (abaixo do header)

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/inventory.html` | Lógica de exclusão mútua nos filtros, showAlert melhorado |

---

## v2.19.52 (18/01/2026) - Correção de Filtros na Página de Inventários

### FIX: Filtros de data, status e botão Atualizar

**Contexto**: Os filtros na página de inventários não estavam funcionando corretamente. O filtro de status tinha opções desalinhadas com o sistema, os filtros de data não eram aplicados no backend, e o botão "Atualizar" não tinha feedback visual.

**Correções Implementadas**:

1. **Filtro de Status simplificado**:
   - Reduzido de 4 opções para 2 (alinhado com exibição real)
   - "Em Andamento" = DRAFT + IN_PROGRESS
   - "Encerrado" = COMPLETED + CLOSED
   - Filtragem aplicada no frontend após receber dados

2. **Filtros de Data corrigidos**:
   - Frontend: Conversão de dateFilter (hoje/semana/mês/trimestre) em datas reais
   - Backend: Adicionados parâmetros `date_from` e `date_to` no endpoint `/api/v1/inventory/lists`
   - Prioridade: dateFilter tem precedência sobre dateFrom/dateTo manuais

3. **Botão Atualizar melhorado**:
   - Removida duplicação da função `refreshInventories()`
   - Adicionado feedback visual (toast "Lista de inventários atualizada!")
   - Tratamento de erros com mensagem ao usuário

4. **Renomeação de labels**:
   - Botão "Relatórios" → "Consulta" no header

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/inventory.html` | Filtro status simplificado, conversão dateFilter, feedback botão Atualizar |
| `backend/app/main.py` | Parâmetros date_from/date_to no endpoint de listagem |

---

## v2.19.51 (18/01/2026) - Remoção de Exportações e Renomeação de Labels

### REFACTOR: Remoção de opções de exportação das páginas de comparação

**Contexto**: Os dados das páginas de comparação são para análise interna e não devem ser utilizados como relatórios oficiais.

**Alterações Implementadas**:

1. **Remoção de botões de exportação**:
   - Removidos botões Excel, CSV, JSON e Impressão de:
     - `comparison_results.html`
     - `inventory_transfer_report.html`
     - `reports.html`

2. **Renomeação de labels**:
   - "Ver Relatório" → "Ver Detalhes" (botões de ação)
   - "Relatório Inventário" → "Consulta Inventário" (cards)

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/comparison_results.html` | Removida seção de exportação, renomeados labels |
| `frontend/inventory_transfer_report.html` | Removidos botões de exportação |
| `frontend/reports.html` | Removida seção de ações de exportação |

---

## v2.19.50 (18/01/2026) - Select2 com Pesquisa Inteligente nos Filtros

### ENHANCEMENT: Dropdowns pesquisáveis nos filtros avançados

**Contexto**: Usuário solicitou substituir campos de texto DE/ATÉ por dropdowns com pesquisa inteligente para facilitar a seleção de valores.

**Melhorias Implementadas**:

1. **Integração Select2 em inventory.html**:
   - Dropdowns DE/ATÉ para Grupo, Categoria, Subcategoria, Segmento
   - Modal "Adicionar Produtos ao Inventário" (8 selects)
   - Modal "Criar Listas de Contagem" (8 selects)
   - Total: 16 campos convertidos

2. **Integração Select2 em products.html**:
   - Filtros de Grupo, Categoria, Subcategoria, Segmento, Armazém
   - Pesquisa inteligente com suporte a acentos

3. **Pesquisa Inteligente**:
   - Busca case-insensitive
   - Busca accent-insensitive (ex: "cafe" encontra "CAFÉ")
   - Tema Bootstrap 5 integrado

4. **Correção Segmento**:
   - Backend corrigido para buscar descrição da tabela SZF010
   - Formato exibido: "código - descrição"

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/inventory.html` | Select2 em 16 campos, função `loadFilterOptionsForInventory()` |
| `frontend/products.html` | Select2 em filtros, `initSelect2Filters()` |
| `backend/app/main.py` | Query Segmento corrigida (JOIN SZF010) |

---

## v2.19.49 (16/01/2026) - Coluna Qtde Contada na tabela de Transferências

### ENHANCEMENT: Adiciona coluna "Qtde Contada" na tabela de Transferências

**Contexto**: Usuário solicitou adicionar a coluna "Qtde Contada" na tabela de Transferências para melhor visualização dos dados.

**Melhorias Implementadas**:

1. **Nova coluna "CONTADA" para Origem e Destino**:
   - Armazém Origem: ARM. | ANTES | **CONTADA** | DEPOIS
   - Armazém Destino: ARM. | ANTES | **CONTADA** | DEPOIS

2. **Páginas atualizadas**:
   - `comparison_results.html` - Tabela de Transferências (card azul)
   - `integration_protheus.html` - Aba de Transferências

3. **Backend atualizado**:
   - Endpoint `/preview` retorna `source_counted` e `target_counted`
   - Suporte para produtos com e sem lote

4. **Exportação atualizada**:
   - CSV e Excel agora incluem as colunas de Qtde Contada

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/comparison_results.html` | Tabela transfers com colunas Qtde Contada, exportação CSV/Excel |
| `frontend/integration_protheus.html` | Tabela transfers com colunas CONTADA |
| `backend/app/api/v1/endpoints/integration_protheus.py` | Campos `source_counted` e `target_counted` |

---

## v2.19.48 (16/01/2026) - Melhoria UX Integração Protheus + Correção Lógica Transferência

### ENHANCEMENT: Auto-preenchimento e visualização de integrações existentes

**Contexto**: Quando o usuário seleciona um inventário que já foi integrado anteriormente, o sistema agora:
1. Auto-preenche automaticamente o inventário B parceiro
2. Permite visualizar a comparação (preview)
3. Bloqueia apenas o botão "Integrar" com mensagem clara

**Melhorias Implementadas**:

1. **Novo Endpoint `/api/v1/integration/protheus/existing-integration/{inventory_id}`**:
   - Retorna informações sobre integração existente para um inventário
   - Inclui dados do parceiro, posição original (A ou B), e status

2. **Auto-preenchimento do Inventário B**:
   - Ao selecionar inventário A que já foi integrado, o B é preenchido automaticamente
   - Select B fica desabilitado para manter consistência com integração original

3. **Troca Automática A↔B**:
   - Se usuário seleciona o que era "B" na integração original
   - Sistema faz troca automática e mostra alerta explicativo

4. **Banner de Integração Existente**:
   - Exibe alerta visual informando status da integração anterior
   - Mostra data de envio/criação

5. **Bloqueio no Envio (não na seleção)**:
   - Usuário pode visualizar preview normalmente
   - Ao clicar "Integrar", sistema verifica status e bloqueia se já enviado
   - Mensagem clara explica o motivo do bloqueio

### BUGFIX: Unificação da lógica de transferências

**Problema**: Inconsistência entre páginas - `inventory.html` mostrava "1 Match Perfeito" enquanto `integration_protheus.html` mostrava "2 Transferências".

**Solução**:
- Unificada a lógica de classificação em `inventory_comparison.py`
- Ambos os tipos (Match Perfeito e Transferência Parcial) agora usam a lista `matches`
- Adicionado flag `is_perfect_match` para diferenciar os tipos
- Renomeado card de "Match Perfeito" para "Transferências" em `inventory.html`

### BUGFIX CRÍTICO: Correção da direção de transferência LÓGICA

**Problema**: A direção da transferência estava invertida. O sistema sugeria transferir de A→B quando deveria ser B→A.

**Contexto Importante**: As transferências são **LÓGICAS** (de SALDO no sistema), não físicas de produtos:
- Se armazém tem **FALTA** (contou menos): saldo precisa **DIMINUIR** → SALDO **SAI** (origem)
- Se armazém tem **SOBRA** (contou mais): saldo precisa **AUMENTAR** → SALDO **ENTRA** (destino)

**Correção**:
```python
# ANTES (errado):
warehouse_origin = inventory_a.warehouse if div_a > 0 else inventory_b.warehouse

# DEPOIS (correto):
warehouse_origin = inventory_a.warehouse if div_a < 0 else inventory_b.warehouse
```

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `backend/app/api/v1/endpoints/integration_protheus.py` | Novo endpoint `existing-integration`, parâmetro `view_only` |
| `backend/app/api/v1/endpoints/inventory_comparison.py` | Unificação lógica transferências, correção direção |
| `frontend/integration_protheus.html` | Lógica de auto-preenchimento, troca automática, banner e bloqueio |
| `frontend/inventory.html` | Renomeado card para "Transferências" |
| `frontend/comparison_results.html` | Atualizado títulos para "Transferências" |

---

## v2.19.47 (13/01/2026) - Atualização endpoint API Protheus

### CONFIG: Alteração de porta da API Protheus de 443 para 8104

**Contexto**: A API Protheus foi migrada para uma nova porta (8104). Todas as referências foram atualizadas.

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `backend/app/core/config.py` | Atualizado PROTHEUS_API_URL para porta 8104 |
| `backend/app/api/v1/endpoints/sync_protheus.py` | Atualizado fallback URL para porta 8104 |
| `backend/app/api/v1/endpoints/import_produtos.py` | Atualizado PROTHEUS_API_URL para porta 8104 |
| `backend/test_api_protheus.py` | Atualizado URL de teste para porta 8104 |
| `test_api_formats.py` | Atualizado API_URL para porta 8104 |
| `.env.example` | Atualizado exemplo de PROTHEUS_API_URL para porta 8104 |

---

## v2.19.46 (12/01/2026) - Identidade Visual Oficial Capul

### ENHANCEMENT: Aplicação das diretrizes do Manual de Identidade Visual Capul

**Contexto**: Atualização da aplicação para seguir as diretrizes oficiais do Manual de Identidade Visual da Capul (2014).

**Melhorias Implementadas**:

1. **Paleta de Cores Oficial**:
   - Verde Escuro (Pantone 349 C): `#006838` - texto e elementos principais
   - Verde Claro (Pantone 376 C): `#72BF44` - folhagem do logo, elementos secundários
   - Amarelo (Pantone Yellow C): `#FFED00` - centro do logo, destaques e slogan

2. **Tipografia Oficial**:
   - Fonte **PT Sans** (Google Fonts) em todas as páginas
   - Substitui Inter/Segoe UI pela fonte oficial da marca

3. **Slogan Institucional**:
   - Adicionado slogan oficial **"Cooperar gera valor"** no footer
   - Destacado em amarelo institucional (`#FFED00`)

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/css/capul-theme.css` | Paleta de cores oficial, variáveis CSS, fonte PT Sans |
| `frontend/inventory.html` | Footer com slogan oficial |
| `frontend/counting_mobile.html` | Footer com slogan, cor oficial |
| `frontend/counting_improved.html` | Footer com slogan oficial |
| `frontend/dashboard.html` | Footer com slogan oficial |
| `frontend/stores.html` | Footer atualizado |
| `frontend/users.html` | Footer atualizado |
| `frontend/reports.html` | Footer atualizado |
| `frontend/products.html` | Footer atualizado |
| `frontend/import.html` | Footer atualizado |
| `frontend/discrepancies.html` | Footer atualizado |
| `frontend/admin_monitoring.html` | Footer atualizado |

---

## v2.19.45 (12/01/2026) - FIX: Saldo não exibido na tela Mobile de contagem

### FIX: Campos "Estoque | Entregas | Total" não exibidos para SUPERVISOR/ADMIN no Mobile

**Problema**: Na tela de contagem mobile (`counting_mobile.html`), os campos "Estoque: | Entregas: | Total" não estavam sendo exibidos mesmo para usuários SUPERVISOR/ADMIN.

**Causa Raiz**: O código frontend usava `product.b2_qatu` para obter o estoque, porém a API retorna esse valor no campo `product.system_qty`.

**Solução**: Corrigido o mapeamento para usar `product.system_qty || product.b2_qatu || 0`, garantindo compatibilidade com a resposta da API.

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `frontend/counting_mobile.html` | Corrigido mapeamento de `b2_qatu` para `system_qty` |

---

## v2.19.43 (09/01/2026) - CORREÇÃO CRÍTICA: Qtd Final incorreta quando lista ENCERRADA

### FIX: Coluna "Qtd Final" exibindo valor errado para produtos com NULL em ciclos encerrados

**Problema Crítico**: A função `calculateFinalQuantityByMajority()` dependia apenas do parâmetro `currentCycle` para determinar quando tratar NULL como 0. Porém, quando uma lista está **ENCERRADA**, **TODOS os NULLs devem ser tratados como 0**, independentemente do ciclo armazenado.

**Exemplos Reais (Inventário 'clenio_15')**:

| Produto | Expected | C1 | C2 | C3 | Qtd Final (ERRADO) | Qtd Final (CORRETO) |
|---------|----------|----|----|----|--------------------|--------------------|
| 00005909 | 0 | 1 | NULL(0) | - | **1** | **0** |
| 00005910 | 0 | 1 | 2 | NULL(0) | **2** | **0** |

**Regras de Negócio**:

1. **Produto 00005909**: `expected=0`, `c1=1`, `c2=NULL`
   - c2 NULL = 0 (não encontrado)
   - c2(0) == expected(0) → Qtd Final deve ser **0**

2. **Produto 00005910**: `expected=0`, `c1=1`, `c2=2`, `c3=NULL`
   - c3 NULL = 0 (contagem Minerva/desempate)
   - c3 efetivo = **0** (valor definitivo)

**Causa Raiz**: A função `calculateFinalQuantityByMajority()` não recebia o status da lista e não podia saber se a lista estava ENCERRADA.

**Solução Implementada**:

1. **Adicionado novo parâmetro `listStatus`** à função `calculateFinalQuantityByMajority()`
2. **Quando `listStatus === 'ENCERRADA'`**, tratar NULL como 0 para TODOS os ciclos aplicáveis
3. **Atualizado TODAS as chamadas** da função para passar o status da lista

```javascript
// ANTES (BUG)
function calculateFinalQuantityByMajority(count1, count2, count3, systemQty, currentCycle) {
    // Só tratava NULL como 0 baseado em currentCycle (ex: currentCycle >= 2)
}

// DEPOIS (v2.19.43)
function calculateFinalQuantityByMajority(count1, count2, count3, systemQty, currentCycle, listStatus) {
    const isListClosed = listStatus === 'ENCERRADA' || listStatus === 'FINALIZADA';

    if (isListClosed) {
        // Tratar NULL como 0 para TODOS os ciclos aplicáveis
        if (count2 === null && count1 diverge de expected) effectiveCount2 = 0;
        if (count3 === null && count1 diverge de effectiveCount2) effectiveCount3 = 0;
    }

    // Lógica de cálculo de quantidade final...
}
```

**Arquivos alterados**:

| Arquivo | Função/Trecho Corrigido |
|---------|------------------------|
| `frontend/inventory.html` | `calculateFinalQuantityByMajority()` - linhas 5951-6026 |
| `frontend/inventory.html` | Chamada em `renderProductListGrid()` - linha 6500 |
| `frontend/inventory.html` | Chamada em `createProductsListModal()` - linha 10951 |
| `frontend/inventory.html` | Chamada em `showInventoryAnalysisModal()` - linhas 19614, 19664, 19760 |
| `frontend/inventory.html` | Extração de `list_status` na API - linha 19503 |

**Impacto**:
- **CORRIGE** a inteligência principal do sistema de inventário
- Garante que a coluna "Qtd Final" exiba o valor correto em listas ENCERRADAS
- Implementa corretamente a regra: **NULL = 0 = "não encontrado"**
- Implementa corretamente a regra: **Se contagem efetiva (NULL=0) bate com expected, é a quantidade final**
- Implementa corretamente a regra: **Contagem 3 (Minerva) é sempre o valor definitivo em caso de divergência**

---

## v2.19.42 (09/01/2026) - Correção: NULL = 0 na Lógica de Encerramento de Ciclo

### FIX: Produto não avança para ciclo 3 quando count_cycle_2 é NULL

**Problema Crítico**: A correção v2.19.41 tratou NULL como 0 no **frontend e relatórios**, mas a lógica de **encerramento de ciclo** no backend ainda não tratava NULL corretamente. Isso fazia com que produtos ficassem "perdidos" - não aparecendo nem para contagem no ciclo 3 nem com status correto.

**Exemplo Real (Inventário 'emanoel_01', produto 00010009)**:
```
expected_quantity = 0
count_cycle_1 = 1    (operador encontrou 1 unidade - diverge do sistema)
count_cycle_2 = NULL (operador NÃO contou no ciclo 2)
needs_recount_cycle_2 = true
needs_recount_cycle_3 = false  ← BUG!

❌ ANTES: Produto ficava com needs_recount_cycle_3=false (não ia para ciclo 3)
          mas também não era encerrado corretamente
✅ DEPOIS: count_cycle_2 NULL → tratado como 0
          c2(0) == expected(0) → "Zero Confirmado", encerra corretamente
```

**Causa Raiz**: Na query SQL de encerramento do ciclo 2:
```sql
-- Todos os CASEs requeriam count_cycle_2 IS NOT NULL
WHEN count_cycle_1 IS NOT NULL AND count_cycle_2 IS NOT NULL ...
-- Quando count_cycle_2 era NULL, caía no ELSE false
ELSE false  -- ← Produto ficava "perdido"!
```

**Solução Implementada**:
1. Adicionado CASE específico para `count_cycle_2 IS NULL AND needs_recount_cycle_2 = true`
2. Usado `COALESCE(count_cycle_2, 0)` nas comparações
3. Também atualiza `count_cycle_2 = 0` quando era NULL e precisava de recontagem

**Regra de Negócio**:
> Quando o ciclo 2 é encerrado e um produto estava marcado para recontagem (`needs_recount_cycle_2=true`) mas não foi contado (`count_cycle_2=NULL`), trata-se como quantidade 0 (não encontrado = não existe).
>
> - Se `c2(efetivo=0) == expected` → Encerra como "Zero Confirmado"
> - Se `c2(efetivo=0) != expected` → Avança para ciclo 3

**Arquivos alterados**:

| Arquivo | Função/Trecho Corrigido |
|---------|------------------------|
| `backend/app/main.py` | Query de `needs_recount_cycle_3` - linhas 2904-2948 |
| `backend/app/main.py` | Query de `needs_recount_cycle_3` - linhas 5843-5881 |

**Impacto**:
- Corrige produtos que ficavam "perdidos" após encerramento do ciclo 2
- Garante que NULL seja tratado como 0 em TODA a lógica do sistema
- Completa a correção iniciada em v2.19.41

---

### FIX: Produto com expected=0 e count_cycle_1=NULL exibido como "Pendente"

**Problema**: Produtos com `expected_quantity = 0` que nunca foram contados (`count_cycle_1 = NULL`) eram exibidos como "Pendente" na interface, mesmo tendo status `ZERO_CONFIRMED` no banco de dados.

**Exemplo Real (Inventário 'inventario_02', produto 00010308)**:
```
expected_quantity = 0
count_cycle_1 = NULL (não foi contado)
status (banco) = ZERO_CONFIRMED ✅
status (frontend) = Pendente ❌
```

**Causa Raiz**: Na função `getProductStatusIntel()` do frontend:
```javascript
// ANTES (BUG)
if (finalQuantity === null) {
    return 'awaiting_count';  // ← Sempre retornava Pendente!
}
```

**Solução Implementada**:
```javascript
// DEPOIS (CORREÇÃO v2.19.42)
if (finalQuantity === null) {
    // Se expected=0 e não foi contado, é "zero confirmado"
    // Lógica: Não encontrar um produto com expected=0 = confirma que quantidade é 0
    if (systemQty === 0) {
        return 'zero_confirmed';  // ✅ Agora retorna zero confirmado
    }
    return 'awaiting_count';
}
```

**Regra de Negócio**:
> Quando um produto tem `expected = 0` e o operador NÃO o contou (NULL), significa que ele não encontrou o produto. Não encontrar um produto com expected=0 confirma que a quantidade é realmente 0.

**Arquivos alterados**:

| Arquivo | Função/Trecho Corrigido |
|---------|------------------------|
| `frontend/inventory.html` | `getProductStatusIntel()` - linha 6235-6242 |

**Impacto**:
- Corrige exibição de status na tela "Gerenciar Lista de Contagem"
- Produtos com expected=0 e não contados agora mostram "zero confirmado" corretamente

---

### FIX: Encerramento do ciclo 3 não tratava count_cycle_3 NULL como 0

**Problema**: Quando o ciclo 3 era encerrado, produtos com `count_cycle_3 = NULL` não eram tratados. A lógica só existia para ciclos 1 e 2.

**Exemplo Real (Inventário 'clenio_14', produto 000102631)**:
```
expected = 0
c1 = 1, c2 = 2, c3 = NULL
needs_recount_cycle_3 = true

❌ ANTES: c3 permanecia NULL, qtd final calculada como 2.00 (c2)
✅ DEPOIS: c3 NULL → 0, e como c3(0) == expected(0) → Qtd final = 0
```

**Solução**: Adicionado bloco `elif current_round == 3` na função `check_and_advance_inventory_round()`:
```python
elif current_round == 3:
    # Tratar count_cycle_3 NULL como 0 quando precisava de recontagem
    UPDATE inventory_items SET
        count_cycle_3 = CASE
            WHEN count_cycle_3 IS NULL AND needs_recount_cycle_3 = true THEN 0
            ELSE count_cycle_3
        END
    WHERE needs_recount_cycle_3 = true
```

**Arquivos alterados**:

| Arquivo | Função/Trecho Corrigido |
|---------|------------------------|
| `backend/app/main.py` | `check_and_advance_inventory_round()` - linhas 2998-3017 |

**Impacto**:
- Completa a correção NULL=0 para todos os 3 ciclos
- Garante cálculo correto de quantidade final quando ciclo 3 é encerrado

---

## v2.19.41 (08/01/2026) - Correção Crítica: NULL = 0 em Ciclos Encerrados

### FIX: Quantidade final incorreta quando produto não contado no ciclo 2/3

**Problema Crítico**: Quando um produto era marcado para recontagem no ciclo 2 mas o operador não informava quantidade (deixava NULL), o sistema usava incorretamente o valor do ciclo 1 como quantidade final.

**Exemplo Real (Inventário 'emanoel', produto 00010119)**:
```
count_cycle_1 = 10    (operador encontrou 10 unidades)
count_cycle_2 = NULL  (não informou = não encontrou = 0)
count_cycle_3 = NULL
expected = 0

❌ ANTES: Sistema usava 10 como quantidade final (errado!)
✅ DEPOIS: Sistema usa 0 como quantidade final (NULL=0 quando ciclo encerrado)
```

**Regra de Negócio Corrigida**:
> Quando o ciclo é encerrado, produtos que o operador NÃO informou quantidade (NULL) devem ser tratados como quantidade 0 (não encontrado = não existe fisicamente).

**Lógica Implementada**:
```javascript
// Se ciclo >= 2 e count2 é NULL mas count1 divergia do expected:
//    → count2 efetivo = 0 (não contado após divergência = confirmação de zero)

// Se ciclo >= 3 e count3 é NULL:
//    → count3 efetivo = 0 (não contado = quantidade zero)
```

**Arquivos alterados**:

| Arquivo | Função/Trecho Corrigido |
|---------|------------------------|
| `frontend/inventory.html` | `getProductStatusIntel()` - linhas 6060-6121 |
| `frontend/inventory.html` | `calculateFinalQuantityByMajority()` - linhas 5950-6006 |
| `frontend/counting_improved.html` | `calculateFinalQuantityByMajority()` - linhas 1626-1684 |
| `backend/app/main.py` | Cálculo de `finalQuantity` - linhas 9446-9484 |
| `backend/app/api/v1/endpoints/counting_lists.py` | Cálculo de `finalQuantity` - linhas 168-200 |

**Impacto**:
- Corrige cálculo de quantidade final em todos os relatórios
- Corrige exibição na página "Gerenciar Lista de Contagem"
- Corrige análise de divergências no modal de análise
- Garante consistência entre frontend e backend

**Cenários Cobertos**:
1. Ciclo 2 encerrado, count2=NULL, count1 divergia → usa 0
2. Ciclo 3 encerrado, count3=NULL → usa 0
3. count2 (efetivo=0) bate com expected=0 → quantidade final = 0 ✅

---

## v2.19.40 (04/01/2026) - Ordenação Alfabética e Navegação Melhorada

### FIX: Produtos não ordenados alfabeticamente no modal de análise

**Problema**: No modal "Analisar" (botão de análise de divergências), os produtos não estavam sendo exibidos em ordem alfabética, dificultando a localização de itens específicos.

**Solução**: Adicionada ordenação alfabética na função `showInventoryAnalysisModal()`:
- Produtos ordenados por `product_name`, `product_description` ou `descricao`
- Ordenação usando `localeCompare('pt-BR')` para suporte a caracteres acentuados
- Consistente com a ordenação já implementada em outros modais (Gerenciar Lista, Relatórios, Integração)

**Arquivos alterados**:
- `frontend/inventory.html` - Função `showInventoryAnalysisModal()` linha ~19512
- `frontend/inventory_transfer_report.html` - Ordenação por descrição em vez de código

### FIX: Botão "Voltar" nos Relatórios A/B da Comparação

**Problema**: Ao clicar em "Ver Relatório" (Inventário A ou B) na tela de comparação, o botão "Voltar" redirecionava diretamente para `inventory.html` em vez de retornar para a tela com os 5 cards da comparação.

**Solução**: Implementada função `voltarParaResumo()` no `inventory_transfer_report.html`:
- Define flag `reopenComparisonModal = true` no sessionStorage
- Salva `comparisonData.type = 'cards'` para reabrir a tela dos 5 cards
- Comportamento idêntico ao botão "Voltar" das outras páginas de comparação

**Arquivos alterados**:
- `frontend/inventory_transfer_report.html` - Botão e função `voltarParaResumo()`

### FEAT: Layout expandido para melhor aproveitamento da tela

**Melhoria**: Containers principais expandidos para usar mais espaço disponível na tela, proporcionando visual mais profissional (padrão ERP).

**CSS responsivo aplicado**:
- Telas normais: `max-width: 95%`
- Telas ≥ 1400px: `max-width: 1800px`
- Telas ≥ 1900px (ultrawide): `max-width: 92%`

**Arquivos alterados** (12 páginas):
- `frontend/inventory.html`
- `frontend/products.html`
- `frontend/users.html`
- `frontend/stores.html`
- `frontend/dashboard.html`
- `frontend/reports.html`
- `frontend/admin_monitoring.html`
- `frontend/integration_protheus.html`
- `frontend/comparison_results.html`
- `frontend/inventory_transfer_report.html`
- `frontend/counting_improved.html`
- `frontend/discrepancies.html`

---

## v2.19.39 (01/01/2026) - Sincronização Automática status/list_status

### FIX: Inconsistência entre campos `status` e `list_status`

**Problema**: Histórico de 20+ ocorrências de bugs relacionados à inconsistência entre os campos:
- `status` (Enum: DRAFT, IN_PROGRESS, COMPLETED)
- `list_status` (String: ABERTA, EM_CONTAGEM, ENCERRADA)

O backend usava `list_status` para controlar o fluxo, mas o frontend verificava `status` para UI, resultando em:
- Inventários marcados como ENCERRADA mas com status DRAFT
- Botões desabilitados incorretamente após encerramento
- Problemas ao exibir status correto na interface

**Solução**: Sincronização automática bidirecional via `@validates` do SQLAlchemy:

```python
# Mapeamento automático:
# ABERTA ↔ DRAFT
# EM_CONTAGEM ↔ IN_PROGRESS
# ENCERRADA ↔ COMPLETED
```

Quando um campo é alterado, o outro é sincronizado automaticamente, eliminando inconsistências.

**Arquivos alterados**:
- `backend/app/models/models.py` - Adicionado `@validates` para `status` e `list_status`
- SQL: Correção de inventários existentes com valores inconsistentes

---

## v2.19.38 (01/01/2026) - Correções Modal de Configuração

### FIX: Botões pós-encerramento e fechamento automático do modal

**Problema**: Após encerrar um inventário, os botões no modal de configuração não eram habilitados corretamente e o modal não fechava automaticamente.

**Correções**:
1. **Habilitar botões pós-encerramento**: Botões de ações são habilitados após encerramento bem-sucedido
2. **Atualização do data-status**: Corrigido para atualizar o atributo `data-status` do card ao encerrar
3. **Fechamento automático**: Modal de configuração fecha automaticamente após sucesso do encerramento
4. **ID do modal**: Corrigido ID do modal de configuração (configModal)

**Arquivos alterados**:
- `frontend/inventory.html`

**Commits**: `de2ff22`, `d125273`, `f905a6f`, `fdfa6d9`

---

## v2.19.37 (31/12/2025) - Melhorias Visuais e Login Multi-Filial

### FIX: Melhorias de UI e correção do login multi-filial

**Correções**:
1. **Login multi-filial**: Corrigido fluxo de autenticação para usuários com acesso a múltiplas filiais
2. **Melhorias visuais**: Ajustes de interface para melhor experiência do usuário

**Arquivos alterados**:
- `frontend/login.html`
- `backend/app/api/auth.py`

**Commits**: `4b1551f`

---

## v2.19.36 (31/12/2025) - Correção Crítica: Filtro de Filial na Query de Saldo

### FIX: Bug crítico na query de saldo que não filtrava por filial

**Problema**: Ao adicionar produtos ao inventário, a query que busca o saldo (`B2_QATU`) da tabela SB2010 **não filtrava por filial**, causando:
- Produtos com mesmo código em filiais diferentes pegavam saldo incorreto
- `expected_quantity` gravado como 0 quando deveria ser 27 (exemplo real)
- Sistema avançava para ciclo 3 mesmo quando não havia divergência real
- Frontend mostrava valor correto (do snapshot), mas backend calculava com valor errado

**Causa raiz**: Query ORM sem filtro de filial:
```python
# ANTES (BUG)
db.query(SB2010.b2_qatu).filter(
    SB2010.b2_cod == product_code,
    SB2010.b2_local == warehouse  # Faltava: SB2010.b2_filial == filial
).scalar()
```

**Correções aplicadas**:

1. **Query de saldo** (`main.py:2097-2125`):
   - Adicionado filtro `b2_filial = :filial` na query SQL
   - Busca de filial movida para antes do `if has_lot_control`

2. **Cálculo de divergências** (`main.py:10210-10324`):
   - Agora usa `COALESCE(iis.b2_qatu, ii.expected_quantity, 0)`
   - Snapshot como fonte da verdade para inventários já existentes
   - JOIN com `inventory_items_snapshot` nas queries de ciclo 1 e ciclo 2

**Arquivos alterados**:
- `backend/app/main.py` - Correção da query e cálculo de divergências

**Commits**: `961c9e2`

---

### TEST: Suite de testes automatizados para ciclos

**Novo arquivo**: `backend/tests/test_ciclos_stress.py` (509 linhas)

**Testes incluídos** (15 total):
- **Autenticação**: Login, validação de token
- **API**: Saúde dos endpoints, tempo de resposta
- **Inventário**: Criar, listar inventários
- **Ciclos**: Fluxos com/sem divergência, confirmação, correção, desempate
- **Bug v2.19.36**: Filtro de filial, snapshot como fonte da verdade
- **Stress**: Criação múltipla, requisições concorrentes

**Execução**:
```bash
python backend/tests/test_ciclos_stress.py
```

**Resultado**: 14/15 testes passando (1 falha não crítica em stress concorrente)

**Commits**: `274eee0`

---

## v2.19.35 (31/12/2025) - Correção de Tooltips e Header em Modais Fullscreen

### FIX: Tooltips "presos" na tela ao navegar entre modais

**Problema**: Tooltips do Bootstrap (ex: "Atualizar dados da lista") ficavam visíveis mesmo após navegar para outro modal.

**Solução**: Criada função `destroyAllTooltips()` que:
- Destrói todas as instâncias de tooltips do Bootstrap
- Remove tooltips órfãos que ficam no DOM
- Chamada antes de abrir cada modal fullscreen

**Funções atualizadas**:
- `showCountingListManagerAsync`
- `viewListDetails`
- `showProductSelectionModal`
- `createCountingLists`
- `createInventoryConfigModal`

**Commits**: `de66f81`

---

## v2.19.34 (31/12/2025) - Header Branco com Logo em Modais Fullscreen

### FEATURE: Identidade visual Capul em todos os modais fullscreen

**Modais atualizados** (inventory.html):
- `countingListModal` - Gerenciar Lista de Contagem
- `productsListModal` - Ver Detalhes
- `productSelectionModal` - Adicionar Produtos ao Inventário
- `cleanAssignmentModal` - Criar Listas de Contagem

**Layout aplicado**:
```
┌─────────────────────────────────────────────────┐
│ [Logo Capul] Inventário  │ Loja │ Usuário [Sair]│  ← Header branco
├─────────────────────────────────────────────────┤
│  ⚙️ Título do Modal                     [Voltar]│  ← Header verde
└─────────────────────────────────────────────────┘
```

**Commits**: `1df770e`

---

## v2.19.33 (31/12/2025) - Página de Redirect com Cores Capul

### FIX: Cores verde Capul na página index.html

**Alteração**: Atualizado gradiente de roxo/azul (`#667eea/#764ba2`) para verde Capul (`#1B5E20/#2E7D32`).

**Commits**: `856d47f`

---

## v2.19.32 (31/12/2025) - Header Branco com Logo em 3 Páginas

### FEATURE: Identidade visual Capul completa

**Páginas atualizadas**:
- `integration_protheus.html`
- `inventory_transfer_report.html`
- `comparison_results.html`

**Alterações**:
- Substituído navbar antigo por `capul-header` padrão
- Adicionado logo Capul verde no header branco
- Adicionado informações de loja e usuário
- Adicionado função `initCapulHeader()` e `logout()`

**Commits**: `0ea98c8`

---

## v2.19.31 (31/12/2025) - Header Mobile Separado (Branco + Verde)

### FIX: Layout do header no counting_mobile.html

**Problema**: Logo branco sobre fundo verde não tinha contraste adequado.

**Solução**: Separação em dois headers:
1. **Header branco** - Logo Capul verde + botão voltar
2. **Header verde** - Nome do inventário, filial e ciclo

**Commits**: `f6d1187`

---

## v2.19.30 (31/12/2025) - Logo Verde no Mobile

### FIX: Exibir logo com cores originais no mobile

- Removido filtro `brightness(0) invert(1)` que deixava logo branco
- Logo agora exibe cores originais (verde)

**Commits**: `cd2493a`

---

## v2.19.29 (31/12/2025) - Centralização do Header Mobile

### FIX: Melhorar visual do header mobile

- Centralizado logo + título do inventário
- Centralizado informações de filial e ciclo
- Aumentado tamanho do logo (32px)

**Commits**: `dadef84`

---

## v2.19.28 (31/12/2025) - Correção Sobreposição no Mobile

### FIX: Botão voltar sobrepondo logo no header mobile

- Adicionado `padding-left: 50px` para evitar sobreposição
- Ajustado alinhamento das informações

**Commits**: `058102f`

---

## v2.19.18 (24/12/2025) - Contagem de Lotes Unificada MOBILE/DESKTOP

### FEATURE: Sistema de contagem por lotes totalmente sincronizado

**Problema Identificado**:
- MOBILE salvava lotes individuais, DESKTOP criava registro "MULTIPLOS_LOTES"
- Soma duplicada: lotes individuais + MULTIPLOS_LOTES = valor errado
- Lotes salvos no MOBILE não apareciam no modal do DESKTOP
- Modal fechava após cada lote, dificultando contagem de múltiplos lotes

**Soluções Implementadas**:

**1. Backend - UPSERT + SUM** (`main.py`):
```python
# UPSERT: Se lote existe, atualiza; senão, insere
existing_counting = db.execute(query_exists).fetchone()
if existing_counting:
    db.execute(update_counting, {...})
else:
    db.execute(insert_counting, {...})

# SUM: Calcula total de todos os lotes
total_quantity = db.execute(sum_query).fetchone()
```

**2. Backend - Endpoint saved-lots corrigido** (`lot_draft.py`):
```python
# ANTES: Buscava da tabela counting_lots (vazia)
# DEPOIS: Busca diretamente da tabela countings
SELECT lot_number, quantity FROM inventario.countings
WHERE inventory_item_id = :item_id AND count_number = :cycle
```

**3. Frontend MOBILE - Modal Multi-Lote** (`counting_mobile.html`):
- Modal permanece aberto após adicionar lote
- Lista de "Lotes Contados" com total em tempo real
- Lotes já contados removidos do dropdown (evita duplicação)
- Clique no lote para editar (ícone de lápis)
- Fonte aumentada para melhor legibilidade

**4. Frontend DESKTOP - Lotes Individuais** (`counting_improved.html`):
```javascript
// ANTES: Criava registro único "MULTIPLOS_LOTES"
lot_number: lotsToSave.length > 1 ? 'MULTIPLOS_LOTES' : ...

// DEPOIS: Salva CADA lote individualmente
for (const lot of lotsToSave) {
    await fetch(endpoint, { body: { lot_number: lot.lot_number, ... } });
}
```

**Arquivos Modificados**:
- `backend/app/main.py` - UPSERT + SUM para lotes
- `backend/app/api/v1/endpoints/lot_draft.py` - Endpoint saved-lots corrigido
- `frontend/counting_mobile.html` - Modal multi-lote (+329 linhas)
- `frontend/counting_improved.html` - Salva lotes individualmente

**Commits**: `9143747`

---

## v2.19.16 (24/12/2025) - Sanitização de Mensagens de Erro

### SEGURANÇA: Mensagens de erro não expõem mais detalhes internos

**Problema**: Erros HTTP retornavam `str(e)` com detalhes internos (estrutura do banco, caminhos, queries SQL). 123 endpoints vulneráveis.

**Solução**: Função `safe_error_response()` em `core/exceptions.py`:
- Produção: mensagem genérica + ID para rastreamento
- Desenvolvimento: detalhes completos para debug

**Arquivos Atualizados**: main.py (57), assignments.py (20), users.py (6), stores.py (5), outros (35)

**Commits**: `b53033e`

---

## v2.19.15 (24/12/2025) - Correção de Paginação na Página de Produtos

**Problema**: Botão '>' na paginação não carregava próxima página.

**Soluções**:
1. Backend: Contagem otimizada com `COUNT(DISTINCT)` ao invés de `query.count()`
2. Frontend: Smart pagination mostrando páginas ao redor da atual

**Resultado**: 117.359 produtos navegáveis em 23.472 páginas

**Commits**: `4eccd27`

---

## v2.19.14 (24/12/2025) - Performance e Consolidação JS

### Otimizações:

**1. Queries N+1 Corrigidas**:
- `list_inventory_items()`: 51 → 2 queries (~25x mais rápido)
- `get_list_products()`: 101 → 2 queries (~50x mais rápido)

**2. Paginação Adicionada**: GET /users e GET /stores com page/size

**3. JavaScript Consolidado**:
- `auth.js` (10.3 KB): logout, checkAuthentication, getAuthHeaders
- `ui.js` (13.8 KB): showAlert, formatDate, formatCurrency
- `export.js` (12.4 KB): exportToCSV, exportToExcel, exportToJSON
- `utils.js` (11.8 KB): sanitizeInput, debounce, SecureStorage

**Commits**: `8cdc9c6`, `36a4c1c`, `644eaae`

---

## v2.19.13 (24/12/2025) - Correções de Segurança Críticas

### Fase 1 - SQL Injection:
- Queries com `text()` corrigidas com constantes `VALID_CYCLE_COLUMNS`
- Endpoints `/test/*` protegidos com `require_test_endpoints()`

### Fase 2 - Segurança Alta:
- Secrets em variáveis de ambiente (`.env.example` criado)
- CORS restringido (configurável via `CORS_ORIGINS`)
- Helper `safe_error_response()` para mensagens seguras

### Fase 3 - Performance:
- Queries N+1 corrigidas em inventory.py e users.py
- Sistema de cache Redis com decorator `@cache_response()`
- Schema `PaginationParams` reutilizável

### Fase 4 - Frontend:
- `utils.js` com `sanitizeHTML()`, `SecureStorage`, `TimerManager`

**Arquivos Criados**: exceptions.py, cache.py, common.py, utils.js, .env.example

---

## v2.19.12 (23/12/2025) - Otimização de Performance da Página de Produtos

**Problema**: Página travava com 3900+ opções nos dropdowns.

**Soluções**:
1. Índices SQL criados na SB1010 (b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen)
2. Endpoint `/products/filters` otimizado (busca direta em tabelas lookup)
3. Frontend `loadFilters()` otimizado (5 atribuições ao invés de ~3900)
4. Segmentos limitados aos 100 mais usados

**Resultado**: Opções de ~3900 → ~1580, sem travamento

**Commits**: `c51be2c`

---

## v2.19.10 (22/12/2025) - Lógica de Ciclos - Confirmação de Contagem

**Problema**: Sistema avançava para ciclo 3 mesmo quando `count_2 == count_1`.

**Lógica Correta**:
```
Ciclo 2 → Encerrar OU Ciclo 3?
1. count_2 == expected? → ENCERRA (bateu com sistema)
2. count_2 == count_1?  → ENCERRA (contagem CONFIRMADA)
3. count_2 != expected E count_2 != count_1? → CICLO 3 (desempate)
```

**Commits**: `b16dd2c`

---

## v2.19.8 (19/12/2025) - Melhorias UX e Performance

- Localização com destaque visual (fonte 14-15px, cor azul)
- Ordenação alfabética de produtos em modais
- Sessão JWT estendida para 8 horas
- Correção da ordem de carregamento no MOBILE

---

## v2.19.7 (17/12/2025) - Filtro de Ciclo no Mobile

**Problema**: MOBILE exibia TODOS os produtos nos ciclos 2 e 3.

**Solução**: Nova função `filterProductsByCycle()` aplicada em:
- loadProducts(), handleSearch(), clearSearch(), applyFilter()
- updateFilterCounts(), openCountingModal(), scanner

---

Ver também:
- [CHANGELOG_RECENTE_v2.15-v2.18.md](CHANGELOG_RECENTE_v2.15-v2.18.md) - Versões 2.15-2.18
- [docs/CHANGELOG_HISTORICO.md](docs/CHANGELOG_HISTORICO.md) - Versões anteriores
