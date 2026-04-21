-- =============================================================================
-- Varredura de chave CT-e em PRODUÇÃO (Protheus CAPUL)
-- =============================================================================
-- Padrão: SQL Developer (rodar cada bloco com Ctrl+Enter / F9, ou tudo com F5)
--
-- Como usar:
--   1. Find & Replace (Ctrl+R) substituir a chave abaixo pela chave a investigar
--      Atual: 31260316505190000139570010013015461001507170
--   2. Conectar em PROD com usuário totvs_prd
--   3. Executar bloco a bloco (F9 = consulta sob o cursor)
--
-- Se TODAS as consultas vierem vazias → Protheus não captura essa chave →
-- confirma necessidade de buscar na SEFAZ direto.
-- =============================================================================


-- ============================================================================
-- BLOCO 1.1 — SZR010 (XMLs importados — cabeçalho NF-e/CT-e)
-- ============================================================================
SELECT ZR_FILIAL,
       ZR_CHVNFE,
       ZR_TPXML,
       ZR_MODELO,
       ZR_NNF,
       ZR_SERIE,
       ZR_DTREC,
       ZR_HRREC,
       ZR_ECNPJ,
       ZR_ENOME,
       ZR_CODFOR,
       ZR_LOJSIG,
       CASE
           WHEN ZR_XML IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(ZR_XML) || ' bytes)'
       END AS XML_STATUS
  FROM TOTVS_PRD.SZR010
 WHERE ZR_CHVNFE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.2 — SZQ010 (itens — testa ZQ_CHVNFE e ZQ_CHVCTE)
-- ============================================================================
SELECT ZQ_FILIAL,
       ZQ_CHVNFE,
       ZQ_CHVCTE,
       ZQ_ITEM,
       ZQ_PROD,
       ZQ_DESCRI,
       ZQ_QTDE,
       ZQ_VLUNIT,
       ZQ_PEDCOM,
       ZQ_ITEMPC,
       ZQ_CTNF,
       ZQ_CTSER,
       ZQ_CTFOR,
       ZQ_CTLOJ
  FROM TOTVS_PRD.SZQ010
 WHERE ZQ_CHVNFE = '31260316505190000139570010013015461001507170'
    OR ZQ_CHVCTE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.3 — GZH010 (Controle CT-e OS — específico de CT-e)
-- ============================================================================
SELECT GZH_FILIAL,
       GZH_CHVCTE,
       GZH_NUMCTE,
       GZH_SERCTE,
       GZH_DTEMIS,
       GZH_EMICNP,
       GZH_EMINOM,
       CASE
           WHEN GZH_XMLCTE IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(GZH_XMLCTE) || ' bytes)'
       END AS XML_CTE,
       CASE
           WHEN GZH_XMLAUT IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(GZH_XMLAUT) || ' bytes)'
       END AS XML_AUT,
       CASE
           WHEN GZH_XMLERR IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(GZH_XMLERR) || ' bytes)'
       END AS XML_ERR
  FROM TOTVS_PRD.GZH010
 WHERE GZH_CHVCTE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.4 — SF1010 (NF de Entrada — caso CT-e tenha gerado entrada fiscal)
-- ============================================================================
SELECT F1_FILIAL,
       F1_DOC,
       F1_SERIE,
       F1_FORNECE,
       F1_LOJA,
       F1_TIPO,
       F1_ESPECIE,
       F1_EMISSAO,
       F1_DTDIGIT,
       F1_CHVNFE,
       F1_STATUS
  FROM TOTVS_PRD.SF1010
 WHERE F1_CHVNFE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.5 — SF2010 (NF de Saída — improvável mas confere)
-- ============================================================================
SELECT F2_FILIAL,
       F2_DOC,
       F2_SERIE,
       F2_CLIENTE,
       F2_LOJA,
       F2_TIPO,
       F2_ESPECIE,
       F2_EMISSAO,
       F2_CHVNFE
  FROM TOTVS_PRD.SF2010
 WHERE F2_CHVNFE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.6 — C00010 (Manifesto destinatário — espelho do distDFe)
-- ============================================================================
SELECT C00_FILIAL,
       C00_CHVNFE,
       C00_CODRET,
       C00_DESRET,
       C00_DTRET,
       C00_HRRET
  FROM TOTVS_PRD.C00010
 WHERE C00_CHVNFE = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 1.7 — CC0010 (Manifesto MDF-e — improvável, só confere)
