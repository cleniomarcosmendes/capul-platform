-- CreateTable
CREATE TABLE "gestao_ti"."anexos_nota_fiscal" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota_fiscal_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_nota_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anexos_nota_fiscal_nota_fiscal_id_idx" ON "gestao_ti"."anexos_nota_fiscal"("nota_fiscal_id");

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_nota_fiscal" ADD CONSTRAINT "anexos_nota_fiscal_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "gestao_ti"."notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_nota_fiscal" ADD CONSTRAINT "anexos_nota_fiscal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
