-- AlterTable: adicionar flag podeGerirCompras em membros_equipe
ALTER TABLE "gestao_ti"."membros_equipe" ADD COLUMN "pode_gerir_compras" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: adicionar equipe_id em notas_fiscais
ALTER TABLE "gestao_ti"."notas_fiscais" ADD COLUMN "equipe_id" TEXT;

-- CreateIndex
CREATE INDEX "notas_fiscais_equipe_id_idx" ON "gestao_ti"."notas_fiscais"("equipe_id");

-- AddForeignKey
ALTER TABLE "gestao_ti"."notas_fiscais" ADD CONSTRAINT "notas_fiscais_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;
