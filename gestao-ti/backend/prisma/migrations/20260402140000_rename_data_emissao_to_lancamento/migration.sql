-- Rename column data_emissao to data_lancamento
ALTER TABLE "gestao_ti"."notas_fiscais" RENAME COLUMN "data_emissao" TO "data_lancamento";

-- Rename index
DROP INDEX IF EXISTS "gestao_ti"."notas_fiscais_data_emissao_idx";
CREATE INDEX "notas_fiscais_data_lancamento_idx" ON "gestao_ti"."notas_fiscais"("data_lancamento");
