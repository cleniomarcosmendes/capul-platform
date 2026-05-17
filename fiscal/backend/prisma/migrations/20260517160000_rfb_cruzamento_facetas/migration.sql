-- Migration 17/05/2026: F3.1 — colunas cnae/porte no snapshot do cruzamento.
--
-- "Inteligência Cadastral" (F3) precisa facetar por CNAE e porte. Esses
-- vêm do JOIN que o RfbCruzamentoService já faz (rfb.estabelecimentos.
-- cnae_principal + rfb.empresas.porte) — agora persistidos na linha do
-- snapshot p/ facetas/groupBy rápidas (sem join por request).
--
-- Nullable: a tabela é truncate+repopulada a cada run; linhas antigas (se
-- houver) ficam null até o próximo cruzamento. Idempotente.

ALTER TABLE "rfb"."cruzamento_resultado" ADD COLUMN IF NOT EXISTS "cnae"  TEXT;
ALTER TABLE "rfb"."cruzamento_resultado" ADD COLUMN IF NOT EXISTS "porte" TEXT;
