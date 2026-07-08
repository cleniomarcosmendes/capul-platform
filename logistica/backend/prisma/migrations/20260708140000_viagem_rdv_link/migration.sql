-- Vínculo Saída de Veículo (frota) → planejamento RDV (viagem SUPERVISOR).
-- Várias saídas de frota podem apontar para 1 RDV (mensal); o RDV soma o KM.
-- Auto-relação na própria tabela viagem. Aditivo (coluna nula) + FK SET NULL.
ALTER TABLE "logistica"."viagem" ADD COLUMN "rdv_viagem_id" TEXT;
ALTER TABLE "logistica"."viagem"
  ADD CONSTRAINT "viagem_rdv_viagem_id_fkey"
  FOREIGN KEY ("rdv_viagem_id") REFERENCES "logistica"."viagem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "viagem_rdv_viagem_id_idx" ON "logistica"."viagem"("rdv_viagem_id");
