-- =================================
-- MIGRAÇÃO: REESTRUTURAÇÃO PRODUTOS - ESPELHO TABELA SB1 PROTHEUS
-- =================================
-- Data: 2025-01-28
-- Objetivo: Adaptar estrutura de produtos para espelhar tabela SB1 do ERP Protheus
--
-- Campos SB1 Protheus mapeados:
-- B1_FILIAL   -> store_id (já existe - configurado como compartilhado)
-- B1_COD      -> b1_cod (código do produto)
-- B1_DESC     -> b1_desc (descrição)
-- B1_LOCPAD   -> b1_locpad (armazém padrão)
-- B1_GRUPO    -> b1_grupo (grupo)
-- B1_XCATGOR  -> b1_xcatgor (categoria)
-- B1_XSUBCAT  -> b1_xsubcat (subcategoria)
-- B1_XSEGMEN  -> b1_xsegmen (segmento)
-- B1_RASTRO   -> b1_rastro (controle de rastreabilidade)
-- B1_CODBAR   -> b1_codbar (código de barras)
-- B1_UM       -> b1_um (unidade de medida)
--
-- Tabela SLK010 Protheus mapeada para product_barcodes:
-- SLK_FILIAL  -> store_id (filial)
-- SLK_CODBAR  -> barcode (código de barras)
-- SLK_PRODUTO -> product_code (código do produto)
--
-- Tabela SBZ010 Protheus mapeada para product_stores:
-- BZ_FILIAL   -> store_id (filial - EXCLUSIVO)
-- BZ_COD      -> product_code (código do produto)
-- BZ_XLOCLIZ1 -> localizacao_1 (localização 1)
-- BZ_XLOCLIZ2 -> localizacao_2 (localização 2)
-- BZ_XLOCLIZ3 -> localizacao_3 (localização 3)
-- =================================

BEGIN;

-- Criar tabela temporária com nova estrutura
CREATE TABLE products_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos originais mantidos para compatibilidade
    code VARCHAR(50) NOT NULL,              -- Mapeado de B1_COD (compatibilidade)
    name VARCHAR(200) NOT NULL,             -- Mapeado de B1_DESC (compatibilidade)
    description TEXT,                       -- Campo adicional local
    unit VARCHAR(10) NOT NULL DEFAULT 'UN', -- Campo local
    cost_price DECIMAL(15,4),               -- Campo local
    sale_price DECIMAL(15,4),               -- Campo local
    current_stock DECIMAL(15,4) DEFAULT 0,  -- Campo local
    is_active BOOLEAN NOT NULL DEFAULT true, -- Campo local
    
    -- NOVOS CAMPOS - ESPELHO TABELA SB1 PROTHEUS
    -- B1_FILIAL é mapeado para store_id (já existe)
    b1_cod VARCHAR(50) NOT NULL,            -- B1_COD - Código do Produto no Protheus
    b1_desc VARCHAR(200) NOT NULL,          -- B1_DESC - Descrição no Protheus
    b1_locpad VARCHAR(10),                  -- B1_LOCPAD - Armazém Padrão
    b1_grupo VARCHAR(20),                   -- B1_GRUPO - Grupo do Produto
    b1_xcatgor VARCHAR(50),                 -- B1_XCATGOR - Categoria
    b1_xsubcat VARCHAR(50),                 -- B1_XSUBCAT - SubCategoria
    b1_xsegmen VARCHAR(50),                 -- B1_XSEGMEN - Segmento
    b1_rastro VARCHAR(1) DEFAULT 'N',       -- B1_RASTRO - Rastro (S/N)
    b1_codbar VARCHAR(50),                  -- B1_CODBAR - Código de Barras
    b1_um VARCHAR(10) DEFAULT 'UN',         -- B1_UM - Unidade de Medida
    
    -- Campos de controle
    store_id UUID NOT NULL REFERENCES stores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints atualizadas
    CONSTRAINT uk_products_new_b1cod_store UNIQUE (b1_cod, store_id),
    CONSTRAINT uk_products_new_codbar_store UNIQUE (b1_codbar, store_id),
    CONSTRAINT chk_products_new_rastro CHECK (b1_rastro IN ('S', 'N'))
);

