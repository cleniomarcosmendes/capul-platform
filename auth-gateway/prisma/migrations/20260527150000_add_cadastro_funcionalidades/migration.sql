-- ============================================================================
-- S16.4 (27/05) — Add Cadastros funcionalidades (parte 1/2)
-- ============================================================================
-- Cadastros operacionais (Departamentos, Centros de Custo, Naturezas
-- Financeiras, Tipos de Contrato, Fornecedores, Produtos, Tipos de Produto,
-- Tipos de Projeto, Categorias de Licença) viram funcionalidades configuráveis
-- por departamento — mesmo padrão dos demais. Dados continuam shared
-- (taxonomias globais), mas a VISIBILIDADE do menu é gateada por depto.
--
-- PostgreSQL exige que novos valores de enum sejam COMITADOS antes de poderem
-- ser USADOS na mesma transação. Como Prisma roda cada migration em transação
-- única, dividimos em 2:
--   1. Esta migration: APENAS ALTER TYPE ADD VALUE
--   2. Próxima migration (20260527150001): backfill em T.I.
-- ============================================================================

ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_DEPARTAMENTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_CENTRO_CUSTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_NATUREZA_FINANCEIRA';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_TIPO_CONTRATO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_FORNECEDOR';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_PRODUTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_TIPO_PRODUTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_TIPO_PROJETO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CADASTRO_CATEGORIA_LICENCA';
