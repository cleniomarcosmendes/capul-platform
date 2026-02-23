# 🔧 TROUBLESHOOTING - CICLO 3

## Comandos Rápidos de Diagnóstico

### 1. Verificar Estado do Inventário
```bash
# Ver ciclo e status atual
docker-compose exec postgres psql -U inventario_user -d inventario_protheus \
  -c "SELECT name, current_cycle, list_status FROM inventario.inventory_lists WHERE name = 'SEU_INVENTARIO';"
```

### 2. Verificar Divergências Entre Ciclos
```bash
# Produtos com Count1 ≠ Count2
docker-compose exec postgres psql -U inventario_user -d inventario_protheus \
  -c "SELECT product_code, count_cycle_1, count_cycle_2, needs_recount_cycle_3 
      FROM inventario.inventory_items 
      WHERE inventory_list_id = 'ID_INVENTARIO' 
      AND ABS(COALESCE(count_cycle_1,0) - COALESCE(count_cycle_2,0)) >= 0.01;"
```

### 3. Verificar Atribuições Ciclo 3
```bash
# Contar atribuições por ciclo
docker-compose exec postgres psql -U inventario_user -d inventario_protheus \
  -c "SELECT ca.count_number, COUNT(*) 
      FROM inventario.counting_assignments ca 
      JOIN inventario.inventory_items ii ON ca.inventory_item_id = ii.id 
      WHERE ii.inventory_list_id = 'ID_INVENTARIO' 
      GROUP BY ca.count_number ORDER BY ca.count_number;"
```

### 4. Logs do Backend
```bash
# Ver logs de transição de ciclos
docker-compose logs -f backend | grep -E "CICLO|RESULTADO|divergência"
```

## Correções Manuais (Emergenciais)

### Forçar Transição para Ciclo 3
```sql
-- 1. Marcar produtos divergentes
UPDATE inventario.inventory_items 
SET needs_recount_cycle_3 = true 
WHERE inventory_list_id = 'ID_INVENTARIO'
AND ABS(COALESCE(count_cycle_1,0) - COALESCE(count_cycle_2,0)) >= 0.01;

-- 2. Atualizar inventário para ciclo 3
UPDATE inventario.inventory_lists 
SET current_cycle = 3, list_status = 'ABERTA' 
WHERE id = 'ID_INVENTARIO';

-- 3. Criar atribuições manualmente (se necessário)
INSERT INTO inventario.counting_assignments (id, inventory_item_id, assigned_to, count_number, status)
SELECT 
  gen_random_uuid(),
  ii.id,
  'ID_USUARIO',
  3,
  'PENDING'
FROM inventario.inventory_items ii
WHERE ii.inventory_list_id = 'ID_INVENTARIO'
AND ii.needs_recount_cycle_3 = true
AND NOT EXISTS (
  SELECT 1 FROM inventario.counting_assignments ca
  WHERE ca.inventory_item_id = ii.id AND ca.count_number = 3
);
```

## Problemas Comuns e Soluções

### ❌ "Usuário não tem produtos atribuídos no ciclo 3"

**Causa**: Flag `needs_recount_cycle_3` está false

**Solução**:
1. Verificar divergências reais
2. Atualizar flags manualmente
3. Recarregar página

### ❌ "Botão mostra 'Liberar 2ª Contagem' mas estou no ciclo 3"

**Causa**: Cache do frontend

**Solução**:
```javascript
// Console do navegador (F12)
localStorage.clear();
location.reload();
```

### ❌ "Sistema não avança para ciclo 3 após encerrar ciclo 2"

**Causa**: Lógica de detecção incorreta

**Verificar**:
- Arquivo `/backend/app/api/v1/endpoints/assignments.py`
- Linha 1496-1540 deve comparar Count1 vs Count2
- NÃO deve comparar Count2 vs Sistema

### ❌ "Produtos aparecem duplicados no ciclo 3"

**Causa**: Atribuições duplicadas

**Solução**:
```sql
-- Remover duplicatas mantendo apenas uma
DELETE FROM inventario.counting_assignments ca1
WHERE EXISTS (
  SELECT 1 FROM inventario.counting_assignments ca2
  WHERE ca2.inventory_item_id = ca1.inventory_item_id
  AND ca2.count_number = ca1.count_number
  AND ca2.id < ca1.id
);
```

## Queries de Validação

### Validar Lógica de Divergência
```sql
-- Deve retornar produtos onde Count1 ≠ Count2
SELECT 
  product_code,
  count_cycle_1 as c1,
  count_cycle_2 as c2,
  ABS(COALESCE(count_cycle_1,0) - COALESCE(count_cycle_2,0)) as diff,
  needs_recount_cycle_3 as needs_c3
FROM inventario.inventory_items
WHERE inventory_list_id = 'ID_INVENTARIO'
AND count_cycle_1 IS NOT NULL
ORDER BY diff DESC;
```

### Status Geral do Sistema
```sql
-- Dashboard de ciclos
SELECT 
  current_cycle,
  list_status,
  COUNT(*) as inventarios
FROM inventario.inventory_lists
WHERE list_status != 'ENCERRADA'
GROUP BY current_cycle, list_status
ORDER BY current_cycle;
```

## Reiniciar Sistema Completamente
```bash
# Parar tudo
docker-compose down

# Limpar volumes (CUIDADO: perde dados!)
# docker-compose down -v

# Iniciar novamente
docker-compose up -d

# Verificar logs
docker-compose logs -f backend
```

## Contatos para Suporte

- **Documentação Completa**: `/docs/FIX_CICLO_3_COMPLETO.md`
- **Changelog**: `/docs/CHANGELOG_CICLOS.md`
- **GitHub Issues**: Reportar em github.com/seu-repo/issues