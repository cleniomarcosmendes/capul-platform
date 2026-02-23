-- ============================================
-- SCRIPT DE CORREÇÃO: Status de dados existentes
-- ============================================
-- Data: 19/10/2025
-- Versão: v2.10.1
-- Objetivo: Corrigir campo 'status' em registros pré-existentes
-- Referência: PENDENCIA_CAMPO_STATUS.md
-- ============================================
-- ATENÇÃO: Este script deve ser executado APENAS UMA VEZ após a migração
-- ============================================

-- Iniciar transação para segurança
BEGIN;

-- ============================================
-- BACKUP: Criar tabelas temporárias para rollback
-- ============================================
CREATE TEMP TABLE backup_counting_list_items_status AS
SELECT id, status
FROM inventario.counting_list_items;

CREATE TEMP TABLE backup_inventory_items_status AS
SELECT id, status
FROM inventario.inventory_items;

DO $$
BEGIN
    RAISE NOTICE '✅ Backup criado com sucesso';
    RAISE NOTICE '   - backup_counting_list_items_status: % registros', (SELECT COUNT(*) FROM backup_counting_list_items_status);
    RAISE NOTICE '   - backup_inventory_items_status: % registros', (SELECT COUNT(*) FROM backup_inventory_items_status);
END $$;

-- ============================================
-- CORREÇÃO: counting_list_items
-- ============================================
DO $$
DECLARE
    total_registros INTEGER;
    registros_atualizados INTEGER;
BEGIN
    -- Contar total de registros
    SELECT COUNT(*) INTO total_registros
    FROM inventario.counting_list_items;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 CORRIGINDO: counting_list_items';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de registros: %', total_registros;

    -- Executar correção
    UPDATE inventario.counting_list_items cli
    SET status = CASE
        -- SEM contagens = PENDING
        WHEN cli.count_cycle_1 IS NULL
         AND cli.count_cycle_2 IS NULL
         AND cli.count_cycle_3 IS NULL THEN 'PENDING'

        -- COM contagens = comparar com esperado
        ELSE (
            CASE
                WHEN ABS(
                    -- Quantidade final (prioridade: 3 > 2 > 1)
                    COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1) -
                    -- Quantidade esperada (buscar de inventory_items)
                    COALESCE((
                        SELECT expected_quantity
                        FROM inventario.inventory_items ii
                        WHERE ii.id = cli.inventory_item_id
                    ), 0)
                ) < 0.01 THEN 'COUNTED'  -- Bate = COUNTED
                ELSE 'PENDING'            -- Diverge = PENDING
            END
        )
    END
    WHERE status != CASE
        WHEN cli.count_cycle_1 IS NULL
         AND cli.count_cycle_2 IS NULL
         AND cli.count_cycle_3 IS NULL THEN 'PENDING'
        ELSE (
            CASE
                WHEN ABS(
                    COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1) -
                    COALESCE((
                        SELECT expected_quantity
                        FROM inventario.inventory_items ii
                        WHERE ii.id = cli.inventory_item_id
                    ), 0)
                ) < 0.01 THEN 'COUNTED'
                ELSE 'PENDING'
            END
        )
    END;

    -- Contar quantos foram atualizados
    GET DIAGNOSTICS registros_atualizados = ROW_COUNT;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Correção concluída:';
    RAISE NOTICE '   - Registros atualizados: %', registros_atualizados;
    RAISE NOTICE '   - Registros mantidos: %', total_registros - registros_atualizados;
END $$;

-- ============================================
-- CORREÇÃO: inventory_items
-- ============================================
DO $$
DECLARE
    total_registros INTEGER;
    registros_atualizados INTEGER;
