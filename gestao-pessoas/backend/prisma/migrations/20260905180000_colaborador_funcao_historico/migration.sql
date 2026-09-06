-- CreateEnum
CREATE TYPE "rh"."OrigemMovimentoFuncional" AS ENUM ('MOVIMENTO', 'CARGA');

-- CreateTable
CREATE TABLE "rh"."colaborador_funcao_historico" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "filial" VARCHAR(10) NOT NULL,
    "data" DATE NOT NULL,
    "sequencia" VARCHAR(10) NOT NULL,
    "funcao_codigo" VARCHAR(20) NOT NULL,
    "funcao_descricao" TEXT,
    "tipo" VARCHAR(10),
    "origem" "rh"."OrigemMovimentoFuncional" NOT NULL DEFAULT 'MOVIMENTO',
    "considerado_no_calculo" BOOLEAN NOT NULL DEFAULT true,
    "motivo_descarte" TEXT,
    "recno_origem" INTEGER,
    "sincronizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_funcao_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colaborador_funcao_historico_colaborador_id_considerado_no__idx" ON "rh"."colaborador_funcao_historico"("colaborador_id", "considerado_no_calculo", "data");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_funcao_historico_colaborador_id_filial_data_seq_key" ON "rh"."colaborador_funcao_historico"("colaborador_id", "filial", "data", "sequencia");

-- AddForeignKey
ALTER TABLE "rh"."colaborador_funcao_historico" ADD CONSTRAINT "colaborador_funcao_historico_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

