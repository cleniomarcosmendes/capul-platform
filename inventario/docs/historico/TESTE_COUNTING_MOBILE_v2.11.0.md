# 🧪 Guia de Testes - Contagem Mobile v2.11.0

**Versão**: v2.11.0
**Data**: 19/10/2025
**Funcionalidade**: Sistema de contagem mobile com modo cego

---

## 📋 Pré-requisitos

### 1. Sistema Inicializado
```bash
# Verificar serviços Docker
docker-compose ps

# Todos devem estar "Up" e "healthy":
# - inventario_backend (porta 8000)
# - inventario_postgres (porta 5432)
# - inventario_redis (porta 6379)
# - inventario_pgadmin (porta 5050)
```

### 2. Dados de Teste
**Usuários disponíveis**:
- OPERATOR: `clenio` / `123456` (verá apenas modo Mobile)
- SUPERVISOR: `supervisor` / `123456` (verá ambos modos)
- ADMIN: `admin` / `admin123` (verá ambos modos)

**Inventários de teste**: Criar inventário com status `EM_CONTAGEM`

---

## 🎯 Roteiro de Testes

### TESTE 1: Modal de Seleção de Modo (RBAC)

#### 1.1. Login como OPERATOR
```
URL: http://localhost:8000/static/login.html
Credenciais: clenio / 123456
```

**Resultado esperado**:
- ✅ Redirecionamento automático para `counting_improved.html`
- ✅ Modal de seleção de lista exibido
- ✅ Ao selecionar lista → Modal de modo abre automaticamente
- ✅ **Apenas 1 card visível**: "Mobile" (card verde)
- ✅ Card "Desktop" está oculto (`display: none`)

#### 1.2. Login como SUPERVISOR
```
Credenciais: supervisor / 123456
```

**Resultado esperado**:
- ✅ Redirecionamento para `dashboard.html`
- ✅ Clicar em "Gerenciar Lista" → Modal de seleção
- ✅ Ao selecionar lista → Modal de modo abre
- ✅ **2 cards visíveis**: "Mobile" (verde) e "Desktop" (azul)

---

### TESTE 2: Modo Mobile - Contagem Cega

#### 2.1. Acesso à Página Mobile
**Fluxo**: Login OPERATOR → Selecionar lista → Clicar "Usar Mobile"

**URL esperada**:
```
http://localhost:8000/static/counting_mobile.html?inventory_id=XXX&list_id=YYY
```

**Verificações visuais**:
- ✅ Header mobile com nome do inventário
- ✅ Informações: Armazém e Ciclo atual
- ✅ Botão logout no canto superior direito
- ✅ Barra de busca com ícone de lupa
- ✅ Lista de produtos em cards (não tabela)
- ✅ Botões flutuantes: "Atualizar" e "Finalizar"

#### 2.2. Validação de Contagem Cega
**Objetivo**: Confirmar que NÃO mostra dados sensíveis

**Verificar que NÃO aparece**:
- ❌ Quantidade esperada (expected_quantity)
- ❌ Contagens de ciclos anteriores (count_cycle_1/2)
- ❌ Indicadores de divergência
- ❌ Cards financeiros ou valores de custo
- ❌ Badges de "Divergência" ou "OK"
- ❌ **Saldo de lotes** (no seletor de lotes)
- ❌ **Data de validade de lotes** (no seletor de lotes)

**Verificar que APARECE**:
- ✅ Código do produto (destaque)
- ✅ Descrição do produto
- ✅ Badge "Com Lote" (se b1_rastro='L')
- ✅ Badge "Contado" (verde, se já foi contado)
- ✅ Valor contado (canto superior direito, se já contado)

---

### TESTE 3: Busca de Produtos

#### 3.1. Busca por Código
**Ação**: Digitar código no campo de busca (ex: "00010")

**Resultado esperado**:
- ✅ Lista filtra em tempo real
- ✅ Ícone "X" aparece no campo de busca
- ✅ Clicar no "X" limpa a busca

#### 3.2. Busca por Descrição
**Ação**: Digitar parte da descrição (ex: "parafuso")

**Resultado esperado**:
- ✅ Lista filtra produtos que contenham o termo
- ✅ Busca case-insensitive

#### 3.3. Empty State
**Ação**: Buscar termo inexistente (ex: "XXXZZZ999")

**Resultado esperado**:
- ✅ Ícone de caixa vazia exibido
- ✅ Mensagem "Nenhum produto encontrado"

---

### TESTE 4: Modal de Contagem - Produto Sem Lote

#### 4.1. Abrir Modal
**Ação**: Clicar em qualquer produto SEM controle de lote

