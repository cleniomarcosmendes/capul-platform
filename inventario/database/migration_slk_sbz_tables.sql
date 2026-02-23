-- =================================
-- MIGRAÇÃO: TABELAS SLK010 e SBZ010 
-- =================================
-- Data: 2025-01-29
-- Objetivo: Criar tabelas SLK010 (Códigos de Barras) e SBZ010 (Localização)
-- =================================

BEGIN;

-- =================================
-- TABELA SLK010 - CÓDIGOS DE BARRAS (COMPARTILHADO)
-- =================================

CREATE TABLE inventario.product_barcodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos espelho SLK010 Protheus
    slk_filial VARCHAR(10) NOT NULL,            -- SLK_FILIAL - Filial
    slk_codbar VARCHAR(50) NOT NULL,            -- SLK_CODBAR - Código de Barras
    slk_produto VARCHAR(50) NOT NULL,           -- SLK_PRODUTO - Código do Produto (B1_COD)
    
    -- Campos de controle local
    product_id UUID NOT NULL,
    store_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_product_barcodes_product FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_barcodes_store FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE,
    CONSTRAINT uk_product_barcodes_codbar UNIQUE (slk_codbar)
);

-- Índices para SLK010
CREATE INDEX idx_product_barcodes_slk_filial ON inventario.product_barcodes(slk_filial);
CREATE INDEX idx_product_barcodes_slk_codbar ON inventario.product_barcodes(slk_codbar);
CREATE INDEX idx_product_barcodes_slk_produto ON inventario.product_barcodes(slk_produto);
CREATE INDEX idx_product_barcodes_product_id ON inventario.product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_store_id ON inventario.product_barcodes(store_id);
CREATE INDEX idx_product_barcodes_active ON inventario.product_barcodes(is_active);

-- Índices compostos
CREATE INDEX idx_product_barcodes_filial_produto ON inventario.product_barcodes(slk_filial, slk_produto);
CREATE INDEX idx_product_barcodes_store_produto ON inventario.product_barcodes(store_id, slk_produto);

-- Trigger para updated_at
CREATE TRIGGER update_product_barcodes_updated_at BEFORE UPDATE ON inventario.product_barcodes
    FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();

-- =================================
-- TABELA SBZ010 - LOCALIZAÇÃO/ENDEREÇO (EXCLUSIVO POR FILIAL)
-- =================================

CREATE TABLE inventario.product_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos espelho SBZ010 Protheus
    bz_filial VARCHAR(10) NOT NULL,             -- BZ_FILIAL - Filial (EXCLUSIVO)
    bz_cod VARCHAR(50) NOT NULL,                -- BZ_COD - Código do Produto (B1_COD)
    bz_local VARCHAR(10),                       -- BZ_LOCAL - Local de armazenagem
    bz_xlocal1 VARCHAR(50),                     -- BZ_XLOCAL1 - Localização 1 (corredor)
    bz_xlocal2 VARCHAR(50),                     -- BZ_XLOCAL2 - Localização 2 (prateleira)
    bz_xlocal3 VARCHAR(50),                     -- BZ_XLOCAL3 - Localização 3 (nível)
    
    -- Campos de controle local
    product_id UUID NOT NULL,
    store_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_product_stores_product FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_stores_store FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE,
    CONSTRAINT uk_product_stores_filial_cod UNIQUE (bz_filial, bz_cod)
);

-- Índices para SBZ010
CREATE INDEX idx_product_stores_bz_filial ON inventario.product_stores(bz_filial);
CREATE INDEX idx_product_stores_bz_cod ON inventario.product_stores(bz_cod);
CREATE INDEX idx_product_stores_bz_local ON inventario.product_stores(bz_local);
CREATE INDEX idx_product_stores_bz_xlocal1 ON inventario.product_stores(bz_xlocal1);
CREATE INDEX idx_product_stores_bz_xlocal2 ON inventario.product_stores(bz_xlocal2);
CREATE INDEX idx_product_stores_bz_xlocal3 ON inventario.product_stores(bz_xlocal3);
CREATE INDEX idx_product_stores_product_id ON inventario.product_stores(product_id);
CREATE INDEX idx_product_stores_store_id ON inventario.product_stores(store_id);
CREATE INDEX idx_product_stores_active ON inventario.product_stores(is_active);

