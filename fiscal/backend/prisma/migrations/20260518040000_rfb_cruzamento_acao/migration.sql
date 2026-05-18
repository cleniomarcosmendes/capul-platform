-- Migration 18/05/2026: ação acionável no cruzamento (Gap B, pedido Clenio).
--
-- O cruzamento criticava só o lado RFB (situação cadastral). Faltava o
-- sinal acionável: RFB com problema (BAIXADA/INAPTA/SUSPENSA/NULA) E
-- ainda ATIVO no Protheus (não bloqueado) = cadastro que precisa de
-- ação. `acao` é derivada (computada no executar()), populada no
-- próximo run do cruzamento. Idempotente.

ALTER TABLE "rfb"."cruzamento_resultado"
  ADD COLUMN IF NOT EXISTS "acao" TEXT NOT NULL DEFAULT 'NENHUMA';