-- Migrar dados existentes para nova estrutura
INSERT INTO products_new (
    id, code, name, description, unit, cost_price, sale_price, current_stock, is_active,
    b1_cod, b1_desc, b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen, b1_rastro, b1_codbar, b1_um,
    store_id, created_at, updated_at
)
SELECT 
    id,
    code,
    name,
    description,
    COALESCE(unit, 'UN'),
    cost_price,
    sale_price,
    current_stock,
    is_active,
    -- Mapeamento inicial dos novos campos baseado nos dados existentes
    code as b1_cod,                                    -- Código atual vira B1_COD
    name as b1_desc,                                   -- Nome atual vira B1_DESC
    '01' as b1_locpad,                                 -- Armazém padrão 01
    CASE 
        WHEN category IS NOT NULL THEN LEFT(category, 20)
        ELSE 'GERAL'
    END as b1_grupo,                                   -- Categoria atual vira grupo
    category as b1_xcatgor,                            -- Categoria atual
    NULL as b1_xsubcat,                                -- Subcategoria vazia inicialmente
    'GERAL' as b1_xsegmen,                            -- Segmento padrão
    CASE 
        WHEN has_serial = true OR has_lot = true THEN 'S'
        ELSE 'N'
    END as b1_rastro,                                  -- Rastro baseado em serial/lote
    barcode as b1_codbar,                              -- Código de barras atual
    COALESCE(unit, 'UN') as b1_um,                     -- Unidade de medida
    store_id,
    created_at,
    updated_at
FROM products;

-- Drop da tabela antiga e rename da nova
ALTER TABLE products RENAME TO products_old_backup;
ALTER TABLE products_new RENAME TO products;

-- =================================
-- CRIAR TABELA SLK010 - CÓDIGOS DE BARRAS
-- =================================
-- Espelho da tabela SLK010 do Protheus para múltiplos códigos de barras por produto

CREATE TABLE product_barcodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos espelho SLK010 Protheus
    slk_filial VARCHAR(10) NOT NULL,        -- SLK_FILIAL - Filial (código da loja)
    slk_codbar VARCHAR(50) NOT NULL,        -- SLK_CODBAR - Código de Barras
    slk_produto VARCHAR(50) NOT NULL,       -- SLK_PRODUTO - Código do Produto (B1_COD)
    
    -- Campos de controle local
    product_id UUID NOT NULL,               -- Referência para tabela products
    store_id UUID NOT NULL,                 -- Referência para stores
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_product_barcodes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_barcodes_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT uk_product_barcodes_codbar_filial UNIQUE (slk_codbar, slk_filial),
    CONSTRAINT chk_product_barcodes_codbar CHECK (LENGTH(slk_codbar) >= 8)
);

-- Migrar códigos de barras existentes para nova tabela
INSERT INTO product_barcodes (
    slk_filial, slk_codbar, slk_produto, product_id, store_id, is_active, created_at
)
SELECT 
    s.code as slk_filial,
    p.b1_codbar as slk_codbar,
    p.b1_cod as slk_produto,
    p.id as product_id,
    p.store_id,
    p.is_active,
    p.created_at
FROM products p
JOIN stores s ON s.id = p.store_id
WHERE p.b1_codbar IS NOT NULL 
  AND p.b1_codbar != '';

-- Criar índices para SLK010
CREATE INDEX idx_product_barcodes_slk_codbar ON product_barcodes(slk_codbar);
CREATE INDEX idx_product_barcodes_slk_produto ON product_barcodes(slk_produto);
CREATE INDEX idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_store_id ON product_barcodes(store_id);
CREATE INDEX idx_product_barcodes_filial ON product_barcodes(slk_filial);
CREATE INDEX idx_product_barcodes_active ON product_barcodes(is_active);

-- Índices compostos
CREATE INDEX idx_product_barcodes_store_produto ON product_barcodes(store_id, slk_produto);
CREATE INDEX idx_product_barcodes_store_codbar ON product_barcodes(store_id, slk_codbar);

-- Comentários na tabela SLK010
COMMENT ON TABLE product_barcodes IS 'Códigos de Barras - Estrutura espelho da tabela SLK010 do Protheus ERP';
COMMENT ON COLUMN product_barcodes.slk_filial IS 'SLK_FILIAL - Filial (código da loja)';
COMMENT ON COLUMN product_barcodes.slk_codbar IS 'SLK_CODBAR - Código de Barras';
COMMENT ON COLUMN product_barcodes.slk_produto IS 'SLK_PRODUTO - Código do Produto (referência B1_COD)';
COMMENT ON COLUMN product_barcodes.product_id IS 'Referência interna para tabela products';
COMMENT ON COLUMN product_barcodes.store_id IS 'Referência interna para tabela stores';

