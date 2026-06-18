-- Migration 18/06/2026: Busca de NF-e por NÚMERO da nota e por RAZÃO SOCIAL
-- (pedido do setor Fiscal). 100% LOCAL — lê só `fiscal.documento_consulta`,
-- nunca dispara SEFAZ (protege o limite diário do CNPJ da CAPUL).
--
-- 1) Razão social do emitente e do destinatário passam a ser persistidas
--    (espelha cte_documento.emitente_razao_social). Alimentadas a cada
--    consulta por chave daqui pra frente. NÃO há backfill: o XML não fica
--    nesta tabela (vive em documento_xml_index/Protheus), então linhas
--    antigas ficam NULL até a próxima consulta. A busca por NÚMERO independe
--    disto (numero_nf já existia).
--
-- 2) Índices:
--    - btree (tipo_documento, numero_nf) → busca por número (equality, sem zeros à esq.)
--    - GIN pg_trgm em cada razão social → ILIKE '%termo%' (Prisma { contains, insensitive })
--
-- Additive e idempotente. pg_trgm é nativo do Postgres.

ALTER TABLE "fiscal"."documento_consulta"
  ADD COLUMN IF NOT EXISTS "emitente_razao_social" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "destinatario_razao_social" VARCHAR(120);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "documento_consulta_tipo_documento_numero_nf_idx"
  ON "fiscal"."documento_consulta" ("tipo_documento", "numero_nf");

CREATE INDEX IF NOT EXISTS "documento_consulta_emitente_razao_social_trgm_idx"
  ON "fiscal"."documento_consulta" USING gin ("emitente_razao_social" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "documento_consulta_destinatario_razao_social_trgm_idx"
  ON "fiscal"."documento_consulta" USING gin ("destinatario_razao_social" gin_trgm_ops);
