-- ===============================================
-- REESTRUTURAÇÃO SB1010 - CADASTRO DE PRODUTOS
-- ===============================================
-- Especificação:
-- b1_filial - Filial (Compartilhado - campo vazio)
-- b1_cod - Código do Produto
-- b1_codbar - Código de Barra
-- b1_desc - Descrição
-- b1_tipo - Tipo
-- b1_um - Unidade
-- b1_locpad - Local
-- b1_grupo - Grupo
-- b1_xcatgor - Categoria
-- b1_xsubcat - SubCategoria
-- b1_xsegmen - Segmento
-- b1_xgrinve - Grupo de Inventário
-- Chave primária: B1_FILIAL + B1_COD
-- OBS: Tabela compartilhada - B1_FILIAL será vazio

BEGIN;

-- Salvar dados existentes em uma tabela temporária
CREATE TABLE temp_sb1010_backup AS 
SELECT * FROM inventario.sb1010;

-- Dropar a tabela atual
DROP TABLE IF EXISTS inventario.sb1010 CASCADE;

-- Recriar a tabela com a estrutura correta
CREATE TABLE inventario.sb1010 (
    b1_filial   VARCHAR(10) NOT NULL DEFAULT '',  -- Filial (compartilhado - vazio)
    b1_cod      VARCHAR(50) NOT NULL,             -- Código do Produto
    b1_codbar   VARCHAR(50),                      -- Código de Barra
    b1_desc     VARCHAR(200) NOT NULL,            -- Descrição
    b1_tipo     VARCHAR(10),                      -- Tipo (PA, MP, etc.)
    b1_um       VARCHAR(10) NOT NULL,             -- Unidade (UN, PC, KG, etc.)
    b1_locpad   VARCHAR(10),                      -- Local padrão
    b1_grupo    VARCHAR(20),                      -- Grupo
    b1_xcatgor  VARCHAR(50),                      -- Categoria
    b1_xsubcat  VARCHAR(50),                      -- SubCategoria
    b1_xsegmen  VARCHAR(50),                      -- Segmento
    b1_xgrinve  VARCHAR(20),                      -- Grupo de Inventário
    
    -- Campos de controle
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE,
    
    -- Chave primária composta: B1_FILIAL + B1_COD
    CONSTRAINT pk_sb1010 PRIMARY KEY (b1_filial, b1_cod)
);

-- Índices para performance
CREATE INDEX idx_sb1010_cod ON inventario.sb1010(b1_cod);
CREATE INDEX idx_sb1010_codbar ON inventario.sb1010(b1_codbar);
CREATE INDEX idx_sb1010_desc ON inventario.sb1010(b1_desc);
CREATE INDEX idx_sb1010_tipo ON inventario.sb1010(b1_tipo);
CREATE INDEX idx_sb1010_grupo ON inventario.sb1010(b1_grupo);
CREATE INDEX idx_sb1010_xcatgor ON inventario.sb1010(b1_xcatgor);
CREATE INDEX idx_sb1010_xsubcat ON inventario.sb1010(b1_xsubcat);
CREATE INDEX idx_sb1010_xsegmen ON inventario.sb1010(b1_xsegmen);
CREATE INDEX idx_sb1010_xgrinve ON inventario.sb1010(b1_xgrinve);
CREATE INDEX idx_sb1010_active ON inventario.sb1010(is_active);

-- Trigger para updated_at
CREATE TRIGGER update_sb1010_updated_at
    BEFORE UPDATE ON inventario.sb1010
    FOR EACH ROW
    EXECUTE FUNCTION inventario.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE inventario.sb1010 IS 'Cadastro de produtos - Protheus SB1010';
COMMENT ON COLUMN inventario.sb1010.b1_filial IS 'Filial (compartilhado - sempre vazio)';
COMMENT ON COLUMN inventario.sb1010.b1_cod IS 'Código do produto (único)';
COMMENT ON COLUMN inventario.sb1010.b1_codbar IS 'Código de barras principal';
COMMENT ON COLUMN inventario.sb1010.b1_desc IS 'Descrição do produto';
COMMENT ON COLUMN inventario.sb1010.b1_tipo IS 'Tipo do produto (PA, MP, etc.)';
COMMENT ON COLUMN inventario.sb1010.b1_um IS 'Unidade de medida';
COMMENT ON COLUMN inventario.sb1010.b1_locpad IS 'Local padrão';
COMMENT ON COLUMN inventario.sb1010.b1_grupo IS 'Grupo do produto';
COMMENT ON COLUMN inventario.sb1010.b1_xcatgor IS 'Categoria';
COMMENT ON COLUMN inventario.sb1010.b1_xsubcat IS 'SubCategoria';
COMMENT ON COLUMN inventario.sb1010.b1_xsegmen IS 'Segmento';
COMMENT ON COLUMN inventario.sb1010.b1_xgrinve IS 'Grupo de inventário';

