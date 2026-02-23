-- =================================
-- MIGRAÇÃO: TABELA DE PREÇOS - ESPELHO TABELA DA1010 PROTHEUS
-- =================================
-- Data: 2025-01-29
-- Objetivo: Criar tabela de preços específicos por filial espelhando DA1010 do ERP Protheus
--
-- Campos DA1010 Protheus mapeados:
-- DA1_FILIAL  -> da1_filial (filial - EXCLUSIVO)
-- DA1_ITEM    -> da1_item (item/sequência)
-- DA1_CODTAB  -> da1_codtab (código da tabela de preço)
-- DA1_CODPRO  -> da1_codpro (código do produto - referência B1_COD)
-- DA1_PRCVEN  -> da1_prcven (preço de venda)
-- DA1_XUPD    -> da1_xupd (data de alteração)
-- =================================

BEGIN;

-- =================================
-- CRIAR TABELA DA1010 - TABELA DE PREÇOS
-- =================================
-- Espelho da tabela DA1010 do Protheus para preços específicos por filial (EXCLUSIVO)

CREATE TABLE inventario.product_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos espelho DA1010 Protheus
    da1_filial VARCHAR(10) NOT NULL,            -- DA1_FILIAL - Filial (EXCLUSIVO)
    da1_item VARCHAR(10) NOT NULL,              -- DA1_ITEM - Item/Sequência
    da1_codtab VARCHAR(10) NOT NULL,            -- DA1_CODTAB - Código da Tabela de Preço
    da1_codpro VARCHAR(50) NOT NULL,            -- DA1_CODPRO - Código do Produto (B1_COD)
    da1_prcven DECIMAL(15,4) NOT NULL,          -- DA1_PRCVEN - Preço de Venda
    da1_xupd DATE,                              -- DA1_XUPD - Data de Alteração
    
    -- Campos de controle local
    product_id UUID NOT NULL,                   -- Referência para tabela products
    store_id UUID NOT NULL,                     -- Referência para stores
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_product_prices_product FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_prices_store FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE,
    CONSTRAINT uk_product_prices_filial_codtab_codpro UNIQUE (da1_filial, da1_codtab, da1_codpro),
    CONSTRAINT chk_product_prices_prcven CHECK (da1_prcven >= 0)
);

-- Criar índices para DA1010
CREATE INDEX idx_product_prices_da1_filial ON inventario.product_prices(da1_filial);
CREATE INDEX idx_product_prices_da1_codtab ON inventario.product_prices(da1_codtab);
CREATE INDEX idx_product_prices_da1_codpro ON inventario.product_prices(da1_codpro);
CREATE INDEX idx_product_prices_da1_prcven ON inventario.product_prices(da1_prcven);
CREATE INDEX idx_product_prices_da1_xupd ON inventario.product_prices(da1_xupd) WHERE da1_xupd IS NOT NULL;
CREATE INDEX idx_product_prices_product_id ON inventario.product_prices(product_id);
CREATE INDEX idx_product_prices_store_id ON inventario.product_prices(store_id);
CREATE INDEX idx_product_prices_active ON inventario.product_prices(is_active);

-- Índices compostos para consultas frequentes
CREATE INDEX idx_product_prices_store_codtab ON inventario.product_prices(store_id, da1_codtab);
CREATE INDEX idx_product_prices_store_codpro ON inventario.product_prices(store_id, da1_codpro);
CREATE INDEX idx_product_prices_codtab_codpro ON inventario.product_prices(da1_codtab, da1_codpro);
CREATE INDEX idx_product_prices_filial_codtab ON inventario.product_prices(da1_filial, da1_codtab);
CREATE INDEX idx_product_prices_filial_codpro ON inventario.product_prices(da1_filial, da1_codpro);

-- Comentários na tabela DA1010
COMMENT ON TABLE inventario.product_prices IS 'Tabela de Preços - Estrutura espelho da tabela DA1010 do Protheus ERP (EXCLUSIVO)';
COMMENT ON COLUMN inventario.product_prices.da1_filial IS 'DA1_FILIAL - Filial (código da loja) - EXCLUSIVO';
COMMENT ON COLUMN inventario.product_prices.da1_item IS 'DA1_ITEM - Item/Sequência na tabela de preço';
COMMENT ON COLUMN inventario.product_prices.da1_codtab IS 'DA1_CODTAB - Código da Tabela de Preço';
COMMENT ON COLUMN inventario.product_prices.da1_codpro IS 'DA1_CODPRO - Código do Produto (referência B1_COD)';
COMMENT ON COLUMN inventario.product_prices.da1_prcven IS 'DA1_PRCVEN - Preço de Venda';
COMMENT ON COLUMN inventario.product_prices.da1_xupd IS 'DA1_XUPD - Data de Alteração';
COMMENT ON COLUMN inventario.product_prices.product_id IS 'Referência interna para tabela products';
COMMENT ON COLUMN inventario.product_prices.store_id IS 'Referência interna para tabela stores';

