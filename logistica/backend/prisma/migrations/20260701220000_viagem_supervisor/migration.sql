-- Fase 3b (módulo Supervisores/RDV) — viagem MENSAL do supervisor.
-- Ver docs/PLANO_LOGISTICA_REPRESENTANTES_v1.md.

-- AlterEnum: novo tipo de viagem
ALTER TYPE "logistica"."TipoViagem" ADD VALUE 'SUPERVISOR';

-- AlterTable: container mensal (mês de referência AAAAMM + adiantamento + região)
ALTER TABLE "logistica"."viagem" ADD COLUMN "mes_referencia" INTEGER,
ADD COLUMN "adiantamento" DECIMAL(12,2),
ADD COLUMN "regiao_id" TEXT;

-- CreateIndex
CREATE INDEX "viagem_regiao_id_idx" ON "logistica"."viagem"("regiao_id");

-- AddForeignKey
ALTER TABLE "logistica"."viagem" ADD CONSTRAINT "viagem_regiao_id_fkey" FOREIGN KEY ("regiao_id") REFERENCES "logistica"."regiao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
