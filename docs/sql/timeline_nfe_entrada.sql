-- =====================================================================
-- Timeline completa de uma NF-e de entrada
-- Banco: CAPULFIS @ 192.168.7.85 (ou producao real)
-- Modo:  READ-ONLY — apenas SELECTs
-- Uso:   alterar a variavel &chave no topo e rodar tudo
--
-- Estrutura:
--   CONTEXTO DA NF-e (dados, nao eventos)
--     S1  Cabecalho SZR010
--     S2  Itens SZQ010 (+ de-para Protheus)
--
--   EVENTOS OFICIAIS SEFAZ (SPED apenas)
--     S3  Status SEFAZ via distDFe (SPED156)
--     S4  Eventos enviados pela CAPUL (SPED150)
--     S5  Eventos recebidos de terceiros (SPED156 CCE/CANC)
--     S6  TIMELINE UNIFICADA — APENAS SPED150 + SPED156
--
-- DECISAO DE ESCOPO: a timeline mostra somente eventos oficiais
-- registrados nas tabelas SPED (TSS). Tabelas operacionais do
-- Protheus (SF1010, C00010) sao excluidas porque podem refletir
-- customizacoes/falhas operacionais e nao sao fonte oficial SEFAZ.
-- =====================================================================

SET PAGESIZE 300
SET LINESIZE 400
SET FEEDBACK OFF
SET VERIFY OFF
SET LONG 5000
SET LONGCHUNKSIZE 5000

-- ============================================================
-- ALTERAR AQUI A CHAVE A CONSULTAR (44 digitos)
-- ============================================================
DEFINE chave = '31260325834847002570550010007584961489832799'

PROMPT
PROMPT ============================================================
PROMPT TIMELINE NF-e ENTRADA — chave: &chave
PROMPT ============================================================

-- =====================================================================
-- S1 — CABECALHO DA NF-E (SZR010)
-- =====================================================================
PROMPT
PROMPT === S1: Cabecalho SZR010 (XML importado) ===

COLUMN CHAVE      FORMAT A44
COLUMN NUMERO     FORMAT A10
COLUMN SERIE      FORMAT A5
COLUMN MODELO     FORMAT A6
COLUMN DT_EMISSAO FORMAT A10
COLUMN DT_RECEB   FORMAT A10
COLUMN EMIT_CNPJ  FORMAT A16
COLUMN EMIT_NOME  FORMAT A45
COLUMN EMIT_UF    FORMAT A3
COLUMN FORNECEDOR FORMAT A10
COLUMN XML_BYTES  FORMAT 999,999,999
COLUMN TP_XML     FORMAT A6

SELECT
    r.ZR_CHVNFE                   CHAVE,
    r.ZR_NNF                      NUMERO,
    r.ZR_SERIE                    SERIE,
    r.ZR_MODELO                   MODELO,
    r.ZR_TPXML                    TP_XML,
    r.ZR_EMISSA                   DT_EMISSAO,
    r.ZR_DTREC                    DT_RECEB,
    r.ZR_ECNPJ                    EMIT_CNPJ,
    SUBSTR(r.ZR_ENOME,1,45)       EMIT_NOME,
    r.ZR_EUF                      EMIT_UF,
    r.ZR_CODFOR || '/' || r.ZR_LOJSIG FORNECEDOR,
    DBMS_LOB.GETLENGTH(r.ZR_XML)  XML_BYTES
FROM TOTVS_PRD.SZR010 r
WHERE r.D_E_L_E_T_ = ' '
  AND r.ZR_CHVNFE  = '&chave';

-- =====================================================================
-- S2 — ITENS DA NF-E (SZQ010)
-- =====================================================================
PROMPT
PROMPT === S2: Itens SZQ010 ===

COLUMN ITEM          FORMAT A4
COLUMN PROD_NFE      FORMAT A15
COLUMN DESCRICAO     FORMAT A40
COLUMN UM            FORMAT A4
COLUMN QTDE          FORMAT 999,999.99
COLUMN VL_UNIT       FORMAT 999,999.9999
COLUMN VL_TOTAL      FORMAT 999,999,999.99
COLUMN CFOP          FORMAT A6
COLUMN COD_PROTHEUS  FORMAT A15
COLUMN PED_COMPRA    FORMAT A14

SELECT
    q.ZQ_ITEM                     ITEM,
    q.ZQ_PROD                     PROD_NFE,
    SUBSTR(q.ZQ_DESCRI,1,40)      DESCRICAO,
    q.ZQ_UM                       UM,
    q.ZQ_QTDE                     QTDE,
    q.ZQ_VLUNIT                   VL_UNIT,
    q.ZQ_TOTAL                    VL_TOTAL,
    q.ZQ_CFOP                     CFOP,
    q.ZQ_CODSIG                   COD_PROTHEUS,
    NULLIF(TRIM(q.ZQ_PEDCOM),'') || NULLIF('/'||TRIM(q.ZQ_ITEMPC),'/') PED_COMPRA
