-- Supervisor de ÁREA do veículo (atendente técnico da Indústria/Filial 18, por
-- matrícula Protheus) — DISTINTO do supervisor_id (encarregado que gerencia o
-- veículo). Ver docs/PLANO_LOGISTICA_REPRESENTANTES_v1.md.

-- AlterTable
ALTER TABLE "logistica"."veiculo" ADD COLUMN     "supervisor_area_matricula" TEXT,
ADD COLUMN     "supervisor_area_nome" TEXT;

-- CreateTable
CREATE TABLE "logistica"."veiculo_supervisor_area_historico" (
    "id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "matricula_anterior" TEXT,
    "matricula_nova" TEXT NOT NULL,
    "nome_novo" TEXT,
    "alterado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por_id" TEXT NOT NULL,

    CONSTRAINT "veiculo_supervisor_area_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "veiculo_supervisor_area_historico_veiculo_id_idx" ON "logistica"."veiculo_supervisor_area_historico"("veiculo_id");

-- CreateIndex
CREATE INDEX "veiculo_supervisor_area_matricula_idx" ON "logistica"."veiculo"("supervisor_area_matricula");

-- AddForeignKey
ALTER TABLE "logistica"."veiculo_supervisor_area_historico" ADD CONSTRAINT "veiculo_supervisor_area_historico_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "logistica"."veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
