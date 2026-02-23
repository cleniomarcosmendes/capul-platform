-- Adicionar campo location na tabela inventory_items
-- Este campo mapeia para SB2010.B2_LOCAL (armazém/almoxarifado)

ALTER TABLE inventario.inventory_items 
ADD COLUMN IF NOT EXISTS location VARCHAR(10);

COMMENT ON COLUMN inventario.inventory_items.location IS 'Localização/Armazém do produto (SB2010.B2_LOCAL)';

-- Adicionar campo para controle de lote na tabela products
ALTER TABLE inventario.products
ADD COLUMN IF NOT EXISTS b2_lote VARCHAR(1);

COMMENT ON COLUMN inventario.products.b2_lote IS 'Controle de lote (SB2010.B2_LOTE) - S=Sim, N=Não';