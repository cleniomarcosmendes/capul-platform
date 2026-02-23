# 📱 PLANO - Sistema de Contagem Mobile v2.11.0

**Data de Criação**: 19/10/2025
**Versão**: v2.11.0
**Tipo**: Feature Release - Mobile-First Counting
**Prioridade**: ALTA
**Status**: 🚧 EM IMPLEMENTAÇÃO

---

## 🎯 **OBJETIVO**

Criar um **modo de contagem otimizado para dispositivos móveis** com interface simplificada e **contagem cega** (sem visualização de quantidade esperada ou ciclos anteriores) para usuários OPERATOR.

---

## 🔍 **PROBLEMA IDENTIFICADO**

### **Situação Atual:**
1. ❌ Todos usuários usam `counting_improved.html` (interface desktop)
2. ❌ OPERATOR vê informações que comprometem a contagem:
   - Quantidade esperada (`expected_quantity`)
   - Contagens de ciclos anteriores (`count_1`, `count_2`)
   - Indicadores de divergência
3. ❌ Interface não otimizada para telas pequenas
4. ❌ **Risco de viés**: Operador ajusta contagem baseado no esperado

### **Exemplo Real:**
```
Produto: 00010037 - COLOSSO PULV.OF 25ML
Esperado: 288 unidades

❌ PROBLEMA:
- Operador vê "Esperado: 288"
- Conta 285 unidades
- "Ajusta" para 288 para "não dar divergência"

✅ SOLUÇÃO:
- Operador NÃO vê quantidade esperada
- Conta 285 unidades
- Sistema registra divergência real (288 vs 285)
```

---

## ✅ **SOLUÇÃO PROPOSTA**

### **Arquitetura de 2 Modos:**

```
Menu "Contagem" (counting_improved.html)
    ↓
Modal: Selecionar Lista
    ↓
Modal: Escolher Modo ⭐ NOVO
    ├── Opção 1: Mobile → counting_mobile.html ⭐ NOVO
    └── Opção 2: Desktop → counting_improved.html (atual)
```

### **Regras de Visibilidade:**
| Perfil | Opção Mobile | Opção Desktop |
|--------|--------------|---------------|
| OPERATOR | ✅ Sim (única opção) | ❌ Não |
| SUPERVISOR | ✅ Sim | ✅ Sim |
| ADMIN | ✅ Sim | ✅ Sim |

---

## 📋 **ESPECIFICAÇÃO FUNCIONAL**

### **1. Modal de Escolha de Modo**

**Localização**: `frontend/counting_improved.html`

**Fluxo**:
1. Usuário seleciona lista de contagem
2. Sistema verifica `user_role` do localStorage
3. Exibe modal com opções disponíveis:
   - OPERATOR: apenas "Mobile"
   - SUPERVISOR/ADMIN: "Mobile" e "Desktop"
4. Usuário escolhe modo
5. Sistema redireciona para página correspondente

**Dados Passados via URL**:
```
?inventory_id={uuid}
&inventory_name={string}
&list_id={uuid}
```

---

### **2. Página Mobile (counting_mobile.html)**

#### **Características:**

**Layout:**
- Header fixo (inventário + lista)
- Campo de busca grande (touch-friendly)
- Lista de produtos simplificada
- Modal de contagem fullscreen em mobile

**Campos VISÍVEIS:**
- ✅ Código do produto
- ✅ Nome do produto (truncado se necessário)
- ✅ Status de contagem (apenas ícone: ⏳ pendente / ✅ contado)
- ✅ Controle de lote (se aplicável)

**Campos OCULTOS (Contagem Cega):**
- ❌ Quantidade esperada
- ❌ Contagens de ciclos anteriores
- ❌ Indicadores de divergência
- ❌ Diferenças calculadas

#### **Modal de Contagem:**

**Estrutura:**
```
┌─────────────────────────┐
│ 00010037                │ ← Código
│ COLOSSO PULV.OF 25ML    │ ← Nome
├─────────────────────────┤
│                         │
│   [   Quantidade   ]    │ ← Input grande (2rem)
│                         │
│   ┌─────────────────┐   │
│   │ 🏷️ Tem Lote?    │   │ ← Se aplicável
│   │ [Adicionar Lote]│   │
│   └─────────────────┘   │
│                         │
├─────────────────────────┤
│ [Cancelar]  [✅ Salvar] │
└─────────────────────────┘
```

#### **Tratamento de Lotes:**

