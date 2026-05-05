-- CT-e Distribuição — controle independente em ambiente_config (05/05/2026)
-- Substitui env var FISCAL_CTE_DISTRIBUICAO_ENABLED (removida no mesmo deploy).
-- Permite cenário "CT-e em HOM enquanto NF-e roda PROD" durante implantação.
--
-- Novos campos no singleton fiscal.ambiente_config (id=1):
--   cte_distribuicao_ativo       — bool default false (gating em PROD por defesa)
--   cte_distribuicao_ambiente    — enum AmbienteSefaz default HOMOLOGACAO
--   cte_distribuicao_alterado_em — timestamp da última alteração (auditoria)
--   cte_distribuicao_alterado_por — usuário que alterou (auditoria)

ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN "cte_distribuicao_ativo"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cte_distribuicao_ambiente"      "fiscal"."AmbienteSefaz" NOT NULL DEFAULT 'HOMOLOGACAO',
  ADD COLUMN "cte_distribuicao_alterado_em"   TIMESTAMP(3),
  ADD COLUMN "cte_distribuicao_alterado_por"  TEXT;
