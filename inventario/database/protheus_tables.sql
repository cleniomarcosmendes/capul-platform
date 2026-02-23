-- =================================
-- TABELAS DO PROTHEUS PARA INVENTÁRIO
-- Adição das tabelas SB2010 e SB8010
-- =================================

SET search_path TO inventario, public;

-- =================================
-- TABELA SB2010 - SALDO ATUAL
-- =================================
CREATE TABLE SB2010 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos do Protheus
    B2_FILIAL VARCHAR(2) NOT NULL,      -- Filial (OBRIGATÓRIO)
    B2_COD VARCHAR(15) NOT NULL,        -- Código do Produto  
    B2_LOCAL VARCHAR(2) NOT NULL,       -- Local
    B2_QATU DECIMAL(15,4) DEFAULT 0,    -- Saldo Atual
    B2_CM1 DECIMAL(15,4) DEFAULT 0,     -- Custo Médio
    B2_VATU1 DECIMAL(15,4) DEFAULT 0,   -- Valor Atual
    
    -- Campos de controle interno
    store_id UUID NOT NULL REFERENCES stores(id),
    protheus_rec INTEGER,               -- Recno do Protheus
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT uk_sb2010_filial_cod_local UNIQUE (B2_FILIAL, B2_COD, B2_LOCAL)
);

-- Índices para SB2010
CREATE INDEX idx_sb2010_filial ON SB2010(B2_FILIAL);
CREATE INDEX idx_sb2010_cod ON SB2010(B2_COD);
CREATE INDEX idx_sb2010_local ON SB2010(B2_LOCAL);
CREATE INDEX idx_sb2010_store ON SB2010(store_id);
CREATE INDEX idx_sb2010_sync ON SB2010(last_sync);
CREATE INDEX idx_sb2010_filial_cod ON SB2010(B2_FILIAL, B2_COD);

-- Trigger para updated_at
CREATE TRIGGER update_sb2010_updated_at BEFORE UPDATE ON SB2010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================
-- TABELA SB8010 - SALDO POR LOTE
-- =================================
CREATE TABLE SB8010 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Campos do Protheus
    B8_FILIAL VARCHAR(2) NOT NULL,      -- Filial
    B8_QTDORI DECIMAL(15,4) DEFAULT 0,  -- Quantidade Original
    B8_PRODUTO VARCHAR(15) NOT NULL,    -- Código do Produto
    B8_LOCAL VARCHAR(2) NOT NULL,       -- Local
    B8_DATA DATE,                       -- Data
    B8_DTVALID DATE,                    -- Data de Validade
    B8_SALDO DECIMAL(15,4) DEFAULT 0,   -- Saldo
    B8_EMPENHO DECIMAL(15,4) DEFAULT 0, -- Empenho
    B8_LOTEFOR VARCHAR(20),             -- Lote Fornecedor
    B8_LOTECTL VARCHAR(20),             -- Lote Controle
    B8_DOC VARCHAR(9),                  -- Documento
    B8_SERIE VARCHAR(3),                -- Série
    B8_CLIFOR VARCHAR(6),               -- Cliente/Fornecedor
    B8_LOJA VARCHAR(2),                 -- Loja (Cliente/Fornecedor)
    
    -- Campos de controle interno
    store_id UUID NOT NULL REFERENCES stores(id),
    protheus_rec INTEGER,               -- Recno do Protheus
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT uk_sb8010_unique UNIQUE (B8_FILIAL, B8_PRODUTO, B8_LOCAL, B8_LOTECTL, B8_DOC, B8_SERIE)
);

-- Índices para SB8010
CREATE INDEX idx_sb8010_filial ON SB8010(B8_FILIAL);
CREATE INDEX idx_sb8010_produto ON SB8010(B8_PRODUTO);
CREATE INDEX idx_sb8010_local ON SB8010(B8_LOCAL);
CREATE INDEX idx_sb8010_lotectl ON SB8010(B8_LOTECTL);
CREATE INDEX idx_sb8010_lotefor ON SB8010(B8_LOTEFOR);
CREATE INDEX idx_sb8010_doc ON SB8010(B8_DOC);
CREATE INDEX idx_sb8010_serie ON SB8010(B8_SERIE);
CREATE INDEX idx_sb8010_clifor ON SB8010(B8_CLIFOR);
CREATE INDEX idx_sb8010_data ON SB8010(B8_DATA);
CREATE INDEX idx_sb8010_dtvalid ON SB8010(B8_DTVALID);
CREATE INDEX idx_sb8010_store ON SB8010(store_id);
CREATE INDEX idx_sb8010_sync ON SB8010(last_sync);
CREATE INDEX idx_sb8010_filial_produto ON SB8010(B8_FILIAL, B8_PRODUTO);

-- Trigger para updated_at
CREATE TRIGGER update_sb8010_updated_at BEFORE UPDATE ON SB8010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================
-- RELACIONAMENTOS E FOREIGN KEYS
-- =================================

-- FK para relacionar SB2010 com produtos (SB1010)
-- Nota: Como products já existe, vamos criar um índice de relacionamento
CREATE INDEX idx_sb2010_to_products ON SB2010(B2_COD, store_id);

