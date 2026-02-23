-- ============================================
-- MIGRAÇÃO: Auto-atualização do campo STATUS
-- ============================================
-- Data: 19/10/2025
-- Versão: v2.10.1
-- Objetivo: Garantir que campo 'status' seja sempre atualizado automaticamente
-- Referência: PENDENCIA_CAMPO_STATUS.md
-- ============================================

-- ============================================
-- FUNÇÃO: Calcular status de contagem
-- ============================================
CREATE OR REPLACE FUNCTION inventario.calculate_counting_status()
RETURNS TRIGGER AS $$
DECLARE
    final_qty NUMERIC(15,4);
    expected_qty NUMERIC(15,4);
    tolerance NUMERIC(15,4) := 0.01;
    debug_product_code VARCHAR(20);
BEGIN
    -- Buscar product_code para debug (se disponível)
    IF TG_TABLE_NAME = 'counting_list_items' THEN
        SELECT ii.product_code INTO debug_product_code
        FROM inventario.inventory_items ii
        WHERE ii.id = NEW.inventory_item_id;
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
        debug_product_code := NEW.product_code;
    END IF;

    -- Log para debug
    RAISE NOTICE '🔄 [TRIGGER] Calculando status para produto %', COALESCE(debug_product_code, 'N/A');

    -- ============================================
    -- ETAPA 1: Buscar quantidade esperada (movido para ANTES)
    -- ============================================
    -- Para counting_list_items, buscar de inventory_items
    IF TG_TABLE_NAME = 'counting_list_items' THEN
        SELECT ii.expected_quantity INTO expected_qty
        FROM inventario.inventory_items ii
        WHERE ii.id = NEW.inventory_item_id;

        RAISE NOTICE '🎯 Quantidade esperada (via inventory_items): %', expected_qty;

    -- Para inventory_items, usar expected_quantity
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
        expected_qty := NEW.expected_quantity;
        RAISE NOTICE '🎯 Quantidade esperada (expected_quantity): %', expected_qty;
    END IF;

    -- Tratar NULL como 0
    expected_qty := COALESCE(expected_qty, 0);

    -- ============================================
    -- ETAPA 2: Verificar ZERO CONFIRMADO (v2.17.4)
    -- Se expected=0 E sem contagens = zero confirmado
    -- ============================================
    IF NEW.count_cycle_1 IS NULL AND
       NEW.count_cycle_2 IS NULL AND
       NEW.count_cycle_3 IS NULL THEN

        IF expected_qty = 0 THEN
            -- Zero confirmado (esperado=0 + campo vazio)
            NEW.status := 'ZERO_CONFIRMED';
            RAISE NOTICE '✅ Status = ZERO_CONFIRMED (esperado=0 + sem contagens)';
            RETURN NEW;
        ELSE
            -- Pendente (esperado>0 + não contado)
            NEW.status := 'PENDING';
            RAISE NOTICE '⚠️ Status = PENDING (sem contagens, esperado > 0)';
            RETURN NEW;
        END IF;
    END IF;

    -- ============================================
    -- ETAPA 3: Calcular quantidade final
    -- Prioridade: count_3 > count_2 > count_1
    -- ============================================
    final_qty := COALESCE(NEW.count_cycle_3, NEW.count_cycle_2, NEW.count_cycle_1);

    RAISE NOTICE '📊 Quantidade final calculada: %', final_qty;

    -- ============================================
    -- ETAPA 4: Comparar e definir status
    -- Tolerância: 0.01 para lidar com decimais
    -- ============================================
    IF ABS(final_qty - expected_qty) < tolerance THEN
        -- Quantidade bate = COUNTED
        NEW.status := 'COUNTED';
        RAISE NOTICE '✅ Status = COUNTED (diferença: % < %)', ABS(final_qty - expected_qty), tolerance;
    ELSE
        -- Quantidade difere = PENDING (indica divergência)
        NEW.status := 'PENDING';
        RAISE NOTICE '⚠️ Status = PENDING (diferença: % >= %)', ABS(final_qty - expected_qty), tolerance;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: counting_list_items
