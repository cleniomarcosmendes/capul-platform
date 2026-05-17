-- Migration 17/05/2026: F1.5 — cruzamento massa SA1+SA2 × base RFB local.
--
-- O PAYOFF do "achado": cruzar clientes (SA1010) e fornecedores (SA2010) do
-- Protheus contra a base pública CNPJ local (schema rfb) — SEM certificado,
-- SEM SEFAZ, zero risco de bloqueio. Snapshot persistido (roda 1x, consulta
-- N vezes) — não consulta Protheus a cada page view.
--
-- `cruzamento_resultado`: 1 linha por vínculo Protheus (cnpj+origem+codigo+
-- loja) enriquecida com situação RFB + alerta. `cruzamento_exec`: histórico
-- de execuções (status/contadores). Idempotente.

CREATE TABLE IF NOT EXISTS "rfb"."cruzamento_resultado" (
  "id"              SERIAL PRIMARY KEY,
  "cnpj"            TEXT NOT NULL,
  "origem"          TEXT NOT NULL,            -- SA1010 | SA2010
  "filial"          TEXT,
  "codigo"          TEXT,
  "loja"            TEXT,
  "razao_protheus"  TEXT,
  "bloqueado"       BOOLEAN DEFAULT false,
  "achado_rfb"      BOOLEAN NOT NULL,
  "situacao_rfb"    TEXT,
  "razao_rfb"       TEXT,
  "uf_rfb"          TEXT,
  "municipio_rfb"   TEXT,
  "optante_simples" TEXT,
  "alerta"          TEXT NOT NULL,            -- OK | ATENCAO | IRREGULAR | NAO_ENCONTRADO
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "cruz_alerta_idx" ON "rfb"."cruzamento_resultado" ("alerta");
CREATE INDEX IF NOT EXISTS "cruz_origem_idx" ON "rfb"."cruzamento_resultado" ("origem");
CREATE INDEX IF NOT EXISTS "cruz_cnpj_idx"   ON "rfb"."cruzamento_resultado" ("cnpj");

CREATE TABLE IF NOT EXISTS "rfb"."cruzamento_exec" (
  "id"               SERIAL PRIMARY KEY,
  "status"           TEXT NOT NULL,           -- RODANDO | CONCLUIDO | ERRO
  "iniciado"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fim"              TIMESTAMP(3),
  "total"            INTEGER,
  "alerta_irregular" INTEGER,
  "alerta_atencao"   INTEGER,
  "alerta_ok"        INTEGER,
  "nao_encontrado"   INTEGER,
  "disparado_por"    TEXT,
  "observacao"       TEXT
);
