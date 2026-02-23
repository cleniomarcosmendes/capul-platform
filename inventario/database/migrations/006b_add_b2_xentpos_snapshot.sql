-- Migration: Adicionar campo b2_xentpos no snapshot
-- Data: 31/10/2025
-- Versão: v2.17.0
-- Descrição: Campo para registrar entregas posteriores no snapshot congelado

BEGIN;

-- Adicionar coluna b2_xentpos na tabela inventory_items_snapshot
ALTER TABLE inventario.inventory_items_snapshot
ADD COLUMN b2_xentpos NUMERIC(15, 2) DEFAULT 0.00;

-- Comentário descritivo
COMMENT ON COLUMN inventario.inventory_items_snapshot.b2_xentpos IS
'Quantidade de produtos vendidos (faturados) mas ainda não retirados pelo cliente (snapshot congelado).';

COMMIT;
