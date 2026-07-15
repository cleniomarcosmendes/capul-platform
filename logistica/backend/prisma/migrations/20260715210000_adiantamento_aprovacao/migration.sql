-- Aprovação do adiantamento do RDV pelo coordenador.
--
-- Motivo: o adiantamento passou a ser lançado também pelo PRÓPRIO supervisor de área
-- (auto-serviço). Esse lançamento nasce PENDENTE e o coordenador (ou Supervisor de
-- Departamento) APROVA/REJEITA. O lançado pelo próprio coordenador/departamento já nasce
-- APROVADO. Só o APROVADO entra no saldo da RDV.
--
-- Aditiva: DEFAULT 'APROVADO' cobre as linhas existentes (que precedem o workflow) e o
-- lançamento do coordenador; o serviço grava PENDENTE no auto-serviço do supervisor.
-- decidido_por_id/decidido_em/motivo_rejeicao registram a decisão (ids de core como String,
-- sem FK cross-schema, por convenção do schema logística).

-- CreateEnum
CREATE TYPE "logistica"."SituacaoAdiantamento" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- AlterTable
ALTER TABLE "logistica"."adiantamento"
  ADD COLUMN "situacao" "logistica"."SituacaoAdiantamento" NOT NULL DEFAULT 'APROVADO',
  ADD COLUMN "decidido_por_id" TEXT,
  ADD COLUMN "decidido_em" TIMESTAMP(3),
  ADD COLUMN "motivo_rejeicao" TEXT;
