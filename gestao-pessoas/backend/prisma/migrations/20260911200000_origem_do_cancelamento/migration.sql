-- ⭐⭐ A ORIGEM DO CANCELAMENTO — para o desfazer não decidir lendo texto.
--
-- Existem DOIS atos que produzem `CANCELADA`, e eles não são simétricos:
--
--   DECISAO_RH    o "Excluir" da Designação, ato POR LINHA, com motivo por
--                 linha. Grava também uma linha em `rh.ciclo_elegibilidade`
--                 com decisao = 'EXCLUIR'.
--   ENCERRAMENTO  o `encerrar` com pendência confirmada: UM ato sobre N
--                 avaliações, com UM motivo. NÃO toca a elegibilidade.
--
-- ⚠️ **A reversão tem a granularidade do ato que causou** (decisão de 11/09):
-- o Excluir se desfaz pelo Incluir, por linha; o encerramento se desfaz em
-- massa, por ciclo. E desfazer o Excluir tem de reverter os DOIS lados na mesma
-- transação — cancelamento e elegibilidade —, senão sobra o estado partido que
-- `decidirElegibilidade` foi escrito para fechar: avaliação viva com decisão de
-- exclusão vigente, que a próxima cópia do cadastro exclui de novo, calada.
--
-- ⭐ **Por que uma COLUNA e não o texto do motivo.** Dava para distinguir por
-- `motivo_cancelamento LIKE 'Excluído do ciclo pelo RH:%'` — e seria errado:
-- comportamento decidido por prefixo de frase quebra no dia em que alguém
-- melhora a redação, e quebra em silêncio. O texto é para humano ler.
--
-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Estrutural, não textual: quem tem linha de EXCLUIR em `ciclo_elegibilidade`
-- veio do Excluir; o resto veio do encerramento. Conferido no DEV em 11/09 —
-- a classificação estrutural bate 100% com o prefixo do texto (2 e 47).
--
-- COMO SE DESFAZ (aditivo):
--   ALTER TABLE rh.avaliacao DROP COLUMN origem_cancelamento;
--   DROP TYPE rh."OrigemCancelamento";

CREATE TYPE "rh"."OrigemCancelamento" AS ENUM ('DECISAO_RH', 'ENCERRAMENTO');

ALTER TABLE "rh"."avaliacao"
  ADD COLUMN "origem_cancelamento" "rh"."OrigemCancelamento";

UPDATE "rh"."avaliacao" av
   SET "origem_cancelamento" =
       CASE WHEN EXISTS (
              SELECT 1 FROM "rh"."ciclo_elegibilidade" e
               WHERE e."ciclo_id" = av."ciclo_id"
                 AND e."colaborador_id" = av."avaliado_id"
                 AND e."decisao" = 'EXCLUIR')
            THEN 'DECISAO_RH'::"rh"."OrigemCancelamento"
            ELSE 'ENCERRAMENTO'::"rh"."OrigemCancelamento"
       END
 WHERE av."status" = 'CANCELADA';

-- O desfazer em massa varre por (ciclo, origem). Sem índice seria seq scan na
-- tabela inteira — que no Piloto já tem 894 linhas e cresce por ciclo.
CREATE INDEX "avaliacao_ciclo_id_origem_cancelamento_idx"
    ON "rh"."avaliacao" ("ciclo_id", "origem_cancelamento");
