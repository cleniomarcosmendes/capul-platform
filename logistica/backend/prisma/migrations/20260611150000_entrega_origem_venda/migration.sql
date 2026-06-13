-- Origem da venda (indicador de canal): PRESENCIAL | TELE_VENDA | OUTRO.
-- Nullable: entregas anteriores à feature ficam sem origem (desconhecida).
CREATE TYPE "logistica"."OrigemVenda" AS ENUM ('PRESENCIAL', 'TELE_VENDA', 'OUTRO');

ALTER TABLE "logistica"."entrega" ADD COLUMN "origem_venda" "logistica"."OrigemVenda";
