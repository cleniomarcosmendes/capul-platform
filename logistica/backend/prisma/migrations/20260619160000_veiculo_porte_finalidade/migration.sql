-- Classificação do veículo (19/06) em 2 eixos independentes:
--   porte: PESADO | LEVE
--   finalidade: ENTREGA | PASSEIO | SERVICO
-- Ambos opcionais (nullable) — o gestor classifica o cadastro existente; até lá
-- aparecem como "Não informado" na Análise da Frota. Aditivo e idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'PorteVeiculo' AND n.nspname = 'logistica') THEN
    CREATE TYPE "logistica"."PorteVeiculo" AS ENUM ('PESADO', 'LEVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'FinalidadeVeiculo' AND n.nspname = 'logistica') THEN
    CREATE TYPE "logistica"."FinalidadeVeiculo" AS ENUM ('ENTREGA', 'PASSEIO', 'SERVICO');
  END IF;
END $$;

ALTER TABLE "logistica"."veiculo" ADD COLUMN IF NOT EXISTS "porte" "logistica"."PorteVeiculo";
ALTER TABLE "logistica"."veiculo" ADD COLUMN IF NOT EXISTS "finalidade" "logistica"."FinalidadeVeiculo";
