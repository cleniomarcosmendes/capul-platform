# Changelog Recente - Versões 2.15 até 2.18.1

**Sistema de Inventário Protheus** - Histórico detalhado das versões 2.15.0 até 2.18.1

---

## 🚀 Últimas Atualizações

### v2.18.1 (04/11/2025) - 🐛 Correções Críticas - Sistema de Transferência Lógica ⭐⭐⭐⭐⭐

#### **6 BUGS CRÍTICOS CORRIGIDOS**

**Problema Identificado pelo Usuário**:
Após testes da v2.18.0, usuário identificou 6 bugs críticos impedindo uso correto do sistema:
1. ❌ Erro de sintaxe JavaScript impedindo carregamento da página
2. ❌ Coluna "Dif. Final" mostrando -11 ao invés de 0 (falsy bug)
3. ❌ Economia calculada com R$ 850 fixo ao invés de custo real (B2_CM1)
4. ❌ Backend não retornando campos b2_cm1_a/b para frontend
5. ❌ Descrição desatualizada mencionando R$ 850
6. ❌ **CRÍTICO**: Produtos com lote não calculando economia (50% dos produtos)

**Correção #1: JavaScript Syntax Error** 🔥 BLOQUEADOR:
```
Uncaught SyntaxError: Unexpected token 'else' (at comparison_results.html:907:15)
```
- **Causa**: Bloco duplicado de código (versão antiga + nova) criando dois `else` consecutivos
- **Solução**: Removido bloco antigo (linhas 837-906), mantida apenas v2.18.0

**Correção #2: Coluna "Dif. Final" com Valores Incorretos** 🐛:
```javascript
// ❌ ERRADO (JavaScript trata 0 como falsy)
const difFinalA = m.diferenca_final_a || (m.counted_a - m.expected_a);

// ✅ CORRETO
const difFinalA = m.diferenca_final_a !== undefined
    ? m.diferenca_final_a
    : (m.counted_a - m.expected_a);
```
- **Problema**: Produtos com divergência zerada (0) exibiam valor original (-11)
- **Solução**: Mudança de `||` para `!== undefined` (2 locais: display + CSV)

**Correção #3: Economia com Custo Real (B2_CM1)** 💰 CRÍTICO:
```python
# ❌ ANTES (v2.18.0)
economia_estimada = nfs_evitadas × 850.0

# ✅ DEPOIS (v2.18.1)
custo_medio = produto_a.get('b2_cm1', 0)
economia_estimada = custo_medio × quantidade_transferida
```
- **Feedback do Usuário**: "vc devera pegar valor do custo medio (SB2010 B2_CM1) é multiplicar pela transferencia"
- **Solução**: 7 mudanças no backend:
  1. Adicionar B2_CM1 à query SQL (linha 343)
  2. Atualizar `calcular_transferencia_logica()` (linhas 169-188)
  3. Adicionar b2_cm1_a/b aos dicts products_data (3 locais)
  4. Atribuir b2_cm1 para produtos sem lote (2 locais)
  5. Adicionar b2_cm1_a/b às respostas da API (2 locais)
  6. Passar b2_cm1 para função de cálculo (4 locais)

**Correção #4: Backend Não Retornando b2_cm1** 🐛:
- **Problema**: Backend calculava corretamente (logs OK), mas frontend não recebia dados
- **Causa**: Campos adicionados aos dicts internos mas não incluídos na API response
- **Solução**: Adicionados `b2_cm1_a` e `b2_cm1_b` aos dicts de resposta (2 endpoints)

**Correção #5: Descrição Desatualizada** 📝:
```html
<!-- ❌ ANTES -->
<small>Baseado em R$ 850,00 por NF de ajuste evitada</small>

<!-- ✅ DEPOIS -->
<small>Valor dos produtos que evitarão emissão de NF de ajuste
(Custo Médio × Quantidade Transferida)</small>
```
- **Feedback do Usuário**: "essa informaçao [...] nao deve ser apresentada, pois nao foi feita em cima de valores do inventario real. estou certo?" ✅ CORRETO

**Correção #6: Produtos com Lote Sem Economia** 🔥 CRÍTICO:
- **Padrão Identificado**:
  - ✅ Produtos **SEM lote** (badge "N"): Economia exibida (ex: 00003255 = R$ 190,74)
  - ❌ Produtos **COM lote** (badge "L"): Economia "-" (ex: 00011377, 00826037)
- **Causa Raiz**: Produtos com lote individual criavam entrada no dict com `b2_cm1_a`/`b2_cm1_b`, mas **nunca atribuíam valores**
```python
# ✅ CORREÇÃO (linhas 512-524)
b2_cm1 = float(item.b2_cm1 or 0)

if is_inv_a:
    products_data[key]['expected_a'] = expected_qty_lot
    products_data[key]['counted_a'] = counted_qty_lot
    products_data[key]['b2_cm1_a'] = b2_cm1  # ← LINHA ADICIONADA
```

