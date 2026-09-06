-- ============================================================================
-- O RECORTE PROVISORIO DO PUBLICO VIRA COLUNA.
--
-- A tarja da tela de Aplicacoes vinha de procurar a palavra "PROVISORIO"
-- dentro de `origem_referencia`. Funcionava enquanto quem escrevia a
-- referencia era um script nosso — e quebraria EM SILENCIO no primeiro recorte
-- montado pela tela, que escreve "02|21010101" e nada mais. Tarja que some
-- sozinha e pior que tarja nenhuma: a gestora passaria a ver um recorte de
-- trabalho como se fosse decisao tomada.
--
-- Mesma semantica de `designacao_padrao.provisorio`, e pela mesma razao: dado
-- de trabalho da T.I. nao e decisao do RH, e a nota tem consequencia de merito.
-- ============================================================================

ALTER TABLE "rh"."aplicacao_publico" ADD COLUMN "provisorio" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: o que ja estava marcado no texto passa a estar marcado na coluna.
UPDATE "rh"."aplicacao_publico"
   SET "provisorio" = true
 WHERE upper(coalesce("origem_referencia", '')) LIKE '%PROVISORIO%';
