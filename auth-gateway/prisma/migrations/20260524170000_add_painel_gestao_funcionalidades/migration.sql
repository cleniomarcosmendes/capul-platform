-- ============================================================================
-- Workspace Multi-Departamento — Add Painel de Gestão funcionalidades (parte 1/2)
-- ============================================================================
-- PostgreSQL exige que novos valores de enum sejam COMITADOS antes de poderem
-- ser USADOS na mesma transação. Como Prisma roda cada migration em transação
-- única, dividimos em 2:
--   1. Esta migration: APENAS ALTER TYPE ADD VALUE (sem uso dos novos valores)
--   2. Próxima migration (20260524170001): backfill que USA os novos valores
-- ============================================================================

ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'PAINEL_GESTAO_CHAMADO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'PAINEL_GESTAO_PROJETO';
