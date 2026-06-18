-- Planejamento de paradas de frota (Fase 2b): PLANEJADA → REALIZADA / PULADA.
-- Aditiva: paradas existentes (ad-hoc) assumem o default REALIZADA.

-- CreateEnum
CREATE TYPE "logistica"."StatusParada" AS ENUM ('PLANEJADA', 'REALIZADA', 'PULADA');

-- AlterTable
ALTER TABLE "logistica"."parada"
  ADD COLUMN "status" "logistica"."StatusParada" NOT NULL DEFAULT 'REALIZADA',
  ADD COLUMN "planejado_local" TEXT,
  ADD COLUMN "realizada_em" TIMESTAMP(3);
