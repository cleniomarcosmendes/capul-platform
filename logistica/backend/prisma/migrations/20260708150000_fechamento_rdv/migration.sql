-- Encerramento mensal do RDV (TEMA 2): trava despesas e adiantamentos de um
-- supervisor num mês. Presença da linha = mês ENCERRADO; reabrir = remove a linha.
CREATE TABLE "logistica"."fechamento_rdv" (
    "id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "mes_referencia" INTEGER NOT NULL,
    "fechado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_por_id" TEXT NOT NULL,
    CONSTRAINT "fechamento_rdv_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fechamento_rdv_supervisor_id_mes_referencia_key" ON "logistica"."fechamento_rdv"("supervisor_id", "mes_referencia");
ALTER TABLE "logistica"."fechamento_rdv"
  ADD CONSTRAINT "fechamento_rdv_supervisor_id_fkey"
  FOREIGN KEY ("supervisor_id") REFERENCES "logistica"."supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