**Resultado esperado**:
- ✅ Modal abre com título "Registrar Contagem"
- ✅ Exibe código do produto
- ✅ Exibe descrição do produto
- ✅ Campo "Quantidade Contada" focado automaticamente
- ✅ Campo "Observações" visível (opcional)
- ✅ **Seletor de lote NÃO aparece** (`display: none`)

#### 4.2. Salvar Contagem
**Ação**: Digite quantidade (ex: 50) e clique "Salvar"

**Resultado esperado**:
- ✅ Modal fecha
- ✅ Loading "Salvando..." exibido
- ✅ Requisição POST para `/api/v1/counting-lists/{list_id}/save-count`
- ✅ Console log: `💾 [SAVE] Salvando contagem: XXXXX = 50`
- ✅ Toast de sucesso: "Salvo! Contagem registrada: 50,00"
- ✅ Card do produto atualizado:
  - Badge "Contado" verde aparece
  - Valor "50,00" no canto superior direito
  - Card fica com borda verde e fundo levemente verde

#### 4.3. Validação de Quantidade
**Ação**: Tentar salvar sem digitar quantidade

**Resultado esperado**:
- ✅ Modal permanece aberto
- ✅ SweetAlert de aviso: "Quantidade Inválida"

---

### TESTE 5: Modal de Contagem - Produto Com Lote

#### 5.1. Abrir Modal (Produto com Lote)
**Ação**: Clicar em produto COM controle de lote (badge "Com Lote")

**Resultado esperado**:
- ✅ Modal abre normalmente
- ✅ **Seletor de lote APARECE** (`display: block`)
- ✅ Select mostra "Carregando lotes..."
- ✅ Requisição GET para `/api/v1/cycles/product/{code}/lots?warehouse=XX`
- ✅ Console log: `🔍 [LOTES] Buscando lotes para produto: XXXXX`

#### 5.2. Lotes Carregados
**Resultado esperado**:
- ✅ Select preenchido com lotes disponíveis
- ✅ **Formato: `Lote: 000000000015659`** (SEM saldo, SEM validade - contagem cega!)
- ✅ Opção padrão: "Selecione um lote"
- ✅ Console log: `✅ [LOTES] X lotes carregados`
- ❌ **NÃO deve mostrar**: Saldo do lote, data de validade (evitar viés)

#### 5.3. Salvar SEM Selecionar Lote
**Ação**: Digite quantidade MAS não selecione lote

**Resultado esperado**:
- ✅ SweetAlert de aviso: "Lote Obrigatório"
- ✅ Modal permanece aberto

#### 5.4. Salvar COM Lote Selecionado
**Ação**: Selecionar lote + digitar quantidade + clicar "Salvar"

**Resultado esperado**:
- ✅ Console log: `💾 [SAVE] Salvando contagem: XXXXX = 50 (Lote: LOTE123)`
- ✅ Requisição POST inclui campo `lot_number`
- ✅ Salvamento bem-sucedido

---

### TESTE 6: Botões de Ação

#### 6.1. Botão Atualizar
**Ação**: Clicar no botão azul "Atualizar"

**Resultado esperado**:
- ✅ Loading overlay exibido
- ✅ Requisição GET para `/api/v1/counting-lists/{list_id}/products`
- ✅ Lista de produtos recarregada
- ✅ Loading desaparece

#### 6.2. Botão Finalizar
**Ação**: Clicar no botão verde "Finalizar"

**Resultado esperado**:
- ✅ SweetAlert de confirmação: "Finalizar Contagem?"
- ✅ Opções: "Sim, Finalizar" e "Cancelar"
- ✅ Ao confirmar: (TODO: implementar lógica real)

#### 6.3. Botão Logout
**Ação**: Clicar no ícone de logout (canto superior direito)

**Resultado esperado**:
- ✅ SweetAlert de confirmação: "Sair do Sistema?"
- ✅ Ao confirmar:
  - localStorage limpo
  - sessionStorage limpo
  - Redirecionamento para `/static/login.html`

---

### TESTE 7: Modo Desktop (Comparação)

#### 7.1. Acesso ao Modo Desktop
**Fluxo**: Login SUPERVISOR → Selecionar lista → Clicar "Usar Desktop"

**URL esperada**:
```
http://localhost:8000/static/counting_improved.html?inventory_id=XXX&list_id=YYY
```

**Verificações**:
- ✅ Interface tradicional (tabela de produtos)
- ✅ **Mostra quantidade esperada** (coluna visível)
- ✅ **Mostra contagens anteriores** (ciclos 1, 2)
- ✅ **Mostra indicadores de divergência** (badges coloridos)
- ✅ Funcionalidade completa mantida

---

## 🔍 Testes de Console (DevTools F12)

### 1. Console Logs Esperados