-- Índices compostos
CREATE INDEX idx_product_stores_filial_cod ON inventario.product_stores(bz_filial, bz_cod);
CREATE INDEX idx_product_stores_store_cod ON inventario.product_stores(store_id, bz_cod);
CREATE INDEX idx_product_stores_local_xlocal1 ON inventario.product_stores(bz_local, bz_xlocal1);

-- Trigger para updated_at
CREATE TRIGGER update_product_stores_updated_at BEFORE UPDATE ON inventario.product_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();

-- =================================
-- VIEWS PARA FACILITAR CONSULTAS
-- =================================

-- View com códigos de barras e produtos
CREATE VIEW inventario.product_barcodes_with_details AS
SELECT 
    pb.id,
    pb.slk_filial,
    pb.slk_codbar,
    pb.slk_produto,
    pb.is_active,
    pb.created_at,
    
    -- Dados do produto
    p.name as product_name,
    p.category as product_category,
    p.unit as product_unit,
    
    -- Dados da loja
    s.code as store_code,
    s.name as store_name
    
FROM inventario.product_barcodes pb
JOIN inventario.products p ON pb.product_id = p.id
JOIN inventario.stores s ON pb.store_id = s.id;

-- View com localizações e produtos
CREATE VIEW inventario.product_locations_with_details AS
SELECT 
    ps.id,
    ps.bz_filial,
    ps.bz_cod,
    ps.bz_local,
    ps.bz_xlocal1,
    ps.bz_xlocal2,
    ps.bz_xlocal3,
    ps.is_active,
    ps.created_at,
    
    -- Dados do produto
    p.name as product_name,
    p.category as product_category,
    p.unit as product_unit,
    
    -- Dados da loja
    s.code as store_code,
    s.name as store_name,
    
    -- Endereço completo
    CONCAT_WS(' - ', ps.bz_local, ps.bz_xlocal1, ps.bz_xlocal2, ps.bz_xlocal3) as full_address
    
FROM inventario.product_stores ps
JOIN inventario.products p ON ps.product_id = p.id
JOIN inventario.stores s ON ps.store_id = s.id;

-- =================================
-- COMENTÁRIOS NAS TABELAS
-- =================================

COMMENT ON TABLE inventario.product_barcodes IS 'Códigos de Barras - Estrutura espelho da tabela SLK010 do Protheus ERP (COMPARTILHADO)';
COMMENT ON COLUMN inventario.product_barcodes.slk_filial IS 'SLK_FILIAL - Filial';
COMMENT ON COLUMN inventario.product_barcodes.slk_codbar IS 'SLK_CODBAR - Código de Barras';
COMMENT ON COLUMN inventario.product_barcodes.slk_produto IS 'SLK_PRODUTO - Código do Produto (B1_COD)';

COMMENT ON TABLE inventario.product_stores IS 'Localização/Endereçamento - Estrutura espelho da tabela SBZ010 do Protheus ERP (EXCLUSIVO)';
COMMENT ON COLUMN inventario.product_stores.bz_filial IS 'BZ_FILIAL - Filial (EXCLUSIVO)';
COMMENT ON COLUMN inventario.product_stores.bz_cod IS 'BZ_COD - Código do Produto (B1_COD)';
COMMENT ON COLUMN inventario.product_stores.bz_local IS 'BZ_LOCAL - Local de armazenagem';
COMMENT ON COLUMN inventario.product_stores.bz_xlocal1 IS 'BZ_XLOCAL1 - Localização 1 (corredor)';
COMMENT ON COLUMN inventario.product_stores.bz_xlocal2 IS 'BZ_XLOCAL2 - Localização 2 (prateleira)';
COMMENT ON COLUMN inventario.product_stores.bz_xlocal3 IS 'BZ_XLOCAL3 - Localização 3 (nível)';

-- =================================
-- DADOS DE EXEMPLO
-- =================================

-- Inserir códigos de barras de exemplo
DO $$
DECLARE
    store_record RECORD;
    product_record RECORD;
