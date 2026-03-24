-- Criar tabelas SB2010 e SB8010 para saldos

-- SB2010 - Saldos por Local (produtos sem lote)
CREATE TABLE IF NOT EXISTS inventario.sb2010 (
    b2_filial VARCHAR(10) NOT NULL DEFAULT '',
    b2_cod VARCHAR(50) NOT NULL,
    b2_local VARCHAR(10) NOT NULL,
    b2_qatu DECIMAL(15,4) DEFAULT 0,  -- Quantidade atual
    b2_reserva DECIMAL(15,4) DEFAULT 0,  -- Quantidade reservada
    b2_qemp DECIMAL(15,4) DEFAULT 0,  -- Quantidade empenhada
    d_e_l_e_t_ VARCHAR(1) DEFAULT ' ',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    PRIMARY KEY (b2_filial, b2_cod, b2_local)
);

-- SB8010 - Saldos por Lote e Local
CREATE TABLE IF NOT EXISTS inventario.sb8010 (
    b8_filial VARCHAR(10) NOT NULL DEFAULT '',
    b8_produto VARCHAR(50) NOT NULL,
    b8_local VARCHAR(10) NOT NULL,
    b8_lotectl VARCHAR(50) NOT NULL,  -- Número do lote
    b8_numlote VARCHAR(20),  -- Sequência do lote
    b8_saldo DECIMAL(15,4) DEFAULT 0,  -- Saldo do lote
    b8_dtvalid DATE,  -- Data de validade
    d_e_l_e_t_ VARCHAR(1) DEFAULT ' ',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    PRIMARY KEY (b8_filial, b8_produto, b8_local, b8_lotectl)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sb2010_produto ON inventario.sb2010(b2_cod);
CREATE INDEX IF NOT EXISTS idx_sb2010_local ON inventario.sb2010(b2_local);
CREATE INDEX IF NOT EXISTS idx_sb8010_produto ON inventario.sb8010(b8_produto);
CREATE INDEX IF NOT EXISTS idx_sb8010_local ON inventario.sb8010(b8_local);
CREATE INDEX IF NOT EXISTS idx_sb8010_lote ON inventario.sb8010(b8_lotectl);

-- Inserir dados de exemplo para teste (ignorar erros de schema evolution)
DO $$
BEGIN
    INSERT INTO inventario.sb2010 (b2_filial, b2_cod, b2_local, b2_qatu) VALUES
    ('01', '00010299', '01', 150),
    ('01', '00010299', '02', 75),
    ('01', '00010491', '01', 200),
    ('01', '00010531', '01', 50)
    ON CONFLICT DO NOTHING;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'sb2010 seed ignorado (schema divergente): %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO inventario.sb8010 (b8_filial, b8_produto, b8_local, b8_lotectl, b8_saldo, b8_dtvalid) VALUES
    ('01', 'PROD-LOTE-001', '01', 'L2024001', 100, '2025-12-31'),
    ('01', 'PROD-LOTE-001', '01', 'L2024002', 50, '2025-06-30'),
    ('01', 'PROD-LOTE-001', '02', 'L2024001', 25, '2025-12-31')
    ON CONFLICT DO NOTHING;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'sb8010 seed ignorado (schema divergente): %', SQLERRM;
END $$;