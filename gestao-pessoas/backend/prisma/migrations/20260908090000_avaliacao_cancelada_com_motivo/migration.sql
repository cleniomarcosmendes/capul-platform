-- ⭐⭐ CANCELAR AVALIAÇÃO — o rastro do ato que faltava.
--
-- `StatusAvaliacao.CANCELADA` existe desde o começo e NUNCA foi escrito por
-- código nenhum: era lido em três lugares e produzido em zero. Com o ato
-- nascendo (decisão do RH na Designação e encerramento com pendência
-- confirmada), o estado precisa carregar QUEM, QUANDO e POR QUÊ — senão daqui a
-- seis meses "por que esta avaliação está cancelada?" não tem resposta.
--
-- ⚠️ Mesmo desenho do `reaberta_em/reaberta_por_id/motivo_reabertura` que já
-- está ao lado: motivo é OBRIGATÓRIO no serviço (a coluna é nula só porque as
-- linhas antigas não têm um), e nada aqui apaga resposta — cancelar tira a
-- avaliação da CONTA, não do banco.
--
-- COMO SE DESFAZ (nada destrutivo; as 3 colunas são aditivas):
--   ALTER TABLE rh.avaliacao
--     DROP COLUMN cancelada_em,
--     DROP COLUMN cancelada_por_id,
--     DROP COLUMN motivo_cancelamento;
-- As avaliações que tiverem sido canceladas continuam com status CANCELADA —
-- só se perde o rastro de quem/quando/por quê. Para desfazer TAMBÉM o estado,
-- antes do DROP:
--   UPDATE rh.avaliacao SET status = 'PENDENTE'
--    WHERE status = 'CANCELADA' AND cancelada_em IS NOT NULL;

ALTER TABLE "rh"."avaliacao"
  ADD COLUMN "cancelada_em"        TIMESTAMP(3),
  ADD COLUMN "cancelada_por_id"    TEXT,
  ADD COLUMN "motivo_cancelamento" TEXT;
