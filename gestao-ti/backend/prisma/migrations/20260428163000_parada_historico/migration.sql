-- =================================================================
-- Migration: parada_historico (timeline imutável) + enum TipoEventoParada
-- =================================================================
-- Contexto: feedback do operador (28/04/2026) — quando uma parada é
-- reaberta múltiplas vezes, observações finais sobrescrevem o campo
-- registros_parada.observacoes. Auditoria fica cega.
--
-- Solução: tabela parada_historico cresce a cada transição de estado.
-- Service registra automaticamente em create/finalizar/cancelar/reabrir.
--
-- Idempotente. Migration aditiva (cria objetos novos, sem alterar dados).
-- =================================================================

-- Enum TipoEventoParada
DO $$ BEGIN
  CREATE TYPE "gestao_ti"."TipoEventoParada" AS ENUM (
    'REGISTRADA', 'REABERTA', 'FINALIZADA', 'CANCELADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela parada_historico
CREATE TABLE IF NOT EXISTS "gestao_ti"."parada_historico" (
  "id"          TEXT NOT NULL,
  "parada_id"   TEXT NOT NULL,
  "tipo_evento" "gestao_ti"."TipoEventoParada" NOT NULL,
  "usuario_id"  TEXT,
  "observacoes" TEXT,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parada_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "parada_historico_parada_id_created_at_idx"
  ON "gestao_ti"."parada_historico" ("parada_id", "created_at");

-- FKs (idempotentes via DO $$)
DO $$ BEGIN
  ALTER TABLE "gestao_ti"."parada_historico"
    ADD CONSTRAINT "parada_historico_parada_id_fkey"
    FOREIGN KEY ("parada_id")
    REFERENCES "gestao_ti"."registros_parada"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gestao_ti"."parada_historico"
    ADD CONSTRAINT "parada_historico_usuario_id_fkey"
    FOREIGN KEY ("usuario_id")
    REFERENCES "core"."usuarios"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
