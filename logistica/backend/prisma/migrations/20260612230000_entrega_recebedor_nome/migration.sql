-- Quem recebeu (informado na baixa) — denormalizado na entrega pra consulta
-- rápida (a trilha completa segue no cofre).
ALTER TABLE "logistica"."entrega" ADD COLUMN "recebedor_nome" TEXT;
