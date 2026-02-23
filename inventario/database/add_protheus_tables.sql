-- =================================
-- ADIÇÃO DE TABELAS PROTHEUS
-- Tabelas de apoio para estrutura SB1010
-- =================================

SET search_path TO inventario, public;

-- =================================
-- TABELA SBM010 - GRUPOS DE PRODUTOS  
-- =================================
CREATE TABLE IF NOT EXISTS SBM010 (
    BM_FILIAL VARCHAR(2) NOT NULL,      -- Filial (compartilhado)
    BM_GRUPO VARCHAR(4) NOT NULL,       -- Grupo (Caracter 4)
    BM_DESC VARCHAR(30) NOT NULL,       -- Descrição do Grupo (Caracter 30)
    
    -- Metadados do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Chave primária composta
    CONSTRAINT pk_sbm010 PRIMARY KEY (BM_FILIAL, BM_GRUPO)
);

-- Índices para SBM010
CREATE INDEX IF NOT EXISTS idx_sbm010_filial ON SBM010(BM_FILIAL);
CREATE INDEX IF NOT EXISTS idx_sbm010_grupo ON SBM010(BM_GRUPO);
CREATE INDEX IF NOT EXISTS idx_sbm010_desc ON SBM010 USING gin(BM_DESC gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sbm010_active ON SBM010(is_active);

-- Comentários
COMMENT ON TABLE SBM010 IS 'Cadastro de Grupos de Produtos (Protheus)';
COMMENT ON COLUMN SBM010.BM_FILIAL IS 'Código da filial (compartilhado)';
COMMENT ON COLUMN SBM010.BM_GRUPO IS 'Código do grupo de produtos';
COMMENT ON COLUMN SBM010.BM_DESC IS 'Descrição do grupo de produtos';

-- =================================
-- TABELA SZD010 - CATEGORIAS DE PRODUTOS
-- =================================
CREATE TABLE IF NOT EXISTS SZD010 (
    ZD_FILIAL VARCHAR(2) NOT NULL,      -- Filial (compartilhado)
    ZD_XCOD VARCHAR(4) NOT NULL,        -- Codigo da Categoria (Caracter 4)
    ZD_XDESC VARCHAR(30) NOT NULL,      -- Descrição da Categoria (Caracter 30)
    
    -- Metadados do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Chave primária composta
    CONSTRAINT pk_szd010 PRIMARY KEY (ZD_FILIAL, ZD_XCOD)
);

-- Índices para SZD010
CREATE INDEX IF NOT EXISTS idx_szd010_filial ON SZD010(ZD_FILIAL);
CREATE INDEX IF NOT EXISTS idx_szd010_xcod ON SZD010(ZD_XCOD);
CREATE INDEX IF NOT EXISTS idx_szd010_xdesc ON SZD010 USING gin(ZD_XDESC gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_szd010_active ON SZD010(is_active);

-- Comentários
COMMENT ON TABLE SZD010 IS 'Cadastro de Categorias de Produtos (Protheus)';
COMMENT ON COLUMN SZD010.ZD_FILIAL IS 'Código da filial (compartilhado)';
COMMENT ON COLUMN SZD010.ZD_XCOD IS 'Código da categoria de produtos';
COMMENT ON COLUMN SZD010.ZD_XDESC IS 'Descrição da categoria de produtos';

-- =================================
-- TABELA SZE010 - SUBCATEGORIAS DE PRODUTOS
-- =================================
CREATE TABLE IF NOT EXISTS SZE010 (
    ZE_FILIAL VARCHAR(2) NOT NULL,      -- Filial (compartilhado)
    ZE_XCOD VARCHAR(4) NOT NULL,        -- Codigo da SubCategoria (Caracter 4)
    ZE_XDESC VARCHAR(30) NOT NULL,      -- Descrição da SubCategoria (Caracter 30)
    
    -- Metadados do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Chave primária composta
    CONSTRAINT pk_sze010 PRIMARY KEY (ZE_FILIAL, ZE_XCOD)
);

-- Índices para SZE010
CREATE INDEX IF NOT EXISTS idx_sze010_filial ON SZE010(ZE_FILIAL);
CREATE INDEX IF NOT EXISTS idx_sze010_xcod ON SZE010(ZE_XCOD);
CREATE INDEX IF NOT EXISTS idx_sze010_xdesc ON SZE010 USING gin(ZE_XDESC gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sze010_active ON SZE010(is_active);

-- Comentários
COMMENT ON TABLE SZE010 IS 'Cadastro de SubCategorias de Produtos (Protheus)';
COMMENT ON COLUMN SZE010.ZE_FILIAL IS 'Código da filial (compartilhado)';
COMMENT ON COLUMN SZE010.ZE_XCOD IS 'Código da subcategoria de produtos';
COMMENT ON COLUMN SZE010.ZE_XDESC IS 'Descrição da subcategoria de produtos';

-- =================================
-- TABELA SZF010 - SEGMENTOS DE PRODUTOS
-- =================================
CREATE TABLE IF NOT EXISTS SZF010 (
    ZF_FILIAL VARCHAR(2) NOT NULL,      -- Filial (compartilhado)
    ZF_XCOD VARCHAR(6) NOT NULL,        -- Codigo do segmento (Caracter 6)
    ZF_XDESC VARCHAR(30) NOT NULL,      -- Descrição do Segmento (Caracter 30)
    
    -- Metadados do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Chave primária composta
    CONSTRAINT pk_szf010 PRIMARY KEY (ZF_FILIAL, ZF_XCOD)
);

-- Índices para SZF010
CREATE INDEX IF NOT EXISTS idx_szf010_filial ON SZF010(ZF_FILIAL);
CREATE INDEX IF NOT EXISTS idx_szf010_xcod ON SZF010(ZF_XCOD);
CREATE INDEX IF NOT EXISTS idx_szf010_xdesc ON SZF010 USING gin(ZF_XDESC gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_szf010_active ON SZF010(is_active);

-- Comentários
COMMENT ON TABLE SZF010 IS 'Cadastro de Segmentos de Produtos (Protheus)';
COMMENT ON COLUMN SZF010.ZF_FILIAL IS 'Código da filial (compartilhado)';
COMMENT ON COLUMN SZF010.ZF_XCOD IS 'Código do segmento de produtos';
COMMENT ON COLUMN SZF010.ZF_XDESC IS 'Descrição do segmento de produtos';

-- =================================
-- CRIAR TABELA SB1010 (PRODUTOS) SE NÃO EXISTIR
-- =================================
CREATE TABLE IF NOT EXISTS SB1010 (
    -- Chaves primárias
    B1_FILIAL VARCHAR(2) NOT NULL,      -- Filial (compartilhado)
    B1_COD VARCHAR(15) NOT NULL,        -- Código do produto
    
    -- Dados básicos do produto
    B1_DESC VARCHAR(30) NOT NULL,       -- Descrição
    B1_LOCPAD VARCHAR(2),               -- Armazém padrão
    B1_CODBAR VARCHAR(15),              -- Código de barras
    B1_UM VARCHAR(2),                   -- Unidade de medida
    B1_RASTRO VARCHAR(1) DEFAULT 'N',   -- Controle de rastro (S/N)
    
    -- Chaves estrangeiras para classificação
    B1_GRUPO VARCHAR(4),                -- Grupo (FK para SBM010)
    B1_XCATGOR VARCHAR(30),             -- Categoria (FK para SZD010) - Ajustado para VARCHAR(30)
    B1_XSUBCAT VARCHAR(30),             -- SubCategoria (FK para SZE010) - Ajustado para VARCHAR(30)
    B1_XSEGMEN VARCHAR(30),             -- Segmento (FK para SZF010) - Ajustado para VARCHAR(30)
    
    -- Controles do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Chave primária composta
    CONSTRAINT pk_sb1010 PRIMARY KEY (B1_FILIAL, B1_COD)
);

-- =================================
-- AJUSTAR CAMPOS EXISTENTES NA SB1010
-- =================================

-- Verificar se as colunas existem antes de tentar adicioná-las
DO $$
BEGIN
    -- Verificar e ajustar B1_GRUPO
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND column_name = 'b1_grupo') THEN
        ALTER TABLE SB1010 ADD COLUMN B1_GRUPO VARCHAR(4);
    END IF;
    
    -- Verificar e ajustar B1_XCATGOR
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND column_name = 'b1_xcatgor') THEN
        ALTER TABLE SB1010 ADD COLUMN B1_XCATGOR VARCHAR(30);
    ELSE
        -- Ajustar tamanho se necessário
        ALTER TABLE SB1010 ALTER COLUMN B1_XCATGOR TYPE VARCHAR(30);
    END IF;
    
    -- Verificar e ajustar B1_XSUBCAT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND column_name = 'b1_xsubcat') THEN
        ALTER TABLE SB1010 ADD COLUMN B1_XSUBCAT VARCHAR(30);
    ELSE
        -- Ajustar tamanho se necessário
        ALTER TABLE SB1010 ALTER COLUMN B1_XSUBCAT TYPE VARCHAR(30);
    END IF;
    
    -- Verificar e ajustar B1_XSEGMEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND column_name = 'b1_xsegmen') THEN
        ALTER TABLE SB1010 ADD COLUMN B1_XSEGMEN VARCHAR(30);
    ELSE
        -- Ajustar tamanho se necessário
        ALTER TABLE SB1010 ALTER COLUMN B1_XSEGMEN TYPE VARCHAR(30);
    END IF;
