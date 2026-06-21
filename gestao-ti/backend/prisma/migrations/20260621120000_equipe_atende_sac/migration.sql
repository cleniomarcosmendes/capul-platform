-- SAC — equipe de ATENDIMENTO ao SAC (recebe os chamados de SAC). Distinta da
-- apoio_sac (roster de apoiadores). A detecção "chamado é SAC" passa a ser por
-- EQUIPE (atende_sac), não por departamento — assim um mesmo workspace pode ter
-- equipe de SAC E equipe de chamado normal. Aditivo, default false.
ALTER TABLE "gestao_ti"."equipes_ti"
  ADD COLUMN IF NOT EXISTS "atende_sac" BOOLEAN NOT NULL DEFAULT false;
