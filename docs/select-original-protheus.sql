-- ============================================================================
-- SELECT ORIGINAL DE APURAÇÃO DA AVALIAÇÃO — Protheus / SIGAAPD
-- Autor: Clenio Marcos · uso: relatório de resultado para a gestão de RH
--
-- PRESERVADO COMO REGISTRO HISTÓRICO. Não é para ser executado nem replicado.
-- Serve como referência de regressão do módulo Gestão de Pessoas: o motor novo
-- deve reproduzir este resultado onde nada mudou, e divergir de forma
-- EXPLICÁVEL onde corrigimos defeito.
--
-- Acentuação restaurada (o original estava em charset divergente).
-- Nenhuma linha de SQL foi alterada.
--
-- DEFEITOS CONHECIDOS (ver docs/04_criterios_automaticos_e_calculo.md):
--   1. NVL fora da soma  -> um componente nulo zera a média inteira
--   2. where resultado_avaliacao <> 0 -> esconde quem não foi avaliado
--   3. current_date -> a nota muda conforme o dia em que o relatório roda
--   4. data_funcao e dias_na_funcao usam filtros diferentes e divergem
--   5. denominador 18 fixo -> quebra silenciosamente se mudar o questionário
--   6. janela de cursos fixa, terminando em 20241131 (data inexistente)
--   7. exclusão de r7_data = '20241101' -> remendo para o dissídio; o dissídio
--      é ANUAL, então excluir uma data não resolve
--   8. no primeiro branch de nota_dias_na_funcao lê-se max(sr7.r_e_c_n_o_)
--      onde os demais leem max(sr7a.r_e_c_n_o_) — o teste "= 0" avalia uma
--      data diferente da usada nos outros branches
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Arielly — Resultado da Avaliação
-- ----------------------------------------------------------------------------
select

ra_filial, ra_cc, ra_mat, ra_salario, rd0_codigo, ra_nome, ra_cic,  ra_admissa, x5_descri as Grau_Instrucao,RA_CODFUNC,
notaFormacao,
data_funcao,
Tempo_de_empresa,
nota_tempo_empresa,
dias_na_funcao,
nota_dias_na_funcao,
desc_funcao,
qtde_curso,
nota_qtde_curso,
resultado_avaliacao,

NVL(((notaFormacao+
nota_tempo_empresa+
nota_dias_na_funcao+
nota_qtde_curso+
resultado_avaliacao)/5),0) media