END $$;

-- =================================
-- CRIAR CHAVES ESTRANGEIRAS (SB1010 → TABELAS DE APOIO)
-- =================================

-- Relacionamento SB1010 → SBM010 (1:N)
-- Observação: Usando constraint que permite NULL para compatibilidade
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND constraint_name = 'fk_sb1010_sbm010_grupo') THEN
        ALTER TABLE SB1010 
        ADD CONSTRAINT fk_sb1010_sbm010_grupo 
        FOREIGN KEY (B1_FILIAL, B1_GRUPO) 
        REFERENCES SBM010(BM_FILIAL, BM_GRUPO)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- Relacionamento SB1010 → SZD010 (1:N)  
-- Observação: Constraint flexível para permitir categorias não cadastradas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_schema = 'inventario' 
                   AND table_name = 'sb1010' 
                   AND constraint_name = 'fk_sb1010_szd010_categoria') THEN
        -- Como os campos têm tamanhos diferentes, criamos um relacionamento lógico via trigger
        -- ao invés de FK constraint física
        NULL; -- Placeholder - relacionamento será gerenciado via trigger
    END IF;
END $$;

-- =================================
-- ÍNDICES PARA SB1010
-- =================================
CREATE INDEX IF NOT EXISTS idx_sb1010_filial ON SB1010(B1_FILIAL);
CREATE INDEX IF NOT EXISTS idx_sb1010_cod ON SB1010(B1_COD);
CREATE INDEX IF NOT EXISTS idx_sb1010_desc ON SB1010 USING gin(B1_DESC gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sb1010_grupo ON SB1010(B1_GRUPO);
CREATE INDEX IF NOT EXISTS idx_sb1010_xcatgor ON SB1010(B1_XCATGOR);
CREATE INDEX IF NOT EXISTS idx_sb1010_xsubcat ON SB1010(B1_XSUBCAT);
CREATE INDEX IF NOT EXISTS idx_sb1010_xsegmen ON SB1010(B1_XSEGMEN);
CREATE INDEX IF NOT EXISTS idx_sb1010_codbar ON SB1010(B1_CODBAR);
CREATE INDEX IF NOT EXISTS idx_sb1010_active ON SB1010(is_active);
CREATE INDEX IF NOT EXISTS idx_sb1010_rastro ON SB1010(B1_RASTRO);

-- =================================
-- TRIGGERS PARA UPDATED_AT
-- =================================
CREATE TRIGGER IF NOT EXISTS update_sbm010_updated_at 
    BEFORE UPDATE ON SBM010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_szd010_updated_at 
    BEFORE UPDATE ON SZD010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_sze010_updated_at 
    BEFORE UPDATE ON SZE010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_szf010_updated_at 
    BEFORE UPDATE ON SZF010
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para SB1010 se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_schema = 'inventario' 
                   AND trigger_name = 'update_sb1010_updated_at') THEN
        CREATE TRIGGER update_sb1010_updated_at 
            BEFORE UPDATE ON SB1010
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =================================
-- DADOS INICIAIS DE EXEMPLO
-- =================================

