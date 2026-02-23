-- Corrigir conceito de inventário
-- Inventário deve ser por LOCAL/ARMAZÉM

-- 1. Adicionar campo LOCAL na tabela inventory_lists
ALTER TABLE inventario.inventory_lists 
ADD COLUMN IF NOT EXISTS warehouse_location VARCHAR(10);

COMMENT ON COLUMN inventario.inventory_lists.warehouse_location IS 'Local/Armazém do inventário (B2_LOCAL/B8_LOCAL)';

-- 2. Remover campos incorretos que adicionei
ALTER TABLE inventario.products DROP COLUMN IF EXISTS b2_lote;
ALTER TABLE inventario.inventory_items DROP COLUMN IF EXISTS location;

-- 3. O campo location correto já existe em countings (onde o operador confirma o local durante a contagem)

-- 4. Criar view para buscar saldos da SB2010 (produtos sem lote)
CREATE OR REPLACE VIEW inventario.v_product_balances AS
SELECT 
    b2_filial as filial,
    b2_cod as product_code,
    b2_local as warehouse_location,
    b2_qatu as current_quantity,
    b2_reserva as reserved_quantity,
    b2_qemp as committed_quantity,
    (b2_qatu - b2_reserva - b2_qemp) as available_quantity
FROM inventario.sb2010
WHERE b2_filial = '01';  -- Ajustar conforme necessário

-- 5. Criar view para buscar saldos da SB8010 (produtos com lote)
CREATE OR REPLACE VIEW inventario.v_lot_balances AS
SELECT 
    b8_filial as filial,
    b8_produto as product_code,
    b8_local as warehouse_location,
    b8_lotectl as lot_number,
    b8_numlote as lot_sequence,
    b8_saldo as current_quantity,
    b8_dtvalid as expiry_date
FROM inventario.sb8010
WHERE b8_filial = '01' AND b8_saldo > 0;

COMMENT ON VIEW inventario.v_product_balances IS 'Saldos de produtos sem controle de lote por local/armazém (SB2010)';
COMMENT ON VIEW inventario.v_lot_balances IS 'Saldos de produtos com controle de lote por local/armazém (SB8010)';