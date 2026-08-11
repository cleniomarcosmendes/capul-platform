-- Separa o PIN DE PLANEJAMENTO (onde achamos que o endereço fica) do GPS DA
-- BAIXA (onde a entrega realmente aconteceu). Até aqui os dois dividiam
-- geo_lat/geo_lng: a baixa sobrescrevia o pin com o GPS e gravava NULL quando o
-- GPS não vinha, apagando o planejamento. Separados, viram o material do
-- aprendizado de campo — comparar um com o outro é o que deixa o endereço ficar
-- preciso com o tempo.
ALTER TABLE "logistica"."entrega" ADD COLUMN     "baixa_geo_lat" DECIMAL(10,7),
ADD COLUMN     "baixa_geo_lng" DECIMAL(10,7);

-- Procedência do ponto aprendido em campo (fonte=CAMPO).
ALTER TABLE "logistica"."geocode_cache" ADD COLUMN     "aprendido_amostras" INTEGER,
ADD COLUMN     "aprendido_desvio_m" INTEGER,
ADD COLUMN     "aprendido_em" TIMESTAMP(3);

-- Backfill: em entrega JÁ BAIXADA, geo_lat/geo_lng só podia ter vindo da baixa
-- (era ela que escrevia por último, e gravava NULL sem GPS). Esse histórico é
-- justamente a evidência que alimenta o aprendizado — mover em vez de descartar.
UPDATE "logistica"."entrega"
   SET "baixa_geo_lat" = "geo_lat",
       "baixa_geo_lng" = "geo_lng"
 WHERE "status" IN ('ENTREGUE', 'NAO_ENTREGUE')
   AND "geo_lat" IS NOT NULL;
