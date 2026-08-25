-- Diagnóstico do 500 em GET /gestao-ti/compras/notas-fiscais
-- SOMENTE LEITURA. Nada aqui altera dado.
--
-- O findAll é um findMany com 6 relações OBRIGATÓRIAS no include. No Prisma,
-- uma única linha cuja relação obrigatória não resolve derruba a QUERY INTEIRA
-- com "Inconsistent query result: Field X is required to return data, got null".
-- Por isso a lista vem vazia em vez de vir incompleta — e por isso só quebra em
-- produção: é dado, não código (o código de PROD é idêntico ao do repositório).

\echo '== 1. NF -> fornecedor (gestao_ti.fornecedores) =='
SELECT count(*) AS orfaos FROM gestao_ti.notas_fiscais n
LEFT JOIN gestao_ti.fornecedores f ON f.id = n.fornecedor_id WHERE f.id IS NULL;

\echo '== 2. NF -> filial (core.filiais) =='
SELECT count(*) AS orfaos FROM gestao_ti.notas_fiscais n
LEFT JOIN core.filiais f ON f.id = n.filial_id WHERE f.id IS NULL;

\echo '== 3. NF -> criadoPor (core.usuarios)  <= principal suspeito =='
SELECT count(*) AS orfaos FROM gestao_ti.notas_fiscais n
LEFT JOIN core.usuarios u ON u.id = n.criado_por_id WHERE u.id IS NULL;

\echo '== 4. itens -> produto (gestao_ti.produtos) =='
SELECT count(*) AS orfaos FROM gestao_ti.nota_fiscal_itens i
LEFT JOIN gestao_ti.produtos p ON p.id = i.produto_id WHERE p.id IS NULL;

\echo '== 5. itens -> centroCusto (core.centros_custo) =='
SELECT count(*) AS orfaos FROM gestao_ti.nota_fiscal_itens i
LEFT JOIN core.centros_custo c ON c.id = i.centro_custo_id WHERE c.id IS NULL;

\echo '== 6. chaveHistorico -> alteradoPor (core.usuarios) =='
SELECT count(*) AS orfaos FROM gestao_ti.nota_fiscal_chave_historico h
LEFT JOIN core.usuarios u ON u.id = h.alterado_por_id WHERE u.id IS NULL;

\echo '== 7. produto -> tipoProduto (relação aninhada) =='
SELECT count(*) AS orfaos FROM gestao_ti.nota_fiscal_itens i
JOIN gestao_ti.produtos p ON p.id = i.produto_id
LEFT JOIN gestao_ti.tipos_produto t ON t.id = p.tipo_produto_id
WHERE p.tipo_produto_id IS NOT NULL AND t.id IS NULL;

\echo '== 8. NULL em coluna que o Prisma declara obrigatória =='
SELECT count(*) FILTER (WHERE fornecedor_id IS NULL)             AS fornecedor_id_null,
       count(*) FILTER (WHERE filial_id IS NULL)                 AS filial_id_null,
       count(*) FILTER (WHERE criado_por_id IS NULL)             AS criado_por_id_null,
       count(*) FILTER (WHERE departamento_id IS NULL)           AS departamento_id_null,
       count(*) FILTER (WHERE departamento_lancamento_id IS NULL) AS depto_lanc_null,
       count(*) FILTER (WHERE data_lancamento IS NULL)           AS data_lancamento_null,
       count(*) FILTER (WHERE valor_total IS NULL)               AS valor_total_null,
       count(*) FILTER (WHERE status IS NULL)                    AS status_null,
       count(*)                                                  AS total_nfs
FROM gestao_ti.notas_fiscais;

\echo '== 9. status fora do enum (REGISTRADA/CONFERIDA/CANCELADA) =='
SELECT status::text, count(*) FROM gestao_ti.notas_fiscais GROUP BY 1 ORDER BY 2 DESC;

\echo '== 10. equipe/projeto: FK apontando para linha inexistente (opcionais, mas checar) =='
SELECT (SELECT count(*) FROM gestao_ti.notas_fiscais n
        LEFT JOIN gestao_ti.equipes_ti e ON e.id = n.equipe_id
        WHERE n.equipe_id IS NOT NULL AND e.id IS NULL) AS equipe_orfa,
       (SELECT count(*) FROM gestao_ti.nota_fiscal_itens i
        LEFT JOIN gestao_ti.projetos p ON p.id = i.projeto_id
        WHERE i.projeto_id IS NOT NULL AND p.id IS NULL) AS projeto_orfo;

\echo '== 11. VOLUME — a rota nao tem paginacao; include profundo em base grande =='
SELECT (SELECT count(*) FROM gestao_ti.notas_fiscais)                AS nfs,
       (SELECT count(*) FROM gestao_ti.nota_fiscal_itens)            AS itens,
       (SELECT count(*) FROM gestao_ti.nota_fiscal_chave_historico)  AS historico_chave;

\echo '== 12. MIGRATIONS — o codigo de PROD (4daf094) espera 59 do gestao-ti =='
SELECT count(*) FILTER (WHERE migration_name ~ '^202') AS aplicadas_total
FROM public._prisma_migrations;
SELECT to_regclass('gestao_ti.nota_fiscal_chave_historico') AS tabela_historico_existe;
SELECT count(*) AS coluna_chave_nfe_existe FROM information_schema.columns
WHERE table_schema='gestao_ti' AND table_name='notas_fiscais' AND column_name='chave_nfe';
