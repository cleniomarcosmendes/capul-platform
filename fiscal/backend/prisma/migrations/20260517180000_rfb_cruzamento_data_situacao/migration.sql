-- Migration 17/05/2026: F3.3 — data_situacao no snapshot do cruzamento.
--
-- "Δ/mudança" SEM histórico (decisão Clenio: não reter dados anteriores).
-- Em vez de comparar com a corrida passada, usamos a DATA DE SITUAÇÃO da
-- própria RFB (rfb.estabelecimentos.data_situacao = quando a situação
-- cadastral mudou na Receita) — calculado só do snapshot atual, zero
-- histórico retido. Permite "INAPTA desde DD/MM/AAAA" + flag "recente".
--
-- Nullable (só faz sentido p/ achado_rfb=true; truncate+repopula).
-- Idempotente.

ALTER TABLE "rfb"."cruzamento_resultado" ADD COLUMN IF NOT EXISTS "data_situacao" TEXT;
