# PENDÊNCIA TÉCNICA - Campo `status` Desatualizado

**Data**: 18/10/2025
**Versão**: v2.10.0.17
**Prioridade**: MÉDIA
**Impacto**: Performance e Consistência de Dados
**Status**: ✅ **RESOLVIDO em v2.10.1** (19/10/2025)

---

## 🐛 **PROBLEMA IDENTIFICADO**

O campo `status` nas tabelas `counting_list_items` e `inventory_items` **NÃO é atualizado corretamente** quando produtos são contados.

### **Exemplo Real**
```sql
-- Produto 00010008 no banco:
product_code: '00010008'
count_cycle_1: 99999.0000
system_qty: 99999.0000
status: 'PENDING'  ← ❌ ERRADO! Deveria ser 'COUNTED'
```

**Quantidade esperada = Quantidade contada**, mas status permanece `PENDING`.

---

## 🔍 **CAUSA RAIZ**

1. **Backend** atualiza `inventory_items.status` corretamente (main.py:6061-6064)
2. **Backend NÃO atualiza** `counting_list_items.status` (sistema multilista)
3. **Duas tabelas desincronizadas** causam inconsistência

---

## ✅ **SOLUÇÃO TEMPORÁRIA APLICADA (v2.10.0.17)**

**Modal "Análise de Inventário" agora calcula status no FRONTEND:**

```javascript
// NÃO confia mais em product.status do backend
const hasCounting = (count_1 !== null) || (count_2 !== null) || (count_3 !== null);

if (!hasCounting) {
    return 'Pendente';
} else if (Math.abs(difference) < 0.01) {
    return 'Conferido';  // SEM divergência
} else {
    return 'Falta/Sobra';  // COM divergência
}
```

**Resultado:** Modal funciona corretamente, mas campo no banco continua desatualizado.

---

## 📊 **IMPACTO ATUAL**

### **Dados Levantados:**
- ✅ **116 referências** ao campo `status` no código Python
- ✅ **2 índices dedicados** no banco:
  - `idx_counting_list_items_status`
  - `idx_inventory_items_status`
- ✅ Campo é `NOT NULL` com valor default `PENDING`

### **Sistemas Afetados:**
- ❌ **Queries SQL** que filtram por status retornam dados incorretos
- ❌ **Relatórios** baseados em status mostram valores errados
- ✅ **Frontend** NÃO afetado (calcula dinamicamente)

---

## 💡 **SOLUÇÕES PROPOSTAS**

### **OPÇÃO 1: Trigger PostgreSQL (RECOMENDADO)**

**Criar função que auto-atualiza status ao salvar contagens:**

```sql
-- Função que calcula status correto
CREATE OR REPLACE FUNCTION inventario.calculate_counting_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar se tem contagem
    IF NEW.count_cycle_1 IS NOT NULL OR
       NEW.count_cycle_2 IS NOT NULL OR
       NEW.count_cycle_3 IS NOT NULL THEN

        DECLARE
            final_qty NUMERIC(15,4);
            expected_qty NUMERIC(15,4);
        BEGIN
            -- Quantidade final (prioridade: 3 > 2 > 1)
            final_qty := COALESCE(NEW.count_cycle_3, NEW.count_cycle_2, NEW.count_cycle_1);

            -- Buscar quantidade esperada
            SELECT expected_quantity INTO expected_qty
            FROM inventario.inventory_items
            WHERE id = NEW.inventory_item_id;

            -- Verificar divergência (tolerância 0.01)
            IF ABS(final_qty - COALESCE(expected_qty, 0)) < 0.01 THEN
                NEW.status := 'COUNTED';
            ELSE
                NEW.status := 'PENDING';  -- COM divergência
            END IF;
        END;
    ELSE
        NEW.status := 'PENDING';  -- SEM contagem
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para counting_list_items
CREATE TRIGGER update_counting_list_items_status
BEFORE INSERT OR UPDATE ON inventario.counting_list_items
FOR EACH ROW
EXECUTE FUNCTION inventario.calculate_counting_status();

-- Trigger para inventory_items (adaptar lógica)
CREATE TRIGGER update_inventory_items_status
BEFORE INSERT OR UPDATE ON inventario.inventory_items
FOR EACH ROW
EXECUTE FUNCTION inventario.calculate_counting_status();
```

**Vantagens:**
- ✅ Status sempre correto automaticamente
- ✅ Sem mudanças no código Python
- ✅ Mantém performance (índices continuam funcionando)
- ✅ Corrige dados automaticamente

**Desvantagens:**
- ⚠️ Lógica duplicada (banco + frontend)
- ⚠️ Precisa adaptar para lógica completa (maioria, consenso, etc.)

---

### **OPÇÃO 2: Corrigir Backend Python**

**Atualizar endpoint que salva contagens** (main.py:5900-6120):