FROM TOTVS_PRD.SZQ010 q
WHERE q.D_E_L_E_T_ = ' '
  AND q.ZQ_CHVNFE  = '&chave'
ORDER BY q.ZQ_ITEM;

-- =====================================================================
-- S3 — STATUS VIA distDFe (SPED156) — cabecalho e flags de eventos
-- =====================================================================
PROMPT
PROMPT === S3: Status via distDFe (SPED156) ===

COLUMN DOC_CHV     FORMAT A44
COLUMN DOC_SIT     FORMAT A4
COLUMN DOC_DTEMIS  FORMAT A10
COLUMN DOC_DTAUT   FORMAT A10
COLUMN DOC_VTOT    FORMAT 999,999,999.99
COLUMN DOC_NSU     FORMAT A15
COLUMN RESP_STAT   FORMAT A5
COLUMN STAT_DOWN   FORMAT A4
COLUMN F_CCE       FORMAT A5
COLUMN F_CANC      FORMAT A5
COLUMN F_ZIP       FORMAT A5

SELECT
    s.DOCCHV                                 DOC_CHV,
    s.DOCSIT                                 DOC_SIT,
    s.DOCDTEMIS                              DOC_DTEMIS,
    s.DOCDTAUT                               DOC_DTAUT,
    s.DOCVTOT                                DOC_VTOT,
    s.DOCNSU                                 DOC_NSU,
    s.RESPSTAT                               RESP_STAT,
    s.STATDOWN                               STAT_DOWN,
    CASE WHEN DBMS_LOB.GETLENGTH(s.CCEXMLRET)  > 0 THEN 'SIM' ELSE '-' END F_CCE,
    CASE WHEN DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0 THEN 'SIM' ELSE '-' END F_CANC,
    CASE WHEN DBMS_LOB.GETLENGTH(s.ZIPNFE)     > 0 THEN 'SIM' ELSE '-' END F_ZIP
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.DOCCHV     = '&chave';

-- =====================================================================
-- S4 — EVENTOS ENVIADOS PELA CAPUL (SPED150)
-- Inclui manifestacoes do destinatario (210200/210210/210220/210240)
-- e eventos proprios de NF-e emitida (110110/110111/110112)
--
-- Mostra DUAS horas:
--   HORA_ERP    = quando o ERP gerou o evento (TIME_EVEN)
--   HORA_SEFAZ  = quando o SEFAZ efetivou (TIME_TRANS) — bate com portal
-- A diferenca eh o tempo de transmissao do evento.
-- =====================================================================
PROMPT
PROMPT === S4: Eventos enviados pela CAPUL (SPED150) ===

COLUMN TPEVENTO   FORMAT 999999
COLUMN DESCRICAO  FORMAT A30
COLUMN SEQ        FORMAT 99
COLUMN DATA       FORMAT A10
COLUMN HORA_ERP   FORMAT A10
COLUMN HORA_SEFAZ FORMAT A11
COLUMN CSTAT      FORMAT 9999
COLUMN MOTIVO     FORMAT A40
COLUMN XML_RET_B  FORMAT 999,999

SELECT
    s.TPEVENTO,
    CASE s.TPEVENTO
        WHEN 110110 THEN 'CC-e (Carta de Correcao)'
        WHEN 110111 THEN 'Cancelamento'
        WHEN 110112 THEN 'Cancel. por substituicao'
        WHEN 210200 THEN 'Manif: Ciencia'
        WHEN 210210 THEN 'Manif: Confirmacao'
        WHEN 210220 THEN 'Manif: Desconhecimento'
        WHEN 210240 THEN 'Manif: Nao Realizada'
        ELSE 'Outro ('||s.TPEVENTO||')'
    END                             DESCRICAO,
    s.SEQEVENTO                     SEQ,
    NVL(s.DATE_TRANS, s.DATE_EVEN)  DATA,
    s.TIME_EVEN                     HORA_ERP,
    s.TIME_TRANS                    HORA_SEFAZ,
    s.CSTATEVEN                     CSTAT,
    SUBSTR(s.CMOTEVEN,1,40)         MOTIVO,
    DBMS_LOB.GETLENGTH(s.XML_RET)   XML_RET_B
FROM SPED_NFE.SPED150 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.NFE_CHV    = '&chave'
ORDER BY NVL(s.DATE_TRANS,s.DATE_EVEN), NVL(s.TIME_TRANS,s.TIME_EVEN), s.SEQEVENTO;

