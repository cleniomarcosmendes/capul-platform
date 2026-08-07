-- 019_slk010_fks_opcionais.sql
--
-- Ultimo bloqueio da importacao de produtos (07/08/2026):
--   psycopg2.errors.NotNullViolation:
--   null value in column "product_id" of relation "slk010"
--
-- Nao e "coluna faltando" como a 016/017/018 — e CONFLITO DE MODELO. A slk010
-- foi desenhada como tabela NATIVA do modulo, com FKs obrigatorias:
--     product_id -> inventario.products
--     store_id   -> inventario.stores
-- mas o importador a trata (corretamente) como ESPELHO do Protheus, gravando so
-- os codigos: slk_filial + slk_codbar + slk_produto.
--
-- E `store_id` e insatisfazivel na pratica: `inventario.stores` esta VAZIA. Com
-- o UNIFIED_AUTH a filial passou a vir de `core.filiais`, e a `stores` ficou
-- como resquicio do modelo anterior — o mesmo resquicio que deixava o seletor de
-- armazem vazio (ver a correcao de /warehouses/simple no mesmo dia).
--
-- DECISAO: tornar as duas FKs OPCIONAIS, em vez de fazer o importador inventar
-- valores. Razoes:
--   * a identidade da linha e a chave natural (filial, codbar, produto), que a
--     migration 018 acabou de tornar UNIQUE;
--   * o unico consumidor real (`main.py` — busca de produto por codigo de
--     barras) le por `slk_codbar`, nunca pelas FKs;
--   * `store_id` nao TEM valor possivel enquanto `stores` estiver vazia;
--   * relaxar NOT NULL e a direcao segura: nenhuma linha existente e invalidada
--     e nenhum dado se perde. Voltar atras e so um ALTER.
--
-- As FKs em si continuam de pe: se alguem preencher, a integridade e validada.

ALTER TABLE inventario.slk010 ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE inventario.slk010 ALTER COLUMN store_id   DROP NOT NULL;

COMMENT ON COLUMN inventario.slk010.product_id IS
  'OPCIONAL desde 07/08/2026. A tabela e espelho do Protheus e a identidade e (slk_filial, slk_codbar, slk_produto); esta FK e resquicio do modelo nativo anterior.';
COMMENT ON COLUMN inventario.slk010.store_id IS
  'OPCIONAL desde 07/08/2026. Aponta para inventario.stores, que o UNIFIED_AUTH tornou obsoleta (a filial vem de core.filiais).';
