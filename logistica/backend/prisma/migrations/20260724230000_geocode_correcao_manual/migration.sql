-- Correção manual da coordenada (operador arrasta o pin no mapa da montagem).
-- Entrada com fonte='MANUAL' nunca é sobrescrita pelo provedor de geocode e
-- passa a valer para toda entrega futura no mesmo endereço — por isso guarda
-- quem corrigiu e quando. Aditivo: colunas nuláveis, sem backfill.
-- AlterTable
ALTER TABLE "logistica"."geocode_cache" ADD COLUMN     "corrigido_em" TIMESTAMP(3),
ADD COLUMN     "corrigido_por_id" TEXT;
