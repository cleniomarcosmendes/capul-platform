-- Sub-fase 3 (19/06): aprovação por tipo de despesa + anormalidade (mau uso).
-- Aditivo e idempotente.

-- Tipo de despesa: exige aprovação? (default true — comportamento atual)
ALTER TABLE "logistica"."tipo_despesa"
  ADD COLUMN IF NOT EXISTS "requer_aprovacao" BOOLEAN NOT NULL DEFAULT true;

-- Despesa: flag de anormalidade (mau uso) + justificativa, marcada pelo gestor.
ALTER TABLE "logistica"."despesa_veiculo"
  ADD COLUMN IF NOT EXISTS "anormalidade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "logistica"."despesa_veiculo"
  ADD COLUMN IF NOT EXISTS "motivo_anormalidade" TEXT;
