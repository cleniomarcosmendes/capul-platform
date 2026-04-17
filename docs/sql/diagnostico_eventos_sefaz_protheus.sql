-- =====================================================================
-- Diagnostico: onde o Protheus grava retornos/eventos SEFAZ
-- Banco:  Oracle TOTVS_PRD (producao CAPUL)
-- Uso:    read-only, apenas SELECTs. Pode rodar no SQLcl ou SQL Developer.
-- Autor:  Modulo Fiscal / Capul Platform — 15/04/2026
--
-- Como usar:
--   1. Conecte como totvs_prd@<service_name_producao>
--   2. Rode o script inteiro (ou bloco por bloco com F5)
--   3. Me envie o output — cada bloco tem um PROMPT com titulo
--
-- Objetivo:
--   Validar se o banco de producao tem MAIS tabelas/dados do que o HLG,
--   e confirmar onde ficam:
--     (a) Eventos de manifestacao do destinatario (NFe recebidas) — C00010
--     (b) Eventos de NFe emitida (CCe, cancelamento) — ?
--     (c) Eventos de CTe e MDFe — GI7010/DLI010/H62010/CC0010
--     (d) Onde fica o XML bruto (filesystem? tabela?)
-- =====================================================================

SET PAGESIZE 200
SET LINESIZE 300
SET FEEDBACK OFF
SET SERVEROUTPUT ON

-- ---------------------------------------------------------------------
-- BLOCO 1: Confirmar quais tabelas-alvo existem FISICAMENTE em producao
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 1: Tabelas-alvo presentes no banco (TOTVS_PRD)
PROMPT ============================================================
SELECT table_name
  FROM all_tables
 WHERE owner = 'TOTVS_PRD'
   AND table_name IN (
     'C00010',   -- Manifesto do destinatario (eventos NFe recebidas)
     'CC0010',   -- Manifesto Documentos Fiscais (MDFe)
     'CDD010',   -- Documentos referenciados
     'DLI010',   -- Eventos MDF-e
     'F0V010',   -- Historico NT 2015/00 (eventos NFe)
     'F0U010',   -- Itens NT 2015/001
     'GI7010',   -- Eventos CTE
     'H62010',   -- Eventos CTeOS
     'EIX010',   -- NFes rejeitadas pela SEFAZ
     'DIC010',   -- Carta de Correcao
     'DIM010',   -- Itens da Carta de Correcao
     'EEM010',   -- Controle de Notas Fiscais
     'CTE010',   -- CTe cabecalho
     'NFECAB',   -- customizada CAPUL
     'NFEITEM',  -- customizada CAPUL
     'SF1010',   -- NF Entrada
     'SF2010',   -- NF Saida
     'SF3010'    -- Livros Fiscais
   )
 ORDER BY table_name;

-- ---------------------------------------------------------------------
-- BLOCO 2: Contagem total de registros nas tabelas-alvo
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 2: Contagem de registros (registros ativos + deletados)
PROMPT ============================================================
COLUMN TABELA FORMAT A30
COLUMN QTD    FORMAT 999,999,999

SELECT 'C00010  - Manif destinatario'      TABELA, COUNT(*) QTD FROM TOTVS_PRD.C00010;
SELECT 'CC0010  - Manifesto MDFe'          , COUNT(*)     FROM TOTVS_PRD.CC0010;
SELECT 'CDD010  - Doc referenciados'       , COUNT(*)     FROM TOTVS_PRD.CDD010;
SELECT 'SF1010  - NF Entrada'              , COUNT(*)     FROM TOTVS_PRD.SF1010;
SELECT 'SF2010  - NF Saida'                , COUNT(*)     FROM TOTVS_PRD.SF2010;

