-- SAC Fase 3 (3b) — classificação/log de cada e-mail buscado + dedupe por
-- message_id. Aditivo e idempotente.
DO $$ BEGIN
  CREATE TYPE "gestao_ti"."ResultadoIngestaoSac" AS ENUM (
    'MATCHED', 'UNMATCHED', 'SKIPPED_AUTO', 'SKIPPED_OWN', 'DUPLICATE', 'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "gestao_ti"."sac_email_ingestao" (
  "id"            TEXT          NOT NULL,
  "message_id"    TEXT          NOT NULL,
  "from_addr"     TEXT,
  "subject"       TEXT,
  "sac_numero"    INTEGER,
  "chamado_id"    TEXT,
  "resultado"     "gestao_ti"."ResultadoIngestaoSac" NOT NULL,
  "motivo"        TEXT,
  "recebido_em"   TIMESTAMP(3),
  "processado_em" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sac_email_ingestao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sac_email_ingestao_message_id_key"
  ON "gestao_ti"."sac_email_ingestao" ("message_id");
CREATE INDEX IF NOT EXISTS "sac_email_ingestao_processado_em_idx"
  ON "gestao_ti"."sac_email_ingestao" ("processado_em");
