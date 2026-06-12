-- Re-entrega (nova tentativa): contador + trilha das tentativas anteriores.
ALTER TABLE "logistica"."entrega" ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "logistica"."entrega" ADD COLUMN "historico_tentativas" JSONB;
