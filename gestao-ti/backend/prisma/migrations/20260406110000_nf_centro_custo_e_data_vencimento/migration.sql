-- AlterTable: adicionar data_vencimento em notas_fiscais
ALTER TABLE "gestao_ti"."notas_fiscais" ADD COLUMN "data_vencimento" TIMESTAMP;

-- AlterTable: trocar departamento_id por centro_custo_id em nota_fiscal_itens
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD COLUMN "centro_custo_id" TEXT;

-- Migrar dados: copiar departamento_id para centro_custo_id (se houver registros)
-- Nota: centro_custo_id ficara NULL para registros existentes pois departamento != centro_custo

-- Remover FK e index antigos
ALTER TABLE "gestao_ti"."nota_fiscal_itens" DROP CONSTRAINT IF EXISTS "nota_fiscal_itens_departamento_id_fkey";
DROP INDEX IF EXISTS "gestao_ti"."nota_fiscal_itens_departamento_id_idx";

-- Remover coluna antiga
ALTER TABLE "gestao_ti"."nota_fiscal_itens" DROP COLUMN IF EXISTS "departamento_id";

-- Tornar centro_custo_id NOT NULL (registros existentes precisam ser atualizados antes)
-- Por seguranca, deixamos nullable e o backend validara

-- Criar index e FK novos
CREATE INDEX "nota_fiscal_itens_centro_custo_id_idx" ON "gestao_ti"."nota_fiscal_itens"("centro_custo_id");
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "core"."centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
