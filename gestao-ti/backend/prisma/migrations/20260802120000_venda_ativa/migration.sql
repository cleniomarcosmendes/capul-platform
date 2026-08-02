-- VENDA ATIVA (02/08/2026) — o comercial passa a usar o Chamado como registro de
-- CONTATO com cliente (prospecção/retomada), pedido do gerente comercial.
--
-- Duas colunas aditivas, com default/nulável: nada muda de comportamento enquanto
-- ninguém marcar uma equipe como Venda Ativa.

-- 1) O comportamento vem da EQUIPE, não do departamento — mesmo padrão do SAC
--    (`atende_sac`/`apoio_sac`). Um departamento pode ter equipe de venda ativa e
--    equipe de chamado comum ao mesmo tempo.
ALTER TABLE "gestao_ti"."equipes_ti"
  ADD COLUMN IF NOT EXISTS "venda_ativa" BOOLEAN NOT NULL DEFAULT false;

-- 2) Matrícula do cliente no Protheus (SA1010). O cliente é gravado ESTRUTURADO, como
--    no SAC — não no texto do assunto. É o que permite "chamados deste cliente" e
--    "clientes sem contato há N dias". O SAC já buscava por matrícula mas descartava o
--    número; com a coluna, ele passa a poder guardar também.
ALTER TABLE "gestao_ti"."chamados"
  ADD COLUMN IF NOT EXISTS "cliente_matricula" TEXT;

CREATE INDEX IF NOT EXISTS "chamados_cliente_matricula_idx"
  ON "gestao_ti"."chamados" ("cliente_matricula");
