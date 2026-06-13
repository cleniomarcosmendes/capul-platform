-- Device-sessions (login mobile / app entregador — Fase 1b, PR 1b.1).
-- Sessão de dispositivo estável entre rotações do refresh; revogação em 3
-- níveis (sessão/dispositivo/usuário). Web não cria sessão. Aditivo/idempotente.

CREATE TABLE IF NOT EXISTS "core"."dispositivo_sessao" (
  "id"              TEXT NOT NULL,
  "usuario_id"      TEXT NOT NULL,
  "device_id"       TEXT NOT NULL,
  "device_info"     TEXT,
  "plataforma"      TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_uso"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_em"       TIMESTAMP(3) NOT NULL,
  "revogado_em"     TIMESTAMP(3),
  "revogado_por_id" TEXT,
  CONSTRAINT "dispositivo_sessao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dispositivo_sessao_usuario_id_idx" ON "core"."dispositivo_sessao"("usuario_id");
CREATE INDEX IF NOT EXISTS "dispositivo_sessao_device_id_idx"  ON "core"."dispositivo_sessao"("device_id");

ALTER TABLE "core"."refresh_tokens" ADD COLUMN IF NOT EXISTS "dispositivo_sessao_id" TEXT;
CREATE INDEX IF NOT EXISTS "refresh_tokens_dispositivo_sessao_id_idx" ON "core"."refresh_tokens"("dispositivo_sessao_id");

-- FKs (ADD CONSTRAINT não tem IF NOT EXISTS → DO block idempotente).
DO $$ BEGIN
  ALTER TABLE "core"."dispositivo_sessao"
    ADD CONSTRAINT "dispositivo_sessao_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_dispositivo_sessao_id_fkey"
    FOREIGN KEY ("dispositivo_sessao_id") REFERENCES "core"."dispositivo_sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
