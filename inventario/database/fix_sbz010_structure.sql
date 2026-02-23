-- ===============================================
-- CORREÇÃO DA ESTRUTURA SBZ010 - PARÂMETROS POR FILIAL
-- ===============================================
-- Especificação:
-- bz_filial  - Filial (exclusivo)
-- bz_cod     - Código do Produto  
-- bz_local   - Local
-- bz_xlocal1 - Localização1
-- bz_xlocal2 - Localização2
-- bz_xlocal3 - Localização3
-- Chave primária: bz_filial + bz_cod
-- Relacionamento: SB1010 x SBZ010 (1:N)

BEGIN;

-- Primeiro, vamos dropar a tabela atual
DROP TABLE IF EXISTS inventario.sbz010 CASCADE;

-- Recriar a tabela com a estrutura correta
CREATE TABLE inventario.sbz010 (
    bz_filial  VARCHAR(10) NOT NULL,    -- Filial (exclusivo)
    bz_cod     VARCHAR(50) NOT NULL,    -- Código do Produto
    bz_local   VARCHAR(10),             -- Local
    bz_xlocal1 VARCHAR(50),             -- Localização1
    bz_xlocal2 VARCHAR(50),             -- Localização2
    bz_xlocal3 VARCHAR(50),             -- Localização3
    
    -- Campos de controle
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Chave primária composta: bz_filial + bz_cod
    CONSTRAINT pk_sbz010 PRIMARY KEY (bz_filial, bz_cod)
);

-- Adicionar foreign key para SB1010 (relacionamento 1:N)
-- Um produto (SB1010) pode ter vários parâmetros por filial (SBZ010)
-- Relaciona bz_cod com code da tabela sb1010
ALTER TABLE inventario.sbz010 
ADD CONSTRAINT fk_sbz010_sb1010 
FOREIGN KEY (bz_cod) REFERENCES inventario.sb1010(code) 
ON DELETE CASCADE;

-- Índices para performance
CREATE INDEX idx_sbz010_filial ON inventario.sbz010(bz_filial);
CREATE INDEX idx_sbz010_cod ON inventario.sbz010(bz_cod);
CREATE INDEX idx_sbz010_local ON inventario.sbz010(bz_local);
CREATE INDEX idx_sbz010_xlocal1 ON inventario.sbz010(bz_xlocal1);
CREATE INDEX idx_sbz010_xlocal2 ON inventario.sbz010(bz_xlocal2);
CREATE INDEX idx_sbz010_xlocal3 ON inventario.sbz010(bz_xlocal3);
CREATE INDEX idx_sbz010_active ON inventario.sbz010(is_active);

-- Trigger para updated_at
CREATE TRIGGER update_sbz010_updated_at
    BEFORE UPDATE ON inventario.sbz010
    FOR EACH ROW
    EXECUTE FUNCTION inventario.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE inventario.sbz010 IS 'Parâmetros de produtos por filial - Protheus SBZ010';
COMMENT ON COLUMN inventario.sbz010.bz_filial IS 'Código da filial (exclusivo)';
COMMENT ON COLUMN inventario.sbz010.bz_cod IS 'Código do produto (referência SB1010)';
COMMENT ON COLUMN inventario.sbz010.bz_local IS 'Local padrão';
COMMENT ON COLUMN inventario.sbz010.bz_xlocal1 IS 'Localização 1';
COMMENT ON COLUMN inventario.sbz010.bz_xlocal2 IS 'Localização 2';
COMMENT ON COLUMN inventario.sbz010.bz_xlocal3 IS 'Localização 3';

-- Inserir alguns dados de exemplo
INSERT INTO inventario.sbz010 (bz_filial, bz_cod, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3) VALUES
('001', 'PROD001', '01', 'EST-A-01', 'PRATELEIRA-A1', 'NIVEL-1'),
('001', 'PROD002', '01', 'EST-A-02', 'PRATELEIRA-A2', 'NIVEL-1'),
('001', 'PROD003', '01', 'EST-B-01', 'PRATELEIRA-B1', 'NIVEL-2'),
('001', 'PROD004', '02', 'EST-C-01', 'PRATELEIRA-C1', 'NIVEL-1'),
('001', 'PROD005', '02', 'EST-C-02', 'PRATELEIRA-C2', 'NIVEL-1'),
('002', 'PROD001', '01', 'FIL2-A-01', 'PRAT-2A1', 'NIV-1'),
('002', 'PROD002', '01', 'FIL2-A-02', 'PRAT-2A2', 'NIV-1');

COMMIT;

SELECT 'SBZ010 estrutura corrigida com sucesso!' as status;