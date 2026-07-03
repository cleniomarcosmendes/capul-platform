-- Redesenho: Região DESCARTADA (município vem do cliente Protheus). Remove o
-- catálogo Regiao + RegiaoMunicipio e as colunas regiao_id de viagem/parada.
ALTER TABLE "logistica"."viagem" DROP CONSTRAINT IF EXISTS "viagem_regiao_id_fkey";
DROP INDEX IF EXISTS "logistica"."viagem_regiao_id_idx";
ALTER TABLE "logistica"."viagem" DROP COLUMN IF EXISTS "regiao_id";
ALTER TABLE "logistica"."parada" DROP CONSTRAINT IF EXISTS "parada_regiao_id_fkey";
DROP INDEX IF EXISTS "logistica"."parada_regiao_id_idx";
ALTER TABLE "logistica"."parada" DROP COLUMN IF EXISTS "regiao_id";
DROP TABLE IF EXISTS "logistica"."regiao_municipio";
DROP TABLE IF EXISTS "logistica"."regiao";
