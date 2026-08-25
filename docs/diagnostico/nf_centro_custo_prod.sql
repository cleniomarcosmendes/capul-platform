-- Itens de nota fiscal SEM centro de custo — os que derrubam a tela em produção.
-- SOMENTE LEITURA.
--
-- Cada linha aqui é um item cujo rateio foi PERDIDO quando alguém excluiu um
-- centro de custo no Configurador (a FK era ON DELETE SET NULL até 20/08/2026).

\echo '== 1. Quantos itens estão sem centro de custo =='
SELECT count(*) AS itens_sem_cc,
       count(DISTINCT nota_fiscal_id) AS notas_afetadas
FROM gestao_ti.nota_fiscal_itens
WHERE centro_custo_id IS NULL;

\echo '== 2. Quais são — para decidir o centro de custo de cada um =='
SELECT nf.numero            AS nf_numero,
       f.nome               AS fornecedor,
       nf.data_lancamento::date AS lancamento,
       d.nome               AS departamento,
       p.descricao          AS produto,
       i.quantidade,
       i.valor_total,
       i.id                 AS item_id
FROM gestao_ti.nota_fiscal_itens i
JOIN gestao_ti.notas_fiscais nf ON nf.id = i.nota_fiscal_id
LEFT JOIN gestao_ti.fornecedores f ON f.id = nf.fornecedor_id
LEFT JOIN core.departamentos    d ON d.id = nf.departamento_id
LEFT JOIN gestao_ti.produtos    p ON p.id = i.produto_id
WHERE i.centro_custo_id IS NULL
ORDER BY nf.data_lancamento DESC;

\echo '== 3. Centros de custo disponíveis para atribuir =='
SELECT id, codigo, nome, status FROM core.centros_custo ORDER BY codigo;

\echo '== 4. Confirmação: a FK ainda é SET NULL? (antes do deploy, sim) =='
SELECT conname,
       CASE confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' ELSE confdeltype::text END AS on_delete
FROM pg_constraint
WHERE conname = 'nota_fiscal_itens_centro_custo_id_fkey';

-- ────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DOS DADOS — só depois de decidir, item a item, qual é o centro de
-- custo correto. NÃO existe "chute seguro" aqui: este campo é rateio de custo,
-- e preencher errado é pior do que deixar vazio (vira número errado no
-- Dashboard, que é o que a diretoria olha).
--
-- Rode UMA linha por item, trocando os dois valores:
--
--   UPDATE gestao_ti.nota_fiscal_itens
--      SET centro_custo_id = '<id-do-centro-de-custo>'
--    WHERE id = '<item_id-da-consulta-2>';
--
-- Depois confira que zerou:
--   SELECT count(*) FROM gestao_ti.nota_fiscal_itens WHERE centro_custo_id IS NULL;
--
-- 💡 Se não der para saber qual era o centro de custo (ele foi excluído), o
-- backup anterior à exclusão tem a informação: a coluna só foi zerada no
-- momento do DELETE.
