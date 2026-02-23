-- Script para limpar TODOS os dados de inventário
-- Sistema de Inventário - Capul
-- ATENÇÃO: Este script apaga TODOS os dados de inventário!

-- Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = replica;

-- Limpar tabelas em ordem (respeitando dependências)
DELETE FROM inventario.closed_counting_rounds;
DELETE FROM inventario.discrepancies;
DELETE FROM inventario.countings;
DELETE FROM inventario.counting_assignments;
DELETE FROM inventario.inventory_items;
DELETE FROM inventario.inventory_lists;

-- Limpar logs relacionados a inventário (opcional)
DELETE FROM inventario.system_logs WHERE module LIKE '%inventory%' OR module LIKE '%counting%';

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = DEFAULT;

-- Mostrar resultado da limpeza
SELECT 
    'closed_counting_rounds' as tabela, COUNT(*) as registros FROM inventario.closed_counting_rounds
UNION ALL
SELECT 
    'discrepancies' as tabela, COUNT(*) as registros FROM inventario.discrepancies
UNION ALL
SELECT 
    'countings' as tabela, COUNT(*) as registros FROM inventario.countings
UNION ALL
SELECT 
    'counting_assignments' as tabela, COUNT(*) as registros FROM inventario.counting_assignments
UNION ALL
SELECT 
    'inventory_items' as tabela, COUNT(*) as registros FROM inventario.inventory_items
UNION ALL
SELECT 
    'inventory_lists' as tabela, COUNT(*) as registros FROM inventario.inventory_lists;

-- Resetar sequências se necessário (não aplicável para UUIDs)
-- mas vamos mostrar uma mensagem de confirmação
SELECT '✅ LIMPEZA CONCLUÍDA! Todas as tabelas de inventário foram zeradas.' as resultado;