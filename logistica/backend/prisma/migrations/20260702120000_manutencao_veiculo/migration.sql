-- Manutenção do veículo: histórico + tipo (preventiva/corretiva). Complementa o
-- ciclo preventivo por KM já existente (campos km_ultima/km_proxima no veiculo).

-- CreateEnum
CREATE TYPE "logistica"."TipoManutencao" AS ENUM ('PREVENTIVA', 'CORRETIVA');

-- CreateTable
CREATE TABLE "logistica"."manutencao_veiculo" (
    "id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "tipo" "logistica"."TipoManutencao" NOT NULL DEFAULT 'PREVENTIVA',
    "km" INTEGER NOT NULL,
    "data_manutencao" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "custo" DECIMAL(12,2),
    "reiniciou_ciclo" BOOLEAN NOT NULL DEFAULT false,
    "km_proxima_gerada" INTEGER,
    "registrado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manutencao_veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manutencao_veiculo_veiculo_id_data_manutencao_idx" ON "logistica"."manutencao_veiculo"("veiculo_id", "data_manutencao");

-- AddForeignKey
ALTER TABLE "logistica"."manutencao_veiculo" ADD CONSTRAINT "manutencao_veiculo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "logistica"."veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
