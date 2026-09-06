-- ============================================================================
-- O LOTE DE IMPORTACAO DA PLANILHA DO RH.
--
-- 82 linhas de planilha viram ~1.000 pares. Isso obriga tres coisas, e a
-- tabela existe para as tres:
--
--   PRE-VISUALIZAR  importar e avisar depois seria pedir para a gestora
--                   conferir mil linhas ja gravadas. `conferencia` e o SHA-256
--                   do conteudo que ela VIU; gravar exige mandar o mesmo
--                   arquivo, e arquivo trocado entre a previa e o OK e
--                   recusado.
--   REIMPORTAR      ela vai importar varias vezes, corrigindo. Par identico
--                   nao vira linha nova; par que muda encerra a vigencia do
--                   anterior; ajuste MANUAL nunca e sobrescrito sem ela mandar.
--   DESFAZER        `desfeito_em` encerra a vigencia do lote inteiro de uma
--                   vez. ENCERRAR, nunca apagar: o historico tem de mostrar
--                   "importado, depois desfeito por fulano".
--
-- `resumo` guarda o relatorio que ela confirmou, para "o que essa importacao
-- fez?" ter resposta meses depois sem recontar nada.
--
-- A FK e ON DELETE SET NULL de proposito: apagar um lote (que nao deve
-- acontecer) nao pode levar junto a designacao de mil pessoas.
-- ============================================================================

-- AlterTable
ALTER TABLE "rh"."designacao_padrao" ADD COLUMN     "importacao_id" TEXT;
-- CreateTable
CREATE TABLE "rh"."importacao_designacao" (
    "id" TEXT NOT NULL,
    "arquivo_nome" TEXT NOT NULL,
    "conferencia" VARCHAR(64) NOT NULL,
    "linhas_no_arquivo" INTEGER NOT NULL,
    "pares_gravados" INTEGER NOT NULL,
    "resumo" JSONB NOT NULL,
    "importado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desfeito_em" TIMESTAMP(3),
    "desfeito_por_id" TEXT,
    CONSTRAINT "importacao_designacao_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "importacao_designacao_criado_em_idx" ON "rh"."importacao_designacao"("criado_em");
-- CreateIndex
CREATE INDEX "designacao_padrao_importacao_id_vigencia_fim_idx" ON "rh"."designacao_padrao"("importacao_id", "vigencia_fim");
-- AddForeignKey
ALTER TABLE "rh"."designacao_padrao" ADD CONSTRAINT "designacao_padrao_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "rh"."importacao_designacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