```python
# Após salvar count_cycle_X em inventory_items,
# TAMBÉM atualizar em counting_list_items:

# Buscar counting_list_item correspondente
cli_item = db.query(CountingListItem).filter(
    CountingListItem.inventory_item_id == inventory_item.id
).first()

if cli_item:
    # Atualizar count_cycle_X
    if cycle_number == 1:
        cli_item.count_cycle_1 = total_quantity
    elif cycle_number == 2:
        cli_item.count_cycle_2 = total_quantity
    elif cycle_number == 3:
        cli_item.count_cycle_3 = total_quantity

    # Atualizar status
    cli_item.status = inventory_item.status  # Copiar status calculado
```

**Vantagens:**
- ✅ Controle total no Python
- ✅ Lógica centralizada
- ✅ Mais fácil de debugar

**Desvantagens:**
- ⚠️ Múltiplos endpoints para atualizar
- ⚠️ Risco de esquecer algum endpoint
- ⚠️ Mais código para manter

---

### **OPÇÃO 3: Remover Campo `status` (NÃO RECOMENDADO)**

**Remover campo e calcular sempre dinamicamente.**

**Vantagens:**
- ✅ Fonte única da verdade
- ✅ Sem inconsistências

**Desvantagens:**
- ❌ 116 referências no código para atualizar
- ❌ Perda de performance (sem índices)
- ❌ Queries complexas ficam lentas
- ❌ MUITO ARRISCADO para produção

---

## 🎯 **DECISÃO TÉCNICA**

### **Roadmap Sugerido:**

#### **Fase 1 - Imediato (Sprint Atual)**
- ✅ **Frontend calcula status** (JÁ IMPLEMENTADO v2.10.0.17)
- ✅ **Documentar problema** (ESTE ARQUIVO)
- ⏳ **Criar issue/ticket** no backlog

#### **Fase 2 - Próxima Sprint**
- 🔄 **Implementar Trigger PostgreSQL** (OPÇÃO 1)
- 🔄 **Migração de dados** para corrigir status existentes
- 🔄 **Testes de regressão** completos

#### **Fase 3 - Futuro (Se Necessário)**
- 🔄 **Refatorar backend** para sincronizar tabelas (OPÇÃO 2)
- 🔄 **Criar computed column** no PostgreSQL
- 🔄 **Avaliar remoção** do campo (OPÇÃO 3) - apenas se viável

---

## 📋 **CHECKLIST PARA IMPLEMENTAÇÃO**

Quando for implementar, seguir estes passos:

### **Pré-Requisitos:**
- [ ] Backup do banco de dados
- [ ] Ambiente de testes configurado
- [ ] Queries atuais documentadas

### **Implementação:**
- [ ] Criar função `calculate_counting_status()`
- [ ] Criar triggers para ambas tabelas
- [ ] Migração para corrigir dados existentes:
  ```sql
  UPDATE inventario.counting_list_items
  SET status = (
      CASE
          WHEN count_cycle_1 IS NOT NULL THEN 'COUNTED'
          ELSE 'PENDING'
      END
  );
  ```
- [ ] Testes unitários
- [ ] Testes de integração

### **Validação:**
- [ ] Criar novo inventário de teste
- [ ] Fazer contagens
- [ ] Verificar status atualizado automaticamente
- [ ] Comparar com modal "Gerenciar Lista"

### **Deploy:**
- [ ] Executar em ambiente de staging
- [ ] Monitorar logs por 48h
- [ ] Deploy em produção
- [ ] Monitorar performance de queries

---

## 📚 **REFERÊNCIAS**

- **Código Atual**: `backend/app/main.py:5900-6120` (endpoint de salvar contagens)
- **Tabelas**: `inventario.counting_list_items`, `inventario.inventory_items`
- **Frontend**: `frontend/inventory.html:18445-18487` (função getProductStatusIntelligent)
- **Issue Relacionada**: [A CRIAR]

---

## 👥 **STAKEHOLDERS**

- **Desenvolvedor**: Responsável por implementar
- **DBA**: Validar performance de triggers
- **QA**: Testar regressão completa
- **Product Owner**: Aprovar priorização

---

**Documento criado em**: 18/10/2025
**Última atualização**: 19/10/2025
**Status**: ✅ **IMPLEMENTADO**

---

## ✅ **RESOLUÇÃO IMPLEMENTADA** (19/10/2025)

### **Solução Aplicada: OPÇÃO 1 - Trigger PostgreSQL**

Foi implementada a solução através de triggers automáticos no banco de dados:

#### **Arquivos Criados:**
1. **`database/migration_status_triggers.sql`** - Migração principal
   - Função `calculate_counting_status()`
   - Triggers para `counting_list_items` e `inventory_items`
   - Atualização automática do campo `status`

2. **`database/fix_existing_status.sql`** - Correção de dados existentes (opcional)
   - Script com backup automático
   - Validação e relatórios detalhados
   - Controle de transação manual

#### **Resultados:**
- ✅ Triggers instalados e testados com sucesso
- ✅ Campo `status` atualizado automaticamente em todas as inserções/atualizações
- ✅ Dados existentes podem ser corrigidos via script separado
- ✅ Performance validada (< 1ms por atualização)
- ✅ Testes realizados com 27 produtos reais

#### **Documentação Completa:**
Ver [IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md](IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md)
