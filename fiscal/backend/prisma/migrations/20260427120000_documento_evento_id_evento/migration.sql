-- =================================================================
-- Migration: documento_evento.id_evento (NOVO)
-- =================================================================
-- Contexto: equipe Protheus atualizou o endpoint /eventosNfe em
-- 27/04/2026 para incluir os campos `id_evento` e `protocolo`
-- diretamente no payload de cada evento. Antes esses campos só
-- eram derivaveis a partir do XML completo do procEventoNFe — que
-- a API Protheus nao expoe — entao para eventos sintéticos (sem XML)
-- o detalhe ficava com Id do Evento e Protocolo de Autorizacao = null.
--
-- Agora que a API devolve direto, persistimos em
-- documento_evento.id_evento (nova coluna) e o detalhe sintético
-- passa a exibir esses campos para o operador, batendo com o portal
-- SEFAZ.
--
-- Tamanho VARCHAR(54): id de evento SEFAZ tem formato fixo
--   ID + tpEvento(6) + chave(44) + nSeqEvento(2) = 54 chars.
--
-- Migration aditiva, segura para producao (coluna nullable).
-- =================================================================

ALTER TABLE "fiscal"."documento_evento"
  ADD COLUMN IF NOT EXISTS "id_evento" VARCHAR(54);
