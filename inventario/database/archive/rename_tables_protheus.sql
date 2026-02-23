-- =================================
-- RENOMEAÇÃO DE TABELAS PARA NOMENCLATURA PROTHEUS EXATA
-- =================================
-- Data: 2025-07-29
-- Objetivo: Padronizar nomes das tabelas seguindo exatamente a nomenclatura do ERP Protheus
-- 
-- MAPEAMENTO:
-- products         -> SB1010 (Cadastro de Produtos)
-- sb2010          -> SB2010 (já correto)
-- sb8010          -> SB8010 (já correto)  
-- product_barcodes -> SLK010 (Códigos de Barras)
-- product_stores   -> SBZ010 (Parâmetros por Filial)
-- product_prices   -> DA1010 (Tabela de Preços)
-- =================================

BEGIN;

-- =================================
-- RENOMEAR TABELAS PRINCIPAIS
-- =================================

-- 1. products -> SB1010
ALTER TABLE inventario.products RENAME TO SB1010;

-- 2. product_barcodes -> SLK010
ALTER TABLE inventario.product_barcodes RENAME TO SLK010;

-- 3. product_stores -> SBZ010  
ALTER TABLE inventario.product_stores RENAME TO SBZ010;

-- 4. product_prices -> DA1010
ALTER TABLE inventario.product_prices RENAME TO DA1010;

-- =================================
-- RENOMEAR VIEWS RELACIONADAS
-- =================================

-- Views de códigos de barras
DROP VIEW IF EXISTS inventario.product_barcodes_with_details;
CREATE VIEW inventario.SLK010_with_details AS
SELECT 
    slk.id,
    slk.slk_filial,
    slk.slk_codbar,
    slk.slk_produto,
    slk.is_active,
    slk.created_at,
    slk.updated_at,
    
    -- Dados do produto SB1010
    sb1.name as product_name,
    sb1.description as product_description,
    sb1.category as product_category,
    sb1.code as sb1_cod,
    
    -- Dados da loja
    s.name as store_name,
    s.code as store_code
    
FROM inventario.SLK010 slk
JOIN inventario.SB1010 sb1 ON slk.product_id = sb1.id
JOIN inventario.stores s ON slk.store_id = s.id;

-- Views de preços
DROP VIEW IF EXISTS inventario.product_prices_with_details;
CREATE VIEW inventario.DA1010_with_details AS
SELECT 
    da1.id,
    da1.da1_filial,
    da1.da1_item,
    da1.da1_codtab,
    da1.da1_codpro,
    da1.da1_prcven,
    da1.da1_xupd,
    da1.is_active,
    da1.created_at,
    da1.updated_at,
    
    -- Dados do produto SB1010
    sb1.name as product_name,
    sb1.category as product_group,
    sb1.category as product_category,
    sb1.cost_price as product_cost,
    
    -- Dados da loja
    s.name as store_name,
    s.description as store_description,
    
    -- Cálculos
    CASE 
        WHEN sb1.cost_price > 0 THEN ROUND(((da1.da1_prcven - sb1.cost_price) / sb1.cost_price) * 100, 2)
        ELSE 0
    END as margin_percentage,
    
    CASE
        WHEN da1.da1_codtab = '001' THEN 'Tabela Padrão'
        WHEN da1.da1_codtab = '002' THEN 'Tabela Promocional'
        WHEN da1.da1_codtab = '003' THEN 'Tabela Atacado'
        ELSE CONCAT('Tabela ', da1.da1_codtab)
    END as table_description
    
FROM inventario.DA1010 da1
JOIN inventario.SB1010 sb1 ON da1.product_id = sb1.id
JOIN inventario.stores s ON da1.store_id = s.id;

