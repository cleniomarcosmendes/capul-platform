-- =================================================================
-- Migration: cadastro_contribuinte.regime_tributario VARCHAR(50) -> VARCHAR(100)
-- =================================================================
-- Contexto: SEFAZ-MG retornou em 23/04/2026 o valor
--   "EMPRESA OPTANTE SIMEI (NORMALMENTE UTILIZADO PELAS EMPRESAS MEI)"
-- (63 caracteres) para um CNPJ MEI. VARCHAR(50) original estourou e
-- quebrou o upsert em cadastro_contribuinte com:
--   "The provided value for the column is too long for the column's type."
--
-- Outros valores observados no `xRegApur` do CCC SEFAZ:
--   - "REGIME DE TRIBUTACAO NORMAL" (28 chars)
--   - "EMPRESA OPTANTE PELO SIMPLES NACIONAL" (37 chars)
--   - "EMPRESA OPTANTE SIMEI (NORMALMENTE UTILIZADO PELAS EMPRESAS MEI)" (63 chars)
--
-- VARCHAR(100) cobre com folga qualquer variante estadual sem virar TEXT
-- (que dispensa validacao). Ver docs/REGIMES_TRIBUTARIOS_BRASIL.md.
-- =================================================================

ALTER TABLE "fiscal"."cadastro_contribuinte"
  ALTER COLUMN "regime_tributario" TYPE VARCHAR(100);
