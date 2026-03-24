-- Migration: Adicionar campo current_cycle na tabela lot_counting_drafts
-- Data: 01/10/2025
-- Objetivo: Diferenciar rascunhos por ciclo de contagem
-- Nota: idempotente — executa apenas se a tabela existir

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'inventario' AND table_name = 'lot_counting_drafts'
    ) THEN
        -- Adicionar coluna current_cycle
        ALTER TABLE inventario.lot_counting_drafts
        ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1;

        -- Comentário da coluna
        COMMENT ON COLUMN inventario.lot_counting_drafts.current_cycle IS 'Ciclo de contagem ao qual este rascunho pertence (1, 2 ou 3)';

        -- Atualizar constraint para incluir ciclo
        ALTER TABLE inventario.lot_counting_drafts
        DROP CONSTRAINT IF EXISTS unique_draft_per_user_item;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'unique_draft_per_user_item_cycle'
        ) THEN
            ALTER TABLE inventario.lot_counting_drafts
            ADD CONSTRAINT unique_draft_per_user_item_cycle
            UNIQUE(inventory_item_id, counted_by, current_cycle);
        END IF;

        -- Criar índice para performance
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_lot_drafts_cycle') THEN
            CREATE INDEX idx_lot_drafts_cycle ON inventario.lot_counting_drafts(current_cycle);
        END IF;

        -- Atualizar rascunhos existentes para ciclo 1 (se houver)
        UPDATE inventario.lot_counting_drafts
        SET current_cycle = 1
        WHERE current_cycle IS NULL;

        RAISE NOTICE 'Migration add_cycle_to_lot_drafts aplicada com sucesso.';
    ELSE
        RAISE NOTICE 'Tabela lot_counting_drafts nao existe — migration ignorada.';
    END IF;
END $$;
