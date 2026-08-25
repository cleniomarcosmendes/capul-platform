-- ============================================================================
-- PRODUÇÃO — destrava a tela de Notas Fiscais e o Dashboard de investimento
-- ============================================================================
--
-- O QUE FAZ
--   1. Cria o centro de custo 999999999 "A DEFINIR - PENDENTE DE CLASSIFICACAO"
--   2. Aponta para ele TODOS os itens de nota fiscal que estão sem centro de
--      custo (9 itens / 6 notas / R$ 802,30 em 20/08/2026)
--
--   Tudo numa transação: ou as duas coisas acontecem, ou nenhuma.
--
-- POR QUE UM CENTRO "A DEFINIR", E NÃO O INFORMATICA
--   Porque não sabemos qual era o centro de custo original — ele foi EXCLUÍDO,
--   e a FK `ON DELETE SET NULL` apagou a referência junto. Chutar INFORMATICA
--   somaria R$ 802,30 no rateio de um centro que talvez não seja o certo, e o
--   erro ficaria invisível: número errado no Dashboard, que é o que a diretoria
--   olha. Um balde "A DEFINIR" é honesto — aparece separado, ninguém confunde
--   com dado apurado, e o usuário reclassifica item a item pela tela.
--
-- POR QUE ISSO DESTRAVA A TELA
--   O Prisma declarava `centroCustoId` obrigatório e o banco aceitava NULL.
--   UMA linha com NULL derrubava a QUERY INTEIRA (P2032) — por isso a lista
--   vinha VAZIA em vez de vir incompleta. Zerando os NULLs, o 500 some na hora,
--   sem esperar deploy.
--
-- TESTADO
--   Rodado em DEV dentro de BEGIN/ROLLBACK em 20/08/2026: cria o centro,
--   reaponta os itens, confere e desfaz. DEV não foi alterado.
--
-- ⚠️ DEPOIS DE RODAR
--   • Reclassificar os 9 itens pela tela de Notas Fiscais (editar a NF e trocar
--     o centro de custo do item).
--   • Quando não sobrar nenhum, INATIVAR o 999999999 no Configurador.
--   • Até o deploy da correção, a FK em PROD ainda é ON DELETE SET NULL:
--     avisar quem mexe no Configurador para INATIVAR centro de custo, nunca
--     EXCLUIR. Depois do deploy, excluir um centro em uso passa a falhar
--     sozinho, com a mensagem certa.
-- ============================================================================

BEGIN;

\echo ''
\echo '>> ANTES:'
SELECT count(*) AS itens_sem_centro_custo,
       count(DISTINCT nota_fiscal_id) AS notas_afetadas,
       coalesce(sum(valor_total), 0) AS valor_total
  FROM gestao_ti.nota_fiscal_itens
 WHERE centro_custo_id IS NULL;

-- A filial do centro provisório é a mesma das notas afetadas (a mais frequente),
-- para não inventar vínculo com filial que não tem nada a ver com o caso.
WITH filial_alvo AS (
  SELECT nf.filial_id
    FROM gestao_ti.nota_fiscal_itens i
    JOIN gestao_ti.notas_fiscais nf ON nf.id = i.nota_fiscal_id
   WHERE i.centro_custo_id IS NULL
   GROUP BY nf.filial_id
   ORDER BY count(*) DESC
   LIMIT 1
),
cc_novo AS (
  INSERT INTO core.centros_custo (id, codigo, nome, descricao, status, created_at, updated_at, filial_id)
  SELECT gen_random_uuid()::text,
         '999999999',
         'A DEFINIR - PENDENTE DE CLASSIFICACAO',
         'Provisorio. Recebeu itens de nota fiscal que perderam o centro de custo quando um centro de custo foi EXCLUIDO (FK ON DELETE SET NULL, corrigida em 20/08/2026). Reclassificar item a item pela tela de Notas Fiscais e depois INATIVAR este centro.',
         'ATIVO'::core."StatusGeral",
         now(), now(),
         f.filial_id
    FROM filial_alvo f
  RETURNING id
)
UPDATE gestao_ti.nota_fiscal_itens i
   SET centro_custo_id = (SELECT id FROM cc_novo)
 WHERE i.centro_custo_id IS NULL;

\echo ''
\echo '>> DEPOIS (itens_sem_centro_custo tem de ser 0):'
SELECT count(*) AS itens_sem_centro_custo FROM gestao_ti.nota_fiscal_itens WHERE centro_custo_id IS NULL;

\echo ''
\echo '>> O centro provisorio e o que ele recebeu:'
SELECT cc.codigo, cc.nome, cc.status,
       count(i.id) AS itens,
       sum(i.valor_total) AS valor_total
  FROM core.centros_custo cc
  LEFT JOIN gestao_ti.nota_fiscal_itens i ON i.centro_custo_id = cc.id
 WHERE cc.codigo = '999999999'
 GROUP BY cc.codigo, cc.nome, cc.status;

-- ⛔ Confira os números acima ANTES de confirmar.
--    Se algo estiver errado, troque COMMIT por ROLLBACK e nada acontece.
COMMIT;

\echo ''
\echo '>> Pronto. Recarregue a tela de Notas Fiscais (Ctrl+F5).'
\echo ''
\echo '>> Os 9 itens para reclassificar:'
SELECT nf.numero AS nf, f.nome AS fornecedor, nf.data_lancamento::date AS lancamento,
       p.descricao AS produto, i.valor_total
  FROM gestao_ti.nota_fiscal_itens i
  JOIN gestao_ti.notas_fiscais nf ON nf.id = i.nota_fiscal_id
  JOIN core.centros_custo cc ON cc.id = i.centro_custo_id
  LEFT JOIN gestao_ti.fornecedores f ON f.id = nf.fornecedor_id
  LEFT JOIN gestao_ti.produtos p ON p.id = i.produto_id
 WHERE cc.codigo = '999999999'
 ORDER BY nf.data_lancamento DESC;
