-- Rastreamento em tempo real (Fase A, 19/06): pings de GPS durante a viagem
-- em curso. Tabela nova (trail); o Monitor mostra a última posição por viagem
-- ativa. Aditivo, idempotente. FK em CASCADE (some junto com a viagem).
CREATE TABLE IF NOT EXISTS "logistica"."posicao_veiculo" (
  "id"           TEXT NOT NULL,
  "viagem_id"    TEXT NOT NULL,
  "latitude"     DECIMAL(10,7) NOT NULL,
  "longitude"    DECIMAL(10,7) NOT NULL,
  "precisao"     DECIMAL(7,2),
  "velocidade"   DECIMAL(7,2),
  "bateria"      INTEGER,
  "capturado_em" TIMESTAMP(3) NOT NULL,
  "recebido_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "posicao_veiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "posicao_veiculo_viagem_id_capturado_em_idx"
  ON "logistica"."posicao_veiculo" ("viagem_id", "capturado_em");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posicao_veiculo_viagem_id_fkey'
      AND table_schema = 'logistica'
  ) THEN
    ALTER TABLE "logistica"."posicao_veiculo"
      ADD CONSTRAINT "posicao_veiculo_viagem_id_fkey"
      FOREIGN KEY ("viagem_id") REFERENCES "logistica"."viagem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
