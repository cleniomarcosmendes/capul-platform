-- 016_add_szb010_local_exibicao.sql
--
-- Fecha um SCHEMA DRIFT achado em 07/08/2026.
--
-- O codigo usa `inventario.szb010.zb_xsbzlcz` em 7 lugares (feature
-- "localizacao dinamica", v2.19.8 de 19/12/2025) — inclusive no endpoint
-- `GET /api/v1/counting-lists/{list_id}/products`, que e o que a TELA DE
-- CONTAGEM usa. Mas a coluna:
--   - nao era criada por NENHUMA migration;
--   - nao estava no modelo SQLAlchemy;
--   - nao existia na tabela (que so tinha zb_filial, zb_xlocal, zb_xdesc,
--     created_at, updated_at).
--
-- Consequencia: em qualquer ambiente montado a partir das migrations, o
-- endpoint da contagem devolvia
--   psycopg2.errors.UndefinedColumn: column szb_loc.zb_xsbzlcz does not exist
-- Onde funciona hoje, a coluna foi adicionada A MAO em algum momento — o que e
-- exatamente o problema: o schema dependia de um passo manual que ninguem
-- registrou. Descoberto ao escrever o teste end-to-end da contagem cega.
--
-- Semantica (espelha o campo do Protheus): diz QUAL dos tres campos de
-- localizacao do produto exibir para aquele armazem.
--   '1' (default) -> bz_xlocal1
--   '2'           -> bz_xlocal2
--   '3'           -> bz_xlocal3
-- O codigo ja trata ausencia/valor invalido caindo em bz_xlocal1
-- (`COALESCE(szb_loc.zb_xsbzlcz, '1')` + `ELSE` no CASE), entao o DEFAULT '1'
-- aqui apenas torna explicito o que o codigo ja assumia.
--
-- Idempotente e nao-destrutivo: onde a coluna ja existe (provavelmente PROD),
-- este ALTER e no-op e nada e sobrescrito.

ALTER TABLE inventario.szb010
  ADD COLUMN IF NOT EXISTS zb_xsbzlcz VARCHAR(1) NOT NULL DEFAULT '1';

COMMENT ON COLUMN inventario.szb010.zb_xsbzlcz IS
  'Qual campo de localizacao exibir para este armazem: 1=bz_xlocal1 (default), 2=bz_xlocal2, 3=bz_xlocal3. Espelha o campo homonimo do Protheus.';