**Validação nos Logs**:
```
💰 Custo Médio: A=17.34, B=17.34, Usado=17.34
💰 Economia Estimada: 17.34 × 11.00 = R$ 190.74 ✅

💰 Custo Médio: A=11.08, B=11.08, Usado=11.08
💰 Economia Estimada: 11.08 × 8.00 = R$ 88.66 ✅

💰 Custo Médio: A=54.13, B=54.13, Usado=54.13
💰 Economia Estimada: 54.13 × 8.00 = R$ 433.04 ✅
```

**Impacto das Correções**:
| Bug | Gravidade | Antes | Depois |
|-----|-----------|-------|--------|
| #1 - Syntax Error | **BLOQUEADOR** | Página não carrega | ✅ Carrega perfeitamente |
| #2 - Dif. Final | Alto | Mostra -11 | ✅ Mostra 0 (verde) |
| #3 - Economia Fixa | **CRÍTICO** | R$ 850 (fixo) | ✅ B2_CM1 × Qtd (real) |
| #4 - API sem b2_cm1 | Alto | Frontend sem dados | ✅ b2_cm1_a/b retornados |
| #5 - Descrição | Médio | Menciona R$ 850 | ✅ Explica cálculo real |
| #6 - Lotes sem B2_CM1 | **CRÍTICO** | 50% sem economia | ✅ 100% com economia |

**Benefícios**:
- 🛡️ **Sistema 100% funcional**: Todos os bugs bloqueadores corrigidos
- 💰 **Economia precisa**: Cálculo com custo real (B2_CM1) ao invés de R$ 850 fixo
- ✅ **Informação correta**: "Dif. Final" = 0 quando divergência zerada
- 📊 **Cobertura total**: Produtos com/sem lote calculam economia corretamente
- 🎯 **Precisão financeira**: Decisões baseadas em valores reais dos produtos

**Arquivos Modificados**:
- `backend/app/api/v1/endpoints/inventory_comparison.py` (7 mudanças em múltiplas linhas)
- `frontend/comparison_results.html` (4 correções: syntax, dif. final, descrição, CSV)

**Commits**:
```bash
869d421 - fix(syntax): remover bloco duplicado de tabela Análise Manual v2.18.0
c2409e4 - fix(critical): corrigir cálculo de 'Dif. Final' + economia com custo médio v2.18.1
50f6dd1 - fix: adicionar campos b2_cm1_a e b2_cm1_b na resposta da API + logs debug
0e5e353 - fix: atualizar descrição de economia para refletir cálculo real v2.18.1
d41f603 - fix(critical): adicionar b2_cm1 para produtos com lote detalhado v2.18.1
```

**Documentação**: [CORRECOES_CRITICAS_v2.18.1.md](CORRECOES_CRITICAS_v2.18.1.md)

**Validação Final**:
- ✅ Página carrega sem erros de sintaxe
- ✅ Coluna "Dif. Final" mostra 0 (verde) para divergências zeradas
- ✅ Economia calculada com B2_CM1 real (ex: R$ 190,74, R$ 88,66)
- ✅ Produtos COM lote exibem economia corretamente
- ✅ Produtos SEM lote continuam exibindo economia
- ✅ **Testado e aprovado pelo usuário** ("deu certo!")

**Tempo de Implementação**: ~2 horas (6 correções sequenciais)

---

### v2.18.1 (04/11/2025) - 📊 Relatórios Individuais A e B ⭐⭐⭐⭐

#### **IMPLEMENTAÇÃO DE RELATÓRIOS COM IMPACTO DE TRANSFERÊNCIA**

**Problema Identificado pelo Usuário**:
- ❌ Cards "Ver Relatório" (azul/vermelho) abriam página ERRADA (`reports.html`)
- ❌ Relatórios individuais não mostravam **impacto das transferências**
- ❌ Estrutura diferente da tela "Análise Manual" (inconsistência)
- ❌ Usuário perdeu contexto da comparação ao visualizar relatório individual

**Solução Implementada** (3 fases):

**FASE 1: Correção de Navegação** ✅:
- **Antes**: Redirecionava para `reports.html` (relatório padrão do inventário)
- **Depois**: Redireciona para `inventory_transfer_report.html` (página dedicada)
- **Função corrigida**: `openInventoryReportPage()` em `inventory.html`
- **Parâmetros passados**:
  - `inventory_id`: ID do inventário selecionado (A ou B)
  - `inventory_a_id`: ID do Inventário A (contexto da comparação)
  - `inventory_b_id`: ID do Inventário B (contexto da comparação)

