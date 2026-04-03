-- CreateEnum
CREATE TYPE "gestao_ti"."StatusNotaFiscal" AS ENUM ('REGISTRADA', 'CONFERIDA', 'CANCELADA');

-- CreateTable: tipos_produto
CREATE TABLE "gestao_ti"."tipos_produto" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_produto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_produto_codigo_key" ON "gestao_ti"."tipos_produto"("codigo");

-- AlterTable: produtos - add tipo_produto_id
ALTER TABLE "gestao_ti"."produtos" ADD COLUMN "tipo_produto_id" TEXT;

-- AddForeignKey
ALTER TABLE "gestao_ti"."produtos" ADD CONSTRAINT "produtos_tipo_produto_id_fkey" FOREIGN KEY ("tipo_produto_id") REFERENCES "gestao_ti"."tipos_produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: notas_fiscais
CREATE TABLE "gestao_ti"."notas_fiscais" (
    "id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL,
    "status" "gestao_ti"."StatusNotaFiscal" NOT NULL DEFAULT 'REGISTRADA',
    "observacao" TEXT,
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable: nota_fiscal_itens
CREATE TABLE "gestao_ti"."nota_fiscal_itens" (
    "id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor_unitario" DECIMAL(12,2) NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "observacao" TEXT,
    "nota_fiscal_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "departamento_id" TEXT NOT NULL,
    "projeto_id" TEXT,

    CONSTRAINT "nota_fiscal_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_numero_fornecedor_id_key" ON "gestao_ti"."notas_fiscais"("numero", "fornecedor_id");

-- CreateIndex
CREATE INDEX "notas_fiscais_fornecedor_id_idx" ON "gestao_ti"."notas_fiscais"("fornecedor_id");

-- CreateIndex
CREATE INDEX "notas_fiscais_filial_id_idx" ON "gestao_ti"."notas_fiscais"("filial_id");

-- CreateIndex
CREATE INDEX "notas_fiscais_data_emissao_idx" ON "gestao_ti"."notas_fiscais"("data_emissao");

-- CreateIndex
CREATE INDEX "nota_fiscal_itens_nota_fiscal_id_idx" ON "gestao_ti"."nota_fiscal_itens"("nota_fiscal_id");

-- CreateIndex
CREATE INDEX "nota_fiscal_itens_projeto_id_idx" ON "gestao_ti"."nota_fiscal_itens"("projeto_id");

-- CreateIndex
CREATE INDEX "nota_fiscal_itens_departamento_id_idx" ON "gestao_ti"."nota_fiscal_itens"("departamento_id");

-- AddForeignKey
ALTER TABLE "gestao_ti"."notas_fiscais" ADD CONSTRAINT "notas_fiscais_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "gestao_ti"."fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."notas_fiscais" ADD CONSTRAINT "notas_fiscais_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."notas_fiscais" ADD CONSTRAINT "notas_fiscais_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "gestao_ti"."notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "gestao_ti"."produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "core"."departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
