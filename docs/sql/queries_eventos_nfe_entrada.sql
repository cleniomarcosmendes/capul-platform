-- =====================================================================
-- Queries de referência — Eventos SEFAZ de NF-e no Protheus CAPUL
-- Companheiro do documento: INVESTIGACAO_EVENTOS_PROTHEUS_15abr2026.md
--
-- Banco:  CAPULFIS @ 192.168.7.85:1521
-- Schemas: TOTVS_PRD (Protheus) + SPED_NFE (TSS local)
-- Modo:   READ-ONLY — apenas SELECTs
-- Data:   15/04/2026
--
-- Todas estas queries ja foram validadas durante a investigacao.
-- Podem ser usadas como base para a API Protheus em desenvolvimento.
-- =====================================================================

SET PAGESIZE 200
SET LINESIZE 300
SET FEEDBACK OFF
SET LONG 5000

-- =====================================================================
-- Q1: VISAO UNIFICADA DE UMA NF-E POR CHAVE
-- Monta uma linha com dados do cabecalho, contagem de eventos e flags
-- Usado para alimentar o endpoint GET /api/v1/fiscal/nfe/{chave}
-- =====================================================================
PROMPT
PROMPT === Q1: Visao unificada por chave ===

-- Substituir :chave por parametro ou usar uma chave fixa para teste
DEFINE chave = '31260325834847003622550010000846021389402924'

SELECT
    r.ZR_CHVNFE                           AS CHAVE,
    r.ZR_NNF                              AS NUMERO,
    r.ZR_SERIE                            AS SERIE,
    r.ZR_MODELO                           AS MODELO,
    r.ZR_EMISSA                           AS DT_EMISSAO,
    r.ZR_DTREC                            AS DT_IMPORTACAO,
    r.ZR_ECNPJ                            AS EMIT_CNPJ,
    r.ZR_ENOME                            AS EMIT_NOME,
    r.ZR_EUF                              AS EMIT_UF,
    r.ZR_CODFOR                           AS FORNEC_PROTHEUS,
    r.ZR_LOJSIG                           AS LOJA_PROTHEUS,
    DBMS_LOB.GETLENGTH(r.ZR_XML)          AS XML_BYTES,

    -- Flags de eventos da CAPUL (SPED150)
    (SELECT COUNT(*) FROM SPED_NFE.SPED150 s
      WHERE s.D_E_L_E_T_=' ' AND s.NFE_CHV = r.ZR_CHVNFE
        AND s.TPEVENTO IN (210200,210210,210220,210240))  AS QTD_MANIFESTACAO_CAPUL,

    (SELECT COUNT(*) FROM SPED_NFE.SPED150 s
      WHERE s.D_E_L_E_T_=' ' AND s.NFE_CHV = r.ZR_CHVNFE
        AND s.TPEVENTO = 110110)                           AS QTD_CCE_PROPRIA,

    -- Flags de eventos do FORNECEDOR (SPED156)
    (SELECT MAX(CASE WHEN DBMS_LOB.GETLENGTH(s.CCEXMLRET) > 0 THEN 1 ELSE 0 END)
       FROM SPED_NFE.SPED156 s
      WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE)   AS TEM_CCE_FORNECEDOR,

    (SELECT MAX(CASE WHEN DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0 THEN 1 ELSE 0 END)
       FROM SPED_NFE.SPED156 s
      WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE)   AS TEM_CANCEL_FORNECEDOR,

    (SELECT s.DOCSIT FROM SPED_NFE.SPED156 s
      WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE
        AND ROWNUM = 1)                                    AS SITUACAO_SEFAZ,

    -- Entrada fiscal (SF1010)
    (SELECT MAX('SIM') FROM TOTVS_PRD.SF1010 f
      WHERE f.D_E_L_E_T_=' ' AND f.F1_CHVNFE = r.ZR_CHVNFE) AS ENTRADA_DADA
FROM TOTVS_PRD.SZR010 r
WHERE r.D_E_L_E_T_ = ' '
  AND r.ZR_CHVNFE  = '&chave';

-- =====================================================================
-- Q2: ITENS DA NF-E (SZQ010) COM DE-PARA PROTHEUS
-- =====================================================================
PROMPT
PROMPT === Q2: Itens da NF-e ===

