-- Criar tabela para rascunhos de contagem de lotes
-- Esta tabela persiste os dados mesmo quando o navegador é limpo

CREATE TABLE IF NOT EXISTS inventario.lot_counting_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventario.inventory_items(id) ON DELETE CASCADE,
    counted_by UUID NOT NULL REFERENCES inventario.users(id),
    draft_data JSONB NOT NULL, -- Armazena os dados dos lotes como JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices para performance
    CONSTRAINT unique_draft_per_user_item UNIQUE(inventory_item_id, counted_by)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_lot_drafts_item ON inventario.lot_counting_drafts(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_lot_drafts_user ON inventario.lot_counting_drafts(counted_by);
CREATE INDEX IF NOT EXISTS idx_lot_drafts_updated ON inventario.lot_counting_drafts(updated_at DESC);

-- Comentários
COMMENT ON TABLE inventario.lot_counting_drafts IS 'Rascunhos de contagem de lotes - persiste dados mesmo com limpeza do navegador';
COMMENT ON COLUMN inventario.lot_counting_drafts.draft_data IS 'Dados dos lotes em formato JSON: [{lot_number, counted_qty, system_qty, expiry_date}]';