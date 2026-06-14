-- Manutenção preventiva por KM (Fase 2). intervalo = a cada quantos km revisa;
-- km_proxima_manutencao = odômetro-alvo da próxima (km_ultima + intervalo).
ALTER TABLE "logistica"."veiculo" ADD COLUMN "intervalo_manutencao_km" INTEGER;
ALTER TABLE "logistica"."veiculo" ADD COLUMN "km_ultima_manutencao" INTEGER;
ALTER TABLE "logistica"."veiculo" ADD COLUMN "km_proxima_manutencao" INTEGER;