from
(
select ra_filial, ra_cc, ra_mat,ra_salario, rd0_codigo, ra_nome, ra_cic,  ra_admissa, x5_descri,RA_CODFUNC,

case
    when x5_chave in ('10','20','25','30','35','40','45') then 25
    when x5_chave = '50' then 50
    when x5_chave = '55' then 75
    when x5_chave in('65','75','85','95') then 100
    else 0
end as notaFormacao,

    (select max(sr7.r7_data) from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' '))) data_funcao,
    round(((current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365),1) as  Tempo_de_empresa,

    case
        when  (round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  = 0 then 0
        when  ((round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  > 0   and (round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  <= 3) then 25
        when  ((round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  > 3  and (round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  <= 5) then 50
        when  ((round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  > 5  and (round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  <= 7) then 75
        when  (round(current_date - to_date(sra.ra_admissa, 'YYYYMMDD'))/365)  > 7 then 100
    end as nota_tempo_empresa,

    (select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) dias_na_funcao,

    case
        when
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and (sr7.r_e_c_n_o_ = (select max (sr7.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) = 0  then 0
        when
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) > 0  and
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) <= 2 then 25
        when
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and  (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) > 2  and
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and  (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) <= 4 then 50
        when
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and  (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) > 4  and
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and  (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) <= 6 then 75
        when
            ((select round(current_date - to_date(max(sr7.r7_data), 'YYYYMMDD')) as data_atual from totvs_prd.sr7010 sr7 where sr7.r7_mat = sra.ra_mat and sr7.d_e_l_e_t_ = ' ' and   (sr7.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ' and sr7a.r7_data <> '20241101'))) /365) > 6  then 100
    end as nota_dias_na_funcao,

    (select  sr7b.r7_descfun from totvs_prd.sr7010 sr7b where sr7b.r7_mat = sra.ra_mat and sr7b.d_e_l_e_t_ = ' ' and (sr7b.r_e_c_n_o_ = (select max (sr7a.r_e_c_n_o_) from totvs_prd.sr7010 sr7a where sr7b.r7_mat = sr7a.r7_mat and sr7a.d_e_l_e_t_ = ' ')))  desc_funcao,

    (select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ')qtde_curso,

    case
        when
            ((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ')) = 0   then 0
        when
            (((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') > 0)  and ((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') <= 2))  then 25
        when
            (((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') > 2)  and ((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') <= 5))  then 50
        when
            (((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') > 5)  and ((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ') <= 8))  then 75
        when
            ((select count (*) from ra4010 ra4 where ra4_mat = sra.ra_mat and ra4_datain >= '20231101' and ra4_datafi <= '20241131' and ra4.d_e_l_e_t_ = ' ')) > 8  then 100

        end as nota_qtde_curso,

    -- componente de metas/objetivos, nunca ativado:
    --(select sum(rdd_resobt) from totvs_prd.rdd010 rdd, totvs_prd.rd2010 rd2 where rdd_codado = rd0.rd0_codigo and   rdd_codcom = '000001' and rdd_codtip = '000005' and rdd_itecom = rd2_item and rd2_codigo = '000001'   and rdd.d_e_l_e_t_ = ' '      and rd2.d_e_l_e_t_ = ' ') resultado_avaliacao
    round((((select sum(rdb_resobt) from totvs_prd.rdb010 rdb where rdb_codado = rd0.rd0_codigo and   rdb_codcom = '000001' and rdb_codtip = '000007' and  rdb.d_e_l_e_t_ = ' ' )*100)/18),0) resultado_avaliacao

from totvs_prd.sra010 sra, totvs_prd.sx5010 sx5, totvs_prd.rd0010 rd0
where
 ra_demissa = ' '
and sra.ra_grinrai = sx5.x5_chave
and sra.ra_cic = rd0.rd0_cic
and sx5.x5_tabela = '26'
and rd0.rd0_msblql <> 1
and sra.ra_sitfolh <> 'D'
and sra.ra_mat like '0%'
and sra.d_e_l_e_t_ = ' '
and sx5.d_e_l_e_t_ = ' '
and rd0.d_e_l_e_t_ = ' '
)
where resultado_avaliacao <> 0;

-- ----------------------------------------------------------------------------
-- Resultado da avaliação — analítico (questão a questão)
-- ----------------------------------------------------------------------------
select
*
from
(
select
rdb.rdb_codado, rd0_nome, rdb_codcom, rdb_itecom, rdb_codtip,  rdb_codque, qp_descric, rdb_codalt, rdb_resobt     from rd8010 rd8, rd0010 rd0, sqp010 sqp, rdb010 rdb
 where
    rdb_codado = rd0.rd0_codigo
and rdb_codcom = rd8_codcom
and rdb_itecom = rd8.rd8_itecom
and rd8_codque = sqp.qp_questao
and rdb_codalt = sqp.qp_alterna
and sqp.qp_alterna = rdb.rdb_codalt
and rd8.rd8_codque = rdb.rdb_codque
and rdb_codado = '004115'
and rd8_codmod = '000004'
and rd8_codcom = '000001'
and rd0.rd0_msblql <> 1
and rd8.d_e_l_e_t_ = ' '
and sqp.d_e_l_e_t_ = ' '
and rd0.d_e_l_e_t_ = ' '
)
where rdb_codado <> ' ';

-- ----------------------------------------------------------------------------
-- Passo a passo — mapeamento das tabelas
-- ----------------------------------------------------------------------------
select * from rdb010 rdd where d_e_l_e_t_ = ' ';
select * from rd8010 rd8 where d_e_l_e_t_ = ' ';
select * from rd0010 rd0 where d_e_l_e_t_ = ' ';
select * from sqp010 sqp where d_e_l_e_t_ = ' ';

-- Tabelas do módulo Avaliação e Desempenho (SIGAAPD)
/*
RD1 - Rede
RD2 - Itens de Competência
RD4 - Itens de Visões
RD5 - Cabeçalho Tipos de Avaliações
RD6 - Cabeçalho Montagem Avaliações
RD7 - Itens Refinamento Avaliações
RD9 - Itens Avaliações x Avaliados
RDA - Itens Avaliados x Avaliadores
RDB - Itens Respostas de Avaliações
RDC - Itens Envio/Retorno Avaliações
RDE - Itens Participantes x Visões
RDF - Objetivos vs Plano Avaliação
RDG - Mensagens
RDH - Itens Tipos de Avaliação-Rede
RDI - Tipo de Objetivos
RDJ - Itens Objetivos/Participantes
RDK - Cabeçalho de Visões
RDL - Cabeçalho Plano de Avaliação
RDM - Cabeçalho de Competências
RDN - Projetos
RDO - Itens Modelo Avaliação/Escala
RDP - Itens Agenda de Avaliações
RDQ - Histórico de Estruturas
RDR - Itens Modelo/Plano Avaliação
RDS - Cabeç. Critérios Mont. Avaliação
RDT - Itens Critérios Mont. Avaliação
RDU - Períodos de Planos/Avaliações
RDV - Cabeçalho Plano de Metas
RDW - Itens de Objetivos C E E
RDY - Itens de "Virtual Memo Field"
RDZ - Pessoas x Entidades
RIX - Política Consolidada
RIY - Detalhes Política Consolidada
RIZ - Resultado Consolidado
*/

select * from ra4010 ra4;