-- Grupos (SBM010)
INSERT INTO SBM010 (BM_FILIAL, BM_GRUPO, BM_DESC) VALUES
('01', 'ELET', 'ELETRONICOS'),
('01', 'ROUP', 'ROUPAS E CALCADOS'),
('01', 'CASA', 'CASA E DECORACAO'),
('01', 'AUTO', 'AUTOMOTIVO'),
('01', 'LIVR', 'LIVROS E MIDIAS')
ON CONFLICT (BM_FILIAL, BM_GRUPO) DO UPDATE SET
    BM_DESC = EXCLUDED.BM_DESC,
    updated_at = CURRENT_TIMESTAMP;

-- Categorias (SZD010)
INSERT INTO SZD010 (ZD_FILIAL, ZD_XCOD, ZD_XDESC) VALUES
('01', 'SMPH', 'SMARTPHONES'),
('01', 'NOTE', 'NOTEBOOKS'),
('01', 'TVCJ', 'TV E HOME THEATER'),
('01', 'CAMI', 'CAMISETAS'),
('01', 'CALC', 'CALCADOS'),
('01', 'MOVE', 'MOVEIS'),
('01', 'PNEU', 'PNEUS'),
('01', 'LIVT', 'LIVROS TECNICOS')
ON CONFLICT (ZD_FILIAL, ZD_XCOD) DO UPDATE SET
    ZD_XDESC = EXCLUDED.ZD_XDESC,
    updated_at = CURRENT_TIMESTAMP;