-- =================================
-- CRIAR TABELA SBZ010 - DADOS ESPECÍFICOS POR FILIAL
-- =================================
-- Espelho da tabela SBZ010 do Protheus para dados específicos por filial (EXCLUSIVO)

CREATE TABLE product_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos espelho SBZ010 Protheus
    bz_filial VARCHAR(10) NOT NULL,         -- BZ_FILIAL - Filial (EXCLUSIVO)
    bz_cod VARCHAR(50) NOT NULL,            -- BZ_COD - Código do Produto (B1_COD)
    bz_xlocliz1 VARCHAR(50),                -- BZ_XLOCLIZ1 - Localização 1
    bz_xlocliz2 VARCHAR(50),                -- BZ_XLOCLIZ2 - Localização 2
    bz_xlocliz3 VARCHAR(50),                -- BZ_XLOCLIZ3 - Localização 3
    
    -- Campos de controle local
    product_id UUID NOT NULL,               -- Referência para tabela products
    store_id UUID NOT NULL,                 -- Referência para stores
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_product_stores_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_stores_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT uk_product_stores_filial_cod UNIQUE (bz_filial, bz_cod),
    CONSTRAINT uk_product_stores_product_store UNIQUE (product_id, store_id)
);

-- Migrar dados existentes para SBZ010 (criar registros por produto/loja)
INSERT INTO product_stores (
    bz_filial, bz_cod, bz_xlocliz1, bz_xlocliz2, bz_xlocliz3, 
    product_id, store_id, is_active, created_at
)
SELECT 
    s.code as bz_filial,
    p.b1_cod as bz_cod,
    COALESCE(p.b1_locpad, '01') as bz_xlocliz1,  -- Usar armazém padrão como localização 1
    NULL as bz_xlocliz2,
    NULL as bz_xlocliz3,
    p.id as product_id,
    p.store_id,
    p.is_active,
    p.created_at
FROM products p
JOIN stores s ON s.id = p.store_id
WHERE p.b1_cod IS NOT NULL 
  AND p.b1_cod != '';

-- Criar índices para SBZ010
CREATE INDEX idx_product_stores_bz_filial ON product_stores(bz_filial);
CREATE INDEX idx_product_stores_bz_cod ON product_stores(bz_cod);
CREATE INDEX idx_product_stores_product_id ON product_stores(product_id);
CREATE INDEX idx_product_stores_store_id ON product_stores(store_id);
CREATE INDEX idx_product_stores_active ON product_stores(is_active);
CREATE INDEX idx_product_stores_xlocliz1 ON product_stores(bz_xlocliz1) WHERE bz_xlocliz1 IS NOT NULL;
CREATE INDEX idx_product_stores_xlocliz2 ON product_stores(bz_xlocliz2) WHERE bz_xlocliz2 IS NOT NULL;
CREATE INDEX idx_product_stores_xlocliz3 ON product_stores(bz_xlocliz3) WHERE bz_xlocliz3 IS NOT NULL;

-- Índices compostos
CREATE INDEX idx_product_stores_filial_cod ON product_stores(bz_filial, bz_cod);
CREATE INDEX idx_product_stores_store_product ON product_stores(store_id, product_id);

-- Comentários na tabela SBZ010
COMMENT ON TABLE product_stores IS 'Dados Específicos por Filial - Estrutura espelho da tabela SBZ010 do Protheus ERP (EXCLUSIVO)';
COMMENT ON COLUMN product_stores.bz_filial IS 'BZ_FILIAL - Filial (código da loja) - EXCLUSIVO';
COMMENT ON COLUMN product_stores.bz_cod IS 'BZ_COD - Código do Produto (referência B1_COD)';
COMMENT ON COLUMN product_stores.bz_xlocliz1 IS 'BZ_XLOCLIZ1 - Localização 1';
COMMENT ON COLUMN product_stores.bz_xlocliz2 IS 'BZ_XLOCLIZ2 - Localização 2';
COMMENT ON COLUMN product_stores.bz_xlocliz3 IS 'BZ_XLOCLIZ3 - Localização 3';
COMMENT ON COLUMN product_stores.product_id IS 'Referência interna para tabela products';
COMMENT ON COLUMN product_stores.store_id IS 'Referência interna para tabela stores';

