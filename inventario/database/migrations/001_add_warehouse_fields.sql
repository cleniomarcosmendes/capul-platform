-- Migration: Adicionar campos de armazém e saldo para rastreabilidade
-- Data: 2025-01-14
-- Objetivo: Gravar o armazém e saldo (B2_QATU) no momento da criação do inventário

-- 1. Adicionar campo warehouse na tabela inventory_lists
-- Este campo grava o armazém selecionado durante a criação do inventário
ALTER TABLE inventario.inventory_lists 
ADD COLUMN IF NOT EXISTS warehouse VARCHAR(2) NOT NULL DEFAULT '01';

COMMENT ON COLUMN inventario.inventory_lists.warehouse IS 'Armazém do inventário (B2_LOCAL do Protheus)';

-- 2. Adicionar campos na tabela inventory_items
-- b2_qatu: Saldo do produto no momento da inclusão no inventário
-- warehouse: Armazém do produto (para garantir rastreabilidade)
ALTER TABLE inventario.inventory_items 
ADD COLUMN IF NOT EXISTS b2_qatu DECIMAL(15,4) DEFAULT 0.0000;

ALTER TABLE inventario.inventory_items 
ADD COLUMN IF NOT EXISTS warehouse VARCHAR(2) NOT NULL DEFAULT '01';

COMMENT ON COLUMN inventario.inventory_items.b2_qatu IS 'Saldo do produto (B2_QATU) no momento da inclusão no inventário';
COMMENT ON COLUMN inventario.inventory_items.warehouse IS 'Armazém do produto (B2_LOCAL) para rastreabilidade';

-- 3. Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_inventory_lists_warehouse ON inventario.inventory_lists(warehouse);
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse ON inventario.inventory_items(warehouse);

-- 4. Atualizar registros existentes com valores padrão (se necessário)
-- Atualiza inventory_lists existentes sem warehouse definido
UPDATE inventario.inventory_lists 
SET warehouse = '01' 
WHERE warehouse IS NULL OR warehouse = '';

-- Atualiza inventory_items existentes sem warehouse definido
UPDATE inventario.inventory_items 
SET warehouse = '01' 
WHERE warehouse IS NULL OR warehouse = '';

-- Atualiza b2_qatu com o expected_quantity para registros existentes
UPDATE inventario.inventory_items 
SET b2_qatu = COALESCE(expected_quantity, 0.0000)
WHERE b2_qatu IS NULL;

-- 5. Remover defaults após migration (opcional - executar manualmente depois)
-- ALTER TABLE inventario.inventory_lists ALTER COLUMN warehouse DROP DEFAULT;
-- ALTER TABLE inventario.inventory_items ALTER COLUMN warehouse DROP DEFAULT;

-- Verificar estrutura após migration
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'inventario' 
-- AND table_name IN ('inventory_lists', 'inventory_items')
-- AND column_name IN ('warehouse', 'b2_qatu')
-- ORDER BY table_name, column_name;