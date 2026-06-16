-- AlterTable: quem registrou a entrega (accountability — PADRAO/INDIVIDUAL)
ALTER TABLE "logistica"."entrega" ADD COLUMN "registrado_por_matricula" TEXT;
ALTER TABLE "logistica"."entrega" ADD COLUMN "registrado_por_nome" TEXT;