-- Views de parâmetros por filial
DROP VIEW IF EXISTS inventario.product_locations_with_details;
CREATE VIEW inventario.SBZ010_with_details AS
SELECT 
    sbz.id,
    sbz.bz_filial,
    sbz.bz_cod,
    sbz.bz_locpad,
    sbz.bz_tipo,
    sbz.bz_ucom,
    sbz.bz_tipconv,
    sbz.bz_conv,
    sbz.bz_peso,
    sbz.bz_pesbru,
    sbz.bz_desc,
    sbz.bz_grupo,
    sbz.bz_grtrib,
    sbz.bz_origem,
    sbz.bz_codiss,
    sbz.bz_clasfis,
    sbz.bz_picm,
    sbz.bz_ipi,
    sbz.bz_markup,
    sbz.is_active,
    sbz.created_at,
    sbz.updated_at,
    
    -- Dados do produto SB1010
    sb1.name as product_name,
    sb1.description as product_description,
    sb1.category as product_category,
    
    -- Dados da loja
    s.name as store_name,
    s.code as store_code
    
FROM inventario.SBZ010 sbz
JOIN inventario.SB1010 sb1 ON sbz.product_id = sb1.id
JOIN inventario.stores s ON sbz.store_id = s.id;

-- =================================
-- ATUALIZAR VIEWS EXISTENTES COM NOVAS REFERÊNCIAS
-- =================================

-- Recriar view de produtos completos
DROP VIEW IF EXISTS inventario.v_products_complete;
CREATE VIEW inventario.v_products_complete AS
SELECT 
    sb1.id,
    sb1.code as sb1_cod,
    sb1.name as sb1_desc,
    sb1.description as sb1_xdesc,
    sb1.category as sb1_grupo,
    sb1.unity_measure as sb1_um,
    sb1.cost_price as sb1_custd,
    sb1.sale_price as sb1_prv1,
    sb1.barcode as sb1_codbar,
    sb1.is_active as sb1_msblql,
    sb1.store_id,
    sb1.created_at,
    sb1.updated_at,
    
    -- Dados da loja
    s.name as store_name,
    s.code as store_code,
    
    -- Saldos SB2010
    sb2.b2_qatu as current_stock,
    sb2.b2_local as storage_location,
    
    -- Saldos por lote SB8010  
    sb8.b8_saldo as lot_balance,
    sb8.b8_lotectl as lot_control,
    sb8.b8_numlote as lot_number,
    
    -- Códigos de barras SLK010
    slk.slk_codigo_barras as additional_barcode,
    
    -- Parâmetros SBZ010
    sbz.bz_locpad as default_location,
    sbz.bz_tipo as product_type,
    
    -- Preços DA1010
    da1.da1_prcven as table_price,
    da1.da1_codtab as price_table
    
FROM inventario.SB1010 sb1
LEFT JOIN inventario.stores s ON sb1.store_id = s.id
LEFT JOIN inventario.SB2010 sb2 ON sb2.product_id = sb1.id
LEFT JOIN inventario.SB8010 sb8 ON sb8.product_id = sb1.id  
LEFT JOIN inventario.SLK010 slk ON slk.product_id = sb1.id
LEFT JOIN inventario.SBZ010 sbz ON sbz.product_id = sb1.id
LEFT JOIN inventario.DA1010 da1 ON da1.product_id = sb1.id AND da1.da1_codtab = '001';

-- View de produtos com saldos
DROP VIEW IF EXISTS inventario.v_products_with_balance;
CREATE VIEW inventario.v_products_with_balance AS
SELECT 
    sb1.id,
    sb1.code as sb1_cod,
    sb1.name as sb1_desc,
    sb1.category as sb1_grupo,
    sb1.store_id,
    s.code as store_code,
    s.name as store_name,
    sb2.b2_filial,
    sb2.b2_cod,
    sb2.b2_local,
    sb2.b2_qatu,
    sb2.b2_reserva,
    sb2.b2_qemp,
    sb2.is_active
FROM inventario.SB1010 sb1
JOIN inventario.stores s ON sb1.store_id = s.id
LEFT JOIN inventario.SB2010 sb2 ON sb2.product_id = sb1.id
WHERE sb1.is_active = true;

-- View de produtos com lotes
DROP VIEW IF EXISTS inventario.v_products_with_lots;  
CREATE VIEW inventario.v_products_with_lots AS
SELECT 
    sb1.id,
    sb1.code as sb1_cod,
    sb1.name as sb1_desc,
    sb1.category as sb1_grupo,
    sb1.store_id,
    s.code as store_code,
    s.name as store_name,
    sb8.b8_filial,
    sb8.b8_produto,
    sb8.b8_local,
    sb8.b8_lotectl,
    sb8.b8_numlote,
    sb8.b8_saldo,
    sb8.b8_dtvalid,
    sb8.is_active
