-- =============================================
-- Capul Platform — Inicialização de Schemas
-- Executado automaticamente pelo Docker na criação do banco
-- =============================================

-- Extensoes necessarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS inventario;
CREATE SCHEMA IF NOT EXISTS gestao_ti;

-- Comentarios
COMMENT ON SCHEMA core IS 'Entidades compartilhadas: empresas, filiais, usuarios, auth, permissoes';
COMMENT ON SCHEMA inventario IS 'Modulo de Inventario de Estoque';
COMMENT ON SCHEMA gestao_ti IS 'Modulo de Gestao de T.I.';
