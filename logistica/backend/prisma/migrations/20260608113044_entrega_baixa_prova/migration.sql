-- AlterTable
ALTER TABLE "logistica"."entrega" ADD COLUMN     "baixado_por_id" TEXT,
ADD COLUMN     "data_hora_entrega" TIMESTAMP(3),
ADD COLUMN     "geo_lat" DECIMAL(10,7),
ADD COLUMN     "geo_lng" DECIMAL(10,7),
ADD COLUMN     "motivo_nao_entrega" TEXT;

