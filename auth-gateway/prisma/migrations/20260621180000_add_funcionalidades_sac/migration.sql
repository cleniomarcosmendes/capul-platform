-- SAC — funcionalidades das telas de SAC (parte 1/2: ADD VALUE).
-- PostgreSQL exige novos valores de enum COMITADOS antes de usados; por isso
-- esta migration só faz ALTER TYPE; o backfill em T.I. vem na 180001.
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'SAC_TRIAGEM';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'SAC_INDICADOR';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'SAC_TEMPLATE';
ALTER TYPE core."FuncionalidadeWorkspace" ADD VALUE IF NOT EXISTS 'SAC_EMAIL_CONFIG';
