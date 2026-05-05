-- CT-e — Gravação automática no Protheus após enriquecimento (05/05/2026 noite)
-- Fase 4 simplificada do PLANO_CTE_DISTRIBUICAO_v2.md: em vez de drop UNC,
-- reusa o ProtheusGravacaoHelper já testado da Onda 1 (POST /grvXML →
-- SZR010 + SZQ010). Vantagem: zero código novo no Protheus, fecha o ciclo
-- pra fluxo distNSU sem depender de pasta compartilhada.
--
-- Adições:
--   ambiente_config.cte_protheus_grava_ativo  — flag (default false; ADMIN_TI ativa)
--   ambiente_config.cte_protheus_grava_alterado_em/por — auditoria
--   cte_documento.protheus_gravado_em — timestamp da gravação (NULL = nunca tentou)
--   cte_documento.protheus_status — GRAVADO/JA_EXISTIA/FALHA_TECNICA
--   cte_documento.protheus_erro — código+mensagem se FALHA_TECNICA

-- Flag global em ambiente_config (singleton)
ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN "cte_protheus_grava_ativo"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cte_protheus_grava_alterado_em"  TIMESTAMP(3),
  ADD COLUMN "cte_protheus_grava_alterado_por" TEXT;

-- Tracking por documento em cte_documento
ALTER TABLE "fiscal"."cte_documento"
  ADD COLUMN "protheus_gravado_em" TIMESTAMP(3),
  ADD COLUMN "protheus_status"     VARCHAR(20),
  ADD COLUMN "protheus_erro"       TEXT;

-- Índice pra cron de retry (filtro processado_em IS NOT NULL AND protheus_gravado_em IS NULL)
CREATE INDEX "cte_documento_protheus_gravado_em_idx"
  ON "fiscal"."cte_documento" ("protheus_gravado_em");
