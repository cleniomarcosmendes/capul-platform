-- ================================================================================
-- MIGRATION 007: Corrigir expected_quantity zerado (usar snapshot)
-- ================================================================================
-- Versão: v2.18.2
-- Data: 04/11/2025
-- Tipo: Bug Fix Crítico (Impacto Financeiro GRAVE)
--
-- PROBLEMA:
-- Campo expected_quantity em inventory_items está ZERADO para 35 produtos,
-- mas o snapshot (b2_qatu) contém o valor CORRETO do Protheus.
--
-- Isso causa:
-- - Cálculo de divergências ERRADO (exemplo: 9 - 0 = +9 ao invés de 9 - 9 = 0)
-- - Recontagens desnecessárias
-- - Status PENDING ao invés de COUNTED
-- - Descredibilidade total do sistema
--
-- CAUSA RAIZ:
-- Ao criar/liberar inventário, sistema não copiou b2_qatu para expected_quantity
--
-- SOLUÇÃO:
-- Copiar b2_qatu do snapshot para expected_quantity onde estiver zerado
-- ================================================================================

\c inventario_protheus;

BEGIN;

-- ========================================
-- PARTE 1: Diagnóstico (antes da correção)
-- ========================================

DO $$
DECLARE
    total_inconsistentes INT;
    total_zerados INT;
BEGIN
    -- Contar produtos com expected_quantity != snapshot
    SELECT COUNT(*) INTO total_inconsistentes
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
    WHERE ii.expected_quantity != iis.b2_qatu;

    -- Contar produtos com expected_quantity = 0 mas snapshot != 0
    SELECT COUNT(*) INTO total_zerados
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
    WHERE ii.expected_quantity = 0 AND iis.b2_qatu != 0;

    RAISE NOTICE '📊 DIAGNÓSTICO:';
    RAISE NOTICE '   Total de produtos com expected_quantity inconsistente: %', total_inconsistentes;
    RAISE NOTICE '   Total de produtos zerados incorretamente: %', total_zerados;
END $$;

-- ========================================
-- PARTE 2: Correção
-- ========================================

-- Atualizar expected_quantity com valor do snapshot
-- Apenas onde expected_quantity != snapshot.b2_qatu
UPDATE inventario.inventory_items ii
SET expected_quantity = iis.b2_qatu
FROM inventario.inventory_items_snapshot iis
WHERE iis.inventory_item_id = ii.id
  AND ii.expected_quantity != iis.b2_qatu;

-- Log de quantos registros foram corrigidos
DO $$
DECLARE
    affected_rows INT;
BEGIN
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Corrigidos % produtos (expected_quantity copiado do snapshot)', affected_rows;
END $$;

-- ========================================
-- PARTE 3: Recálculo de needs_recount_cycle_2
-- ========================================

-- Produtos que foram "corrigidos" agora podem NÃO precisar mais de recontagem!
-- Exemplo: Produto 00002104
--   ANTES: expected=0, count_1=9 → divergência +9 → needs_recount_cycle_2=TRUE
--   DEPOIS: expected=9, count_1=9 → divergência 0 → needs_recount_cycle_2=FALSE

UPDATE inventario.inventory_items ii
SET needs_recount_cycle_2 = FALSE
FROM inventario.inventory_items_snapshot iis
WHERE iis.inventory_item_id = ii.id
  AND ii.count_cycle_1 IS NOT NULL
  AND ABS(ii.count_cycle_1 - ii.expected_quantity) < 0.01  -- Sem divergência após correção
  AND ii.needs_recount_cycle_2 = TRUE;

DO $$
DECLARE
    affected_rows INT;
BEGIN
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Resetados % flags needs_recount_cycle_2 (sem divergência após correção)', affected_rows;
END $$;

-- ========================================
-- PARTE 4: Recálculo de Status
-- ========================================

-- Produtos que agora NÃO têm divergência devem ter status COUNTED
UPDATE inventario.inventory_items ii
SET status = 'COUNTED'
WHERE ii.count_cycle_1 IS NOT NULL
  AND ABS(ii.count_cycle_1 - ii.expected_quantity) < 0.01  -- Sem divergência
  AND ii.status = 'PENDING';

DO $$
DECLARE
    affected_rows INT;
BEGIN
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Atualizados % status para COUNTED (sem divergência após correção)', affected_rows;
END $$;

-- ========================================
-- PARTE 5: Validação
-- ========================================

DO $$
DECLARE
    inconsistentes_restantes INT;
    zerados_restantes INT;
BEGIN
    -- Verificar se ainda há produtos inconsistentes
    SELECT COUNT(*) INTO inconsistentes_restantes
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
    WHERE ii.expected_quantity != iis.b2_qatu;

    -- Verificar se ainda há produtos zerados incorretamente
    SELECT COUNT(*) INTO zerados_restantes
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
    WHERE ii.expected_quantity = 0 AND iis.b2_qatu != 0;

    RAISE NOTICE '📊 VALIDAÇÃO PÓS-CORREÇÃO:';
    IF inconsistentes_restantes > 0 THEN
        RAISE WARNING '   ⚠️ Ainda existem % produtos com expected_quantity inconsistente', inconsistentes_restantes;
    ELSE
        RAISE NOTICE '   ✅ Todos os produtos têm expected_quantity consistente com snapshot';
    END IF;

    IF zerados_restantes > 0 THEN
        RAISE WARNING '   ⚠️ Ainda existem % produtos zerados incorretamente', zerados_restantes;
    ELSE
        RAISE NOTICE '   ✅ Nenhum produto zerado incorretamente';
    END IF;
END $$;

-- ========================================
-- PARTE 6: Exemplo de produtos corrigidos
-- ========================================

-- Mostrar produtos corrigidos (TESTE 01)
-- 📋 EXEMPLOS DE PRODUTOS CORRIGIDOS (TESTE 01):

SELECT
    ii.product_code,
    ii.expected_quantity as expected_agora,
    iis.b2_qatu as snapshot_b2_qatu,
    ii.count_cycle_1,
    ii.count_cycle_2,
    ii.needs_recount_cycle_2,
    ii.status
FROM inventario.inventory_items ii
JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
JOIN inventario.inventory_lists il ON il.id = ii.inventory_list_id
WHERE il.name = 'TESTE 01'
  AND ii.product_code IN ('00002104', '00002612', '00002108')
ORDER BY ii.product_code;

COMMIT;

-- ================================================================================
-- FIM DA MIGRATION
-- ================================================================================

-- VALIDAÇÃO MANUAL (opcional):
--
-- Para verificar se a correção funcionou:
--
-- SELECT
--     COUNT(*) as total_produtos,
--     COUNT(*) FILTER (WHERE ii.expected_quantity != iis.b2_qatu) as inconsistentes,
--     COUNT(*) FILTER (WHERE ii.expected_quantity = 0 AND iis.b2_qatu != 0) as zerados_incorretos
-- FROM inventario.inventory_items ii
-- JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id;
--
-- Resultado esperado:
-- - inconsistentes = 0
-- - zerados_incorretos = 0
