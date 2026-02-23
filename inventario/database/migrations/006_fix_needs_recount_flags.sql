-- ================================================================================
-- MIGRATION 006: Corrigir flags needs_recount_cycle_X após contagem
-- ================================================================================
-- Versão: v2.18.2
-- Data: 04/11/2025
-- Tipo: Bug Fix Crítico
--
-- PROBLEMA:
-- Produtos que foram contados no ciclo 2/3 ainda têm needs_recount_cycle_X = TRUE
-- Isso causa recontagens desnecessárias e descredibilidade do sistema
--
-- SOLUÇÃO:
-- Resetar flags needs_recount_cycle_X = FALSE para produtos já contados
-- ================================================================================

\c inventario_protheus;

BEGIN;

-- ========================================
-- PARTE 1: Corrigir needs_recount_cycle_2
-- ========================================

-- Produtos que JÁ foram contados no ciclo 2 devem ter needs_recount_cycle_2 = FALSE
UPDATE inventario.inventory_items
SET needs_recount_cycle_2 = FALSE
WHERE count_cycle_2 IS NOT NULL  -- Já foi contado no ciclo 2
  AND needs_recount_cycle_2 = TRUE;  -- Mas flag ainda está TRUE (errado!)

-- Log de quantos registros foram corrigidos
DO $$
DECLARE
    affected_rows INT;
BEGIN
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Corrigidos % produtos com needs_recount_cycle_2 = FALSE (já contados no ciclo 2)', affected_rows;
END $$;

-- ========================================
-- PARTE 2: Corrigir needs_recount_cycle_3
-- ========================================

-- Produtos que JÁ foram contados no ciclo 3 devem ter needs_recount_cycle_3 = FALSE
UPDATE inventario.inventory_items
SET needs_recount_cycle_3 = FALSE
WHERE count_cycle_3 IS NOT NULL  -- Já foi contado no ciclo 3
  AND needs_recount_cycle_3 = TRUE;  -- Mas flag ainda está TRUE (errado!)

-- Log de quantos registros foram corrigidos
DO $$
DECLARE
    affected_rows INT;
BEGIN
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Corrigidos % produtos com needs_recount_cycle_3 = FALSE (já contados no ciclo 3)', affected_rows;
END $$;

-- ========================================
-- PARTE 3: Validação
-- ========================================

-- Verificar se ainda existem produtos com flags inconsistentes
DO $$
DECLARE
    inconsistent_cycle_2 INT;
    inconsistent_cycle_3 INT;
BEGIN
    -- Contar produtos com ciclo 2 contado mas flag TRUE
    SELECT COUNT(*) INTO inconsistent_cycle_2
    FROM inventario.inventory_items
    WHERE count_cycle_2 IS NOT NULL
      AND needs_recount_cycle_2 = TRUE;

    -- Contar produtos com ciclo 3 contado mas flag TRUE
    SELECT COUNT(*) INTO inconsistent_cycle_3
    FROM inventario.inventory_items
    WHERE count_cycle_3 IS NOT NULL
      AND needs_recount_cycle_3 = TRUE;

    IF inconsistent_cycle_2 > 0 THEN
        RAISE WARNING '⚠️ Ainda existem % produtos com ciclo 2 contado mas needs_recount_cycle_2 = TRUE', inconsistent_cycle_2;
    ELSE
        RAISE NOTICE '✅ Todos os produtos com ciclo 2 contado têm needs_recount_cycle_2 correto';
    END IF;

    IF inconsistent_cycle_3 > 0 THEN
        RAISE WARNING '⚠️ Ainda existem % produtos com ciclo 3 contado mas needs_recount_cycle_3 = TRUE', inconsistent_cycle_3;
    ELSE
        RAISE NOTICE '✅ Todos os produtos com ciclo 3 contado têm needs_recount_cycle_3 correto';
    END IF;
END $$;

-- ========================================
-- PARTE 4: Exemplo de produtos corrigidos
-- ========================================

-- Mostrar exemplos de produtos corrigidos (inventário TESTE 01)
SELECT
    ii.product_code,
    ii.expected_quantity,
    ii.count_cycle_1,
    ii.count_cycle_2,
    ii.count_cycle_3,
    ii.needs_recount_cycle_2,
    ii.needs_recount_cycle_3,
    ii.status
FROM inventario.inventory_items ii
JOIN inventario.inventory_lists il ON il.id = ii.inventory_list_id
WHERE il.name = 'TESTE 01'
  AND ii.count_cycle_2 IS NOT NULL
ORDER BY ii.product_code
LIMIT 5;

COMMIT;

-- ================================================================================
-- FIM DA MIGRATION
-- ================================================================================

-- VALIDAÇÃO MANUAL (opcional):
--
-- Para verificar se a correção funcionou, execute:
--
-- SELECT
--     COUNT(*) as total_produtos,
--     COUNT(*) FILTER (WHERE count_cycle_2 IS NOT NULL) as contados_ciclo_2,
--     COUNT(*) FILTER (WHERE count_cycle_2 IS NOT NULL AND needs_recount_cycle_2 = TRUE) as inconsistentes_ciclo_2,
--     COUNT(*) FILTER (WHERE count_cycle_3 IS NOT NULL) as contados_ciclo_3,
--     COUNT(*) FILTER (WHERE count_cycle_3 IS NOT NULL AND needs_recount_cycle_3 = TRUE) as inconsistentes_ciclo_3
-- FROM inventario.inventory_items;
--
-- Resultado esperado:
-- - inconsistentes_ciclo_2 = 0
-- - inconsistentes_ciclo_3 = 0
