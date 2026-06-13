-- CreateEnum
CREATE TYPE "TipoComprovante" AS ENUM ('FOTO', 'ASSINATURA');

-- CreateTable
CREATE TABLE "comprovante" (
    "id" TEXT NOT NULL,
    "entrega_id" TEXT NOT NULL,
    "entrega_numero" INTEGER,
    "filial_id" TEXT NOT NULL,
    "matricula" TEXT,
    "cupom" TEXT,
    "tipo" "TipoComprovante" NOT NULL,
    "object_key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" INTEGER,
    "geo_lat" DECIMAL(10,7),
    "geo_lng" DECIMAL(10,7),
    "entregador_id" TEXT NOT NULL,
    "capturado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trilha" JSONB,

    CONSTRAINT "comprovante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comprovante_entrega_id_idx" ON "comprovante"("entrega_id");

-- CreateIndex
CREATE INDEX "comprovante_filial_id_capturado_em_idx" ON "comprovante"("filial_id", "capturado_em");

-- CreateIndex
CREATE INDEX "comprovante_matricula_idx" ON "comprovante"("matricula");

-- CreateIndex
CREATE INDEX "comprovante_cupom_idx" ON "comprovante"("cupom");