-- ============================================
DROP TRIGGER IF EXISTS trg_update_counting_list_items_status ON inventario.counting_list_items;

CREATE TRIGGER trg_update_counting_list_items_status
    BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3
    ON inventario.counting_list_items
    FOR EACH ROW
    EXECUTE FUNCTION inventario.calculate_counting_status();

COMMENT ON TRIGGER trg_update_counting_list_items_status ON inventario.counting_list_items IS
'Auto-atualiza campo status quando contagens são inseridas ou modificadas';

-- ============================================
-- TRIGGER: inventory_items
-- ============================================
DROP TRIGGER IF EXISTS trg_update_inventory_items_status ON inventario.inventory_items;

CREATE TRIGGER trg_update_inventory_items_status
    BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3
    ON inventario.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION inventario.calculate_counting_status();

COMMENT ON TRIGGER trg_update_inventory_items_status ON inventario.inventory_items IS
'Auto-atualiza campo status quando contagens são inseridas ou modificadas';

-- ============================================
-- CORREÇÃO DE DADOS EXISTENTES
-- ============================================
-- Executar UPDATE para corrigir status de todos os registros existentes

-- ❌ DESABILITADO TEMPORARIAMENTE para evitar logs excessivos
-- Os triggers já corrigirão automaticamente quando houver novos UPDATEs

/*
-- counting_list_items
UPDATE inventario.counting_list_items
SET count_cycle_1 = count_cycle_1  -- Força trigger sem mudar valor
WHERE id IN (
    SELECT id FROM inventario.counting_list_items
    WHERE count_cycle_1 IS NOT NULL
       OR count_cycle_2 IS NOT NULL
       OR count_cycle_3 IS NOT NULL
);

-- inventory_items
UPDATE inventario.inventory_items
SET count_cycle_1 = count_cycle_1  -- Força trigger sem mudar valor
WHERE id IN (
    SELECT id FROM inventario.inventory_items
    WHERE count_cycle_1 IS NOT NULL
       OR count_cycle_2 IS NOT NULL
       OR count_cycle_3 IS NOT NULL
);
*/

-- ============================================
-- SCRIPT DE CORREÇÃO MANUAL (EXECUTAR SEPARADAMENTE SE NECESSÁRIO)
-- ============================================
-- Para corrigir dados existentes SEM acionar logs do trigger,
-- criar script separado de correção direta:

-- EXEMPLO (NÃO EXECUTAR AUTOMATICAMENTE):
/*
UPDATE inventario.counting_list_items cli
SET status = CASE
    WHEN cli.count_cycle_1 IS NULL
     AND cli.count_cycle_2 IS NULL
     AND cli.count_cycle_3 IS NULL THEN 'PENDING'
    WHEN ABS(
        COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1) -
        COALESCE((SELECT expected_quantity FROM inventario.inventory_items WHERE id = cli.inventory_item_id), 0)
    ) < 0.01 THEN 'COUNTED'
    ELSE 'PENDING'
END;
*/

-- ============================================
-- VALIDAÇÃO
-- ============================================
-- Query para verificar se triggers foram criados corretamente
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'inventario'
  AND trigger_name LIKE 'trg_update_%_status'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- LOGS E INFORMAÇÕES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Função criada: inventario.calculate_counting_status()';
    RAISE NOTICE 'Trigger criado: trg_update_counting_list_items_status';
    RAISE NOTICE 'Trigger criado: trg_update_inventory_items_status';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ IMPORTANTE:';
    RAISE NOTICE '- Campo "status" será atualizado automaticamente';
    RAISE NOTICE '- Dados existentes serão corrigidos na próxima atualização';
    RAISE NOTICE '- Para correção imediata, executar script de correção manual';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Referência: PENDENCIA_CAMPO_STATUS.md';
    RAISE NOTICE '========================================';
END $$;
