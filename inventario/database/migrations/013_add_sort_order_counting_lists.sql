-- Migration 013: adicionar sort_order em counting_lists
--
-- Permite ao supervisor definir a ordem em que os produtos aparecem para o contador
-- no momento da Liberação da lista. Cada Liberar (1ª vez ou re-liberação após devolução)
-- pode escolher um sort_order diferente.
--
-- Valores aceitos:
--   ORIGINAL              — ordem default (sequencial conforme inserção da lista)
--   PRODUCT_CODE          — por código do produto (numérico)
--   PRODUCT_DESCRIPTION   — por descrição (alfabético pt-BR)
--   LOCAL1                — por Localização 1 (otimiza walk-through pelo armazém)
--   LOCAL2                — por Localização 2
--   LOCAL3                — por Localização 3
--
-- Default ORIGINAL para retrocompatibilidade — listas existentes mantêm comportamento atual.

ALTER TABLE inventario.counting_lists
ADD COLUMN IF NOT EXISTS sort_order VARCHAR(30) DEFAULT 'ORIGINAL';

-- Constraint: só aceita valores conhecidos
ALTER TABLE inventario.counting_lists
DROP CONSTRAINT IF EXISTS counting_lists_sort_order_check;

ALTER TABLE inventario.counting_lists
ADD CONSTRAINT counting_lists_sort_order_check
CHECK (sort_order IN (
    'ORIGINAL', 'PRODUCT_CODE', 'PRODUCT_DESCRIPTION',
    'LOCAL1', 'LOCAL2', 'LOCAL3'
));

COMMENT ON COLUMN inventario.counting_lists.sort_order IS
'Ordenação dos produtos para o contador, definida pelo supervisor no Liberar. '
'Valores: ORIGINAL, PRODUCT_CODE, PRODUCT_DESCRIPTION, LOCAL1, LOCAL2, LOCAL3.';
