-- 018_slk010_unique_natural.sql
--
-- Mesmo defeito da 017, na tabela seguinte do importador — encontrado ANTES de
-- estourar, varrendo todos os `ON CONFLICT` de `import_produtos.py` contra as
-- restricoes reais em vez de esperar o proximo 500.
--
-- `import_produtos.py` faz:
--   INSERT INTO inventario.slk010 (...)
--   ON CONFLICT (slk_filial, slk_codbar, slk_produto) DO NOTHING
-- e nao existia UNIQUE sobre essas colunas. A importacao morreria em slk010
-- (codigos de barras) logo depois de passar por sb8010 (lotes).
--
-- Idempotente. Se surgir duplicata, o CREATE UNIQUE INDEX falha com mensagem
-- clara — comportamento certo para um espelho do Protheus.
--
-- ⚠️ Padrao que se repetiu 3x em 07/08 (016, 017, 018): o CODIGO assume um
-- objeto de schema que NENHUMA migration cria. Ao mexer neste modulo, conferir
-- `ON CONFLICT` / colunas usadas contra o schema real, em vez de confiar que a
-- tabela esta como o codigo espera.

CREATE UNIQUE INDEX IF NOT EXISTS slk010_natural_uidx
  ON inventario.slk010 (slk_filial, slk_codbar, slk_produto);

COMMENT ON INDEX inventario.slk010_natural_uidx IS
  'Chave natural do espelho SLK010 (codigos de barras). Exigida pelo ON CONFLICT do importador de produtos.';
