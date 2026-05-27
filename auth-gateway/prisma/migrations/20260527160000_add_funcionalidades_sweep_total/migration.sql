-- ============================================================================
-- S16.5 (27/05) — Add funcionalidades sweep total (parte 1/2)
-- ============================================================================
-- Conclui o sweep S16 — todos os itens do menu agora têm funcionalidade
-- configurável por departamento. Dados continuam shared; só visibilidade
-- do menu é per-depto. Edição segue restrita a MANAGERS no sidebar.
--
-- Funcionalidades novas (10):
--   Operação:      CONHECIMENTO, CATALOGO_SERVICO (antes compartilhavam CHAMADO)
--   Análise:       DASHBOARD, MONITOR, ACOMPANHAMENTO, ACOMPANHAMENTO_ITEM
--   Configuração:  SLA, HORARIO_TRABALHO, IMPORTAR_DADOS
--   Externos:      CHAMADO_EXTERNO (antes compartilhava INDICADOR_ESTRATEGICO)
--
-- PostgreSQL exige que novos valores de enum sejam COMITADOS antes de poderem
-- ser USADOS. Como Prisma roda cada migration em transação única, dividimos
-- em 2: esta apenas ALTER TYPE; a próxima (160001) faz o backfill em T.I.
-- ============================================================================

ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CONHECIMENTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CATALOGO_SERVICO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'DASHBOARD';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'MONITOR';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'ACOMPANHAMENTO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'ACOMPANHAMENTO_ITEM';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'SLA';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'HORARIO_TRABALHO';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'IMPORTAR_DADOS';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'CHAMADO_EXTERNO';
