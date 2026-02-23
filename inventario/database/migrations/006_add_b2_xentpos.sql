-- Migration: Adicionar campo b2_xentpos (Estoque Pós-Venda)
-- Data: 31/10/2025
-- Versão: v2.17.0
-- Descrição: Campo para registrar produtos vendidos (faturados) mas ainda não retirados pelo cliente

BEGIN;

-- Adicionar coluna b2_xentpos na tabela sb2010
ALTER TABLE inventario.sb2010
ADD COLUMN b2_xentpos NUMERIC(15, 2) DEFAULT 0.00 NOT NULL;

-- Comentário descritivo
COMMENT ON COLUMN inventario.sb2010.b2_xentpos IS
'Quantidade de produtos vendidos (faturados) mas ainda não retirados pelo cliente. Utilizado para ajustar quantidade esperada no inventário físico. Fórmula: Qtde Esperada = b2_qatu + b2_xentpos';

-- Criar índice para otimizar consultas (apenas registros com valor > 0)
CREATE INDEX idx_sb2010_xentpos ON inventario.sb2010(b2_xentpos)
WHERE b2_xentpos > 0;

COMMIT;