**Ao carregar página mobile**:
```
📱 [MOBILE] Página de contagem mobile carregada
✅ [MOBILE] Inventário carregado: Nome_Inventário, Ciclo 1, Armazém 02
📦 [MOBILE] Carregando produtos...
✅ [MOBILE] X produtos carregados
```

**Ao abrir modal de produto com lote**:
```
📋 [MODAL] Abrindo modal para produto: 00010037
🔍 [LOTES] Buscando lotes para produto: 00010037
✅ [LOTES] 5 lotes carregados
```

**Ao salvar contagem**:
```
💾 [SAVE] Salvando contagem: 00010037 = 99.50 (Lote: LOTE123)
✅ [SAVE] Contagem salva com sucesso: {...}
```

### 2. Network Tab (XHR/Fetch)

**Requisições esperadas**:
1. `GET /api/v1/counting-lists/{list_id}` → 200 OK
2. `GET /api/v1/counting-lists/{list_id}/products` → 200 OK
3. `GET /api/v1/cycles/product/{code}/lots?warehouse=02` → 200 OK (se produto tem lote)
4. `POST /api/v1/counting-lists/{list_id}/save-count` → 200 OK

**Verificar headers**:
- ✅ `Authorization: Bearer {token}` em todas as requisições
- ✅ `Content-Type: application/json` nos POSTs

---

## 🐛 Problemas Conhecidos e Soluções

### Problema 1: Modal de modo não abre
**Causa**: JavaScript não encontrou elementos do modal
**Solução**: Verificar se modal foi adicionado em `counting_improved.html` linha ~1148

### Problema 2: Página mobile mostra 404
**Causa**: Arquivo `counting_mobile.html` não existe em `/frontend/`
**Solução**: Confirmar que arquivo foi criado corretamente

### Problema 3: Lotes não carregam
**Causa**: Endpoint de lotes retorna erro 404
**Solução**: Verificar se backend está atualizado com endpoint `/api/v1/cycles/product/{code}/lots`

### Problema 4: Salvamento retorna 403 (Não autorizado)
**Causa**: Usuário não está atribuído à lista no ciclo correto
**Solução**: Verificar atribuição na tabela `counting_lists.counter_cycle_X`

---

## ✅ Checklist de Validação Final

### Interface Mobile
- [ ] Header mobile exibido corretamente
- [ ] Barra de busca funciona (filtro em tempo real)
- [ ] Cards de produtos exibem código e descrição
- [ ] Badge "Com Lote" aparece quando b1_rastro='L'
- [ ] Badge "Contado" aparece após salvar
- [ ] Valor contado exibido no canto superior direito
- [ ] Botões flutuantes fixados no rodapé

### Modal de Contagem
- [ ] Modal abre ao clicar no produto
- [ ] Seletor de lote aparece/oculta conforme b1_rastro
- [ ] Lotes carregam corretamente da API
- [ ] Validação de lote obrigatório funciona
- [ ] Validação de quantidade funciona
- [ ] Salvamento via API funciona
- [ ] Toast de sucesso exibido

### RBAC e Segurança
- [ ] OPERATOR vê apenas card "Mobile"
- [ ] SUPERVISOR/ADMIN veem ambos cards
- [ ] Modo mobile NÃO mostra quantidade esperada
- [ ] Modo mobile NÃO mostra contagens anteriores
- [ ] Modo mobile NÃO mostra divergências

### Fluxo Completo
- [ ] Login → Modal seleção → Modal modo → Página mobile
- [ ] Buscar produto → Abrir modal → Selecionar lote → Salvar
- [ ] Atualizar lista funciona
- [ ] Logout limpa sessão e redireciona

---

## 📊 Métricas de Performance

### Carregamento Inicial
- Página mobile: < 2 segundos
- Lista de produtos (100 itens): < 1 segundo
- Lotes de produto: < 500ms

### Responsividade
- Filtro de busca: tempo real (< 100ms)
- Abertura de modal: instantâneo
- Salvamento de contagem: < 1 segundo

### Tamanho dos Arquivos
- `counting_mobile.html`: ~30KB (com CSS/JS embutido)
- `counting_improved.html`: ~180KB (página original)

---

## 🎉 Resultado Esperado

✅ **Sistema funcionando 100%**:
- Modo Mobile operacional para OPERATOR
- Modo Desktop preservado para SUPERVISOR/ADMIN
- Contagem cega implementada (sem viés)
- Integração completa com backend existente
- UX mobile-optimized e touch-friendly
- Sistema de lotes totalmente funcional

---

**Versão do Sistema**: v2.11.0
**Data de Criação**: 19/10/2025
**Próximas Features**: Modal multi-lote, scanner de código de barras
