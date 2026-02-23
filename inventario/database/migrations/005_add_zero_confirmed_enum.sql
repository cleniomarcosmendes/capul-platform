-- ============================================
-- MIGRAÇÃO: Adicionar valor ZERO_CONFIRMED ao ENUM counting_status
-- ============================================
-- Data: 02/11/2025
-- Versão: v2.17.4
-- Objetivo: Permitir status "ZERO_CONFIRMED" para produtos com expected=0 e sem contagens
-- Referência: CORRECAO_ZERO_CONFIRMADO_v2.17.4.md
-- ============================================

-- Adicionar valor ZERO_CONFIRMED ao ENUM
ALTER TYPE inventario.counting_status ADD VALUE IF NOT EXISTS 'ZERO_CONFIRMED';

-- Verificar valores do ENUM
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'inventario.counting_status'::regtype
ORDER BY enumsortorder;

-- ============================================
-- CORREÇÃO DE DADOS EXISTENTES
-- ============================================
-- Forçar recálculo de status em produtos com expected=0 e sem contagens
UPDATE inventario.counting_list_items cli
SET count_cycle_1 = cli.count_cycle_1  -- Força trigger sem mudar valor
FROM inventario.inventory_items ii
WHERE cli.inventory_item_id = ii.id
  AND ii.expected_quantity = 0
  AND cli.count_cycle_1 IS NULL
  AND cli.count_cycle_2 IS NULL
  AND cli.count_cycle_3 IS NULL;

-- Contar produtos com ZERO_CONFIRMED
SELECT COUNT(*) as total_zero_confirmed
FROM inventario.counting_list_items
WHERE status = 'ZERO_CONFIRMED';

-- ============================================
-- LOGS E INFORMAÇÕES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA - v2.17.4';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Valor adicionado ao ENUM: ZERO_CONFIRMED';
    RAISE NOTICE 'Produtos atualizados: produtos com expected=0 + sem contagens';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Referência: CORRECAO_ZERO_CONFIRMADO_v2.17.4.md';
    RAISE NOTICE '========================================';
END $$;