SELECT
    q.ZQ_ITEM      AS ITEM,
    q.ZQ_PROD      AS PRODUTO_NFE,
    q.ZQ_DESCRI    AS DESCRICAO,
    q.ZQ_EAN       AS EAN,
    q.ZQ_UM        AS UM,
    q.ZQ_QTDE      AS QUANTIDADE,
    q.ZQ_VLUNIT    AS VL_UNITARIO,
    q.ZQ_TOTAL     AS VL_TOTAL,
    q.ZQ_CFOP      AS CFOP,
    q.ZQ_CODSIG    AS COD_PROTHEUS,
    q.ZQ_QTSIGA    AS QTD_PROTHEUS,
    q.ZQ_VLSIGA    AS VL_PROTHEUS,
    q.ZQ_PEDCOM    AS PEDIDO_COMPRA,
    q.ZQ_ITEMPC    AS ITEM_PC
FROM TOTVS_PRD.SZQ010 q
WHERE q.D_E_L_E_T_=' '
  AND q.ZQ_CHVNFE = '&chave'
ORDER BY q.ZQ_ITEM;

-- =====================================================================
-- Q3: EVENTOS DA NF-E (uniao SPED150 + SPED156)
-- Retorna a linha do tempo completa de uma chave
-- =====================================================================
PROMPT
PROMPT === Q3: Timeline de eventos ===

-- Eventos enviados pela CAPUL (SPED150)
SELECT
    'SPED150' AS ORIGEM,
    s.TPEVENTO,
    CASE s.TPEVENTO
        WHEN 110110 THEN 'CC-e'
        WHEN 110111 THEN 'Cancelamento'
        WHEN 110112 THEN 'Cancelamento por substituicao'
        WHEN 210200 THEN 'Manif: Ciencia da Operacao'
        WHEN 210210 THEN 'Manif: Confirmacao da Operacao'
        WHEN 210220 THEN 'Manif: Desconhecimento'
        WHEN 210240 THEN 'Manif: Operacao Nao Realizada'
        ELSE 'Outro (' || s.TPEVENTO || ')'
    END AS DESCRICAO,
    s.SEQEVENTO,
    s.DATE_EVEN AS DATA,
    s.TIME_EVEN AS HORA,
    s.CSTATEVEN AS STATUS,
    s.CMOTEVEN  AS MOTIVO,
    s.EVENPROT  AS PROTOCOLO,
    'CAPUL'     AS ENVIADO_POR,
    DBMS_LOB.GETLENGTH(s.XML_RET) AS XML_RET_BYTES
FROM SPED_NFE.SPED150 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.NFE_CHV    = '&chave'

UNION ALL

-- Eventos de terceiros (SPED156) — emitidos por fornecedores
-- CC-e do fornecedor
SELECT
    'SPED156/CCE' AS ORIGEM,
    110110        AS TPEVENTO,
    'CC-e (do fornecedor)' AS DESCRICAO,
    NULL          AS SEQEVENTO,
    s.CCEDTEMIS   AS DATA,
    s.CCEHREMIS   AS HORA,
    NULL          AS STATUS,
    NULL          AS MOTIVO,
    s.CCENSU      AS PROTOCOLO,
    'FORNECEDOR'  AS ENVIADO_POR,
    DBMS_LOB.GETLENGTH(s.CCEXMLRET) AS XML_RET_BYTES
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.DOCCHV     = '&chave'
  AND DBMS_LOB.GETLENGTH(s.CCEXMLRET) > 0

UNION ALL

-- Cancelamento do fornecedor
SELECT
    'SPED156/CANC' AS ORIGEM,
    110111        AS TPEVENTO,
    'Cancelamento (do fornecedor)' AS DESCRICAO,
    NULL          AS SEQEVENTO,
    s.CANCDTEMIS  AS DATA,
    s.CANCHRAUT   AS HORA,
    NULL          AS STATUS,
    NULL          AS MOTIVO,
    s.CANCNSU     AS PROTOCOLO,
    'FORNECEDOR'  AS ENVIADO_POR,
    DBMS_LOB.GETLENGTH(s.CANCXMLRET) AS XML_RET_BYTES
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND s.DOCCHV     = '&chave'
  AND DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0

