-- CreateTable: cadastro próprio de fornecedores da despesa de frota
CREATE TABLE "logistica"."fornecedor_despesa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fornecedor_despesa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fornecedor_despesa_nome_key" ON "logistica"."fornecedor_despesa"("nome");

-- AlterTable: despesa referencia o fornecedor (mantém fornecedor texto livre)
ALTER TABLE "logistica"."despesa_veiculo" ADD COLUMN "fornecedor_id" TEXT;
ALTER TABLE "logistica"."despesa_veiculo" ADD CONSTRAINT "despesa_veiculo_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "logistica"."fornecedor_despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "despesa_veiculo_fornecedor_id_idx" ON "logistica"."despesa_veiculo"("fornecedor_id");

-- Seed: fornecedor padrão "NÃO DEFINIDO"
INSERT INTO "logistica"."fornecedor_despesa" ("id", "nome", "ativo", "criado_em")
VALUES (gen_random_uuid()::text, 'NÃO DEFINIDO', true, now())
ON CONFLICT ("nome") DO NOTHING;
