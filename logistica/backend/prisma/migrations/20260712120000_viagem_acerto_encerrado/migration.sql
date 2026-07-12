-- Encerramento do ACERTO da viagem de frota — INDEPENDENTE da conclusão da viagem
-- (o veículo é liberado ao entregar; o acerto vem depois). Presença de
-- acerto_encerrado_em = acerto TRAVADO (não aceita despesa/adiantamento); reabrir = NULL.
ALTER TABLE "logistica"."viagem" ADD COLUMN "acerto_encerrado_em" TIMESTAMP(3);
ALTER TABLE "logistica"."viagem" ADD COLUMN "acerto_encerrado_por_id" TEXT;
