-- Bug VARCHAR(53→54) em cte_evento.id_evento (07/05/2026)
--
-- Comentario do schema dizia matematica errada:
--   "ID" + tpEvento(6) + chave(44) + nSeqEvento(2) = 53 chars  ← ERRADO
--
-- Correto: 2+6+44+2 = 54 chars
--
-- Resultado: TODO evento CT-e com id_evento de 54 chars (todos!) falhava
-- ao persistir com erro Prisma "value too long for the column type".
-- Confirmado em log do tick 12:00 BRT 07/05 — centenas de eventos
-- perdidos durante varredura.
--
-- Fix: ALTER COLUMN para VARCHAR(54). Idempotente (só aumenta o tamanho,
-- nao perde dados).

ALTER TABLE "fiscal"."cte_evento"
  ALTER COLUMN "id_evento" TYPE VARCHAR(54);
