-- Permite vincular multiplos anexos a uma mesma InteracaoPendencia (comentario).
--
-- Contexto (14/05/2026): incidente Marco Antonio reportou ERRO INTERNO ao
-- tentar enviar comentario com 2 anexos. Causa: schema tinha
-- `anexos_pendencia.interacao_id` UNIQUE (relacao 1:1), mas o compositor do
-- frontend permite multiplos arquivos (multiple no input). Backend tentava
-- `updateMany` com 2 anexos linkando ao mesmo interacao_id e Prisma rejeitava
-- com P2002 (unique constraint failed).
--
-- Fix: dropar a unique constraint, virando a relacao many-to-one (1 interacao
-- -> N anexos). Mesmo paradigma do Chamado.
--
-- Mantemos um indice nao-unico em interacao_id pra consultas continuarem
-- rapidas (filtros por interacao).
--
-- Idempotente.

-- A constraint UNIQUE em PostgreSQL eh implementada por um indice unique
-- com nome igual ao da constraint. Precisa dropar a CONSTRAINT (que tambem
-- remove o indice automaticamente) — dropar o indice direto falha com
-- "cannot drop index because constraint requires it" (E2BP01).
ALTER TABLE "gestao_ti"."anexos_pendencia"
  DROP CONSTRAINT IF EXISTS "anexos_pendencia_interacao_id_key";

CREATE INDEX IF NOT EXISTS "anexos_pendencia_interacao_id_idx"
  ON "gestao_ti"."anexos_pendencia" ("interacao_id");
