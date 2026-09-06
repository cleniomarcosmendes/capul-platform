-- DropIndex
DROP INDEX "rh"."colaborador_funcao_historico_colaborador_id_filial_data_seq_key";

-- AlterTable
ALTER TABLE "rh"."colaborador_funcao_historico" ALTER COLUMN "recno_origem" SET NOT NULL,
ALTER COLUMN "recno_origem" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_funcao_historico_colaborador_id_filial_data_seq_key" ON "rh"."colaborador_funcao_historico"("colaborador_id", "filial", "data", "sequencia", "recno_origem");

