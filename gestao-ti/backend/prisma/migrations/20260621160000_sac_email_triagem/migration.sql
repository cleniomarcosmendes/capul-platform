-- SAC Fase 4a — Caixa de Triagem dos e-mails UNMATCHED. Preserva corpo + anexos
-- pra ação de vincular/abrir. Aditivo e idempotente.
ALTER TABLE "gestao_ti"."sac_email_ingestao"
  ADD COLUMN IF NOT EXISTS "corpo_texto"          TEXT,
  ADD COLUMN IF NOT EXISTS "triagem_status"       TEXT,
  ADD COLUMN IF NOT EXISTS "triado_em"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "triado_por"           TEXT,
  ADD COLUMN IF NOT EXISTS "chamado_vinculado_id" TEXT;

CREATE INDEX IF NOT EXISTS "sac_email_ingestao_triagem_status_idx"
  ON "gestao_ti"."sac_email_ingestao" ("triagem_status");

CREATE TABLE IF NOT EXISTS "gestao_ti"."sac_email_anexo" (
  "id"            TEXT         NOT NULL,
  "ingestao_id"   TEXT         NOT NULL,
  "nome_original" TEXT         NOT NULL,
  "nome_arquivo"  TEXT         NOT NULL,
  "mime_type"     TEXT         NOT NULL,
  "tamanho"       INTEGER      NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sac_email_anexo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sac_email_anexo_ingestao_id_idx"
  ON "gestao_ti"."sac_email_anexo" ("ingestao_id");

DO $$ BEGIN
  ALTER TABLE "gestao_ti"."sac_email_anexo"
    ADD CONSTRAINT "sac_email_anexo_ingestao_id_fkey"
    FOREIGN KEY ("ingestao_id") REFERENCES "gestao_ti"."sac_email_ingestao"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