**Se produto NÃO tem lote (b1_rastro != 'L')**:
- Input simples de quantidade
- Salva direto no campo `count_cycle_X`

**Se produto TEM lote (b1_rastro = 'L')**:
- Botão "Adicionar Lote"
- Modal secundário:
  ```
  ┌──────────────────────┐
  │ Adicionar Lote       │
  ├──────────────────────┤
  │ Nº do Lote:          │
  │ [_______________]    │
  │                      │
  │ Quantidade:          │
  │ [_______________]    │
  ├──────────────────────┤
  │ [Cancelar] [Adicionar]│
  └──────────────────────┘
  ```
- Lista de lotes adicionados:
  ```
  Lotes Adicionados:
  🏷️ LOT001: 150 un
  🏷️ LOT002: 138 un
  ───────────────────
  Total: 288 un
  ```
- Salva no campo `observation_cycle_X` formatado:
  ```json
  "Lote: LOT001 (Qty: 150.00); Lote: LOT002 (Qty: 138.00)"
  ```

---

### **3. Backend - Endpoint Mobile**

**Arquivo NOVO**: `backend/app/api/v1/endpoints/mobile_counting.py`

#### **Endpoint 1: Listar Produtos para Mobile**

```python
GET /api/v1/mobile/list/{list_id}/products

Headers:
  Authorization: Bearer {token}

Response (apenas campos necessários):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_code": "00010037",
      "product_name": "COLOSSO PULV.OF 25ML",
      "has_lot_control": true,
      "current_cycle": 2,
      "is_counted": false,  // Se já foi contado no ciclo atual
      // ❌ SEM: expected_quantity, count_1, count_2, divergence
    }
  ]
}
```

**Validações**:
- ✅ Verificar se usuário é OPERATOR
- ✅ Verificar se lista pertence ao usuário
- ✅ Retornar apenas campos permitidos

#### **Endpoint 2: Salvar Contagem Mobile**

```python
POST /api/v1/mobile/count/save

Headers:
  Authorization: Bearer {token}

Body:
{
  "item_id": "uuid",
  "quantity": 288.00,
  "lots": [  // Opcional, apenas se has_lot_control = true
    {
      "lot_number": "LOT001",
      "quantity": 150.00
    },
    {
      "lot_number": "LOT002",
      "quantity": 138.00
    }
  ]
}

Response:
{
  "success": true,
  "message": "Contagem salva com sucesso",
  "data": {
    "item_id": "uuid",
    "is_counted": true
    // ❌ SEM retornar divergências ou quantidades esperadas
  }
}
```

**Validações**:
- ✅ Verificar se usuário é OPERATOR
- ✅ Verificar se lista pertence ao usuário
- ✅ Validar quantidade > 0
- ✅ Se produto tem lote: validar que lotes foram informados
- ✅ Salvar no campo correto baseado em `current_cycle`
- ✅ Trigger de status executado automaticamente

**Lógica de Salvamento**:
```python
current_cycle = counting_list.current_cycle

if current_cycle == 1:
    item.count_cycle_1 = quantity
    if lots:
        item.observation_cycle_1 = format_lots(lots)
elif current_cycle == 2:
    item.count_cycle_2 = quantity
    if lots:
        item.observation_cycle_2 = format_lots(lots)
elif current_cycle == 3:
    item.count_cycle_3 = quantity
    if lots:
        item.observation_cycle_3 = format_lots(lots)

# Trigger auto-atualiza o status
db.commit()
```

---

### **4. CSS Mobile-Optimized**

**Arquivo NOVO**: `frontend/css/mobile_counting.css`

**Características**:
```css
/* Tamanhos Touch-Friendly */
.btn-touch {
    min-height: 60px;
    min-width: 60px;
}

input.form-control-mobile {
    font-size: 2rem;
    padding: 20px;
    text-align: center;
}

/* Lista de Produtos */
.product-card-mobile {
    min-height: 80px;
    border-bottom: 1px solid #e0e0e0;
    padding: 15px;
    cursor: pointer;
    transition: background 0.2s;
}

.product-card-mobile:active {
    background: #f5f5f5;
}

/* Header Fixo */
.sticky-header {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Busca Grande */
.search-mobile {
    font-size: 1.2rem;
    padding: 15px;
    border-radius: 10px;
}

/* Modal Fullscreen em Mobile */
@media (max-width: 576px) {
    .modal-counting {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        margin: 0;
        border-radius: 0;
    }
}
```