BEGIN
    -- Para cada loja ativa
    FOR store_record IN SELECT id, code FROM inventario.stores WHERE is_active = true LOOP
        -- Para cada produto ativo da loja (limitado a 5 para exemplo)
        FOR product_record IN 
            SELECT id, code, name 
            FROM inventario.products 
            WHERE store_id = store_record.id 
            AND is_active = true 
            AND code IS NOT NULL 
            LIMIT 5
        LOOP
            -- Código de barras EAN-13 simulado
            INSERT INTO inventario.product_barcodes (
                slk_filial, slk_codbar, slk_produto,
                product_id, store_id, is_active, created_at
            ) VALUES (
                store_record.code,
                '789' || LPAD((RANDOM() * 9999999999)::BIGINT::TEXT, 10, '0'),
                product_record.code,
                product_record.id,
                store_record.id,
                true,
                CURRENT_TIMESTAMP
            ) ON CONFLICT DO NOTHING;
            
            -- Localização de exemplo
            INSERT INTO inventario.product_stores (
                bz_filial, bz_cod, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3,
                product_id, store_id, is_active, created_at
            ) VALUES (
                store_record.code,
                product_record.code,
                '01',
                'C' || LPAD((RANDOM() * 99 + 1)::INTEGER::TEXT, 2, '0'),
                'P' || LPAD((RANDOM() * 99 + 1)::INTEGER::TEXT, 2, '0'),
                'N' || LPAD((RANDOM() * 9 + 1)::INTEGER::TEXT, 1, '0'),
                product_record.id,
                store_record.id,
                true,
                CURRENT_TIMESTAMP
            ) ON CONFLICT DO NOTHING;
            
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Códigos de barras e localizações de exemplo criados';
END $$;

-- =================================
-- PERMISSÕES
-- =================================

-- Conceder permissões ao role da aplicação
GRANT ALL PRIVILEGES ON inventario.product_barcodes TO inventario_app;
GRANT ALL PRIVILEGES ON inventario.product_stores TO inventario_app;

-- Permissões nas views
GRANT SELECT ON inventario.product_barcodes_with_details TO inventario_app;
GRANT SELECT ON inventario.product_locations_with_details TO inventario_app;

-- Log da migração
INSERT INTO inventario.system_logs (level, message, module, additional_data, created_at) VALUES
('INFO', 'Migração SLK010/SBZ010: Tabelas de códigos de barras e localização criadas', 'migration', 
 jsonb_build_object(
    'migration_version', 'v2.2_slk_sbz_tables',
    'tables_created', jsonb_build_array('product_barcodes', 'product_stores'),
    'views_created', jsonb_build_array('product_barcodes_with_details', 'product_locations_with_details'),
    'sample_data', 'inserted'
 ), 
 CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;

COMMIT;

-- =================================
-- VALIDAÇÃO PÓS-MIGRAÇÃO
-- =================================

-- Verificar se migração foi bem-sucedida
DO $$
DECLARE
    barcodes_count INTEGER;
    locations_count INTEGER;
    barcodes_indexes INTEGER;
    locations_indexes INTEGER;
BEGIN
    -- Verificar se tabelas foram criadas
    SELECT COUNT(*) INTO barcodes_count 
    FROM information_schema.tables 
    WHERE table_schema = 'inventario' 
    AND table_name = 'product_barcodes';
    
    SELECT COUNT(*) INTO locations_count
    FROM information_schema.tables 
    WHERE table_schema = 'inventario' 
    AND table_name = 'product_stores';
    
    IF barcodes_count = 0 OR locations_count = 0 THEN
        RAISE EXCEPTION 'Tabelas não foram criadas';
    END IF;
    
    -- Verificar índices
    SELECT COUNT(*) INTO barcodes_indexes
    FROM pg_indexes 
    WHERE schemaname = 'inventario' 
    AND tablename = 'product_barcodes';
    
    SELECT COUNT(*) INTO locations_indexes
    FROM pg_indexes 
    WHERE schemaname = 'inventario' 
    AND tablename = 'product_stores';
    
    RAISE NOTICE 'Migração SLK010/SBZ010 concluída com sucesso:';
    RAISE NOTICE '- Tabela product_barcodes criada: %', barcodes_count > 0;
    RAISE NOTICE '- Tabela product_stores criada: %', locations_count > 0;
    RAISE NOTICE '- Índices product_barcodes: %', barcodes_indexes;
    RAISE NOTICE '- Índices product_stores: %', locations_indexes;
    RAISE NOTICE '- Views criadas: product_barcodes_with_details, product_locations_with_details';
    
END $$;