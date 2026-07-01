-- Fase 3a (módulo Supervisores/RDV) — catálogos: Atividade de Visita + Região
-- (N:N com Município). Ver docs/PLANO_LOGISTICA_REPRESENTANTES_v1.md.

-- CreateTable
CREATE TABLE "logistica"."atividade_visita" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filial_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividade_visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."regiao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filial_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regiao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."regiao_municipio" (
    "id" TEXT NOT NULL,
    "regiao_id" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" VARCHAR(2),

    CONSTRAINT "regiao_municipio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atividade_visita_filial_id_nome_key" ON "logistica"."atividade_visita"("filial_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "regiao_filial_id_nome_key" ON "logistica"."regiao"("filial_id", "nome");

-- CreateIndex
CREATE INDEX "regiao_municipio_municipio_idx" ON "logistica"."regiao_municipio"("municipio");

-- CreateIndex
CREATE UNIQUE INDEX "regiao_municipio_regiao_id_municipio_key" ON "logistica"."regiao_municipio"("regiao_id", "municipio");

-- AddForeignKey
ALTER TABLE "logistica"."regiao_municipio" ADD CONSTRAINT "regiao_municipio_regiao_id_fkey" FOREIGN KEY ("regiao_id") REFERENCES "logistica"."regiao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