-- SubCategorias (SZE010)
INSERT INTO SZE010 (ZE_FILIAL, ZE_XCOD, ZE_XDESC) VALUES
('01', 'ANDR', 'ANDROID'),
('01', 'APPL', 'APPLE'),
('01', 'INTL', 'INTEL'),
('01', 'AMD', 'AMD'),
('01', 'POLO', 'POLO'),
('01', 'ESPT', 'ESPORTIVO'),
('01', 'MESA', 'MESAS'),
('01', 'CADE', 'CADEIRAS'),
('01', 'PASS', 'PASSEIO'),
('01', 'PROG', 'PROGRAMACAO')
ON CONFLICT (ZE_FILIAL, ZE_XCOD) DO UPDATE SET
    ZE_XDESC = EXCLUDED.ZE_XDESC,
    updated_at = CURRENT_TIMESTAMP;

-- Segmentos (SZF010)
INSERT INTO SZF010 (ZF_FILIAL, ZF_XCOD, ZF_XDESC) VALUES
('01', 'PREMIM', 'PREMIUM'),
('01', 'CORPOR', 'CORPORATIVO'),
('01', 'CASUAL', 'CASUAL'),
('01', 'ATLETI', 'ATLETICO'),
('01', 'RESIDE', 'RESIDENCIAL'),
('01', 'COMERC', 'COMERCIAL'),
('01', 'LUXO', 'LUXO'),
('01', 'BASIC', 'BASICO')
ON CONFLICT (ZF_FILIAL, ZF_XCOD) DO UPDATE SET
    ZF_XDESC = EXCLUDED.ZF_XDESC,
    updated_at = CURRENT_TIMESTAMP;

-- =================================
-- VIEWS ÚTEIS PARA RELACIONAMENTOS
-- =================================

