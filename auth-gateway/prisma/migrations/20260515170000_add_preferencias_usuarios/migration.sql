-- AlterTable
ALTER TABLE "core"."usuarios" ADD COLUMN "preferencias" JSONB NOT NULL DEFAULT '{}';