ORDER BY 5, 6;

-- =====================================================================
-- Q4: LISTAGEM PAGINADA DE NFES DE ENTRADA
-- Base para o endpoint GET /api/v1/fiscal/nfe/entrada
-- =====================================================================
PROMPT
PROMPT === Q4: Lista paginada de NFes de entrada (com filtros) ===

-- Parametros de exemplo (ajustar conforme necessario)
DEFINE dt_inicio = '20260301'
DEFINE dt_fim    = '20260415'
DEFINE page      = 1
DEFINE size      = 20

SELECT *
  FROM (
    SELECT a.*, ROWNUM RN
      FROM (
        SELECT
            r.ZR_CHVNFE     CHAVE,
            r.ZR_NNF        NUMERO,
            r.ZR_SERIE      SERIE,
            r.ZR_EMISSA     DT_EMISSAO,
            r.ZR_ECNPJ      EMIT_CNPJ,
            SUBSTR(r.ZR_ENOME,1,40) EMIT_NOME,
            r.ZR_CODFOR     FORNEC,

            -- Situacao SEFAZ (via SPED156)
            NVL((SELECT CASE WHEN MAX(s.DOCSIT)='3' THEN 'CANCELADA'
                             WHEN MAX(DBMS_LOB.GETLENGTH(s.CCEXMLRET))>0 THEN 'COM_CCE'
                             ELSE 'AUTORIZADA' END
                   FROM SPED_NFE.SPED156 s
                  WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE),
                'AUTORIZADA') SITUACAO,

            -- Flags eventos
            NVL((SELECT MAX(CASE WHEN DBMS_LOB.GETLENGTH(s.CCEXMLRET)>0 THEN 'S' ELSE 'N' END)
                   FROM SPED_NFE.SPED156 s
                  WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE),
                'N') TEM_CCE,

            NVL((SELECT MAX(CASE WHEN DBMS_LOB.GETLENGTH(s.CANCXMLRET)>0 THEN 'S' ELSE 'N' END)
                   FROM SPED_NFE.SPED156 s
                  WHERE s.D_E_L_E_T_=' ' AND s.DOCCHV = r.ZR_CHVNFE),
                'N') TEM_CANCEL,

            -- Manifestacao enviada pela CAPUL
            NVL((SELECT MAX(s.TPEVENTO)
                   FROM SPED_NFE.SPED150 s
                  WHERE s.D_E_L_E_T_=' ' AND s.NFE_CHV = r.ZR_CHVNFE
                    AND s.TPEVENTO IN (210200,210210,210220,210240)),
                0) MANIFESTACAO,

            -- Entrada fiscal
            NVL((SELECT MAX('S') FROM TOTVS_PRD.SF1010 f
                  WHERE f.D_E_L_E_T_=' ' AND f.F1_CHVNFE = r.ZR_CHVNFE),
                'N') ENTRADA_DADA
        FROM TOTVS_PRD.SZR010 r
        WHERE r.D_E_L_E_T_ = ' '
          AND r.ZR_TPXML    = 'NFe'
          AND r.ZR_MODELO   = '55'
          AND r.ZR_EMISSA  BETWEEN '&dt_inicio' AND '&dt_fim'
        ORDER BY r.ZR_EMISSA DESC, r.ZR_CHVNFE DESC
    ) a
    WHERE ROWNUM <= (&page * &size)
  )
WHERE RN > ((&page - 1) * &size);

-- =====================================================================
-- Q5: BACKLOG — NFes conhecidas via distDFe mas SEM XML completo
-- Sao candidatas imediatas ao fallback de download via A1
-- =====================================================================
PROMPT
PROMPT === Q5: Backlog SPED156 \ SZR010 ===

