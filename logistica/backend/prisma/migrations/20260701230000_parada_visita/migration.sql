-- Fase 3c (módulo Supervisores/RDV) — visita do supervisor na Parada:
-- atividade, região, cliente (matrícula/sócio), município, propriedade/fazenda.

-- AlterTable
ALTER TABLE "logistica"."parada" ADD COLUMN "atividade_id" TEXT,
ADD COLUMN "regiao_id" TEXT,
ADD COLUMN "cliente_matricula" TEXT,
ADD COLUMN "cliente_nome" TEXT,
ADD COLUMN "municipio" TEXT,
ADD COLUMN "propriedade" TEXT;

-- CreateIndex
CREATE INDEX "parada_atividade_id_idx" ON "logistica"."parada"("atividade_id");
CREATE INDEX "parada_regiao_id_idx" ON "logistica"."parada"("regiao_id");

-- AddForeignKey
ALTER TABLE "logistica"."parada" ADD CONSTRAINT "parada_atividade_id_fkey" FOREIGN KEY ("atividade_id") REFERENCES "logistica"."atividade_visita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "logistica"."parada" ADD CONSTRAINT "parada_regiao_id_fkey" FOREIGN KEY ("regiao_id") REFERENCES "logistica"."regiao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