-- View que mostra produtos com suas classificações
CREATE OR REPLACE VIEW v_produtos_completos AS
SELECT 
    sb1.B1_FILIAL,
    sb1.B1_COD,
    sb1.B1_DESC,
    sb1.B1_LOCPAD,
    sb1.B1_CODBAR,
    sb1.B1_UM,
    sb1.B1_RASTRO,
    
    -- Grupo
    sb1.B1_GRUPO,
    sbm.BM_DESC as GRUPO_DESC,
    
    -- Categoria  
    sb1.B1_XCATGOR,
    szd.ZD_XDESC as CATEGORIA_DESC,
    
    -- SubCategoria
    sb1.B1_XSUBCAT,
    sze.ZE_XDESC as SUBCATEGORIA_DESC,
    
    -- Segmento
    sb1.B1_XSEGMEN,
    szf.ZF_XDESC as SEGMENTO_DESC,
    
    sb1.created_at,
    sb1.updated_at,
    sb1.is_active
FROM SB1010 sb1
LEFT JOIN SBM010 sbm ON (sb1.B1_FILIAL = sbm.BM_FILIAL AND sb1.B1_GRUPO = sbm.BM_GRUPO)
LEFT JOIN SZD010 szd ON (sb1.B1_FILIAL = szd.ZD_FILIAL AND sb1.B1_XCATGOR = szd.ZD_XDESC)
LEFT JOIN SZE010 sze ON (sb1.B1_FILIAL = sze.ZE_FILIAL AND sb1.B1_XSUBCAT = sze.ZE_XDESC)  
LEFT JOIN SZF010 szf ON (sb1.B1_FILIAL = szf.ZF_FILIAL AND sb1.B1_XSEGMEN = szf.ZF_XDESC);

-- View de estatísticas por classificação
CREATE OR REPLACE VIEW v_estatisticas_produtos AS
SELECT 
    'GRUPO' as tipo_classificacao,
    B1_GRUPO as codigo,
    MAX(sbm.BM_DESC) as descricao,
    COUNT(*) as total_produtos,
    COUNT(CASE WHEN is_active THEN 1 END) as produtos_ativos
FROM SB1010 sb1
LEFT JOIN SBM010 sbm ON (sb1.B1_FILIAL = sbm.BM_FILIAL AND sb1.B1_GRUPO = sbm.BM_GRUPO)
WHERE B1_GRUPO IS NOT NULL
GROUP BY B1_GRUPO

UNION ALL

SELECT 
    'CATEGORIA' as tipo_classificacao,
    B1_XCATGOR as codigo,
    MAX(szd.ZD_XDESC) as descricao,
    COUNT(*) as total_produtos,
    COUNT(CASE WHEN is_active THEN 1 END) as produtos_ativos
FROM SB1010 sb1
LEFT JOIN SZD010 szd ON (sb1.B1_FILIAL = szd.ZD_FILIAL AND sb1.B1_XCATGOR = szd.ZD_XDESC)
WHERE B1_XCATGOR IS NOT NULL
GROUP BY B1_XCATGOR;

-- =================================
-- COMENTÁRIOS FINAIS
-- =================================
COMMENT ON TABLE SB1010 IS 'Tabela de Produtos (Protheus SB1010) com relacionamentos';

-- =================================
-- PERMISSÕES
-- =================================
GRANT ALL PRIVILEGES ON SBM010 TO inventario_app;
GRANT ALL PRIVILEGES ON SZD010 TO inventario_app;
GRANT ALL PRIVILEGES ON SZE010 TO inventario_app;
GRANT ALL PRIVILEGES ON SZF010 TO inventario_app;
GRANT ALL PRIVILEGES ON SB1010 TO inventario_app;

-- Análise das tabelas
ANALYZE SBM010;
ANALYZE SZD010;
ANALYZE SZE010;
ANALYZE SZF010;
ANALYZE SB1010;

-- =================================
-- FINALIZAÇÃO
-- =================================
COMMENT ON SCHEMA inventario IS 'Sistema de Inventário Protheus v2.0 - Com tabelas de apoio SB1';

-- Resetar search_path
SET search_path TO public;

-- Fim do script