-- SAC Fase 1 (20/06) — equipe-catálogo de apoiadores ("roster").
-- apoio_sac=TRUE => os MEMBROS desta equipe são os elegíveis a serem puxados
-- "em cópia" num chamado de SAC. Esta equipe é só catálogo: NUNCA pode ser a
-- equipe-atual de um chamado (guard "roster não roteável" no backend) — por
-- isso ser membro dela não dá visibilidade de fila. Aditivo, default false.
ALTER TABLE "gestao_ti"."equipes_ti"
  ADD COLUMN IF NOT EXISTS "apoio_sac" BOOLEAN NOT NULL DEFAULT false;
