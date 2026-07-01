-- Fase 2 (módulo Supervisores/RDV) — despesa categorizada VEÍCULO × INDIVÍDUO.
-- Ver docs/PLANO_LOGISTICA_REPRESENTANTES_v1.md.

-- CreateEnum
CREATE TYPE "logistica"."CategoriaDespesa" AS ENUM ('VEICULO', 'INDIVIDUO');

-- AlterTable: tipo_despesa ganha a categoria (default VEÍCULO — retrocompat).
ALTER TABLE "logistica"."tipo_despesa" ADD COLUMN "categoria" "logistica"."CategoriaDespesa" NOT NULL DEFAULT 'VEICULO';

-- AlterTable: despesa de INDIVÍDUO não tem veículo → veiculo_id opcional.
ALTER TABLE "logistica"."despesa_veiculo" ALTER COLUMN "veiculo_id" DROP NOT NULL;