-- =================================
-- DADOS DE EXEMPLO - TABELAS DE PREÇO PADRÃO
-- =================================

-- Inserir alguns preços de exemplo após verificar existência de produtos
DO $$
DECLARE
    store_record RECORD;
    product_record RECORD;
    item_counter INTEGER := 1;
BEGIN
    -- Para cada loja ativa
    FOR store_record IN SELECT id, code FROM inventario.stores WHERE is_active = true LOOP
        -- Para cada produto ativo da loja
        FOR product_record IN 
            SELECT id, code, sale_price 
            FROM inventario.products 
            WHERE store_id = store_record.id 
            AND is_active = true 
            AND code IS NOT NULL 
            LIMIT 10 -- Limitar a 10 produtos por loja para exemplo
        LOOP
            -- Tabela de preço padrão (001)
            INSERT INTO inventario.product_prices (
                da1_filial, da1_item, da1_codtab, da1_codpro, da1_prcven, da1_xupd,
                product_id, store_id, is_active, created_at
            ) VALUES (
                store_record.code,
                LPAD(item_counter::text, 4, '0'),
                '001',
                product_record.code,
                COALESCE(product_record.sale_price, 0.00),
                CURRENT_DATE,
                product_record.id,
                store_record.id,
                true,
                CURRENT_TIMESTAMP
            ) ON CONFLICT (da1_filial, da1_codtab, da1_codpro) DO NOTHING;
            
            -- Tabela de preço promocional (002) - 10% desconto
            INSERT INTO inventario.product_prices (
                da1_filial, da1_item, da1_codtab, da1_codpro, da1_prcven, da1_xupd,
                product_id, store_id, is_active, created_at
            ) VALUES (
                store_record.code,
                LPAD((item_counter + 1000)::text, 4, '0'),
                '002',
                product_record.code,
                ROUND(COALESCE(product_record.sale_price, 0.00) * 0.9, 2),
                CURRENT_DATE,
                product_record.id,
                store_record.id,
                true,
                CURRENT_TIMESTAMP
            ) ON CONFLICT (da1_filial, da1_codtab, da1_codpro) DO NOTHING;
            
            item_counter := item_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Preços de exemplo criados para todas as lojas ativas';
END $$;

-- =================================
-- VIEW DE PREÇOS COM PRODUTOS
-- =================================

CREATE VIEW inventario.product_prices_with_details AS
SELECT 
    pp.id,
    pp.da1_filial,
    pp.da1_item,
    pp.da1_codtab,
    pp.da1_codpro,
    pp.da1_prcven,
    pp.da1_xupd,
    pp.is_active,
    pp.created_at,
    pp.updated_at,
    
    -- Dados do produto
    p.name as product_name,
    p.category as product_group,
    p.category as product_category,
    p.cost_price as product_cost,
    
    -- Dados da loja
    s.name as store_name,
    s.description as store_description,
    
    -- Cálculos
    CASE 
        WHEN p.cost_price > 0 THEN ROUND(((pp.da1_prcven - p.cost_price) / p.cost_price) * 100, 2)
        ELSE 0
    END as margin_percentage,
    
    CASE
        WHEN pp.da1_codtab = '001' THEN 'Tabela Padrão'
        WHEN pp.da1_codtab = '002' THEN 'Tabela Promocional'
        WHEN pp.da1_codtab = '003' THEN 'Tabela Atacado'
        ELSE CONCAT('Tabela ', pp.da1_codtab)
    END as table_description
    
FROM inventario.product_prices pp
JOIN inventario.products p ON pp.product_id = p.id
JOIN inventario.stores s ON pp.store_id = s.id;

-- Comentário na view
COMMENT ON VIEW inventario.product_prices_with_details IS 'View com detalhes completos de preços, produtos e lojas';

-- Log da migração
INSERT INTO inventario.system_logs (level, message, module, additional_data, created_at) VALUES
('INFO', 'Migração DA1010: Tabela de preços criada com sucesso', 'migration', 
 jsonb_build_object(
    'migration_version', 'v2.1_da1010_prices',
    'table_created', 'product_prices',
    'view_created', 'product_prices_with_details',
    'indexes_created', 13,
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
    table_count INTEGER;
    index_count INTEGER;
    sample_count INTEGER;
BEGIN
    -- Verificar se tabela foi criada
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'inventario' 
    AND table_name = 'product_prices';
    
    IF table_count = 0 THEN
        RAISE EXCEPTION 'Tabela product_prices não foi criada';
    END IF;
    
    -- Verificar índices
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'inventario' 
    AND tablename = 'product_prices';
    
    -- Verificar dados de exemplo
    SELECT COUNT(*) INTO sample_count
    FROM inventario.product_prices;
    
    RAISE NOTICE 'Migração DA1010 concluída com sucesso:';
    RAISE NOTICE '- Tabela product_prices criada: %', table_count > 0;
    RAISE NOTICE '- Índices criados: %', index_count;
    RAISE NOTICE '- Registros de exemplo: %', sample_count;
    RAISE NOTICE '- View product_prices_with_details criada';
    
END $$;