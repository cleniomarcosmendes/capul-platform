-- Migration 18/05/2026: divergencia de razao social no cruzamento (F1.8).
--
-- O cruzamento classificava o alerta SO por existencia + situacao
-- cadastral, ignorando se a razao social do Protheus (SA1/SA2) diverge
-- da oficial da RFB. Agora e uma DIMENSAO PROPRIA (independente do alerta
-- de situacao): similaridade_razao (0-100, score normalizado) +
-- divergencia_razao (bool = similaridade < limiar). Limiar configuravel
-- por ADMIN_TI em ambiente_config.rfb_sim_razao_min (default 80).
-- Idempotente.

ALTER TABLE "rfb"."cruzamento_resultado"
  ADD COLUMN IF NOT EXISTS "divergencia_razao"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "similaridade_razao" INTEGER;

ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN IF NOT EXISTS "rfb_sim_razao_min" INTEGER DEFAULT 80;