-- Tabelas que NAO existem em HLG — podem existir em PRD:
-- Se der ORA-00942, tudo bem, significa que tambem nao existe em PRD.
PROMPT
PROMPT -- Tabelas abaixo podem nao existir. ORA-00942 = nao existe em PRD:
SELECT 'F0V010  - Hist NT 2015'            , COUNT(*)     FROM TOTVS_PRD.F0V010;
SELECT 'GI7010  - Eventos CTe'             , COUNT(*)     FROM TOTVS_PRD.GI7010;
SELECT 'DIC010  - Carta Correcao'          , COUNT(*)     FROM TOTVS_PRD.DIC010;
SELECT 'EIX010  - NFe Rejeitadas'          , COUNT(*)     FROM TOTVS_PRD.EIX010;
SELECT 'H62010  - Eventos CTeOS'           , COUNT(*)     FROM TOTVS_PRD.H62010;

-- ---------------------------------------------------------------------
-- BLOCO 3: Amostra C00010 — 20 registros mais recentes
--   Entender: quais codigos SEFAZ, quais filiais, periodo de dados
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 3: Amostra C00010 (Manifesto do destinatario)
PROMPT ============================================================
COLUMN C00_FILIAL  FORMAT A6
COLUMN C00_CHVNFE  FORMAT A44
COLUMN C00_CODEVE  FORMAT A8
COLUMN C00_STATUS  FORMAT A6
COLUMN C00_SITDOC  FORMAT A7
COLUMN C00_CODRET  FORMAT A7
COLUMN C00_NOEMIT  FORMAT A35
COLUMN C00_CNPJEM  FORMAT A15
COLUMN C00_DTEMI   FORMAT A10
COLUMN C00_DTREC   FORMAT A10
COLUMN C00_VLDOC   FORMAT 999,999,999.99
COLUMN DESC_RES    FORMAT A50

SELECT *
  FROM (
    SELECT C00_FILIAL, C00_CHVNFE, C00_CODEVE, C00_STATUS, C00_SITDOC,
           C00_CODRET, SUBSTR(C00_NOEMIT,1,35) C00_NOEMIT, C00_CNPJEM,
           C00_DTEMI, C00_DTREC, C00_VLDOC,
           SUBSTR(C00_DESRES,1,50) DESC_RES
      FROM TOTVS_PRD.C00010
     WHERE D_E_L_E_T_ = ' '
     ORDER BY C00_DTEMI DESC, C00_CHVNFE DESC
  )
 WHERE ROWNUM <= 20;

-- ---------------------------------------------------------------------
-- BLOCO 4: C00010 — distribuicao por CODIGO DE EVENTO
--   Ajuda a saber quais codigos o Protheus usa (1=sem manif, 2=ciencia,
--   3=confirm, 4=desconh, 5=nao realizada — ou os codigos SEFAZ 6 digitos)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 4: C00010 — Distribuicao por C00_CODEVE
PROMPT ============================================================
COLUMN C00_CODEVE FORMAT A10
COLUMN QTD        FORMAT 999,999,999
SELECT C00_CODEVE,
       COUNT(*) QTD
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
 GROUP BY C00_CODEVE
 ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------
-- BLOCO 5: C00010 — distribuicao por STATUS / SITDOC / CODRET
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 5: C00010 — Distribuicao por STATUS/SITDOC/CODRET
PROMPT ============================================================
COLUMN C00_STATUS FORMAT A8
COLUMN C00_SITDOC FORMAT A8
COLUMN C00_CODRET FORMAT A8
COLUMN DESRES     FORMAT A50
SELECT C00_STATUS, C00_SITDOC, C00_CODRET,
       SUBSTR(MAX(C00_DESRES),1,50) DESRES,
       COUNT(*) QTD
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
 GROUP BY C00_STATUS, C00_SITDOC, C00_CODRET
 ORDER BY COUNT(*) DESC
 FETCH FIRST 30 ROWS ONLY;

