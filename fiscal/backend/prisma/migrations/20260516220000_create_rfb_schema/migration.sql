-- Migration 16/05/2026: schema `rfb` — Base Pública CNPJ (Receita Federal).
--
-- F1.1 do PLANO_MODULO_CNPJ_RFB_v1.md (v1.1, addendum F0/PoC). "Achado":
-- importar a base pública CNPJ da RFB (dados abertos, SEM certificado, SEM
-- SEFAZ — zero risco de bloqueio) para cruzamento em massa SA1+SA2 × local.
--
-- Schema ISOLADO `rfb` (não polui `fiscal`/`core` nem o DB compartilhado).
-- Tabelas LIVE apenas; tabelas *_staging são criadas/dropadas em runtime
-- pelo serviço de importação (swap atômico por-tabela — F1.3).
--
-- Colunas em TEXT: Postgres armazena text == varchar (mesmo varlena), sem
-- blank-padding de char(n); footprint medido na PoC (~250 B/linha estab
-- com índices, ~170 B/linha empresa — docs/poc-cnpj/README.md).
--
-- Idempotente (CREATE ... IF NOT EXISTS). Aplicada via init job
-- `fiscal-migrate` (npx prisma migrate deploy), padrão da casa.

CREATE SCHEMA IF NOT EXISTS "rfb";

-- pg_trgm: busca por nome/razão social (validado disponível na PoC).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Tabela principal: Estabelecimentos (~60M+ linhas) ──
CREATE TABLE IF NOT EXISTS "rfb"."estabelecimentos" (
  "cnpj_completo"       TEXT PRIMARY KEY,
  "cnpj_basico"         TEXT NOT NULL,
  "cnpj_ordem"          TEXT,
  "cnpj_dv"             TEXT,
  "matriz_filial"       TEXT,
  "nome_fantasia"       TEXT,
  "situacao_cadastral"  TEXT,
  "data_situacao"       TEXT,
  "cnae_principal"      TEXT,
  "logradouro"          TEXT,
  "numero"              TEXT,
  "bairro"              TEXT,
  "cep"                 TEXT,
  "uf"                  TEXT,
  "municipio"           TEXT,
  "ddd1"                TEXT,
  "telefone1"           TEXT,
  "correio_eletronico"  TEXT
);

CREATE INDEX IF NOT EXISTS "estab_cnpj_basico_idx"  ON "rfb"."estabelecimentos" ("cnpj_basico");
CREATE INDEX IF NOT EXISTS "estab_situacao_idx"     ON "rfb"."estabelecimentos" ("situacao_cadastral");
CREATE INDEX IF NOT EXISTS "estab_uf_municipio_idx" ON "rfb"."estabelecimentos" ("uf", "municipio");
CREATE INDEX IF NOT EXISTS "estab_cnae_idx"         ON "rfb"."estabelecimentos" ("cnae_principal");
-- Busca textual por nome fantasia (GIN trgm — não-btree, criado via SQL).
CREATE INDEX IF NOT EXISTS "estab_fantasia_trgm_idx"
  ON "rfb"."estabelecimentos" USING gin ("nome_fantasia" gin_trgm_ops);

-- ── Empresas (cnpj_basico = raiz; razão social, porte, capital) ──
CREATE TABLE IF NOT EXISTS "rfb"."empresas" (
  "cnpj_basico"        TEXT PRIMARY KEY,
  "razao_social"       TEXT,
  "natureza_juridica"  TEXT,
  "porte"              TEXT,
  "capital_social"     NUMERIC(18,2)
);
CREATE INDEX IF NOT EXISTS "emp_razao_trgm_idx"
  ON "rfb"."empresas" USING gin ("razao_social" gin_trgm_ops);

-- ── Simples / MEI ──
CREATE TABLE IF NOT EXISTS "rfb"."simples" (
  "cnpj_basico"            TEXT PRIMARY KEY,
  "optante_simples"        TEXT,
  "data_opcao_simples"     TEXT,
  "optante_mei"            TEXT,
  "data_exclusao_simples"  TEXT
);

-- ── Domínios (código → descrição) ──
CREATE TABLE IF NOT EXISTS "rfb"."cnaes"      ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);
CREATE TABLE IF NOT EXISTS "rfb"."municipios" ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);
CREATE TABLE IF NOT EXISTS "rfb"."naturezas"  ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);

-- ── Controle de importação (1 linha por versão AAAA-MM) ──
CREATE TABLE IF NOT EXISTS "rfb"."controle_importacao" (
  "id"              SERIAL PRIMARY KEY,
  "versao_rfb"      TEXT NOT NULL UNIQUE,
  "status"          TEXT NOT NULL,                -- DISPONIVEL | IMPORTANDO | CONCLUIDO | ERRO
  "data_deteccao"   TIMESTAMP(3),
  "data_inicio"     TIMESTAMP(3),
  "data_fim"        TIMESTAMP(3),
  "total_registros" BIGINT,
  "disparado_por"   TEXT,
  "observacao"      TEXT
);
