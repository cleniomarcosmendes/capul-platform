-- CreateTable: parcela_rateio_projetos
CREATE TABLE "gestao_ti"."parcela_rateio_projetos" (
    "id" TEXT NOT NULL,
    "percentual" DECIMAL(7,4),
    "valor_calculado" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcela_id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,

    CONSTRAINT "parcela_rateio_projetos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parcela_rateio_projetos_parcela_id_projeto_id_key" ON "gestao_ti"."parcela_rateio_projetos"("parcela_id", "projeto_id");

-- CreateIndex
CREATE INDEX "parcela_rateio_projetos_projeto_id_idx" ON "gestao_ti"."parcela_rateio_projetos"("projeto_id");

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcela_rateio_projetos" ADD CONSTRAINT "parcela_rateio_projetos_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "gestao_ti"."parcelas_contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcela_rateio_projetos" ADD CONSTRAINT "parcela_rateio_projetos_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
