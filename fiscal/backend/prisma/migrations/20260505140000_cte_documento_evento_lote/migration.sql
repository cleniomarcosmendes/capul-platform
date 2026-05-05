-- CT-e Distribuição Fase 2 — Persistência + auditoria
-- 3 tabelas dedicadas no schema fiscal (Opção A do Plano v2):
--   cte_documento       → XML completo dos CT-es retornados pelo SEFAZ
--   cte_evento          → eventos vinculados (CC-e, cancelamento, etc)
--   cte_lote_consulta   → auditoria de cada execução do orquestrador
-- Persistência feita pela Fase 2; PapelDetectorService (preenche papel_capul)
-- vem na Fase 3.

-- CreateEnum
CREATE TYPE "fiscal"."SchemaCte" AS ENUM ('procCTe', 'procCTeSimp', 'resCTe', 'procEventoCTe', 'resEventoCTe', 'DESCONHECIDO');

-- CreateEnum
CREATE TYPE "fiscal"."PapelCapul" AS ENUM ('DEST', 'TOMA', 'REM', 'EXPED', 'RECEB', 'AUTXML', 'TERCEIRO');

-- CreateEnum
CREATE TYPE "fiscal"."TipoEventoCte" AS ENUM ('CANCELAMENTO', 'CCE', 'PRESTACAO_DESACORDO', 'CONFIRMACAO_PRESTACAO', 'GTV_PRESTACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "fiscal"."StatusLoteConsulta" AS ENUM ('OK', 'BLOQUEADO', 'LIMITE_ATINGIDO', 'ERRO_SEFAZ', 'CIRCUIT_BREAK', 'ERRO_INTERNO');

-- CreateTable
CREATE TABLE "fiscal"."cte_documento" (
    "id" SERIAL NOT NULL,
    "cnpj_consulente" VARCHAR(14) NOT NULL,
    "ambiente" INTEGER NOT NULL,
    "nsu" VARCHAR(15) NOT NULL,
    "schema" "fiscal"."SchemaCte" NOT NULL,
    "chave" VARCHAR(44),
    "modelo" INTEGER,
    "dh_emi" TIMESTAMP(3),
    "xml_sha256" CHAR(64) NOT NULL,
    "xml" TEXT NOT NULL,
    "xml_bytes" INTEGER NOT NULL,
    "papel_capul" "fiscal"."PapelCapul",
    "erro_parse" TEXT,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),

    CONSTRAINT "cte_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cte_evento" (
    "id" SERIAL NOT NULL,
    "documento_id" INTEGER,
    "chave" VARCHAR(44) NOT NULL,
    "id_evento" VARCHAR(53) NOT NULL,
    "tipo_evento" "fiscal"."TipoEventoCte" NOT NULL,
    "tp_evento_num" INTEGER NOT NULL,
    "n_seq_evento" INTEGER NOT NULL,
    "dh_evento" TIMESTAMP(3) NOT NULL,
    "c_stat" VARCHAR(3) NOT NULL,
    "x_motivo" TEXT NOT NULL,
    "protocolo" VARCHAR(15),
    "xml_sha256" CHAR(64) NOT NULL,
    "xml" TEXT NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cte_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cte_lote_consulta" (
    "id" SERIAL NOT NULL,
    "cnpj_consulente" VARCHAR(14) NOT NULL,
    "ambiente" INTEGER NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),
    "iteracoes" INTEGER NOT NULL DEFAULT 0,
    "ult_nsu_inicial" VARCHAR(15) NOT NULL,
    "ult_nsu_final" VARCHAR(15) NOT NULL,
    "max_nsu_final" VARCHAR(15) NOT NULL,
    "docs_persistidos" INTEGER NOT NULL DEFAULT 0,
    "docs_duplicados" INTEGER NOT NULL DEFAULT 0,
    "status" "fiscal"."StatusLoteConsulta" NOT NULL,
    "c_stat_ultimo" VARCHAR(3),
    "x_motivo_ultimo" TEXT,
    "motivo_stop" TEXT,
    "origem" VARCHAR(10) NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "duracao_ms" INTEGER,
    "erro_detalhe" TEXT,

    CONSTRAINT "cte_lote_consulta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cte_documento_chave_idx" ON "fiscal"."cte_documento"("chave");

-- CreateIndex
CREATE INDEX "cte_documento_xml_sha256_idx" ON "fiscal"."cte_documento"("xml_sha256");

-- CreateIndex
CREATE INDEX "cte_documento_recebido_em_idx" ON "fiscal"."cte_documento"("recebido_em");

-- CreateIndex
CREATE INDEX "cte_documento_processado_em_idx" ON "fiscal"."cte_documento"("processado_em");

-- CreateIndex
CREATE UNIQUE INDEX "cte_documento_cnpj_consulente_ambiente_nsu_key" ON "fiscal"."cte_documento"("cnpj_consulente", "ambiente", "nsu");

-- CreateIndex
CREATE UNIQUE INDEX "cte_evento_id_evento_key" ON "fiscal"."cte_evento"("id_evento");

-- CreateIndex
CREATE INDEX "cte_evento_chave_idx" ON "fiscal"."cte_evento"("chave");

-- CreateIndex
CREATE INDEX "cte_evento_documento_id_idx" ON "fiscal"."cte_evento"("documento_id");

-- CreateIndex
CREATE INDEX "cte_evento_tipo_evento_idx" ON "fiscal"."cte_evento"("tipo_evento");

-- CreateIndex
CREATE INDEX "cte_evento_dh_evento_idx" ON "fiscal"."cte_evento"("dh_evento");

-- CreateIndex
CREATE INDEX "cte_lote_consulta_cnpj_consulente_ambiente_idx" ON "fiscal"."cte_lote_consulta"("cnpj_consulente", "ambiente");

-- CreateIndex
CREATE INDEX "cte_lote_consulta_iniciado_em_idx" ON "fiscal"."cte_lote_consulta"("iniciado_em");

-- CreateIndex
CREATE INDEX "cte_lote_consulta_status_idx" ON "fiscal"."cte_lote_consulta"("status");
