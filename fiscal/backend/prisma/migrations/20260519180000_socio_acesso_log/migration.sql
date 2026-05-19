-- Migration 19/05/2026: auditoria de ACESSO a PII de sócios (LGPD, D4).
--
-- Append-only. O Fiscal grava 1 linha a cada consulta que exponha sócio
-- (Busca por Sócio ou QSA da Consulta Cadastral). A capability em si
-- (core.usuario_capability) é owned pelo auth-gateway (F1) — aqui só o
-- log de acesso, no schema fiscal. Idempotente. Plano:
-- docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md

CREATE TABLE IF NOT EXISTS "fiscal"."socio_acesso_log" (
  "id"            SERIAL NOT NULL,
  "usuario_id"    TEXT NOT NULL,
  "usuario_email" TEXT,
  "escopo"        TEXT NOT NULL,
  "termo"         TEXT,
  "resultado_qtd" INTEGER NOT NULL,
  "em"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "socio_acesso_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "socio_acesso_log_usuario_id_em_idx"
  ON "fiscal"."socio_acesso_log" ("usuario_id", "em");
