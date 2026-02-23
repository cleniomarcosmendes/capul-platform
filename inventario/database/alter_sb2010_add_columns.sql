-- =================================
-- ADIÇÃO DE COLUNAS FALTANTES NA TABELA SB2010
-- Adiciona B2_RESERVA e B2_QEMP para compatibilidade com CSV
-- =================================

SET search_path TO inventario, public;

-- Adicionar coluna B2_RESERVA (Quantidade Reservada)
ALTER TABLE sb2010 
ADD COLUMN IF NOT EXISTS B2_RESERVA DECIMAL(15,4) DEFAULT 0;

-- Adicionar coluna B2_QEMP (Quantidade Empenhada)
ALTER TABLE sb2010 
ADD COLUMN IF NOT EXISTS B2_QEMP DECIMAL(15,4) DEFAULT 0;

-- Adicionar comentários nas novas colunas
COMMENT ON COLUMN sb2010.B2_RESERVA IS 'Quantidade reservada do produto';
COMMENT ON COLUMN sb2010.B2_QEMP IS 'Quantidade empenhada do produto';

-- Confirmar estrutura da tabela
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'inventario' 
AND table_name = 'sb2010'
ORDER BY ordinal_position;