-- FK para relacionar SB8010 com produtos (SB1010) 
CREATE INDEX idx_sb8010_to_products ON SB8010(B8_PRODUTO, store_id);

-- FK para relacionar SB8010 com SB2010
CREATE INDEX idx_sb8010_to_sb2010 ON SB8010(B8_FILIAL, B8_PRODUTO, B8_LOCAL);

-- =================================
-- VIEWS PARA FACILITAR CONSULTAS
-- =================================

-- View que relaciona SB1010 (products) com SB2010 (saldos)
CREATE VIEW v_products_with_balance AS
SELECT 
    p.id as product_id,
    p.code as product_code,
    p.name as product_name,
    p.store_id,
    s.code as store_code,
    sb2.B2_FILIAL,
    sb2.B2_LOCAL,
    sb2.B2_QATU as current_balance,
    sb2.B2_CM1 as average_cost,
    sb2.B2_VATU1 as current_value,
    sb2.last_sync as balance_last_sync
FROM products p
JOIN stores s ON p.store_id = s.id
LEFT JOIN SB2010 sb2 ON (p.code = sb2.B2_COD AND p.store_id = sb2.store_id);

-- View que relaciona produtos com lotes
CREATE VIEW v_products_with_lots AS
SELECT 
    p.id as product_id,
    p.code as product_code,
    p.name as product_name,
    p.store_id,
    s.code as store_code,
    sb8.B8_FILIAL,
    sb8.B8_LOCAL,
    sb8.B8_LOTECTL as lot_control,
    sb8.B8_LOTEFOR as lot_supplier,
    sb8.B8_SALDO as lot_balance,
    sb8.B8_DTVALID as lot_expiry,
    sb8.B8_DATA as lot_date,
    sb8.last_sync as lot_last_sync
FROM products p
JOIN stores s ON p.store_id = s.id
LEFT JOIN SB8010 sb8 ON (p.code = sb8.B8_PRODUTO AND p.store_id = sb8.store_id);

-- View consolidada com produtos, saldos e lotes
CREATE VIEW v_products_complete AS
SELECT 
    p.id as product_id,
    p.code as product_code,
    p.name as product_name,
    p.store_id,
    s.code as store_code,
    sb2.B2_QATU as system_balance,
    sb2.B2_CM1 as average_cost,
    sb2.B2_VATU1 as current_value,
    COUNT(sb8.id) as total_lots,
    SUM(sb8.B8_SALDO) as total_lot_balance
FROM products p
JOIN stores s ON p.store_id = s.id
LEFT JOIN SB2010 sb2 ON (p.code = sb2.B2_COD AND p.store_id = sb2.store_id)
LEFT JOIN SB8010 sb8 ON (p.code = sb8.B8_PRODUTO AND p.store_id = sb8.store_id)
GROUP BY p.id, p.code, p.name, p.store_id, s.code, sb2.B2_QATU, sb2.B2_CM1, sb2.B2_VATU1;

-- =================================
-- COMENTÁRIOS NAS TABELAS
-- =================================

COMMENT ON TABLE SB2010 IS 'Saldos atuais dos produtos por filial - Integração Protheus';
COMMENT ON TABLE SB8010 IS 'Saldos por lote dos produtos por filial - Integração Protheus';

COMMENT ON COLUMN SB2010.B2_FILIAL IS 'Filial (campo obrigatório)';
COMMENT ON COLUMN SB2010.B2_COD IS 'Código do produto';
COMMENT ON COLUMN SB2010.B2_LOCAL IS 'Local de armazenagem';
COMMENT ON COLUMN SB2010.B2_QATU IS 'Quantidade atual em estoque';
COMMENT ON COLUMN SB2010.B2_CM1 IS 'Custo médio do produto';
COMMENT ON COLUMN SB2010.B2_VATU1 IS 'Valor atual do estoque';

COMMENT ON COLUMN SB8010.B8_FILIAL IS 'Filial';
COMMENT ON COLUMN SB8010.B8_PRODUTO IS 'Código do produto';
COMMENT ON COLUMN SB8010.B8_LOCAL IS 'Local de armazenagem';
COMMENT ON COLUMN SB8010.B8_LOTECTL IS 'Lote de controle';
COMMENT ON COLUMN SB8010.B8_LOTEFOR IS 'Lote do fornecedor';
COMMENT ON COLUMN SB8010.B8_SALDO IS 'Saldo atual do lote';
COMMENT ON COLUMN SB8010.B8_DTVALID IS 'Data de validade do lote';

-- =================================
-- PERMISSÕES
-- =================================

-- Conceder permissões ao role da aplicação
GRANT ALL PRIVILEGES ON SB2010 TO inventario_app;
GRANT ALL PRIVILEGES ON SB8010 TO inventario_app;

-- Permissões nas views
GRANT SELECT ON v_products_with_balance TO inventario_app;
GRANT SELECT ON v_products_with_lots TO inventario_app;
GRANT SELECT ON v_products_complete TO inventario_app;

-- Finalização
SET search_path TO public;