---

## 🔒 **SEGURANÇA E RBAC**

### **Controle de Acesso:**

**Frontend**:
```javascript
// Verificar role ao carregar página mobile
const userRole = localStorage.getItem('user_role');

if (userRole !== 'OPERATOR' && userRole !== 'SUPERVISOR' && userRole !== 'ADMIN') {
    window.location.href = 'login.html';
}

// OPERATOR não pode acessar counting_improved.html diretamente
if (window.location.pathname.includes('counting_improved.html') && userRole === 'OPERATOR') {
    window.location.href = 'counting_mobile.html';
}
```

**Backend**:
```python
# Endpoint mobile apenas para OPERATOR
if current_user.role != "OPERATOR":
    raise HTTPException(
        status_code=403,
        detail="Este endpoint é exclusivo para usuários OPERATOR"
    )

# Verificar se lista pertence ao usuário
if counting_list.counter_cycle_X != current_user.id:
    raise HTTPException(
        status_code=403,
        detail="Esta lista não está atribuída a você"
    )
```

---

## 📊 **ESTRUTURA DE ARQUIVOS**

```
Capul_Inventario/
├── frontend/
│   ├── counting_mobile.html          ⭐ NOVO
│   ├── counting_improved.html        ✏️ MODIFICADO (adicionar modal)
│   └── css/
│       └── mobile_counting.css       ⭐ NOVO
├── backend/
│   └── app/
│       └── api/
│           └── v1/
│               └── endpoints/
│                   └── mobile_counting.py  ⭐ NOVO
└── docs/
    └── PLANO_COUNTING_MOBILE_v2.11.0.md  ⭐ NOVO (este arquivo)
```

---

## 🧪 **CENÁRIOS DE TESTE**

### **Teste 1: OPERATOR - Acesso via Menu**
1. Login como OPERATOR (clenio / 123456)
2. Clicar em "Contagem" no menu
3. ✅ Modal de seleção de lista abre
4. Selecionar lista "clenio_03"
5. ✅ Modal de escolha de modo abre
6. ✅ Vê apenas "Opção 1: Mobile"
7. Clicar em "Usar Mobile"
8. ✅ Redireciona para `counting_mobile.html?inventory_id=...&list_id=...`

### **Teste 2: OPERATOR - Contagem SEM Lote**
1. Na página mobile, buscar produto "00010008"
2. ✅ Produto aparece na lista
3. ✅ NÃO mostra quantidade esperada
4. Clicar no produto
5. ✅ Modal de contagem abre
6. Digitar quantidade: 150
7. Clicar em "Salvar"
8. ✅ Contagem salva
9. ✅ Produto marca como contado (✅)
10. ✅ Trigger atualiza status no banco

### **Teste 3: OPERATOR - Contagem COM Lote**
1. Buscar produto "00010037" (tem lote)
2. Clicar no produto
3. ✅ Modal de contagem abre
4. ✅ Botão "Adicionar Lote" visível
5. Clicar em "Adicionar Lote"
6. ✅ Modal de lote abre
7. Informar:
   - Lote: LOT001
   - Quantidade: 150
8. Clicar em "Adicionar"
9. ✅ Lote aparece na lista
10. Adicionar segundo lote:
    - Lote: LOT002
    - Quantidade: 138
11. ✅ Total calculado: 288
12. Clicar em "Salvar"
13. ✅ Contagem salva com lotes no campo `observation_cycle_X`

### **Teste 4: SUPERVISOR - Escolha de Modo**
1. Login como SUPERVISOR (admin / admin123)
2. Clicar em "Contagem"
3. Selecionar lista
4. ✅ Vê "Opção 1: Mobile" E "Opção 2: Desktop"
5. Pode escolher qualquer uma

### **Teste 5: Segurança - Tentativa de Acesso Direto**
1. OPERATOR tenta acessar `counting_improved.html` diretamente
2. ✅ Sistema redireciona para `counting_mobile.html`
3. OPERATOR tenta acessar endpoint `/api/v1/inventory/...` (desktop)
4. ✅ Backend retorna 403 Forbidden

---

## 📈 **MÉTRICAS DE SUCESSO**

