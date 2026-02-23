-- Migration: Adicionar campo b8_lotefor na tabela inventory_lots_snapshot
-- Data: 31/10/2025
-- Versão: v2.17.1

BEGIN;

-- Adicionar coluna b8_lotefor na tabela inventory_lots_snapshot
ALTER TABLE inventario.inventory_lots_snapshot
ADD COLUMN b8_lotefor VARCHAR(18) DEFAULT '' NOT NULL;

-- Comentário descritivo
COMMENT ON COLUMN inventario.inventory_lots_snapshot.b8_lotefor IS
'Número do lote do fornecedor (snapshot). Congelado no momento da criação do inventário.';

COMMIT;
