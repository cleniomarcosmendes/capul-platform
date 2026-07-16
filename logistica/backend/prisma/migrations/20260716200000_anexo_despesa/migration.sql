-- Vários comprovantes por despesa (foto/PDF). Tabela `anexo_despesa` (N por despesa) —
-- o binário fica no object store (MinIO/cofre); aqui só a chave + hash + mime + ordem.
-- Os campos comprovante_* de `despesa_veiculo` viram LEGADO (1 anexo) e convivem: a
-- leitura junta o legado com os anexos novos. Aditiva — nada quebra.

-- CreateTable
CREATE TABLE "logistica"."anexo_despesa" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "hash" TEXT,
    "mime" TEXT,
    "tamanho" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anexo_despesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anexo_despesa_despesa_id_idx" ON "logistica"."anexo_despesa"("despesa_id");

-- AddForeignKey
ALTER TABLE "logistica"."anexo_despesa"
  ADD CONSTRAINT "anexo_despesa_despesa_id_fkey" FOREIGN KEY ("despesa_id")
  REFERENCES "logistica"."despesa_veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
