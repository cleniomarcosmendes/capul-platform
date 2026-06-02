-- Chave da NF-e (44 dígitos) que originou a licença — vínculo ao módulo Fiscal
-- (rastreabilidade + consulta da NF). Opcional; NÃO única (uma NF pode gerar
-- várias licenças). Pedido do setor 02/06/2026. Additive e idempotente.

ALTER TABLE "gestao_ti"."software_licencas"
  ADD COLUMN IF NOT EXISTS "chave_nfe" CHAR(44);