-- =====================================================================
-- S5 — EVENTOS RECEBIDOS DE TERCEIROS (SPED156 CCE/CANC)
-- CC-e ou cancelamento que o FORNECEDOR fez sobre a NF-e emitida por ele
-- =====================================================================
PROMPT
PROMPT === S5: Eventos recebidos de terceiros (SPED156) ===

COLUMN TIPO      FORMAT A35
COLUMN DT_EMIS   FORMAT A10
COLUMN DT_AUT    FORMAT A10
COLUMN NSU       FORMAT A16
COLUMN XML_BYTES FORMAT 999,999
COLUMN CORRECAO  FORMAT A50

-- CC-e do fornecedor
SELECT
    'CC-e (do fornecedor)'                      TIPO,
    s.CCEDTEMIS                                 DT_EMIS,
    s.CCEDTAUT                                  DT_AUT,
    s.CCENSU                                    NSU,
    DBMS_LOB.GETLENGTH(s.CCEXMLRET)             XML_BYTES,
    SUBSTR(UTL_RAW.CAST_TO_VARCHAR2(DBMS_LOB.SUBSTR(s.CCECORR, 50, 1)),1,50) CORRECAO
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.DOCCHV     = '&chave'
  AND DBMS_LOB.GETLENGTH(s.CCEXMLRET) > 0

UNION ALL

-- Cancelamento do fornecedor
SELECT
    'Cancelamento (do fornecedor)'              TIPO,
    s.CANCDTEMIS                                DT_EMIS,
    s.CANCDTAUT                                 DT_AUT,
    s.CANCNSU                                   NSU,
    DBMS_LOB.GETLENGTH(s.CANCXMLRET)            XML_BYTES,
    NULL                                        CORRECAO
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.DOCCHV     = '&chave'
  AND DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0

ORDER BY 2;

-- =====================================================================
-- S6 — TIMELINE UNIFICADA (APENAS EVENTOS SEFAZ via SPED)
-- Consolida todos os eventos das tabelas SPED150 + SPED156 em ordem
-- cronologica.
--
-- Implementado como WITH (CTE) unico para robustez de parser.
--
-- NAO inclui:
--   - SF1010 (entrada fiscal) — eh estado operacional Protheus, pode ter
--     customizacoes/falhas e nao reflete a verdade SEFAZ
--   - C00010 (manifesto destinatario simples) — eh espelho parcial do
--     distDFe, ja temos a versao completa em SPED156
--   - SZR010 (XML importado) — eh ato operacional Protheus, nao evento
--     SEFAZ
-- =====================================================================
PROMPT
PROMPT === S6: TIMELINE UNIFICADA — APENAS eventos SEFAZ (SPED) ===
PROMPT     QUANDO_SEFAZ = hora oficial SEFAZ (= portal Nacional)
PROMPT     QUANDO_ERP   = hora local Protheus (so SPED150)
PROMPT     LATENCIA_S   = delta entre ERP e SEFAZ (segundos)

COLUMN QUANDO_SEFAZ FORMAT A17
COLUMN QUANDO_ERP   FORMAT A17
COLUMN LATENCIA_S   FORMAT 999999
COLUMN ORIGEM       FORMAT A13
COLUMN TIPO         FORMAT A33
COLUMN ATOR         FORMAT A12
COLUMN DETALHES     FORMAT A55

