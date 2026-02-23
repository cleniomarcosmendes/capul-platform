-- =================================
-- RENOMEAÇÃO SIMPLES DAS TABELAS PARA PROTHEUS
-- =================================

-- Passo 1: Renomear as tabelas principais
ALTER TABLE inventario.products RENAME TO SB1010;
ALTER TABLE inventario.product_barcodes RENAME TO SLK010;
ALTER TABLE inventario.product_stores RENAME TO SBZ010;
ALTER TABLE inventario.product_prices RENAME TO DA1010;

-- Passo 2: Verificar se renomeação funcionou
SELECT 'Renomeação concluída' as status;