-- ---------------------------------------------------------------------
-- BLOCO 6: C00010 — volume mensal dos ultimos 12 meses
--   Verifica se o Protheus esta populando continuamente
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 6: C00010 — Volume por mes (ultimos 12 meses)
PROMPT ============================================================
COLUMN ANO_MES FORMAT A8
SELECT SUBSTR(C00_DTEMI,1,6) ANO_MES,
       COUNT(*) QTD_NFE,
       COUNT(DISTINCT C00_CNPJEM) QTD_EMITENTES,
       SUM(C00_VLDOC) VALOR_TOTAL
  FROM TOTVS_PRD.C00010
 WHERE D_E_L_E_T_ = ' '
   AND C00_DTEMI >= TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYYMMDD')
 GROUP BY SUBSTR(C00_DTEMI,1,6)
 ORDER BY 1 DESC;

-- ---------------------------------------------------------------------
-- BLOCO 7: C00010 — top 15 emitentes (CNPJs que mais emitem para CAPUL)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 7: C00010 — Top 15 emitentes
PROMPT ============================================================
COLUMN CNPJ FORMAT A16
COLUMN EMITENTE FORMAT A50
SELECT *
  FROM (
    SELECT C00_CNPJEM CNPJ,
           SUBSTR(MAX(C00_NOEMIT),1,50) EMITENTE,
           COUNT(*) QTD,
           SUM(C00_VLDOC) VALOR_TOTAL
      FROM TOTVS_PRD.C00010
     WHERE D_E_L_E_T_ = ' '
       AND C00_DTEMI >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMMDD')
     GROUP BY C00_CNPJEM
     ORDER BY COUNT(*) DESC
  )
 WHERE ROWNUM <= 15;

-- ---------------------------------------------------------------------
-- BLOCO 8: Buscar TODAS as tabelas TOTVS_PRD com nome contendo
--   EVENTO / CCE / CARTA / CANCEL / MANIF / SPED — que existam fisicamente
--   (pode revelar tabelas que so existem em producao)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 8: Tabelas TOTVS_PRD com nomes relacionados a eventos
PROMPT ============================================================
COLUMN TABLE_NAME FORMAT A20
COLUMN X2_NOME    FORMAT A55
SELECT t.table_name,
       NVL(n.X2_NOME, '(sem dicionario)') X2_NOME
  FROM all_tables t
  LEFT JOIN TOTVS_PRD.SX2010 n
         ON n.X2_CHAVE = SUBSTR(t.table_name,1,3)
        AND LENGTH(t.table_name) = 6
 WHERE t.owner = 'TOTVS_PRD'
   AND (
        UPPER(NVL(n.X2_NOME,'')) LIKE '%EVENTO%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CC-E%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CCE%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CARTA%CORR%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CANCEL%NF%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%MANIFEST%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%NT 2015%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%NFE%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CT-E%'
     OR UPPER(NVL(n.X2_NOME,'')) LIKE '%CTE%'
   )
 ORDER BY t.table_name;

-- ---------------------------------------------------------------------
-- BLOCO 9: Inspecao CTE010 (CTe cabecalho) — existe e tem dados?
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 9: CTE010 — estrutura e contagem
PROMPT ============================================================
COLUMN column_name  FORMAT A20
COLUMN data_type    FORMAT A12
COLUMN data_length  FORMAT 99999
SELECT column_name, data_type, data_length
  FROM all_tab_columns
 WHERE owner = 'TOTVS_PRD'
   AND table_name = 'CTE010'
 ORDER BY column_id;

PROMPT
PROMPT -- Contagem CTE010:
SELECT 'CTE010' TABELA, COUNT(*) QTD FROM TOTVS_PRD.CTE010;

-- ---------------------------------------------------------------------
-- BLOCO 10: SF2010 — verificar se o Protheus preenche F2_IDCCE
--   Se preenche, significa que cartas de correcao existem (ID de TSS)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 10: SF2010 — Quantas NFs tem ID de CC-e preenchido
PROMPT ============================================================
SELECT 'SF2 com F2_IDCCE'  TIPO, COUNT(*) QTD
  FROM TOTVS_PRD.SF2010
 WHERE D_E_L_E_T_ = ' '
   AND F2_IDCCE IS NOT NULL
   AND F2_IDCCE <> ' '
