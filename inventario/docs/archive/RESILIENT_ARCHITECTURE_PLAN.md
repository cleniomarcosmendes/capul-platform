# 🛡️ PLANO DE ARQUITETURA RESILIENTE

## 🎯 OBJETIVO
Transformar toda a aplicação para usar **padrão resiliente** sem foreign keys entre módulos.

## 📋 CHECKLIST DE REFATORAÇÃO

### ✅ FASE 1: CRÍTICO (FEITO)
- [x] `inventory_items.product_id` → Usar `product_code`
- [x] Criar `ResilientDataService`
- [x] Exemplo de endpoints resilientes
- [x] Tornar FKs críticas opcionais

### 🔄 FASE 2: IMPORTANTE (EM ANDAMENTO)
- [ ] Refatorar `users.store_id` → `users.store_code`
- [ ] Refatorar `inventory_lists.store_id` → `inventory_lists.store_code`
- [ ] Refatorar `slk010` para usar apenas chaves naturais
- [ ] Atualizar endpoints de usuários
- [ ] Atualizar endpoints de inventário

### 📅 FASE 3: COMPLEMENTAR
- [ ] Refatorar `product_*` tables
- [ ] Refatorar `system_logs`
- [ ] Refatorar `counting_assignments`
- [ ] Criar migrations automáticas
- [ ] Documentação completa

## 🏗️ PADRÕES ARQUITETURAIS

### 1. PRINCÍPIO BASE
```
❌ EVITAR: Foreign Keys entre módulos
✅ USAR: Chaves naturais + busca on-demand
```

### 2. ESTRUTURA RESILIENTE
```
Módulo A ──(código)──→ Módulo B
         ←──(busca)────

NÃO:
Módulo A ──(FK)──→ Módulo B  ❌ Frágil
```

### 3. PADRÃO DE CÓDIGO
```python
# ❌ FRÁGIL:
user = db.query(User).filter(User.id == user_id).first()
store = user.store  # Foreign key

# ✅ RESILIENTE:
user = db.query(User).filter(User.username == username).first()
store = get_store_by_code(user.store_code)  # Chave natural
```

## 📊 BENEFÍCIOS ESPERADOS

### 🛡️ ROBUSTEZ
- **Antes**: 1 mudança quebra N funcionalidades
- **Depois**: Módulos independentes

### ⚡ PERFORMANCE  
- **Antes**: JOINs complexos com N tabelas
- **Depois**: Busca direta na fonte

### 🔧 MANUTENÇÃO
- **Antes**: Migrations complexas
- **Depois**: Mudanças isoladas

### 🚀 DEPLOY
- **Antes**: Deploy "all-or-nothing"
- **Depois**: Deploy por módulo

## 🔍 MONITORAMENTO

### Métricas de Sucesso:
1. **Zero foreign keys** entre módulos diferentes
2. **100% uptime** em mudanças de schema
3. **Tempo de deploy** reduzido
4. **Bugs relacionados a FK** = 0

### Testes de Resiliência:
```bash
# 1. Testar módulos independentemente
curl /api/v1/inventory/  # Deve funcionar sem products
curl /api/v1/protheus/   # Deve funcionar sem inventory

# 2. Testar mudanças de schema
ALTER TABLE products ADD COLUMN test_field TEXT;
# ↳ Não deve quebrar inventory

# 3. Testar busca resiliente
GET /api/v1/products/by-code/00010008
# ↳ Deve buscar direto no SB1010
```

## 📚 DOCUMENTAÇÃO TÉCNICA

### Para Desenvolvedores:
1. **SEMPRE** usar chaves naturais
2. **NUNCA** criar FK entre módulos
3. **USAR** `ResilientDataService`
4. **TESTAR** isolamento de módulos

### Para Operações:
1. Migrations são **não-destrutivas**
2. Rollback é **sempre possível**
3. Deploy pode ser **gradual**
4. Monitoramento por **módulo**

---

## 🎯 RESULTADO FINAL

```
🏛️ ARQUITETURA ATUAL (Frágil):
Module A ←→ Module B ←→ Module C
    ↕️         ↕️         ↕️
  Schema   Schema    Schema
  (Tudo acoplado - 1 mudança quebra tudo)

🛡️ ARQUITETURA RESILIENTE (Objetivo):
Module A    Module B    Module C
    ↓           ↓           ↓
 Natural    Natural    Natural
  Keys       Keys       Keys
    ↓           ↓           ↓
  [Protheus Data Layer]
  (Cada módulo independente)
```

**Status**: 🟡 20% Completo
**Próximo**: Refatorar users e inventory_lists
**Estimativa**: 2-3 semanas para completar