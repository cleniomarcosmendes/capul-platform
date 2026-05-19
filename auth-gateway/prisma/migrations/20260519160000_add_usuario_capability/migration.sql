-- Migration 19/05/2026: capability explícita por usuário (LGPD).
--
-- Acesso a dado sensível (PII de sócios — FISCAL_CONSULTA_SOCIOS)
-- desacoplado do papel: concedido nominalmente por ADMIN no Configurador,
-- com motivo. Linha preservada na revogação (ativo=false + revogado_*) =
-- auditoria de concessão. Idempotente. Plano:
-- docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md

CREATE TABLE IF NOT EXISTS "core"."usuario_capability" (
  "id"            TEXT NOT NULL,
  "usuario_id"    TEXT NOT NULL,
  "capability"    TEXT NOT NULL,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "motivo"        TEXT NOT NULL,
  "concedido_por" TEXT NOT NULL,
  "concedido_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revogado_por"  TEXT,
  "revogado_em"   TIMESTAMP(3),
  CONSTRAINT "usuario_capability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usuario_capability_usuario_id_capability_key"
  ON "core"."usuario_capability" ("usuario_id", "capability");

CREATE INDEX IF NOT EXISTS "usuario_capability_capability_ativo_idx"
  ON "core"."usuario_capability" ("capability", "ativo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usuario_capability_usuario_id_fkey'
      AND table_schema = 'core' AND table_name = 'usuario_capability'
  ) THEN
    ALTER TABLE "core"."usuario_capability"
      ADD CONSTRAINT "usuario_capability_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
