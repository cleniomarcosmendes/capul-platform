-- Supervisor de venda (RDV) passa a ter DEPARTAMENTO próprio.
--
-- Motivo: o "Supervisor de Departamento" (papel SUPERVISOR_FROTA) passa a gerir o RDV
-- ESCOPADO POR DEPARTAMENTO. O cadastro do representante (logistica.supervisor) só tinha
-- filial + coordenador — não dava para inferir o departamento antes de existir coordenador
-- (justo o momento de "montar o time"). Com a coluna própria, o escopo funciona desde a
-- criação.
--
-- Nullable: registros existentes ficam sem departamento até serem editados no "montar o
-- time". FK ausente por convenção do schema logística (ids de core — usuários/filiais/
-- departamentos — são gravados como String, SEM FK cross-schema). Aditiva.
ALTER TABLE "logistica"."supervisor" ADD COLUMN "departamento_id" TEXT;

CREATE INDEX "supervisor_departamento_id_idx" ON "logistica"."supervisor"("departamento_id");
