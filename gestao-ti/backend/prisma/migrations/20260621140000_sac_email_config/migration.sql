-- SAC Fase 3 (e-mail de ENTRADA) — config OPERACIONAL do poller IMAP. Singleton
-- (id=1). A CONEXÃO IMAP vem do AMBIENTE (SAC_IMAP_*); aqui só estado/toggles +
-- observabilidade. Aditivo e idempotente.
CREATE TABLE IF NOT EXISTS "gestao_ti"."sac_email_config" (
  "id"                    INTEGER       NOT NULL DEFAULT 1,
  "enabled"               BOOLEAN       NOT NULL DEFAULT false,
  "pause_sync"            BOOLEAN       NOT NULL DEFAULT false,
  "mailbox_folder"        TEXT          NOT NULL DEFAULT 'INBOX',
  "poll_interval_minutes" INTEGER       NOT NULL DEFAULT 5,
  "last_poll_at"          TIMESTAMP(3),
  "last_status"           TEXT,
  "last_error"            TEXT,
  "processados_total"     INTEGER       NOT NULL DEFAULT 0,
  "updated_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"            TEXT,
  CONSTRAINT "sac_email_config_pkey" PRIMARY KEY ("id")
);

-- Garante a linha singleton (id=1).
INSERT INTO "gestao_ti"."sac_email_config" ("id") VALUES (1)
  ON CONFLICT ("id") DO NOTHING;
