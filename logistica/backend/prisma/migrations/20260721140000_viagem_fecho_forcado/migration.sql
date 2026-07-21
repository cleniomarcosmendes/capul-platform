-- Encerramento FORÇADO da rota pelo gestor de entrega (KM final obrigatório) +
-- auditoria (quem forçou e quando). Aditivo, colunas nuláveis.
-- AlterTable
ALTER TABLE "logistica"."viagem" ADD COLUMN     "fechado_forcado_em" TIMESTAMP(3),
ADD COLUMN     "fechado_forcado_por_id" TEXT;