**FASE 2: Estrutura de 11 Colunas** ✅:
- **Mesma estrutura** da tela "Análise Manual"
- **Colunas**:
  1. Código
  2. Descrição
  3. Lote (badge L/N/S)
  4. N.° Lote
  5. **Saldo+Ent.P.** (qty esperada)
  6. **Contado** (qty contada)
  7. **Diverg.** (divergência original)
  8. **Transf.** (transferência lógica - positivo se recebe, negativo se doa)
  9. **Estoque Ajust.** (saldo após ajuste)
  10. **Dif. Final** (divergência após transferência)
  11. **Economia (R$)** (valor economizado com B2_CM1)

**FASE 3: Uso de Dados do Backend** ✅:
- **Antes**: Calculava manualmente no frontend (inconsistente)
- **Depois**: Usa campos do backend (mesma lógica da Análise Manual)
- **Campos utilizados**:
  - `transferencia_logica` (objeto completo do backend)
  - `saldo_ajustado_a` / `saldo_ajustado_b`
  - `diferenca_final_a` / `diferenca_final_b`
  - `b2_cm1_a` / `b2_cm1_b` (custo médio)

**Color-Coding (Consistente)**:
- 🟢 **Verde** (`bg-success`): Divergência zerada (Dif. Final = 0)
- 🟡 **Amarelo** (`bg-warning`): Divergência reduzida
- 🔵 **Azul** (`bg-primary`): Transferências lógicas (positivo ou negativo)
- ⚪ **Branco**: Sem mudança

**Lógica de Transferência por Armazém**:
```javascript
// Determinar direção da transferência
const warehouseInventory = inventoryInfo.warehouse;
const transfQty = transf.quantidade_transferida || 0;

if (transf.origem === warehouseInventory) {
    transferAmount = -transfQty;  // Doando para outro armazém (negativo)
} else if (transf.destino === warehouseInventory) {
    transferAmount = transfQty;   // Recebendo de outro armazém (positivo)
}
```

**Exemplo Real** (Produto 00010037 - ARM.06):
```
Saldo+Ent.P.: 79 | Contado: 6 | Diverg.: +73 (SOBRA)
Transf.: -73 (doa 73 unidades para ARM.02)
Estoque Ajust.: 6 (79 - 73 = 6)
Dif. Final: 0 (6 - 6 = 0) → 🟢 Verde (zerou!)
Economia: R$ 54,13 × 73 = R$ 3.951,49
```

**Benefícios**:
- 🎯 **Navegação correta**: Cards levam para página certa
- 📊 **Consistência visual**: Mesma estrutura em 3 páginas (Análise Manual, Transferências, Relatórios A/B)
- 🔄 **Dados do backend**: Sem cálculos manuais no frontend (eliminação de bugs)
- 💰 **Economia visível**: Usuário vê impacto financeiro por inventário
- ✅ **Contexto preservado**: Relatório individual mantém contexto da comparação

**Arquivos Modificados**:
- `frontend/inventory.html` (linhas 24111-24154 - função `openInventoryReportPage()`)
- `frontend/inventory_transfer_report.html` (reestruturação completa):
  - Linhas 270-285: Header com 11 colunas
  - Linhas 330-338: Recepção de parâmetros padronizados
  - Linhas 509-555: Uso de dados do backend (transferencia_logica)
  - Linhas 567-615: Renderização com color-coding

**Commits**:
```bash
f138db7 - fix: corrigir redirecionamento dos relatórios individuais para inventory_transfer_report.html v2.18.1
4eb32fb - feat: reestruturar inventory_transfer_report.html com 11 colunas v2.18.1
b1e98a6 - feat: adicionar color-coding e usar dados do backend v2.18.1
ba3dbfe - refactor: remover código temporário de debug v2.18.1
```

**Documentação**: [IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md](IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md)

**Validação**:
- ✅ Cards azul/vermelho redirecionam para página correta
- ✅ Tabela com 11 colunas (consistente com Análise Manual)
- ✅ Transferências com sinal correto (+ recebe, - doa)
- ✅ Color-coding funcional (verde, amarelo, azul)
- ✅ Economia calculada com custo real (B2_CM1)
- ✅ **Testado e aprovado pelo usuário** ("deu certo!")

**Tempo de Implementação**: ~1 hora (3 fases)

---

_[O resto do conteúdo do histórico v2.15-v2.18 continua no arquivo original...]_

**📝 Nota**: Este arquivo contém o histórico detalhado das versões 2.15 até 2.18.1. Para histórico de versões anteriores (v2.9 e anteriores), consulte [docs/CHANGELOG_HISTORICO.md](docs/CHANGELOG_HISTORICO.md).
