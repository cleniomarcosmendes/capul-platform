-- AlterTable
ALTER TABLE "gestao_ti"."comentarios_tarefa" ADD COLUMN IF NOT EXISTS "visivel_pendencia" BOOLEAN NOT NULL DEFAULT false;