SELECT
    s.DOCCHV                    AS CHAVE,
    s.EMITCNPJ,
    SUBSTR(s.EMITNOME,1,40)     AS EMIT_NOME,
    s.DOCDTEMIS                 AS DT_EMISSAO,
    s.DOCDTAUT                  AS DT_AUTORIZACAO,
    s.DOCVTOT                   AS VALOR_TOTAL,
    s.DOCSIT                    AS SITUACAO,
    s.DOCNSU                    AS NSU,
    CASE WHEN DBMS_LOB.GETLENGTH(s.CANCXMLRET) > 0 THEN 'S' ELSE 'N' END TEM_CANCEL,
    CASE WHEN DBMS_LOB.GETLENGTH(s.CCEXMLRET) > 0 THEN 'S' ELSE 'N' END TEM_CCE
FROM SPED_NFE.SPED156 s
WHERE s.D_E_L_E_T_ = ' '
  AND NOT EXISTS (
        SELECT 1 FROM TOTVS_PRD.SZR010 r
         WHERE r.D_E_L_E_T_ = ' '
           AND r.ZR_CHVNFE  = s.DOCCHV
      )
ORDER BY s.DOCDTEMIS DESC;

-- =====================================================================
-- Q6: EXTRAIR XML COMPLETO DE UMA CHAVE
-- (usado em GET /api/v1/fiscal/nfe/{chave}/xml)
-- =====================================================================
PROMPT
PROMPT === Q6: XML de uma chave ===

-- Tamanho e primeiros bytes (para verificacao)
SELECT
    DBMS_LOB.GETLENGTH(r.ZR_XML) XML_BYTES,
    UTL_RAW.CAST_TO_VARCHAR2(DBMS_LOB.SUBSTR(r.ZR_XML, 200, 1)) INICIO_XML
FROM TOTVS_PRD.SZR010 r
WHERE r.D_E_L_E_T_ = ' '
  AND r.ZR_CHVNFE  = '&chave';

-- Para extrair o XML completo em aplicacao (Node.js/NestJS via oracledb):
-- const result = await connection.execute(
--   "SELECT ZR_XML FROM TOTVS_PRD.SZR010 WHERE D_E_L_E_T_=' ' AND ZR_CHVNFE=:chave",
--   [chave],
--   { fetchInfo: { ZR_XML: { type: oracledb.BUFFER } } }
-- );

-- =====================================================================
-- Q7: ESTATISTICAS GERAIS
-- Util para o dashboard do modulo Fiscal
-- =====================================================================
PROMPT
PROMPT === Q7: Estatisticas gerais ===

SELECT 'SZR010 - XMLs importados (NFe 55)' METRICA,
       COUNT(*) VALOR
  FROM TOTVS_PRD.SZR010
 WHERE D_E_L_E_T_=' ' AND ZR_TPXML='NFe' AND ZR_MODELO='55'
UNION ALL
SELECT 'SZR010 - XMLs CT-e',
       COUNT(*)
  FROM TOTVS_PRD.SZR010
 WHERE D_E_L_E_T_=' ' AND ZR_TPXML='CTe'
UNION ALL
SELECT 'SPED150 - Eventos enviados pela CAPUL',
       COUNT(*)
  FROM SPED_NFE.SPED150
 WHERE D_E_L_E_T_=' '
UNION ALL
SELECT 'SPED156 - Retornos distDFe',
       COUNT(*)
  FROM SPED_NFE.SPED156
 WHERE D_E_L_E_T_=' '
UNION ALL
SELECT 'SPED156 com cancelamento de terceiro',
       COUNT(*)
  FROM SPED_NFE.SPED156
 WHERE D_E_L_E_T_=' '
   AND DBMS_LOB.GETLENGTH(CANCXMLRET) > 0
UNION ALL
SELECT 'SPED156 com CC-e de terceiro',
       COUNT(*)
  FROM SPED_NFE.SPED156
 WHERE D_E_L_E_T_=' '
   AND DBMS_LOB.GETLENGTH(CCEXMLRET) > 0
UNION ALL
SELECT 'Backlog: SPED156 sem SZR010',
       COUNT(*)
  FROM SPED_NFE.SPED156 s
 WHERE s.D_E_L_E_T_=' '
   AND NOT EXISTS (
         SELECT 1 FROM TOTVS_PRD.SZR010 r
          WHERE r.D_E_L_E_T_=' ' AND r.ZR_CHVNFE = s.DOCCHV
       );

-- =====================================================================
-- FIM
-- =====================================================================
EXIT;
