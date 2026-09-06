-- CreateEnum
CREATE TYPE "rh"."DecisaoElegibilidade" AS ENUM ('INCLUIR', 'EXCLUIR');

-- CreateEnum
CREATE TYPE "rh"."MotivoElegibilidade" AS ENUM ('CARGO_INELEGIVEL', 'REGRA_CICLO', 'MANUAL_RH');

-- AlterTable
ALTER TABLE "rh"."ciclo" ADD COLUMN     "incluir_afastados" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rh"."ciclo_elegibilidade" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "decisao" "rh"."DecisaoElegibilidade" NOT NULL,
    "motivo" "rh"."MotivoElegibilidade" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "registrado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removido_em" TIMESTAMP(3),
    "removido_por_id" TEXT,

    CONSTRAINT "ciclo_elegibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ciclo_elegibilidade_ciclo_id_removido_em_idx" ON "rh"."ciclo_elegibilidade"("ciclo_id", "removido_em");

-- CreateIndex
CREATE INDEX "ciclo_elegibilidade_ciclo_id_colaborador_id_criado_em_idx" ON "rh"."ciclo_elegibilidade"("ciclo_id", "colaborador_id", "criado_em");

-- AddForeignKey
ALTER TABLE "rh"."ciclo_elegibilidade" ADD CONSTRAINT "ciclo_elegibilidade_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "rh"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."ciclo_elegibilidade" ADD CONSTRAINT "ciclo_elegibilidade_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

