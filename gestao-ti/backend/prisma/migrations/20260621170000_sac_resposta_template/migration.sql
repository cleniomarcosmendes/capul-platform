-- SAC Fase 4b — Respostas prontas (templates) do SAC. Aditivo e idempotente.
CREATE TABLE IF NOT EXISTS "gestao_ti"."sac_resposta_template" (
  "id"         TEXT         NOT NULL,
  "titulo"     TEXT         NOT NULL,
  "corpo"      TEXT         NOT NULL,
  "ativo"      BOOLEAN      NOT NULL DEFAULT true,
  "ordem"      INTEGER      NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sac_resposta_template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sac_resposta_template_ativo_ordem_idx"
  ON "gestao_ti"."sac_resposta_template" ("ativo", "ordem");
