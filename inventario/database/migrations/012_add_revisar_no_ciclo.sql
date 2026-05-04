-- Migration 012: Marcação de itens para revisão pelo supervisor
-- Quando o supervisor devolve uma lista (handoff DEVOLVIDA), pode marcar
-- itens específicos como "precisa revisar". A contagem anterior é mantida —
-- o contador apenas confirma ou edita.

BEGIN;

ALTER TABLE inventario.counting_list_items
  ADD COLUMN IF NOT EXISTS revisar_no_ciclo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_revisao   TEXT;

CREATE INDEX IF NOT EXISTS idx_counting_list_items_revisar
  ON inventario.counting_list_items(revisar_no_ciclo)
  WHERE revisar_no_ciclo = TRUE;

COMMENT ON COLUMN inventario.counting_list_items.revisar_no_ciclo IS
  'Item marcado pelo supervisor para revisão pelo contador (após handoff DEVOLVIDA). '
  'Limpa quando o contador salva nova contagem no item.';
COMMENT ON COLUMN inventario.counting_list_items.motivo_revisao IS
  'Motivo da revisão informado pelo supervisor (opcional, por item).';

COMMIT;
