-- Compra de licenças (cabeçalho NF, itens = licenças). Decisão 03/06.
-- Toda licença passa a referenciar um cabeçalho (licenca_compras). numero='S/N'
-- = sem nota fiscal (vários registros podem ter 'S/N' → sem unique em numero).
-- Migração cirúrgica (multi-schema): cria a tabela, adiciona nota_id em
-- software_licencas, gera 1 cabeçalho 'S/N' por licença pré-existente (backfill),
-- e só então cria as FKs.

-- CreateTable
CREATE TABLE "gestao_ti"."licenca_compras" (
    "id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "sem_nota" BOOLEAN NOT NULL DEFAULT false,
    "data_lancamento" TIMESTAMP(3) NOT NULL,
    "data_vencimento" TIMESTAMP(3),
    "chave_nfe" CHAR(44),
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fornecedor_id" TEXT,
    "criado_por_id" TEXT,
    "departamento_lancamento_id" TEXT NOT NULL,

    CONSTRAINT "licenca_compras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "licenca_compras_fornecedor_id_idx" ON "gestao_ti"."licenca_compras"("fornecedor_id");
CREATE INDEX "licenca_compras_chave_nfe_idx" ON "gestao_ti"."licenca_compras"("chave_nfe");
CREATE INDEX "licenca_compras_data_lancamento_idx" ON "gestao_ti"."licenca_compras"("data_lancamento");

-- AlterTable: nota_id na licença (NULLABLE nesta fase de transição)
ALTER TABLE "gestao_ti"."software_licencas" ADD COLUMN "nota_id" TEXT;

-- CreateIndex
CREATE INDEX "software_licencas_nota_id_idx" ON "gestao_ti"."software_licencas"("nota_id");

-- Backfill: 1 cabeçalho 'S/N' por licença pré-existente, e liga via nota_id.
-- Mantém os dados (fornecedor/chave/datas/valor/depto-lançamento) que existirem.
WITH novos AS (
  SELECT l.id AS lic_id, gen_random_uuid()::text AS nota_id
  FROM "gestao_ti"."software_licencas" l
  WHERE l.nota_id IS NULL
), ins AS (
  INSERT INTO "gestao_ti"."licenca_compras"
    (id, numero, sem_nota, data_lancamento, data_vencimento, chave_nfe,
     valor_total, observacao, fornecedor_id, criado_por_id,
     departamento_lancamento_id, created_at, updated_at)
  SELECT n.nota_id, 'S/N', (l.chave_nfe IS NULL),
         COALESCE(l.data_inicio, l.created_at), l.data_vencimento, l.chave_nfe,
         COALESCE(l.valor_total, 0),
         'Migrado 03/06 — cabeçalho gerado para licença pré-existente',
         l.fornecedor_id, NULL, l.departamento_lancamento_id, l.created_at, now()
  FROM novos n
  JOIN "gestao_ti"."software_licencas" l ON l.id = n.lic_id
  RETURNING 1
)
UPDATE "gestao_ti"."software_licencas" l
SET nota_id = n.nota_id
FROM novos n
WHERE l.id = n.lic_id;

-- AddForeignKey (após o backfill)
ALTER TABLE "gestao_ti"."licenca_compras" ADD CONSTRAINT "licenca_compras_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "gestao_ti"."fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gestao_ti"."licenca_compras" ADD CONSTRAINT "licenca_compras_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gestao_ti"."software_licencas" ADD CONSTRAINT "software_licencas_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "gestao_ti"."licenca_compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
