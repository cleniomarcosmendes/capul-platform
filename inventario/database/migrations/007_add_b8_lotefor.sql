-- Migration: Adicionar campo b8_lotefor (Lote do Fornecedor)
-- Data: 31/10/2025
-- Versão: v2.17.1

BEGIN;

-- Adicionar coluna b8_lotefor na tabela sb8010
ALTER TABLE inventario.sb8010
ADD COLUMN b8_lotefor VARCHAR(18) DEFAULT '' NOT NULL;

-- Comentário descritivo
COMMENT ON COLUMN inventario.sb8010.b8_lotefor IS
'Número do lote do fornecedor. Utilizado como informação complementar ao b8_lotectl para facilitar identificação física durante contagem.';

-- Criar índice para otimizar consultas
CREATE INDEX idx_sb8010_lotefor ON inventario.sb8010(b8_lotefor)
WHERE b8_lotefor <> '';

COMMIT;
