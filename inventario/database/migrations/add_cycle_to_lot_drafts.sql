-- Migration: Adicionar campo current_cycle na tabela lot_counting_drafts
-- Data: 01/10/2025
-- Objetivo: Diferenciar rascunhos por ciclo de contagem

-- Adicionar coluna current_cycle
ALTER TABLE inventario.lot_counting_drafts
ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1;

-- Comentário da coluna
COMMENT ON COLUMN inventario.lot_counting_drafts.current_cycle IS 'Ciclo de contagem ao qual este rascunho pertence (1, 2 ou 3)';

-- Atualizar constraint para incluir ciclo
ALTER TABLE inventario.lot_counting_drafts
DROP CONSTRAINT IF EXISTS unique_draft_per_user_item;

ALTER TABLE inventario.lot_counting_drafts
ADD CONSTRAINT unique_draft_per_user_item_cycle
UNIQUE(inventory_item_id, counted_by, current_cycle);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_lot_drafts_cycle
ON inventario.lot_counting_drafts(current_cycle);

-- Atualizar rascunhos existentes para ciclo 1 (se houver)
UPDATE inventario.lot_counting_drafts
SET current_cycle = 1
WHERE current_cycle IS NULL;
