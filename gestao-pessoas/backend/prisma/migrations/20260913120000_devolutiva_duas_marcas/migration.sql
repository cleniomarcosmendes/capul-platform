-- ⭐⭐ A DEVOLUTIVA TEM DOIS ATOS, E CADA UM TEM A SUA MARCA.
--
--   1. O RH LIBERA  — decide que a nota pode ser mostrada. Ato de escritório.
--   2. O AVALIADOR CONDUZ — a conversa presencial com o avaliado.
--
-- Os dois valem, são de pessoas diferentes, e acontecem em momentos diferentes.
-- Uma marca só não distingue "já pode" de "já foi".
--
-- ── POR QUE RENOMEAR AS QUE JÁ EXISTIAM ─────────────────────────────────────
--
-- `devolutiva_em` / `devolutiva_por_id` existem desde a migration inicial
-- (`20260905160000_init_rh`) e **nunca tiveram leitor nem escritor** — oito dias
-- de coluna morta. Renomear é de graça agora e impossível depois.
--
-- ⚠️ E é necessário: com o par novo ao lado, `devolutiva_em` sozinho não diz
-- qual dos dois atos ele marca. Quem abrir esta tabela em dezembro tem de saber
-- pelo NOME, sem ir procurar o service.
ALTER TABLE "rh"."avaliacao" RENAME COLUMN "devolutiva_em"     TO "devolutiva_conduzida_em";
ALTER TABLE "rh"."avaliacao" RENAME COLUMN "devolutiva_por_id" TO "devolutiva_conduzida_por_id";

ALTER TABLE "rh"."avaliacao"
  ADD COLUMN "devolutiva_liberada_em"     TIMESTAMP(3),
  ADD COLUMN "devolutiva_liberada_por_id" TEXT;

COMMENT ON COLUMN "rh"."avaliacao"."devolutiva_liberada_em" IS
  'ATO 1 — o RH liberou: a partir daqui o AVALIADOR passa a ver a nota de quem ele avaliou. Nulo = ninguém vê. ⚠️ Limpo na reabertura: a nota nova não está liberada. O fato de a pessoa TER VISTO sobrevive em rh.auditoria, nunca aqui.';

COMMENT ON COLUMN "rh"."avaliacao"."devolutiva_conduzida_em" IS
  'ATO 2 — o avaliador conduziu a conversa presencial com o avaliado. Só pode existir depois de devolutiva_liberada_em.';

-- ⭐ Quem lê a fila do avaliador filtra por avaliador + liberação.
CREATE INDEX "avaliacao_devolutiva_liberada_idx"
  ON "rh"."avaliacao" ("avaliador_id", "devolutiva_liberada_em");
