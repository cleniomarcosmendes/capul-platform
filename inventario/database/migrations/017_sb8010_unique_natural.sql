-- 017_sb8010_unique_natural.sql
--
-- Fecha o segundo SCHEMA DRIFT achado em 07/08/2026 (o primeiro foi a 016).
--
-- SINTOMA: importar produtos morria com HTTP 500 no meio do lote de LOTES:
--   psycopg2.errors.InvalidColumnReference:
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- O importador (`import_produtos.py`, `_batch_upsert`) faz:
--   INSERT INTO inventario.sb8010 (...)
--   ON CONFLICT (b8_filial, b8_produto, b8_local, b8_lotectl) DO UPDATE ...
-- e o Postgres exige um UNIQUE (ou PK) exatamente sobre essas colunas.
--
-- CAUSA: a definicao ORIGINAL da tabela (create_sb2_sb8_tables.sql) tinha
--   PRIMARY KEY (b8_filial, b8_produto, b8_local, b8_lotectl)
-- mas a tabela real tem PK em `id` (UUID) e nenhuma unicidade sobre a chave
-- natural. Em algum momento ela foi recriada/alterada com chave substituta e a
-- restricao se perdeu — sem migration registrando a troca. A tabela IRMA
-- (sb2010) manteve a dela: `sb2010_pkey (b2_filial, b2_cod, b2_local)`. Ou
-- seja, as duas divergiram e so uma quebra.
--
-- Nao se troca a PK de volta (o `id` ja e referenciado como chave substituta):
-- adiciona-se o UNIQUE sobre a chave natural, que e o que o ON CONFLICT precisa
-- e o que garante a integridade do espelho (um lote por filial/produto/local).
--
-- Idempotente. Se houver duplicata pre-existente, o CREATE UNIQUE INDEX falha
-- com mensagem clara — o que e o comportamento certo: duplicata em espelho do
-- Protheus e dado errado, e mascarar isso so adiaria o problema.

CREATE UNIQUE INDEX IF NOT EXISTS sb8010_natural_uidx
  ON inventario.sb8010 (b8_filial, b8_produto, b8_local, b8_lotectl);

COMMENT ON INDEX inventario.sb8010_natural_uidx IS
  'Chave natural do espelho SB8010 (lotes). Exigida pelo ON CONFLICT do importador de produtos; a PK e o `id` substituto.';
