-- Cancelamento do planejamento do supervisor (RDV) por força maior.
-- Antes só existiam Ajustar/Rejeitar, válidos apenas no estado ENVIADO: depois de
-- APROVADO não havia caminho de volta e o planejamento ficava pendurado para sempre.
-- CANCELADO tira o planejamento da prestação de contas; o motivo é obrigatório na
-- regra de negócio (coluna nullable apenas por causa das linhas antigas).

-- AlterEnum
ALTER TYPE "logistica"."StatusPlanejamento" ADD VALUE 'CANCELADO';

-- AlterTable
ALTER TABLE "logistica"."viagem" ADD COLUMN     "cancelado_em" TIMESTAMP(3),
ADD COLUMN     "cancelado_por_id" TEXT,
ADD COLUMN     "motivo_cancelamento" TEXT;