-- Migrar dados existentes da tabela de backup
INSERT INTO inventario.sb1010 (
    b1_filial, b1_cod, b1_codbar, b1_desc, b1_tipo, b1_um, 
    b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen, b1_xgrinve
)
SELECT 
    '',                    -- b1_filial (vazio - compartilhado)
    code,                  -- b1_cod
    barcode,              -- b1_codbar
    name,                 -- b1_desc
    'PA',                 -- b1_tipo (padrão)
    unit,                 -- b1_um
    '01',                 -- b1_locpad (padrão)
    category,             -- b1_grupo
    category,             -- b1_xcatgor
    '',                   -- b1_xsubcat
    'GERAL',              -- b1_xsegmen
    'INV01'               -- b1_xgrinve
FROM temp_sb1010_backup
WHERE is_active = true;

-- Inserir dados de exemplo atualizados
INSERT INTO inventario.sb1010 (
    b1_filial, b1_cod, b1_codbar, b1_desc, b1_tipo, b1_um, 
    b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen, b1_xgrinve
) VALUES
('', 'PROD001', '7891234567890', 'MOUSE ÓTICO USB', 'PA', 'UN', '01', 'PERIFERICOS', 'INFORMATICA', 'MOUSE', 'HARDWARE', 'INV01'),
('', 'PROD002', '7891234567891', 'TECLADO MECÂNICO', 'PA', 'UN', '01', 'PERIFERICOS', 'INFORMATICA', 'TECLADO', 'HARDWARE', 'INV01'),
('', 'PROD003', '7891234567892', 'MONITOR 24 LED', 'PA', 'UN', '01', 'MONITORES', 'INFORMATICA', 'MONITOR', 'HARDWARE', 'INV01'),
('', 'PROD004', '7891234567893', 'NOTEBOOK I5 8GB', 'PA', 'UN', '02', 'NOTEBOOKS', 'INFORMATICA', 'NOTEBOOK', 'EQUIPAMENTOS', 'INV02'),
('', 'PROD005', '7891234567894', 'SMARTPHONE 128GB', 'PA', 'UN', '02', 'CELULARES', 'TELECOM', 'SMARTPHONE', 'MOBILES', 'INV02'),
('', 'PROD006', '7891234567895', 'FONE BLUETOOTH', 'PA', 'UN', '01', 'ACESSORIOS', 'TELECOM', 'FONE', 'AUDIO', 'INV01'),
('', 'PROD007', '7891234567896', 'CABO USB-C 1M', 'PA', 'UN', '01', 'CABOS', 'ACESSORIOS', 'CABO', 'CONECTIVIDADE', 'INV01'),
('', 'PROD008', '7891234567897', 'CARREGADOR 5V', 'PA', 'UN', '01', 'CARREGADORES', 'ACESSORIOS', 'CARREGADOR', 'ENERGIA', 'INV01'),
('', 'PROD009', '7891234567898', 'WEBCAM FULL HD', 'PA', 'UN', '01', 'CAMERAS', 'INFORMATICA', 'WEBCAM', 'VIDEO', 'INV01'),
('', 'PROD010', '7891234567899', 'IMPRESSORA LASER', 'PA', 'UN', '02', 'IMPRESSORAS', 'INFORMATICA', 'IMPRESSORA', 'EQUIPAMENTOS', 'INV02')
ON CONFLICT (b1_filial, b1_cod) DO NOTHING;

-- Dropar tabela de backup
DROP TABLE temp_sb1010_backup;

COMMIT;

-- Verificar a estrutura criada
\d inventario.sb1010

-- Mostrar alguns registros
SELECT b1_cod, b1_desc, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xgrinve 
FROM inventario.sb1010 
LIMIT 5;

SELECT 'SB1010 reestruturada com sucesso!' as status;