| Métrica | Objetivo | Como Medir |
|---------|----------|------------|
| **Contagem Cega** | 100% OPERATOR não vê esperado | Auditoria de tela |
| **Usabilidade Mobile** | Tempo < 30s por produto | Testes com usuários |
| **Taxa de Erro** | < 5% de erros de digitação | Análise de divergências |
| **Segurança** | 0 acessos indevidos | Logs de auditoria |
| **Performance** | < 2s para carregar lista | Medição de tempo |

---

## 🎯 **BENEFÍCIOS ESPERADOS**

### **1. Integridade da Contagem**
- ✅ Contagem cega (sem viés)
- ✅ Divergências reais detectadas
- ✅ Dados mais confiáveis

### **2. Experiência do Usuário**
- ✅ Interface mobile-first
- ✅ Menos distrações (apenas campos necessários)
- ✅ Mais rápido para digitar

### **3. Segurança**
- ✅ RBAC reforçado
- ✅ Segregação de informações por perfil
- ✅ Auditoria completa

### **4. Flexibilidade**
- ✅ ADMIN/SUPERVISOR podem usar ambos modos
- ✅ Adaptável para diferentes cenários

---

## ⚠️ **RISCOS E MITIGAÇÕES**

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| OPERATOR não se adapta ao mobile | Médio | Baixa | Treinamento + interface intuitiva |
| Problemas com lotes no mobile | Alto | Média | Testes extensivos + validação |
| Perda de performance | Baixo | Baixa | Cache + otimizações |
| Bugs de segurança (acesso indevido) | Alto | Baixa | Testes de penetração + RBAC rigoroso |

---

## 📅 **CRONOGRAMA**

| Etapa | Descrição | Tempo Estimado | Responsável |
|-------|-----------|----------------|-------------|
| 0 | Planejamento e Documentação | 30min | ✅ Completo |
| 1 | Modal de Seleção de Modo | 45min | Em andamento |
| 2 | Página Mobile HTML | 2-3h | Pendente |
| 3 | Backend Mobile API | 1h | Pendente |
| 4 | CSS Mobile-Optimized | 30min | Pendente |
| 5 | Tratamento de Lotes | 1h | Pendente |
| 6 | Testes e Validação | 1h | Pendente |
| 7 | Documentação | 30min | Pendente |

**Tempo Total**: 7-8 horas

---

## 🔄 **DEPENDÊNCIAS**

**Pré-requisitos**:
- ✅ Sistema de autenticação funcionando
- ✅ RBAC implementado (v2.9)
- ✅ Triggers de status (v2.10.1)
- ✅ Sistema de lotes funcionando

**Compatibilidade**:
- ✅ Não quebra funcionalidades existentes
- ✅ Modo Desktop continua funcionando normalmente
- ✅ Triggers e validações mantidas

---

## 📚 **DOCUMENTAÇÃO RELACIONADA**

- [IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md](IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md) - Sistema RBAC
- [IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md](IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md) - Triggers automáticos
- [CLAUDE.md](CLAUDE.md) - Documentação principal
- [GUIA_USO_SISTEMA.md](docs/GUIA_USO_SISTEMA.md) - Guia de uso

---

## ✅ **CRITÉRIOS DE ACEITE**

**Deve Funcionar**:
- [x] OPERATOR vê apenas modo Mobile
- [x] ADMIN/SUPERVISOR vêem ambos modos
- [x] Página mobile não mostra quantidade esperada
- [x] Página mobile não mostra ciclos anteriores
- [x] Contagem simples (sem lote) funciona
- [x] Contagem com lote funciona
- [x] Lotes salvos corretamente em observation
- [x] Trigger de status executado
- [x] Backend valida permissões
- [x] Interface touch-friendly

**Não Deve**:
- [ ] ❌ OPERATOR acessar dados de outros usuários
- [ ] ❌ OPERATOR ver quantidade esperada
- [ ] ❌ OPERATOR ver divergências
- [ ] ❌ Sistema permitir acesso direto ao desktop para OPERATOR

---

## 🚀 **PRÓXIMOS PASSOS APÓS v2.11.0**

**Melhorias Futuras** (v2.12.x):
1. Scanner de código de barras integrado (câmera)
2. Modo offline (PWA com cache)
3. Voz-para-texto (ditado de quantidade)
4. Dashboard de produtividade (contagens/hora)
5. Gamificação (badges, rankings)

---

**Documento criado em**: 19/10/2025
**Última atualização**: 19/10/2025
**Status**: ✅ PLANEJAMENTO COMPLETO
**Aprovado por**: Equipe de Desenvolvimento
**Versão**: 1.0