BEGIN
    -- Contar total de registros
    SELECT COUNT(*) INTO total_registros
    FROM inventario.inventory_items;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 CORRIGINDO: inventory_items';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de registros: %', total_registros;

    -- Executar correção
    UPDATE inventario.inventory_items ii
    SET status = CASE
        -- SEM contagens = PENDING
        WHEN ii.count_cycle_1 IS NULL
         AND ii.count_cycle_2 IS NULL
         AND ii.count_cycle_3 IS NULL THEN 'PENDING'

        -- COM contagens = comparar com system_qty
        ELSE (
            CASE
                WHEN ABS(
                    -- Quantidade final (prioridade: 3 > 2 > 1)
                    COALESCE(ii.count_cycle_3, ii.count_cycle_2, ii.count_cycle_1) -
                    -- Quantidade esperada (system_qty)
                    COALESCE(ii.system_qty, 0)
                ) < 0.01 THEN 'COUNTED'  -- Bate = COUNTED
                ELSE 'PENDING'            -- Diverge = PENDING
            END
        )
    END
    WHERE status != CASE
        WHEN ii.count_cycle_1 IS NULL
         AND ii.count_cycle_2 IS NULL
         AND ii.count_cycle_3 IS NULL THEN 'PENDING'
        ELSE (
            CASE
                WHEN ABS(
                    COALESCE(ii.count_cycle_3, ii.count_cycle_2, ii.count_cycle_1) -
                    COALESCE(ii.system_qty, 0)
                ) < 0.01 THEN 'COUNTED'
                ELSE 'PENDING'
            END
        )
    END;

    -- Contar quantos foram atualizados
    GET DIAGNOSTICS registros_atualizados = ROW_COUNT;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Correção concluída:';
    RAISE NOTICE '   - Registros atualizados: %', registros_atualizados;
    RAISE NOTICE '   - Registros mantidos: %', total_registros - registros_atualizados;
END $$;

-- ============================================
-- VALIDAÇÃO: Comparar antes vs depois
-- ============================================
DO $$
DECLARE
    diff_counting_items INTEGER;
    diff_inventory_items INTEGER;
BEGIN
    -- Contar diferenças em counting_list_items
    SELECT COUNT(*) INTO diff_counting_items
    FROM inventario.counting_list_items cli
    INNER JOIN backup_counting_list_items_status b ON cli.id = b.id
    WHERE cli.status != b.status;

    -- Contar diferenças em inventory_items
    SELECT COUNT(*) INTO diff_inventory_items
    FROM inventario.inventory_items ii
    INNER JOIN backup_inventory_items_status b ON ii.id = b.id
    WHERE ii.status != b.status;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 VALIDAÇÃO';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'counting_list_items:';
    RAISE NOTICE '   - Registros modificados: %', diff_counting_items;
    RAISE NOTICE '';
    RAISE NOTICE 'inventory_items:';
    RAISE NOTICE '   - Registros modificados: %', diff_inventory_items;
    RAISE NOTICE '';
    RAISE NOTICE 'Total de status corrigidos: %', diff_counting_items + diff_inventory_items;
END $$;

-- ============================================
-- RELATÓRIO DETALHADO: Produtos com status corrigido
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 PRODUTOS CORRIGIDOS (counting_list_items)';
    RAISE NOTICE '========================================';
END $$;

SELECT
    cli.product_code AS "Código",
    b.status AS "Status Antigo",
    cli.status AS "Status Novo",
    cli.count_cycle_1 AS "Count 1",
    cli.count_cycle_2 AS "Count 2",
    cli.count_cycle_3 AS "Count 3",
    ii.expected_quantity AS "Qty Esperada"
FROM inventario.counting_list_items cli
INNER JOIN backup_counting_list_items_status b ON cli.id = b.id
INNER JOIN inventario.inventory_items ii ON cli.inventory_item_id = ii.id
WHERE cli.status != b.status
ORDER BY cli.product_code
LIMIT 20;  -- Mostrar apenas 20 primeiros

-- ============================================
-- FINALIZAÇÃO
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CORREÇÃO CONCLUÍDA COM SUCESSO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Próximos passos:';
    RAISE NOTICE '1. Revisar os registros modificados acima';
    RAISE NOTICE '2. Se estiver OK, executar: COMMIT;';
    RAISE NOTICE '3. Se houver problema, executar: ROLLBACK;';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ATENÇÃO: Transação ainda está aberta!';
    RAISE NOTICE '';
END $$;

-- ============================================
-- DECISÃO MANUAL: Descomentar UMA das opções
-- ============================================

-- OPÇÃO 1: Confirmar alterações (SE TUDO ESTIVER OK)
-- COMMIT;
-- \echo '✅ Alterações confirmadas! Status corrigido com sucesso.'

-- OPÇÃO 2: Reverter alterações (SE HOUVER PROBLEMA)
-- ROLLBACK;
-- \echo '⚠️ Alterações revertidas! Status voltou ao estado anterior.'

-- ============================================
-- LIMPEZA (executar após COMMIT/ROLLBACK)
-- ============================================
-- DROP TABLE IF EXISTS backup_counting_list_items_status;
-- DROP TABLE IF EXISTS backup_inventory_items_status;