UNION ALL
SELECT 'SF2 total ativas'  , COUNT(*)
  FROM TOTVS_PRD.SF2010
 WHERE D_E_L_E_T_ = ' ';

-- Se houver NFs com F2_IDCCE, amostra:
PROMPT
PROMPT -- Amostra de NFs com CC-e (F2_IDCCE preenchido):
COLUMN F2_FILIAL FORMAT A6
COLUMN F2_DOC    FORMAT A10
COLUMN F2_SERIE  FORMAT A5
COLUMN F2_EMISSAO FORMAT A10
COLUMN F2_CHVNFE FORMAT A44
COLUMN F2_IDCCE FORMAT A40
COLUMN F2_CODRSEF FORMAT A8
SELECT *
  FROM (
    SELECT F2_FILIAL, F2_DOC, F2_SERIE, F2_EMISSAO, F2_CHVNFE,
           F2_IDCCE, F2_CODRSEF
      FROM TOTVS_PRD.SF2010
     WHERE D_E_L_E_T_ = ' '
       AND F2_IDCCE IS NOT NULL
       AND F2_IDCCE <> ' '
     ORDER BY F2_EMISSAO DESC
  )
 WHERE ROWNUM <= 10;

-- ---------------------------------------------------------------------
-- BLOCO 11: SF2010 — existe coluna F2_CHVNFE preenchida em toda NFe?
--   Parametro para o modulo Fiscal: podemos usar SF2 como "fonte da verdade"
--   de NFes emitidas
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 11: SF2010 — quantas NFes sem chave (antigas ou invalidas)
PROMPT ============================================================
SELECT 'SF2 com F2_CHVNFE'     TIPO, COUNT(*) QTD
  FROM TOTVS_PRD.SF2010
 WHERE D_E_L_E_T_ = ' '
   AND F2_CHVNFE IS NOT NULL
   AND F2_CHVNFE <> ' '
UNION ALL
SELECT 'SF2 sem F2_CHVNFE'     , COUNT(*)
  FROM TOTVS_PRD.SF2010
 WHERE D_E_L_E_T_ = ' '
   AND (F2_CHVNFE IS NULL OR F2_CHVNFE = ' ');

-- ---------------------------------------------------------------------
-- BLOCO 12: Buscar colunas com tipo LONG/CLOB/BLOB (onde XML eh salvo)
--   Se o Protheus salvar XML em tabela, estara em coluna grande (M/LONG)
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 12: Tabelas TOTVS_PRD com colunas LONG/CLOB/BLOB
PROMPT            (possiveis armazenadoras de XML SEFAZ)
PROMPT ============================================================
COLUMN table_name FORMAT A15
COLUMN column_name FORMAT A20
COLUMN data_type FORMAT A10
SELECT table_name, column_name, data_type
  FROM all_tab_columns
 WHERE owner = 'TOTVS_PRD'
   AND data_type IN ('CLOB','BLOB','LONG','NCLOB','LONG RAW')
   AND (
        UPPER(column_name) LIKE '%XML%'
     OR UPPER(column_name) LIKE '%NFE%'
     OR UPPER(column_name) LIKE '%EVT%'
     OR UPPER(column_name) LIKE '%MDF%'
     OR UPPER(column_name) LIKE '%CTE%'
   )
 ORDER BY table_name, column_name;

-- ---------------------------------------------------------------------
-- BLOCO 13: Existe schema/usuario TSS (Totvs Services Server)?
--   TSS eh onde tradicionalmente ficam eventos de NFe emitida
-- ---------------------------------------------------------------------
PROMPT
PROMPT ============================================================
PROMPT BLOCO 13: Schemas que podem ser TSS
PROMPT ============================================================
SELECT username
  FROM all_users
 WHERE UPPER(username) LIKE '%TSS%'
    OR UPPER(username) LIKE '%SPED%'
    OR UPPER(username) LIKE '%NFE%'
    OR UPPER(username) LIKE '%FISCAL%'
 ORDER BY username;

PROMPT
PROMPT === FIM DO DIAGNOSTICO ===
