-- ====================================================================
-- MIGRAÇÃO v2.10.0.18 - Correção de Quantidade Esperada para Produtos com Lote
-- ====================================================================
-- Data: 18/10/2025
-- Descrição: Corrige expected_quantity para produtos com controle de lote (b1_rastro='L')
--            Produtos com lote devem usar SUM(B8_SALDO) da SB8010, não B2_QATU da SB2010
-- Impacto: Cálculos de divergência, relatórios e acertos de estoque
-- ====================================================================

-- PASSO 1: Backup das tabelas (opcional, mas recomendado)
-- Criar tabelas de backup antes de fazer alterações

CREATE TABLE IF NOT EXISTS inventario.inventory_items_backup_20251018 AS
SELECT * FROM inventario.inventory_items;

CREATE TABLE IF NOT EXISTS inventario.inventory_items_snapshot_backup_20251018 AS
SELECT * FROM inventario.inventory_items_snapshot;

-- ====================================================================
-- PASSO 2: Corrigir inventory_items.expected_quantity
-- ====================================================================
-- Para produtos COM lote: usar soma de inventory_lots_snapshot (dados congelados)
-- Para produtos SEM lote: manter valor atual

UPDATE inventario.inventory_items ii
SET
    expected_quantity = (
        -- Usar soma dos lotes se produto tem snapshot de lotes
        SELECT COALESCE(SUM(ils.b8_saldo), 0)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    ),
    b2_qatu = (
        -- Atualizar b2_qatu também (usado como fallback)
        SELECT COALESCE(SUM(ils.b8_saldo), 0)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    )
WHERE ii.id IN (
    -- Apenas produtos que TEM snapshot de lotes (b1_rastro='L')
    SELECT DISTINCT inventory_item_id
    FROM inventario.inventory_lots_snapshot
);

-- ====================================================================
-- PASSO 3: Corrigir inventory_items_snapshot.b2_qatu
-- ====================================================================
-- Snapshot deve refletir soma dos lotes, não B2_QATU original

UPDATE inventario.inventory_items_snapshot iis
SET b2_qatu = (
    -- Soma dos lotes do snapshot
    SELECT COALESCE(SUM(ils.b8_saldo), 0)
    FROM inventario.inventory_lots_snapshot ils
    WHERE ils.inventory_item_id = iis.inventory_item_id
)
WHERE iis.b1_rastro = 'L'  -- Apenas produtos com controle de lote
  AND EXISTS (
      -- Garantir que tem lotes
      SELECT 1 FROM inventario.inventory_lots_snapshot ils
      WHERE ils.inventory_item_id = iis.inventory_item_id
  );

-- ====================================================================
-- PASSO 4: Verificação dos Resultados
-- ====================================================================
-- Query para verificar produtos corrigidos

SELECT
    ii.product_code,
    iis.b1_desc AS product_name,
    iis.b1_rastro AS lot_control,
    ii.expected_quantity AS expected_qty_inventory_item,
    iis.b2_qatu AS b2_qatu_snapshot,
    (
        SELECT COUNT(*)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    ) AS num_lots,
    (
        SELECT COALESCE(SUM(ils.b8_saldo), 0)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    ) AS sum_lot_quantities
FROM inventario.inventory_items ii
LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
WHERE iis.b1_rastro = 'L'
ORDER BY ii.product_code
LIMIT 50;

-- ====================================================================
-- PASSO 5: Validação (Produtos com divergência entre valores)
-- ====================================================================
-- Verificar se ainda há produtos com valores inconsistentes

SELECT
    ii.product_code,
    iis.b1_desc,
    ii.expected_quantity,
    (
        SELECT COALESCE(SUM(ils.b8_saldo), 0)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    ) AS sum_lots,
    ABS(ii.expected_quantity - (
        SELECT COALESCE(SUM(ils.b8_saldo), 0)
        FROM inventario.inventory_lots_snapshot ils
        WHERE ils.inventory_item_id = ii.id
    )) AS difference
FROM inventario.inventory_items ii
LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
WHERE iis.b1_rastro = 'L'
  AND ABS(ii.expected_quantity - (
      SELECT COALESCE(SUM(ils.b8_saldo), 0)
      FROM inventario.inventory_lots_snapshot ils
      WHERE ils.inventory_item_id = ii.id
  )) > 0.01  -- Tolerância de 0.01
ORDER BY difference DESC;

-- ====================================================================
-- PASSO 6: Estatísticas da Migração
-- ====================================================================

SELECT
    'Total de produtos com lote' AS metric,
    COUNT(*) AS value
FROM inventario.inventory_items_snapshot
WHERE b1_rastro = 'L'

UNION ALL

SELECT
    'Produtos com lote E snapshots de lotes' AS metric,
    COUNT(DISTINCT iis.inventory_item_id) AS value
FROM inventario.inventory_items_snapshot iis
INNER JOIN inventario.inventory_lots_snapshot ils ON ils.inventory_item_id = iis.inventory_item_id
WHERE iis.b1_rastro = 'L'

UNION ALL

SELECT
    'Produtos atualizados em inventory_items' AS metric,
    COUNT(*) AS value
FROM inventario.inventory_items ii
WHERE ii.id IN (
    SELECT DISTINCT inventory_item_id
    FROM inventario.inventory_lots_snapshot
);

-- ====================================================================
-- NOTAS IMPORTANTES
-- ====================================================================
-- 1. Esta migração usa dados de snapshot (inventory_lots_snapshot) que são imutáveis
-- 2. Se não houver snapshot de lotes, o produto NÃO será atualizado
-- 3. Produtos SEM controle de lote (b1_rastro != 'L') não são afetados
-- 4. Tabelas de backup foram criadas para rollback se necessário
-- 5. Execute as queries de verificação ANTES de fazer commit

-- ====================================================================
-- ROLLBACK (Se necessário)
-- ====================================================================
-- Caso precise reverter as mudanças:

/*
-- Restaurar inventory_items
DELETE FROM inventario.inventory_items;
INSERT INTO inventario.inventory_items
SELECT * FROM inventario.inventory_items_backup_20251018;

-- Restaurar inventory_items_snapshot
DELETE FROM inventario.inventory_items_snapshot;
INSERT INTO inventario.inventory_items_snapshot
SELECT * FROM inventario.inventory_items_snapshot_backup_20251018;
*/

-- ====================================================================
-- FIM DA MIGRAÇÃO
-- ====================================================================