FROM inventario.SB1010 sb1
JOIN inventario.stores s ON sb1.store_id = s.id
LEFT JOIN inventario.SB8010 sb8 ON sb8.product_id = sb1.id
WHERE sb1.is_active = true;

-- =================================
-- ATUALIZAR FOREIGN KEY CONSTRAINTS
-- =================================

-- Atualizar FKs em inventory_items
ALTER TABLE inventario.inventory_items 
DROP CONSTRAINT IF EXISTS fk_inventory_items_product;

ALTER TABLE inventario.inventory_items 
ADD CONSTRAINT fk_inventory_items_product 
FOREIGN KEY (product_id) REFERENCES inventario.SB1010(id) ON DELETE CASCADE;

-- Atualizar FKs em countings (se existir relação com produtos)
-- Verificar se existem outras tabelas que referenciam products

-- =================================
-- COMENTÁRIOS NAS TABELAS RENOMEADAS
-- =================================

COMMENT ON TABLE inventario.SB1010 IS 'Tabela SB1010 - Cadastro de Produtos (espelho Protheus)';
COMMENT ON TABLE inventario.SLK010 IS 'Tabela SLK010 - Códigos de Barras (espelho Protheus)';
COMMENT ON TABLE inventario.SBZ010 IS 'Tabela SBZ010 - Parâmetros por Filial (espelho Protheus)';
COMMENT ON TABLE inventario.DA1010 IS 'Tabela DA1010 - Tabela de Preços (espelho Protheus)';

-- =================================
-- LOG DA OPERAÇÃO
-- =================================

INSERT INTO inventario.system_logs (level, message, module, additional_data, created_at) VALUES
('INFO', 'Renomeação de tabelas para nomenclatura Protheus concluída', 'migration', 
 jsonb_build_object(
    'migration_version', 'v2.2_rename_protheus_tables',
    'tables_renamed', jsonb_build_array('products->SB1010', 'product_barcodes->SLK010', 'product_stores->SBZ010', 'product_prices->DA1010'),
    'views_updated', jsonb_build_array('SLK010_with_details', 'SBZ010_with_details', 'DA1010_with_details', 'v_products_complete', 'v_products_with_balance', 'v_products_with_lots'),
    'constraints_updated', true
 ), 
 CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;

COMMIT;

-- =================================
-- VALIDAÇÃO PÓS-MIGRAÇÃO
-- =================================

DO $$
DECLARE
    sb1_count INTEGER;
    slk_count INTEGER;
    sbz_count INTEGER;
    da1_count INTEGER;
BEGIN
    -- Verificar se todas as tabelas foram renomeadas
    SELECT COUNT(*) INTO sb1_count FROM information_schema.tables WHERE table_schema = 'inventario' AND table_name = 'sb1010';
    SELECT COUNT(*) INTO slk_count FROM information_schema.tables WHERE table_schema = 'inventario' AND table_name = 'slk010';
    SELECT COUNT(*) INTO sbz_count FROM information_schema.tables WHERE table_schema = 'inventario' AND table_name = 'sbz010';
    SELECT COUNT(*) INTO da1_count FROM information_schema.tables WHERE table_schema = 'inventario' AND table_name = 'da1010';
    
    RAISE NOTICE 'Validação da renomeação:';
    RAISE NOTICE '- SB1010 criada: %', sb1_count > 0;
    RAISE NOTICE '- SLK010 criada: %', slk_count > 0;
    RAISE NOTICE '- SBZ010 criada: %', sbz_count > 0;
    RAISE NOTICE '- DA1010 criada: %', da1_count > 0;
    
    IF sb1_count = 0 OR slk_count = 0 OR sbz_count = 0 OR da1_count = 0 THEN
        RAISE EXCEPTION 'Algumas tabelas não foram renomeadas corretamente';
    END IF;
    
    RAISE NOTICE 'Renomeação concluída com sucesso! Estrutura padronizada com Protheus.';
END $$;