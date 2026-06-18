-- Escopo do local de parada (18/06): filial + departamento + veículo (todos
-- nullable; null = global). Remove a unicidade global do nome (mesmo nome pode
-- existir em filiais/escopos diferentes). Aditivo.
ALTER TABLE "logistica"."local_parada" ADD COLUMN IF NOT EXISTS "filial_id" TEXT;
ALTER TABLE "logistica"."local_parada" ADD COLUMN IF NOT EXISTS "departamento_id" TEXT;
ALTER TABLE "logistica"."local_parada" ADD COLUMN IF NOT EXISTS "veiculo_id" TEXT;

DROP INDEX IF EXISTS "logistica"."local_parada_nome_key";

CREATE INDEX IF NOT EXISTS "local_parada_filial_id_idx" ON "logistica"."local_parada"("filial_id");
CREATE INDEX IF NOT EXISTS "local_parada_veiculo_id_idx" ON "logistica"."local_parada"("veiculo_id");
