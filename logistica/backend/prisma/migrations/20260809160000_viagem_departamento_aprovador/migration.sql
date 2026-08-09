-- Departamento que RESPONDE pelas despesas da viagem — congelado no ato da saída.
--
-- Antes o aprovador era derivado do cadastro do VEÍCULO (veiculo.supervisor_id); mas a
-- despesa é da PESSOA, não do carro — pegar um veículo de outro departamento mandava a
-- aprovação para um gerente sem relação com quem gastou.
--
-- Nullable de propósito: viagens anteriores não têm o retrato e seguem na regra antiga.
ALTER TABLE "logistica"."viagem" ADD COLUMN "departamento_aprovador_id" TEXT;

-- A aprovação filtra por este campo.
CREATE INDEX "viagem_departamento_aprovador_id_idx" ON "logistica"."viagem"("departamento_aprovador_id");
