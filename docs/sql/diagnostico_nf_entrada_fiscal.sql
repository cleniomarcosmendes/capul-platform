-- =====================================================================
-- Diagnostico focado: NF-e de ENTRADA
-- Banco:  CAPULFIS @ 192.168.7.85 (Oracle TOTVS_PRD)
-- Objetivo do modulo Fiscal:
--   Eliminar a dependencia do portal SEFAZ (e-CAC) + certificado
--   digital espalhado em varias maquinas para baixar XML de NF-e
--   recebidas. Centralizar o download via A1 unico no servidor.
--
-- Hipoteses a validar:
--   H1: Protheus ja faz distDFe por NSU e popula C00010 com um "resumo"
--       (ja confirmado em producao)
--   H2: Mas NAO baixa o XML completo automaticamente — dai a CAPUL
--       ainda entra manualmente no portal para cada chave
--   H3: SF1010.F1_XLDANFE esta VAZIO na maioria dos casos (porque o
--       usuario nao anexa quando digita manual) — validar %
--   H4: Ha NFes em C00010 que NUNCA viraram SF1010 (gap entre recebido
--       e dado entrada) — esse eh o nosso "backlog" de valor
--
-- Autor: Modulo Fiscal — 15/04/2026
-- =====================================================================

SET PAGESIZE 200
SET LINESIZE 300
SET FEEDBACK OFF
SET LONG 500
SET SERVEROUTPUT ON

-- ---------------------------------------------------------------------
-- BLOCO 1: SF1010 estrutura — campos relevantes para entrada fiscal
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 1: SF1010 (NF Entrada) — estrutura de campos relevantes
PROMPT ============================================================
COLUMN X3_CAMPO   FORMAT A14
COLUMN X3_TITULO  FORMAT A22
COLUMN X3_DESCRIC FORMAT A45
COLUMN X3_TIPO    FORMAT A4
COLUMN X3_TAMANHO FORMAT 99999
SELECT X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_TITULO, X3_DESCRIC
  FROM TOTVS_PRD.SX3010
 WHERE X3_ARQUIVO = 'SF1'
   AND (UPPER(X3_CAMPO) IN ('F1_FILIAL','F1_DOC','F1_SERIE','F1_TIPO',
                             'F1_FORNECE','F1_LOJA','F1_EMISSAO',
                             'F1_DTDIGIT','F1_VALMERC','F1_VALBRUT',
                             'F1_CHVNFE','F1_XLDANFE','F1_DANFE',
                             'F1_STATUS','F1_XSTATUS','F1_XMSGRET',
                             'F1_XRETSEF','F1_PROTOC','F1_XPROTOC',
                             'F1_NFELETR','F1_EDIMP','F1_XML',
                             'F1_FIMP','F1_RECBMTO','F1_ESPECIE')
        OR UPPER(X3_DESCRIC) LIKE '%XML%'
        OR UPPER(X3_DESCRIC) LIKE '%PROTOCOLO%'
        OR UPPER(X3_DESCRIC) LIKE '%CHAVE%NF%')
 ORDER BY X3_ORDEM;

-- ---------------------------------------------------------------------
-- BLOCO 2: SF1010 — colunas reais (Oracle) com tipo BLOB/CLOB
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 2: SF1010 — colunas BLOB/CLOB no Oracle
PROMPT ============================================================
COLUMN column_name FORMAT A20
COLUMN data_type   FORMAT A12
COLUMN data_length FORMAT 999999
SELECT column_name, data_type, data_length
  FROM all_tab_columns
 WHERE owner = 'TOTVS_PRD'
   AND table_name = 'SF1010'
   AND data_type IN ('BLOB','CLOB','LONG','NCLOB','LONG RAW');

