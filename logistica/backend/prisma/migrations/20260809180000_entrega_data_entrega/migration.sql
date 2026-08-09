-- DIA em que a entrega deve ser feita (ponto 2 da pauta de 09/08).
--
-- Há locais atendidos em dias específicos — a rota daquela região só passa em certos
-- dias. A montagem da rota ordena por esta data e AVISA (sem bloquear) quando o
-- operador seleciona uma entrega fora do dia atual.
--
-- Data-só ancorada ao meio-dia -03:00 na aplicação (mesma regra de data_despesa):
-- guardar meia-noite faz a entrega "pular" para o dia anterior conforme o fuso.
-- Nullable: entregas anteriores não têm o dia e a montagem as trata como sem data.
ALTER TABLE "logistica"."entrega" ADD COLUMN "data_entrega" TIMESTAMP(3);

-- A fila de entregas é lida por filial e ordenada por dia.
CREATE INDEX "entrega_filial_id_data_entrega_idx" ON "logistica"."entrega"("filial_id", "data_entrega");
