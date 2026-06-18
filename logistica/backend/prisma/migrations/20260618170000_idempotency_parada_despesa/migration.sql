-- Idempotência para reenvio da fila offline (Fase 2d): parada ad-hoc e despesa
-- da viagem não duplicam quando a fila reenvia a mesma ação. Aditiva (nullable).

ALTER TABLE "logistica"."parada" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "logistica"."despesa_veiculo" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "parada_idempotency_key_key" ON "logistica"."parada"("idempotency_key");
CREATE UNIQUE INDEX "despesa_veiculo_idempotency_key_key" ON "logistica"."despesa_veiculo"("idempotency_key");
