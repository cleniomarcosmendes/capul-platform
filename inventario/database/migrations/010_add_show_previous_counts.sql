-- Migration: Flag de visibilidade de contagens anteriores na contagem cega
-- Data: 02/05/2026
-- Versão: v2.20.1
--
-- Motivação:
-- Contagem deve ser cega por padrão. Hoje C1/C2 sempre aparecem ao contador no
-- mobile/desktop, ferindo o princípio. Esta migration adiciona uma flag por
-- counting_list que o supervisor escolhe NO ATO da liberação. Default: false
-- (cega real). Reset a cada nova liberação (cada ciclo decide separadamente).

BEGIN;

ALTER TABLE inventario.counting_lists
  ADD COLUMN IF NOT EXISTS show_previous_counts BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN inventario.counting_lists.show_previous_counts IS
  'Permite ao contador ver C1/C2 anteriores nesta liberação. Default false (contagem cega). Resetado a cada release.';

COMMIT;