-- ---------------------------------------------------------------------
-- BLOCO 3: SF1010 — contagem geral por STATUS (ativos / deletados)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 3: SF1010 — Totais
PROMPT ============================================================
SELECT 'SF1010 total'           TIPO, COUNT(*) QTD FROM TOTVS_PRD.SF1010;
SELECT 'SF1010 ativas'                , COUNT(*)     FROM TOTVS_PRD.SF1010 WHERE D_E_L_E_T_ = ' ';

-- ---------------------------------------------------------------------
-- BLOCO 4: SF1010 — quantas tem chave NFe preenchida
--   Isso eh pre-requisito para qualquer integracao fiscal
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 4: SF1010 — Cobertura de F1_CHVNFE
PROMPT ============================================================
SELECT 'SF1 com chave NFe (44d)' TIPO, COUNT(*) QTD
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND F1_CHVNFE IS NOT NULL
   AND LENGTH(TRIM(F1_CHVNFE)) = 44
UNION ALL
SELECT 'SF1 sem chave NFe'             , COUNT(*)
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND (F1_CHVNFE IS NULL OR TRIM(F1_CHVNFE) IS NULL OR LENGTH(TRIM(F1_CHVNFE)) <> 44);

-- ---------------------------------------------------------------------
-- BLOCO 5: SF1010 — COBERTURA DO XML (F1_XLDANFE)
--   ESTA EH A PERGUNTA CENTRAL:
--   Quantas NFes de entrada tem XML salvo no Protheus?
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 5: SF1010 — Cobertura do XML (F1_XLDANFE)
PROMPT ============================================================
SELECT 'SF1 com XML (BLOB preenchido)'   TIPO, COUNT(*) QTD
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100
UNION ALL
SELECT 'SF1 com BLOB vazio (<= 100 bytes)'   , COUNT(*)
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND (DBMS_LOB.GETLENGTH(F1_XLDANFE) IS NULL OR DBMS_LOB.GETLENGTH(F1_XLDANFE) <= 100);

-- Tamanho medio e maximo do BLOB (para estimar custo de storage)
PROMPT
PROMPT -- Estatisticas do BLOB F1_XLDANFE:
COLUMN METRICA FORMAT A30
COLUMN VALOR   FORMAT 999,999,999,999
SELECT 'Tamanho medio bytes' METRICA, ROUND(AVG(DBMS_LOB.GETLENGTH(F1_XLDANFE))) VALOR
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100
UNION ALL
SELECT 'Tamanho maximo bytes'           , MAX(DBMS_LOB.GETLENGTH(F1_XLDANFE))
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
UNION ALL
SELECT 'Tamanho minimo (> 100 bytes)'   , MIN(DBMS_LOB.GETLENGTH(F1_XLDANFE))
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100
UNION ALL
SELECT 'Soma total (MB)'                , ROUND(SUM(DBMS_LOB.GETLENGTH(F1_XLDANFE))/1024/1024)
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' ';

-- ---------------------------------------------------------------------
-- BLOCO 6: SF1010 — amostra dos primeiros 500 bytes do XML
--   Valida se eh XML mesmo (<nfeProc ou <NFe) ou PDF (%PDF) ou outra coisa
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 6: SF1010 — Amostra do inicio do BLOB (5 registros)
PROMPT ============================================================
COLUMN F1_DOC    FORMAT A10
COLUMN F1_SERIE  FORMAT A5
COLUMN F1_CHVNFE FORMAT A44
COLUMN INICIO_BLOB FORMAT A80
SELECT *
  FROM (
    SELECT F1_DOC, F1_SERIE, F1_CHVNFE,
           UTL_RAW.CAST_TO_VARCHAR2(
             DBMS_LOB.SUBSTR(F1_XLDANFE, 80, 1)
           ) INICIO_BLOB
      FROM TOTVS_PRD.SF1010
     WHERE D_E_L_E_T_ = ' '
       AND DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100
     ORDER BY F1_EMISSAO DESC
  )
 WHERE ROWNUM <= 5;

