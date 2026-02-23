-- =====================================================
-- Migration: 005 - Criar Tabela SZB010 (Armazéns/Locais)
-- Data: 20/10/2025
-- Descrição: Tabela de cadastro de armazéns do Protheus
-- =====================================================

-- Criar tabela SZB010 (espelho do Protheus)
CREATE TABLE IF NOT EXISTS inventario.szb010 (
    -- Campos do Protheus (chave composta)
    zb_filial  VARCHAR(2)  NOT NULL,  -- Código da filial/loja
    zb_xlocal  VARCHAR(2)  NOT NULL,  -- Código do armazém
    zb_xdesc   VARCHAR(30) NOT NULL,  -- Descrição do armazém

    -- Campos de controle (nossa aplicação)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Chave primária composta
    PRIMARY KEY (zb_filial, zb_xlocal)
);

-- Comentários nas colunas
COMMENT ON TABLE inventario.szb010 IS 'Cadastro de Armazéns/Locais (espelho Protheus SZB010)';
COMMENT ON COLUMN inventario.szb010.zb_filial IS 'Código da filial (2 caracteres)';
COMMENT ON COLUMN inventario.szb010.zb_xlocal IS 'Código do armazém (2 caracteres)';
COMMENT ON COLUMN inventario.szb010.zb_xdesc IS 'Descrição do armazém (30 caracteres)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_szb010_filial ON inventario.szb010(zb_filial);
CREATE INDEX IF NOT EXISTS idx_szb010_local ON inventario.szb010(zb_xlocal);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION inventario.update_szb010_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_szb010_updated_at
    BEFORE UPDATE ON inventario.szb010
    FOR EACH ROW
    EXECUTE FUNCTION inventario.update_szb010_timestamp();

-- Log de criação
DO $$
BEGIN
    RAISE NOTICE 'Tabela szb010 criada com sucesso!';
    RAISE NOTICE 'Chave primária: (zb_filial, zb_xlocal)';
    RAISE NOTICE 'Índices criados: idx_szb010_filial, idx_szb010_local';
END $$;
