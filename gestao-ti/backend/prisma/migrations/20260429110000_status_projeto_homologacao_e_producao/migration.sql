-- Migration: adiciona valores EM_HOMOLOGACAO e LIBERADO_PARA_PRODUCAO
-- ao enum gestao_ti.StatusProjeto
--
-- Contexto: solicitação 29/04/2026 do setor — fluxo atual
-- (PLANEJAMENTO → EM_ANDAMENTO → CONCLUIDO) é ambíguo. "CONCLUIDO" não
-- distingue "técnico terminou em HOM" de "aplicado em PROD". Equipe
-- Protheus depende de "anotações informais" pra saber o que pode subir.
--
-- Novo fluxo:
--   PLANEJAMENTO → EM_ANDAMENTO → EM_HOMOLOGACAO → LIBERADO_PARA_PRODUCAO → CONCLUIDO
--   (PAUSADO/CANCELADO em qualquer ponto antes de CONCLUIDO)
--   EM_HOMOLOGACAO ↔ EM_ANDAMENTO (volta se reprovado em HOM)
--   LIBERADO_PARA_PRODUCAO ↔ EM_ANDAMENTO (volta se bug encontrado depois da liberação)
--
-- SQL idempotente — `ADD VALUE IF NOT EXISTS` (Postgres 12+).

ALTER TYPE "gestao_ti"."StatusProjeto" ADD VALUE IF NOT EXISTS 'EM_HOMOLOGACAO';
ALTER TYPE "gestao_ti"."StatusProjeto" ADD VALUE IF NOT EXISTS 'LIBERADO_PARA_PRODUCAO';
