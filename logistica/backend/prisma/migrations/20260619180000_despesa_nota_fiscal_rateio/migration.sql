-- Sub-fase 4 (19/06): nota fiscal / documento no lançamento da despesa, com
-- opção "sem nota" e rateio (uma nota → vários tipos no mesmo veículo).
-- Aditivo e idempotente.

ALTER TABLE "logistica"."despesa_veiculo"
  ADD COLUMN IF NOT EXISTS "numero_documento" TEXT;
ALTER TABLE "logistica"."despesa_veiculo"
  ADD COLUMN IF NOT EXISTS "sem_nota" BOOLEAN NOT NULL DEFAULT false;

-- Duplicidade: a mesma nota só pode repetir no veículo se for TIPO de despesa
-- diferente (rateio). Índice parcial único — ignora linhas sem documento (semNota
-- / lançamentos antigos), que repetem por natureza.
CREATE UNIQUE INDEX IF NOT EXISTS "despesa_veiculo_doc_unico"
  ON "logistica"."despesa_veiculo" ("veiculo_id", "numero_documento", "tipo_despesa_id")
  WHERE "numero_documento" IS NOT NULL;
