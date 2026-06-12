-- Rascunho de viagem pode nascer só com a carga: veículo/motorista definidos
-- depois (o despacho exige os dois).
ALTER TABLE "logistica"."viagem" ALTER COLUMN "veiculo_id" DROP NOT NULL;
ALTER TABLE "logistica"."viagem" ALTER COLUMN "motorista_id" DROP NOT NULL;