-- Recriar índices otimizados para estrutura SB1
CREATE INDEX idx_products_b1_cod ON products(b1_cod);
CREATE INDEX idx_products_b1_codbar ON products(b1_codbar) WHERE b1_codbar IS NOT NULL;
CREATE INDEX idx_products_b1_desc ON products USING gin(b1_desc gin_trgm_ops);
CREATE INDEX idx_products_b1_grupo ON products(b1_grupo);
CREATE INDEX idx_products_b1_xcatgor ON products(b1_xcatgor);
CREATE INDEX idx_products_b1_xsubcat ON products(b1_xsubcat) WHERE b1_xsubcat IS NOT NULL;
CREATE INDEX idx_products_b1_xsegmen ON products(b1_xsegmen);
CREATE INDEX idx_products_b1_locpad ON products(b1_locpad);
CREATE INDEX idx_products_b1_rastro ON products(b1_rastro);
CREATE INDEX idx_products_b1_um ON products(b1_um);

-- Índices compostos para consultas frequentes
CREATE INDEX idx_products_store_b1cod ON products(store_id, b1_cod);
CREATE INDEX idx_products_store_grupo ON products(store_id, b1_grupo);
CREATE INDEX idx_products_store_catgor ON products(store_id, b1_xcatgor);
CREATE INDEX idx_products_active_store ON products(is_active, store_id);

-- Índices de compatibilidade (manter consultas antigas funcionando)
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_name ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_active ON products(is_active);

-- View de compatibilidade para consultas antigas
CREATE VIEW products_legacy AS
SELECT 
    id,
    code,
    b1_codbar as barcode,
    name,
    description,
    b1_xcatgor as category,
    unit,
    cost_price,
    sale_price,
    current_stock,
    CASE WHEN b1_rastro = 'S' THEN true ELSE false END as has_serial,
    CASE WHEN b1_rastro = 'S' THEN true ELSE false END as has_lot,
    is_active,
    store_id,
    created_at,
    updated_at
FROM products;

-- Atualizar sequences e constraints
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_product_id_fkey;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id);

-- Comentários na tabela
COMMENT ON TABLE products IS 'Produtos - Estrutura espelho da tabela SB1 do Protheus ERP';
COMMENT ON COLUMN products.b1_cod IS 'B1_COD - Código do Produto no Protheus';
COMMENT ON COLUMN products.b1_desc IS 'B1_DESC - Descrição do Produto no Protheus';
COMMENT ON COLUMN products.b1_locpad IS 'B1_LOCPAD - Armazém Padrão';
COMMENT ON COLUMN products.b1_grupo IS 'B1_GRUPO - Grupo do Produto';
COMMENT ON COLUMN products.b1_xcatgor IS 'B1_XCATGOR - Categoria';
COMMENT ON COLUMN products.b1_xsubcat IS 'B1_XSUBCAT - SubCategoria';
COMMENT ON COLUMN products.b1_xsegmen IS 'B1_XSEGMEN - Segmento';
COMMENT ON COLUMN products.b1_rastro IS 'B1_RASTRO - Controle de Rastreabilidade (S/N)';
COMMENT ON COLUMN products.b1_codbar IS 'B1_CODBAR - Código de Barras';
COMMENT ON COLUMN products.b1_um IS 'B1_UM - Unidade de Medida';

-- Log da migração
INSERT INTO system_logs (level, message, details, created_at) VALUES
('INFO', 'Migração SB1: Estrutura de produtos atualizada para espelhar tabela SB1 do Protheus', 
 jsonb_build_object(
    'migration_version', 'v2.0_sb1_structure',
    'tables_affected', ARRAY['products', 'product_barcodes', 'product_stores'],
    'backup_table', 'products_old_backup',
    'new_columns', ARRAY['b1_cod', 'b1_desc', 'b1_locpad', 'b1_grupo', 'b1_xcatgor', 'b1_xsubcat', 'b1_xsegmen', 'b1_rastro', 'b1_codbar', 'b1_um'],
    'new_tables', ARRAY['product_barcodes', 'product_stores']
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
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM products_old_backup;
    SELECT COUNT(*) INTO new_count FROM products;
    
    IF old_count != new_count THEN
        RAISE EXCEPTION 'Migração falhou: contagem diferente (old: %, new: %)', old_count, new_count;
    END IF;
    
    RAISE NOTICE 'Migração SB1 concluída com sucesso: % produtos migrados', new_count;
END $$;