-- Fase 1c: cache de geocodificação (endereço normalizado -> lat/lng).
CREATE TABLE "logistica"."geocode_cache" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "fonte" TEXT,
    "precisao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "geocode_cache_chave_key" ON "logistica"."geocode_cache"("chave");
