-- CreateEnum
CREATE TYPE "logistica"."PropriedadeVeiculo" AS ENUM ('PROPRIO', 'ALUGADO');

-- AlterTable
ALTER TABLE "logistica"."veiculo" ADD COLUMN "propriedade" "logistica"."PropriedadeVeiculo" NOT NULL DEFAULT 'PROPRIO';