-- ---------------------------------------------------------------------
-- BLOCO 7: SF1010 — volume mensal de NFes de entrada (12 meses)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 7: SF1010 — Volume mensal ultimos 12 meses
PROMPT ============================================================
COLUMN ANO_MES FORMAT A8
COLUMN QTD_NFS FORMAT 999,999
COLUMN COM_CHAVE FORMAT 999,999
COLUMN COM_XML FORMAT 999,999
COLUMN PCT_XML FORMAT 999.9
SELECT SUBSTR(F1_EMISSAO,1,6) ANO_MES,
       COUNT(*) QTD_NFS,
       SUM(CASE WHEN LENGTH(TRIM(F1_CHVNFE)) = 44 THEN 1 ELSE 0 END) COM_CHAVE,
       SUM(CASE WHEN DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100 THEN 1 ELSE 0 END) COM_XML,
       ROUND(100.0 * SUM(CASE WHEN DBMS_LOB.GETLENGTH(F1_XLDANFE) > 100 THEN 1 ELSE 0 END) / COUNT(*), 1) PCT_XML
  FROM TOTVS_PRD.SF1010
 WHERE D_E_L_E_T_ = ' '
   AND F1_EMISSAO >= TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYYMMDD')
 GROUP BY SUBSTR(F1_EMISSAO,1,6)
 ORDER BY 1 DESC;

-- ---------------------------------------------------------------------
-- BLOCO 8: C00010 x SF1010 — O GAP
--   Quantas NFes a CAPUL JA SABE que existem (via distDFe / C00010)
--   mas ainda NAO entraram em SF1010 (nao foram digitadas / dadas entrada)?
--   Esse gap eh o "backlog de XMLs nao baixados" — publico-alvo do modulo
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 8: GAP C00010 x SF1010 (NFes recebidas mas nao entradas)
PROMPT ============================================================
-- Total C00010 (NFes que CAPUL sabe que existem)
SELECT 'C00010 total (ativas)'           TIPO, COUNT(*) QTD
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
UNION ALL
-- C00 que tem chave (deveriam todas ter)
SELECT 'C00010 com chave 44d'                 , COUNT(*)
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
   AND LENGTH(TRIM(C00_CHVNFE)) = 44
UNION ALL
-- C00 que ja virou SF1 (entrada dada)
SELECT 'C00 com SF1 correspondente'           , COUNT(*)
  FROM TOTVS_PRD.C00010 c
 WHERE c.D_E_L_E_T_ = ' '
   AND EXISTS (
         SELECT 1 FROM TOTVS_PRD.SF1010 f
          WHERE f.D_E_L_E_T_ = ' '
            AND f.F1_CHVNFE = c.C00_CHVNFE
       )
UNION ALL
-- C00 SEM SF1 (backlog: NFe chegou mas nao deram entrada)
SELECT 'C00 SEM SF1 (BACKLOG entrada)'        , COUNT(*)
  FROM TOTVS_PRD.C00010 c
 WHERE c.D_E_L_E_T_ = ' '
   AND NOT EXISTS (
         SELECT 1 FROM TOTVS_PRD.SF1010 f
          WHERE f.D_E_L_E_T_ = ' '
            AND f.F1_CHVNFE = c.C00_CHVNFE
       );

-- ---------------------------------------------------------------------
-- BLOCO 9: Backlog por mes — quantas NFes pendentes por mes de emissao
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 9: Backlog (C00 sem SF1) agrupado por mes de emissao
PROMPT ============================================================
COLUMN ANO_MES FORMAT A8
COLUMN QTD_BACKLOG FORMAT 999,999
SELECT SUBSTR(c.C00_DTEMI,1,6) ANO_MES,
       COUNT(*) QTD_BACKLOG,
       ROUND(SUM(c.C00_VLDOC),2) VALOR_BACKLOG
  FROM TOTVS_PRD.C00010 c
 WHERE c.D_E_L_E_T_ = ' '
   AND NOT EXISTS (
         SELECT 1 FROM TOTVS_PRD.SF1010 f
          WHERE f.D_E_L_E_T_ = ' '
            AND f.F1_CHVNFE = c.C00_CHVNFE
       )
 GROUP BY SUBSTR(c.C00_DTEMI,1,6)
 ORDER BY 1 DESC;