-- ============================================================================
SELECT CC0_FILIAL,
       CC0_CHVMDF,
       CC0_DTEMIS,
       CASE
           WHEN CC0_XMLMDF IS NULL THEN 'NULL'
           ELSE 'OK'
       END AS XML_MDF
  FROM TOTVS_PRD.CC0010
 WHERE CC0_CHVMDF = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 2.1 — SPED150 (eventos enviados pela CAPUL: cancel, CC-e, manifest)
-- ============================================================================
SELECT NFE_ID,
       NFE_CHV,
       TPEVENTO,
       SEQEVENTO,
       DHREGEVEN,
       CSTATEVEN,
       CMOTEVEN,
       CHCANC,
       CHCCE
  FROM SPED_NFE.SPED150
 WHERE NFE_CHV = '31260316505190000139570010013015461001507170'
    OR CHCANC  = '31260316505190000139570010013015461001507170'
    OR CHCCE   = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 2.2 — SPED154 (histórico de eventos)
-- ============================================================================
SELECT NFE_ID,
       NFE_CHV,
       TPEVENTO,
       SEQEVENTO,
       DHREGEVEN,
       CSTATEVEN,
       CMOTEVEN
  FROM SPED_NFE.SPED154
 WHERE NFE_CHV = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 2.3 — SPED156 (NFeDistribuicaoDFe — XML completo + eventos terceiros)
-- ============================================================================
SELECT DOCID,
       DOCCHV,
       DOCNSU,
       DOCDTEMIS,
       DOCSIT,
       EMITCNPJ,
       EMITNOME,
       CANCNSU,
       CCENSU,
       CASE
           WHEN DOCXMLRET IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(DOCXMLRET) || ')'
       END AS XML_DOC,
       CASE
           WHEN CANCXMLRET IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(CANCXMLRET) || ')'
       END AS XML_CANC,
       CASE
           WHEN CCEXMLRET IS NULL THEN 'NULL'
           ELSE 'OK (' || DBMS_LOB.GETLENGTH(CCEXMLRET) || ')'
       END AS XML_CCE
  FROM SPED_NFE.SPED156
 WHERE DOCCHV = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 2.4 — SPED050 (NFes EMITIDAS — improvável para chave de entrada CT-e)
-- ============================================================================
SELECT NFE_ID,
       NFE_CHV,
       NFE_NUMERO,
       NFE_SERIE,
       NFE_DH_AUT,
       NFE_STATUS
  FROM SPED_NFE.SPED050
 WHERE NFE_CHV = '31260316505190000139570010013015461001507170';


-- ============================================================================
-- BLOCO 3 — META: descobre tabelas com colunas-chave (CHVCTE, CHVNFE etc.)
-- Útil para encontrar tabelas novas que ainda não conhecemos.
-- ============================================================================
SELECT OWNER,
       TABLE_NAME,
       COLUMN_NAME,
       DATA_TYPE
  FROM ALL_TAB_COLUMNS
 WHERE OWNER IN ('TOTVS_PRD', 'SPED_NFE')
   AND ( COLUMN_NAME LIKE '%CHVCTE%'
      OR COLUMN_NAME LIKE '%CHVNFE%'
      OR COLUMN_NAME LIKE '%CHVMDF%'
      OR COLUMN_NAME LIKE '%CHV_CTE%'
      OR COLUMN_NAME LIKE '%CTECHV%'
      OR COLUMN_NAME LIKE '%CHCANC%'
      OR COLUMN_NAME LIKE '%CHCCE%')
 ORDER BY OWNER, TABLE_NAME, COLUMN_NAME;


-- ============================================================================
-- BLOCO 4 — Sanidade: quantos NF-e e CT-e a base tem em SZR010
-- ============================================================================
SELECT ZR_TPXML,
       ZR_MODELO,
       COUNT(*)        AS TOTAL,
       MIN(ZR_DTREC)   AS MENOR_DATA,
       MAX(ZR_DTREC)   AS MAIOR_DATA
  FROM TOTVS_PRD.SZR010
 GROUP BY ZR_TPXML, ZR_MODELO
 ORDER BY ZR_TPXML, ZR_MODELO;


-- ============================================================================
-- BLOCO 5 — Verificação opcional: tabelas CT-e específicas (podem não existir)
-- Rodar apenas se quiser confirmar tabelas que historicamente estavam vazias
-- ============================================================================

-- 5.1 SPED400 (CT-e específico — historicamente vazio na CAPULFIS)
SELECT COUNT(*) AS QTD_TOTAL FROM SPED_NFE.SPED400;

-- 5.2 SPED500 (CT-e/genérico — historicamente vazio na CAPULFIS)
SELECT COUNT(*) AS QTD_TOTAL FROM SPED_NFE.SPED500;
