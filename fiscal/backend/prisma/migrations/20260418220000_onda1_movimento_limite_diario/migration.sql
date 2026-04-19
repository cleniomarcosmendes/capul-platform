-- Migration: Onda 1 — movimento-based + limite diário
--
-- Plano v2.0 §2.1, §2.5, §6.4:
--   1. Enum TipoSincronizacao reduzido para 4 valores (MOVIMENTO_MEIO_DIA,
--      MOVIMENTO_MANHA_SEGUINTE, MANUAL, PONTUAL) — remove BOOTSTRAP, SEMANAL_AUTO,
--      DIARIA_AUTO, DIARIA_MANUAL, COMPLETA_MANUAL.
--   2. AmbienteConfig: renomeia janela_diaria_cron / janela_semanal_cron para
--      cron_movimento_meio_dia / cron_movimento_manha_seguinte (12:00 e 06:00).
--   3. CadastroSincronizacao: adiciona janela_inicio, janela_fim, filiais_movimento[].
--   4. LimiteDiario: nova tabela singleton (contador diário + alertas 80/90/100%).

-- ----- 1. Enum TipoSincronizacao ----------------------------------------------

BEGIN;

CREATE TYPE "fiscal"."TipoSincronizacao_new" AS ENUM (
  'MOVIMENTO_MEIO_DIA',
  'MOVIMENTO_MANHA_SEGUINTE',
  'MANUAL',
  'PONTUAL'
);

-- Cast por texto com mapeamento inline dos valores legados.
-- Valores legados possíveis (deletados antes da migration se órfãos):
--   DIARIA_AUTO, DIARIA_MANUAL     → MOVIMENTO_MEIO_DIA
--   SEMANAL_AUTO, COMPLETA_MANUAL  → PONTUAL
--   BOOTSTRAP                      → PONTUAL
ALTER TABLE "fiscal"."cadastro_sincronizacao"
  ALTER COLUMN "tipo" TYPE "fiscal"."TipoSincronizacao_new"
  USING (
    CASE "tipo"::text
      WHEN 'DIARIA_AUTO'     THEN 'MOVIMENTO_MEIO_DIA'
      WHEN 'DIARIA_MANUAL'   THEN 'MOVIMENTO_MEIO_DIA'
      WHEN 'SEMANAL_AUTO'    THEN 'PONTUAL'
      WHEN 'COMPLETA_MANUAL' THEN 'PONTUAL'
      WHEN 'BOOTSTRAP'       THEN 'PONTUAL'
      ELSE "tipo"::text
    END::"fiscal"."TipoSincronizacao_new"
  );

ALTER TYPE "fiscal"."TipoSincronizacao" RENAME TO "TipoSincronizacao_old";
ALTER TYPE "fiscal"."TipoSincronizacao_new" RENAME TO "TipoSincronizacao";
DROP TYPE "fiscal"."TipoSincronizacao_old";

COMMIT;

-- ----- 2. AmbienteConfig -----------------------------------------------------

ALTER TABLE "fiscal"."ambiente_config"
  DROP COLUMN IF EXISTS "janela_diaria_cron",
  DROP COLUMN IF EXISTS "janela_semanal_cron";

ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN IF NOT EXISTS "cron_movimento_meio_dia"       TEXT NOT NULL DEFAULT '0 12 * * *',
  ADD COLUMN IF NOT EXISTS "cron_movimento_manha_seguinte" TEXT NOT NULL DEFAULT '0 6 * * *';

-- ----- 3. CadastroSincronizacao ----------------------------------------------

ALTER TABLE "fiscal"."cadastro_sincronizacao"
  ADD COLUMN IF NOT EXISTS "janela_inicio"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "janela_fim"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "filiais_movimento" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ----- 4. LimiteDiario (novo) ------------------------------------------------

CREATE TABLE IF NOT EXISTS "fiscal"."limite_diario" (
  "id"                   INTEGER           NOT NULL DEFAULT 1,
  "limite_diario"        INTEGER           NOT NULL DEFAULT 2000,
  "alerta_amarelo"       INTEGER           NOT NULL DEFAULT 1600,
  "alerta_vermelho"      INTEGER           NOT NULL DEFAULT 1800,
  "contador_hoje"        INTEGER           NOT NULL DEFAULT 0,
  "data_contador"        DATE              NOT NULL DEFAULT CURRENT_DATE,
  "pausado_automatico"   BOOLEAN           NOT NULL DEFAULT FALSE,
  "pausado_em"           TIMESTAMP(3),
  "alertas_enviados_hoje" JSONB,
  "atualizado_em"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por"       TEXT,
  CONSTRAINT "limite_diario_pkey" PRIMARY KEY ("id")
);

-- Seed singleton (id=1). ON CONFLICT DO NOTHING garante idempotência.
INSERT INTO "fiscal"."limite_diario" ("id") VALUES (1)
ON CONFLICT ("id") DO NOTHING;
