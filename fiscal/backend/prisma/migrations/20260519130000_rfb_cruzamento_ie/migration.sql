-- Migration 19/05/2026: IE do Protheus visível no cruzamento (pedido Clenio).
--
-- A base RFB Dados Abertos NÃO tem Inscrição Estadual (IE é registro
-- estadual; o layout federal não carrega). O cruzamento passa a expor a
-- IE como vem do PROTHEUS (SA1/SA2 — A1_INSCR/A2_INSCR), dado BRUTO do
-- ERP, NÃO validado contra SEFAZ/CCC (essa validação é o fluxo CCC com
-- certificado, separado). Colunas populadas no próximo run do cruzamento
-- (snapshot recriado a cada execução). Idempotente.

ALTER TABLE "rfb"."cruzamento_resultado"
  ADD COLUMN IF NOT EXISTS "inscricao_estadual"    TEXT,
  ADD COLUMN IF NOT EXISTS "inscricao_estadual_uf" TEXT;