WITH
ev_autorizacao AS (
    SELECT
        s.DOCDTAUT                       AS DATA_SEFAZ,
        NVL(s.DOCHRAUT,'00:00:00')       AS HORA_SEFAZ,
        NULL                             AS DATA_ERP,
        NULL                             AS HORA_ERP,
        'SPED156'                        AS ORIGEM,
        'NFe autorizada SEFAZ'           AS TIPO,
        'FORNECEDOR'                     AS ATOR,
        SUBSTR(s.EMITNOME,1,30) || ' | R$ ' || TO_CHAR(s.DOCVTOT,'FM999,999,999.99') AS DETALHES
    FROM SPED_NFE.SPED156 s
    WHERE s.D_E_L_E_T_=' '
      AND s.DOCCHV     = '&chave'
      AND s.DOCDTAUT  IS NOT NULL
),
ev_sped150 AS (
    -- Mostra AMBAS as horas: ERP (TIME_EVEN) e SEFAZ (TIME_TRANS).
    -- O delta = tempo de transmissao/processamento.
    SELECT
        s.DATE_TRANS                     AS DATA_SEFAZ,
        SUBSTR(s.TIME_TRANS,1,8)         AS HORA_SEFAZ,
        s.DATE_EVEN                      AS DATA_ERP,
        SUBSTR(s.TIME_EVEN,1,8)          AS HORA_ERP,
        'SPED150'                        AS ORIGEM,
        CASE s.TPEVENTO
            WHEN 110110 THEN 'Evento: CC-e propria'
            WHEN 110111 THEN 'Evento: Cancelamento proprio'
            WHEN 110112 THEN 'Evento: Cancelamento substit.'
            WHEN 210200 THEN 'Manif: Ciencia da Operacao'
            WHEN 210210 THEN 'Manif: Confirmacao da Operacao'
            WHEN 210220 THEN 'Manif: Desconhecimento'
            WHEN 210240 THEN 'Manif: Operacao Nao Realizada'
            ELSE 'Evento ' || s.TPEVENTO
        END                              AS TIPO,
        'CAPUL'                          AS ATOR,
        NVL(SUBSTR(s.CMOTEVEN,1,40),'-') || ' [cStat ' || s.CSTATEVEN || ']' AS DETALHES
    FROM SPED_NFE.SPED150 s
    WHERE s.D_E_L_E_T_=' '
      AND s.NFE_CHV    = '&chave'
),
ev_sped156_cce AS (
    SELECT
        NVL(s.CCEDTAUT, s.CCEDTEMIS)             AS DATA_SEFAZ,
        NVL(s.CCEHRAUT, NVL(s.CCEHREMIS,'00:00:00')) AS HORA_SEFAZ,
        NULL                                     AS DATA_ERP,
        NULL                                     AS HORA_ERP,
        'SPED156/CCE'                            AS ORIGEM,
        'Evento: CC-e do fornecedor'             AS TIPO,
        'FORNECEDOR'                             AS ATOR,
        'NSU ' || s.CCENSU                       AS DETALHES
    FROM SPED_NFE.SPED156 s
    WHERE s.D_E_L_E_T_=' '
      AND s.DOCCHV     = '&chave'
      AND DBMS_LOB.GETLENGTH(s.CCEXMLRET) > 0
),
ev_sped156_cancel AS (
    SELECT
        NVL(s.CANCDTAUT, s.CANCDTEMIS)           AS DATA_SEFAZ,
        NVL(s.CANCHRAUT, '00:00:00')             AS HORA_SEFAZ,
        NULL                                     AS DATA_ERP,
        NULL                                     AS HORA_ERP,
        'SPED156/CANC'                           AS ORIGEM,
        'Evento: Cancelamento do fornecedor'     AS TIPO,
        'FORNECEDOR'                             AS ATOR,
        'NSU ' || s.CANCNSU                      AS DETALHES
    FROM SPED_NFE.SPED156 s
    WHERE s.D_E_L_E_T_=' '
      AND s.DOCCHV     = '&chave'
      AND DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0
),
todos AS (
    SELECT * FROM ev_autorizacao
    UNION ALL SELECT * FROM ev_sped150
    UNION ALL SELECT * FROM ev_sped156_cce
    UNION ALL SELECT * FROM ev_sped156_cancel
)
SELECT
    NVL(DATA_SEFAZ,DATA_ERP) || ' ' || SUBSTR(NVL(HORA_SEFAZ,HORA_ERP),1,8) AS QUANDO_SEFAZ,
    CASE WHEN DATA_ERP IS NOT NULL AND HORA_ERP IS NOT NULL
         THEN DATA_ERP || ' ' || SUBSTR(HORA_ERP,1,8)
         ELSE NULL
    END AS QUANDO_ERP,
    CASE WHEN DATA_SEFAZ IS NOT NULL AND DATA_ERP IS NOT NULL
              AND HORA_SEFAZ IS NOT NULL AND HORA_ERP IS NOT NULL
         THEN ROUND((TO_DATE(DATA_SEFAZ||LPAD(REPLACE(HORA_SEFAZ,':',''),6,'0'),'YYYYMMDDHH24MISS')
                   - TO_DATE(DATA_ERP||LPAD(REPLACE(HORA_ERP,':',''),6,'0'),'YYYYMMDDHH24MISS'))*86400)
         ELSE NULL
    END AS LATENCIA_S,
    ORIGEM,
    TIPO,
    ATOR,
    DETALHES
FROM todos
ORDER BY NVL(DATA_SEFAZ,DATA_ERP) NULLS LAST, NVL(HORA_SEFAZ,HORA_ERP) NULLS LAST;

PROMPT
PROMPT ============================================================
PROMPT FIM
PROMPT
PROMPT Se S1 vier vazio, a chave NAO existe em SZR010 (sem XML).
PROMPT Neste caso, checar S3 (SPED156) para ver se o Protheus
PROMPT ao menos conhece a NF-e via distDFe.
PROMPT
PROMPT NOTA DE ESCOPO:
PROMPT A timeline (S6) lista APENAS eventos oficiais SEFAZ via
PROMPT tabelas SPED. Estado operacional Protheus (SF1010, C00010)
PROMPT eh excluido por nao ser fonte oficial.
PROMPT ============================================================

EXIT;
