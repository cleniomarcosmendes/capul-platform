-- Fase A da geolocalização de campo: modelo `local_cliente` (a "verdade de campo" que o
-- Protheus não tem) + enriquecimento da marcação (`parada`).
--
-- Um cliente (SA1) tem N locais geolocalizados (fazenda ≠ endereço de entrega). A
-- coordenada de cada local é CONSOLIDADA a partir das marcações (paradas) de qualquer
-- origem — visita de supervisor OU parada de saída de veículo. `nome` estrutura o que
-- antes era `parada.propriedade` texto livre, dando chave estável ao agrupamento.
--
-- `parada` ganha: local_cliente_id (liga a marcação ao local), precisao_m (precisão do
-- GPS) e no_local (o usuário confirmou estar NO local — só essas alimentam a
-- consolidação). Tudo nullable/aditivo — nada de legado quebra.

-- CreateEnum
CREATE TYPE "logistica"."TipoLocalCliente" AS ENUM ('PROPRIEDADE', 'ENTREGA', 'OUTRO');
CREATE TYPE "logistica"."ConfiancaLocal" AS ENUM ('SEM_DADO', 'PROVISORIA', 'CONFIRMADA');

-- CreateTable
CREATE TABLE "logistica"."local_cliente" (
    "id" TEXT NOT NULL,
    "filial_id" TEXT,
    "cliente_matricula" TEXT NOT NULL,
    "cliente_nome" TEXT,
    "tipo" "logistica"."TipoLocalCliente" NOT NULL DEFAULT 'PROPRIEDADE',
    "nome" TEXT NOT NULL,
    "municipio" TEXT,
    "lat_consolidada" DECIMAL(10,7),
    "long_consolidada" DECIMAL(10,7),
    "confianca" "logistica"."ConfiancaLocal" NOT NULL DEFAULT 'SEM_DADO',
    "n_marcacoes" INTEGER NOT NULL DEFAULT 0,
    "raio_dispersao_m" INTEGER,
    "consolidado_em" TIMESTAMP(3),
    "enviado_protheus_em" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_cliente_cliente_matricula_tipo_nome_key" ON "logistica"."local_cliente"("cliente_matricula", "tipo", "nome");
CREATE INDEX "local_cliente_cliente_matricula_idx" ON "logistica"."local_cliente"("cliente_matricula");
CREATE INDEX "local_cliente_filial_id_idx" ON "logistica"."local_cliente"("filial_id");

-- AlterTable (marcação enriquecida)
ALTER TABLE "logistica"."parada"
  ADD COLUMN "local_cliente_id" TEXT,
  ADD COLUMN "precisao_m" INTEGER,
  ADD COLUMN "no_local" BOOLEAN;

-- CreateIndex
CREATE INDEX "parada_local_cliente_id_idx" ON "logistica"."parada"("local_cliente_id");

-- AddForeignKey
ALTER TABLE "logistica"."parada"
  ADD CONSTRAINT "parada_local_cliente_id_fkey" FOREIGN KEY ("local_cliente_id")
  REFERENCES "logistica"."local_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
