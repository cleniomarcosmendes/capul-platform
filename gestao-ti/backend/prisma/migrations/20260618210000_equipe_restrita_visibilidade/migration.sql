-- Visibilidade restrita à equipe (independe de `privada`).
-- restrita_visibilidade=TRUE => chamados desta equipe só são VISÍVEIS aos
-- membros ativos dela; nem o staff do depto (não-membro) vê na LISTAGEM.
-- Solicitante/técnico/colaborador do chamado e ADMIN seguem vendo.
-- Aditivo, default false (= comportamento atual; zero impacto no que existe).
ALTER TABLE "gestao_ti"."equipes_ti"
  ADD COLUMN IF NOT EXISTS "restrita_visibilidade" BOOLEAN NOT NULL DEFAULT false;
