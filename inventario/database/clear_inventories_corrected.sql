-- =======================================
-- SCRIPT PARA LIMPAR TODOS OS INVENTÁRIOS (CORRIGIDO)
-- =======================================

-- Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = replica;

-- 1. Limpar contagens
DELETE FROM inventario.countings WHERE 1=1;

-- 2. Limpar divergências
DELETE FROM inventario.discrepancies WHERE 1=1;
DELETE FROM inventario.counting_discrepancies WHERE 1=1;

-- 3. Limpar atribuições de contadores
DELETE FROM inventario.counting_assignments WHERE 1=1;

-- 4. Limpar rodadas de contagem fechadas
DELETE FROM inventario.closed_counting_rounds WHERE 1=1;

-- 5. Limpar listas de contagem
DELETE FROM inventario.counting_lists WHERE 1=1;

-- 6. Limpar itens de inventário
DELETE FROM inventario.inventory_items WHERE 1=1;

-- 7. Limpar listas de inventário
DELETE FROM inventario.inventory_lists WHERE 1=1;

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = DEFAULT;

-- Verificar limpeza
SELECT 'countings' as table_name, COUNT(*) as records FROM inventario.countings
UNION ALL
SELECT 'discrepancies', COUNT(*) FROM inventario.discrepancies
UNION ALL
SELECT 'counting_discrepancies', COUNT(*) FROM inventario.counting_discrepancies
UNION ALL
SELECT 'counting_assignments', COUNT(*) FROM inventario.counting_assignments
UNION ALL
SELECT 'closed_counting_rounds', COUNT(*) FROM inventario.closed_counting_rounds
UNION ALL
SELECT 'counting_lists', COUNT(*) FROM inventario.counting_lists
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM inventario.inventory_items
UNION ALL
SELECT 'inventory_lists', COUNT(*) FROM inventario.inventory_lists;

-- Mostrar produtos disponíveis para novos inventários
SELECT COUNT(*) as total_products FROM inventario.products WHERE is_active = true;

-- Mostrar usuários disponíveis
SELECT COUNT(*) as total_users FROM inventario.users WHERE active = true;

SELECT 'LIMPEZA COMPLETA DOS INVENTÁRIOS REALIZADA!' as status;