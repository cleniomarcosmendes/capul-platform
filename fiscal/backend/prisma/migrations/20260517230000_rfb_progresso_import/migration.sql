-- Migration 17/05/2026: progresso granular do import RFB (F1.6, escopo B).
--
-- A tela "Base CNPJ (RFB)" era caixa-preta durante import de 1-2h (Status
-- IMPORTANDO congelado, Registros/Observacao so por tabela concluida, sem
-- tempo decorrido). Incidente 0x00 do import 60M expos a aflicao real.
-- Estas colunas alimentam o painel: tabela/arquivo atuais, throughput
-- (linhas_acumuladas + atualizado_em entre polls) e checklist 6 tabelas
-- (progresso JSONB = mapa {tabela: {status, linhas}}). Idempotente.

ALTER TABLE "rfb"."controle_importacao"
  ADD COLUMN IF NOT EXISTS "tabela_atual"      TEXT,
  ADD COLUMN IF NOT EXISTS "arquivo_atual"     INTEGER,
  ADD COLUMN IF NOT EXISTS "arquivos_total"    INTEGER,
  ADD COLUMN IF NOT EXISTS "linhas_acumuladas" BIGINT,
  ADD COLUMN IF NOT EXISTS "atualizado_em"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "progresso"         JSONB;
