-- =====================================================
-- SCRIPT DE LIMPEZA: INVENTÁRIOS E SNAPSHOTS
-- Data: 26/10/2025
-- Versão: v2.15.0
-- Autor: Claude Code
-- =====================================================
--
-- OBJETIVO: Limpar APENAS dados de inventários e snapshots
-- PRESERVA: Usuários, lojas, produtos Protheus, hierarquia
--
-- =====================================================

-- Desabilitar triggers temporariamente para acelerar limpeza
SET session_replication_role = 'replica';

\echo '🧹 Iniciando limpeza de inventários e snapshots...'

-- =====================================================
-- ETAPA 1: LIMPAR TABELAS DEPENDENTES (ordem correta)
-- =====================================================

\echo '📋 Limpando rascunhos de lotes...'
TRUNCATE TABLE inventario.lot_counting_drafts CASCADE;

\echo '📊 Limpando contagens...'
TRUNCATE TABLE inventario.countings CASCADE;

\echo '📉 Limpando divergências...'
TRUNCATE TABLE inventario.discrepancies CASCADE;

\echo '👥 Limpando atribuições de contagem...'
TRUNCATE TABLE inventario.counting_assignments CASCADE;

\echo '📝 Limpando listas de contagem...'
TRUNCATE TABLE inventario.counting_lists CASCADE;

-- =====================================================
-- ETAPA 2: LIMPAR SNAPSHOTS (v2.10.0)
-- =====================================================

\echo '📸 Limpando snapshot de lotes...'
TRUNCATE TABLE inventario.inventory_lots_snapshot CASCADE;

\echo '📸 Limpando snapshot de itens...'
TRUNCATE TABLE inventario.inventory_items_snapshot CASCADE;

-- =====================================================
-- ETAPA 3: LIMPAR ITENS E LISTAS DE INVENTÁRIO
-- =====================================================

\echo '📦 Limpando itens de inventário...'
TRUNCATE TABLE inventario.inventory_items CASCADE;

\echo '📋 Limpando listas de inventário...'
TRUNCATE TABLE inventario.inventory_lists CASCADE;

-- =====================================================
-- ETAPA 4: REABILITAR TRIGGERS
-- =====================================================

\echo '🔧 Reabilitando triggers...'
SET session_replication_role = 'origin';

-- =====================================================
-- ETAPA 5: VALIDAÇÃO
-- =====================================================

\echo ''
\echo '✅ LIMPEZA CONCLUÍDA!'
\echo ''
\echo '📊 RESUMO DA LIMPEZA:'
\echo '---------------------------------------------------'

SELECT
    '✅ Inventários' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.inventory_lists
UNION ALL
SELECT
    '✅ Itens de Inventário' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.inventory_items
UNION ALL
SELECT
    '✅ Snapshots de Itens' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.inventory_items_snapshot
UNION ALL
SELECT
    '✅ Snapshots de Lotes' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.inventory_lots_snapshot
UNION ALL
SELECT
    '✅ Contagens' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.countings
UNION ALL
SELECT
    '✅ Listas de Contagem' as tabela,
    COUNT(*) as registros_restantes
FROM inventario.counting_lists;

\echo ''
\echo '📦 DADOS PRESERVADOS:'
\echo '---------------------------------------------------'

SELECT
    '👤 Usuários' as categoria,
    COUNT(*) as total
FROM inventario.users
WHERE is_active = true
UNION ALL
SELECT
    '🏪 Lojas' as categoria,
    COUNT(*) as total
FROM inventario.stores
WHERE is_active = true
UNION ALL
SELECT
    '📦 Produtos (SB1010)' as categoria,
    COUNT(*) as total
FROM inventario.sb1010
UNION ALL
SELECT
    '💰 Saldos (SB2010)' as categoria,
    COUNT(*) as total
FROM inventario.sb2010
UNION ALL
SELECT
    '🔢 Lotes (SB8010)' as categoria,
    COUNT(*) as total
FROM inventario.sb8010
UNION ALL
SELECT
    '🏢 Grupos (SBM010)' as categoria,
    COUNT(*) as total
FROM inventario.sbm010
UNION ALL
SELECT
    '📂 Categorias (SZD010)' as categoria,
    COUNT(*) as total
FROM inventario.szd010
UNION ALL
SELECT
    '📁 Subcategorias (SZE010)' as categoria,
    COUNT(*) as total
FROM inventario.sze010
UNION ALL
SELECT
    '🏷️ Segmentos (SZF010)' as categoria,
    COUNT(*) as total
FROM inventario.szf010
UNION ALL
SELECT
    '🏗️ Armazéns (SZB010)' as categoria,
    COUNT(*) as total
FROM inventario.szb010;

\echo ''
\echo '✅ Limpeza concluída! Sistema pronto para novos inventários.'
\echo ''
