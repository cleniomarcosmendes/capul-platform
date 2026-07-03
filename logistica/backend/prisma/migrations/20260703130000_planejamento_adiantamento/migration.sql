-- Fase 6b — planejamento do supervisor (workflow de aprovação) + adiantamentos
-- (mensais, N). adiantamento/regiaoId da viagem ficam obsoletos (removidos depois).

-- CreateEnum
CREATE TYPE "logistica"."StatusPlanejamento" AS ENUM ('RASCUNHO', 'ENVIADO', 'APROVADO', 'AJUSTADO', 'REJEITADO', 'EM_EXECUCAO', 'CONCLUIDO');

-- AlterTable: viagem ganha o ciclo do planejamento + vínculo ao supervisor cadastrado
ALTER TABLE "logistica"."viagem" ADD COLUMN "status_planejamento" "logistica"."StatusPlanejamento",
ADD COLUMN "supervisor_registro_id" TEXT,
ADD COLUMN "aprovado_por_id" TEXT,
ADD COLUMN "aprovado_em" TIMESTAMP(3),
ADD COLUMN "comentario_coordenador" TEXT;

-- CreateIndex
CREATE INDEX "viagem_supervisor_registro_id_idx" ON "logistica"."viagem"("supervisor_registro_id");

-- AddForeignKey
ALTER TABLE "logistica"."viagem" ADD CONSTRAINT "viagem_supervisor_registro_id_fkey" FOREIGN KEY ("supervisor_registro_id") REFERENCES "logistica"."supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: adiantamento (mensal, vários por supervisor/mês)
CREATE TABLE "logistica"."adiantamento" (
    "id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "mes_referencia" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data_adiantamento" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "lancado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adiantamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adiantamento_supervisor_id_mes_referencia_idx" ON "logistica"."adiantamento"("supervisor_id", "mes_referencia");

-- AddForeignKey
ALTER TABLE "logistica"."adiantamento" ADD CONSTRAINT "adiantamento_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "logistica"."supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
