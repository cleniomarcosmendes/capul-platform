-- ========================================
-- SCRIPT DE LIMPEZA DO BANCO DE DADOS
-- Sistema de Inventário v2.14.0
-- Data: 26/10/2025
-- ========================================
--
-- Este script limpa TODOS os dados de teste, mantendo apenas:
-- ✅ Usuários (users, user_stores)
-- ✅ Lojas (stores)
-- ✅ Estrutura do banco (schema, triggers, índices)
--
-- 🧹 LIMPA:
-- ❌ Todas as tabelas do Protheus (SB1, SB2, SB8, SBM, SZD, SZE, SZF, SZB, SBZ, SLK)
-- ❌ Todas as tabelas de inventário e snapshot
--
-- ========================================

-- Conectar ao banco correto
\c inventario_protheus

-- Iniciar transação
BEGIN;

-- ========================================
-- 1. DESABILITAR TRIGGERS TEMPORARIAMENTE
-- ========================================
SET session_replication_role = 'replica';

-- ========================================
-- 2. LIMPAR TABELAS DE INVENTÁRIO
-- ========================================
TRUNCATE TABLE inventario.lot_counting_drafts CASCADE;
TRUNCATE TABLE inventario.inventory_lots_snapshot CASCADE;
TRUNCATE TABLE inventario.inventory_items_snapshot CASCADE;
TRUNCATE TABLE inventario.inventory_sub_items CASCADE;
TRUNCATE TABLE inventario.inventory_sub_lists CASCADE;
TRUNCATE TABLE inventario.inventory_items CASCADE;
TRUNCATE TABLE inventario.countings CASCADE;
TRUNCATE TABLE inventario.counting_lots CASCADE;
TRUNCATE TABLE inventario.counting_list_items CASCADE;
TRUNCATE TABLE inventario.counting_assignments CASCADE;
TRUNCATE TABLE inventario.closed_counting_rounds CASCADE;
TRUNCATE TABLE inventario.counting_lists CASCADE;
TRUNCATE TABLE inventario.inventory_lists CASCADE;

-- ========================================
-- 3. LIMPAR TABELAS DO PROTHEUS
-- ========================================

-- Hierarquia Mercadológica
TRUNCATE TABLE inventario.sbm010 CASCADE;  -- Grupos
TRUNCATE TABLE inventario.szd010 CASCADE;  -- Categorias
TRUNCATE TABLE inventario.sze010 CASCADE;  -- Subcategorias
TRUNCATE TABLE inventario.szf010 CASCADE;  -- Segmentos

-- Armazéns
TRUNCATE TABLE inventario.szb010 CASCADE;  -- Armazéns

-- Produtos e Estoque
TRUNCATE TABLE inventario.sb8010 CASCADE;  -- Lotes
TRUNCATE TABLE inventario.sb2010 CASCADE;  -- Saldos por armazém
TRUNCATE TABLE inventario.sb1010 CASCADE;  -- Produtos (cadastro geral)

-- Parâmetros e Localizações
TRUNCATE TABLE inventario.sbz010 CASCADE;  -- Parâmetros de produtos
TRUNCATE TABLE inventario.slk010 CASCADE;  -- Localizações

-- ========================================
-- 4. REABILITAR TRIGGERS
-- ========================================
SET session_replication_role = 'origin';

-- ========================================
-- 5. RESETAR SEQUENCES (se necessário)
-- ========================================
-- As sequences de UUID não precisam reset, mas caso haja autoincrement:
-- ALTER SEQUENCE inventario.alguma_seq RESTART WITH 1;

-- ========================================
-- 6. COMMIT
-- ========================================
COMMIT;

-- ========================================
-- 7. VERIFICAR LIMPEZA
-- ========================================
SELECT
    'users' as tabela,
    COUNT(*) as registros
FROM inventario.users
UNION ALL
SELECT
    'stores',
    COUNT(*)
FROM inventario.stores
UNION ALL
SELECT
    'sb1010 (produtos)',
    COUNT(*)
FROM inventario.sb1010
UNION ALL
SELECT
    'sb2010 (saldos)',
    COUNT(*)
FROM inventario.sb2010
UNION ALL
SELECT
    'sbm010 (grupos)',
    COUNT(*)
FROM inventario.sbm010
UNION ALL
SELECT
    'szd010 (categorias)',
    COUNT(*)
FROM inventario.szd010
UNION ALL
SELECT
    'inventory_lists',
    COUNT(*)
FROM inventario.inventory_lists
UNION ALL
SELECT
    'inventory_items',
    COUNT(*)
FROM inventario.inventory_items;

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
-- users                  → 2+ (admin, clenio, etc)
-- stores                 → 1+ (lojas cadastradas)
-- sb1010 (produtos)      → 0
-- sb2010 (saldos)        → 0
-- sbm010 (grupos)        → 0
-- szd010 (categorias)    → 0
-- inventory_lists        → 0
-- inventory_items        → 0
-- ========================================

\echo '✅ Limpeza concluída com sucesso!'
\echo '📊 Usuários e lojas foram mantidos'
\echo '🔄 Execute a sincronização com Protheus para reimportar os dados'
