-- =================================
-- AJUSTE DA TABELA SB2010 PARA IMPORTAÇÃO FLEXÍVEL DO PROTHEUS
-- Remove restrições desnecessárias para aceitar dados do ERP
-- =================================

SET search_path TO inventario, public;

-- 1. Remover constraint NOT NULL de store_id
ALTER TABLE sb2010 ALTER COLUMN store_id DROP NOT NULL;

-- 2. Verificar e ajustar a chave primária atual
-- Primeiro, vamos ver qual é a estrutura atual
\d sb2010

-- 3. Comentar que store_id é opcional para dados do Protheus
COMMENT ON COLUMN sb2010.store_id IS 'ID da loja - opcional para dados importados do Protheus';

-- 4. Adicionar comentário na tabela sobre a filosofia de importação
COMMENT ON TABLE sb2010 IS 'Saldos atuais dos produtos - Dados importados diretamente do Protheus sem validações rígidas';

-- 5. Verificar constraints atuais
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_namespace nsp ON nsp.oid = con.connamespace
JOIN pg_class cls ON cls.oid = con.conrelid
WHERE nsp.nspname = 'inventario'
AND cls.relname = 'sb2010';