-- ---------------------------------------------------------------------
-- BLOCO 10: Top 15 emitentes do backlog (fornecedores com mais
--   NFes pendentes de entrada)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 10: Top 15 emitentes do backlog
PROMPT ============================================================
COLUMN CNPJ FORMAT A16
COLUMN EMITENTE FORMAT A45
COLUMN QTD FORMAT 999,999
COLUMN VALOR FORMAT 999,999,999.99
SELECT *
  FROM (
    SELECT c.C00_CNPJEM CNPJ,
           SUBSTR(MAX(c.C00_NOEMIT),1,45) EMITENTE,
           COUNT(*) QTD,
           SUM(c.C00_VLDOC) VALOR
      FROM TOTVS_PRD.C00010 c
     WHERE c.D_E_L_E_T_ = ' '
       AND NOT EXISTS (
             SELECT 1 FROM TOTVS_PRD.SF1010 f
              WHERE f.D_E_L_E_T_ = ' '
                AND f.F1_CHVNFE = c.C00_CHVNFE
           )
     GROUP BY c.C00_CNPJEM
     ORDER BY COUNT(*) DESC
  )
 WHERE ROWNUM <= 15;

-- ---------------------------------------------------------------------
-- BLOCO 11: C00010 — ha campo/flag indicando se XML JA foi baixado?
--   C00_XSINC no HLG sugere "Xml gravado" (L = logico)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 11: C00010 — Distribuicao C00_XSINC (XML gravado?)
PROMPT ============================================================
COLUMN C00_XSINC FORMAT A10
SELECT C00_XSINC, COUNT(*) QTD
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
 GROUP BY C00_XSINC
 ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------
-- BLOCO 12: Buscar outras tabelas/colunas que possam ter XML de NF-e
--   de entrada (alem de SF1010.F1_XLDANFE)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 12: Outras tabelas com possivel XML de entrada
PROMPT ============================================================
COLUMN table_name  FORMAT A15
COLUMN column_name FORMAT A20
COLUMN data_type   FORMAT A10
COLUMN X2_NOME     FORMAT A40
SELECT c.table_name, c.column_name, c.data_type,
       NVL(n.X2_NOME, '(sem dicionario)') X2_NOME
  FROM all_tab_columns c
  LEFT JOIN TOTVS_PRD.SX2010 n
         ON n.X2_CHAVE = SUBSTR(c.table_name,1,3)
        AND LENGTH(c.table_name) = 6
 WHERE c.owner = 'TOTVS_PRD'
   AND c.data_type IN ('BLOB','CLOB','LONG')
   AND (UPPER(c.column_name) LIKE '%XML%' OR UPPER(c.column_name) LIKE '%NFE%')
 ORDER BY c.table_name, c.column_name;

-- ---------------------------------------------------------------------
-- BLOCO 13: Existe schema SPED_NFE aqui tambem?
--   Se sim, listar suas tabelas (contagem)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 13: Schema SPED_NFE — existe e quais tabelas?
PROMPT ============================================================
SELECT username FROM all_users
 WHERE UPPER(username) IN ('SPED_NFE','TSS','SPED','NFE','FISCAL');

PROMPT
PROMPT -- Se SPED_NFE existe, listar top 15 tabelas por tamanho:
SELECT table_name
  FROM all_tables
 WHERE owner = 'SPED_NFE'
 ORDER BY table_name
 FETCH FIRST 30 ROWS ONLY;

PROMPT
PROMPT === FIM DO DIAGNOSTICO NF ENTRADA ===
EXIT;
