-- =============================================================================
-- MONITORAMENTO: SZR010 (custom) vs SPED156 (padrao TSS)
-- Objetivo: Acompanhar cobertura de XML de entrada em ambas as tabelas
--           para decidir qual fonte priorizar no modulo Fiscal
-- Banco: CAPULFIS (192.168.7.85:1521) | Usuario: totvs_prd
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. VISAO MENSAL — Cruzamento SZR010 x SPED156
--    Mostra por mes: quantas NFes tem em cada tabela, quantas em ambas,
--    quantas so em uma, e o percentual de cobertura do padrao (ZIPPROC)
-- ---------------------------------------------------------------------------
WITH szr AS (
    SELECT SUBSTR(ZR_EMISSA, 1, 6) AS mes, COUNT(*) AS qtd
    FROM TOTVS_PRD.SZR010
    WHERE D_E_L_E_T_ = ' ' AND ZR_MODELO = '55'
    GROUP BY SUBSTR(ZR_EMISSA, 1, 6)
),
sped AS (
    SELECT SUBSTR(DOCDTEMIS, 1, 6) AS mes,
           COUNT(*) AS qtd,
           SUM(CASE WHEN ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(ZIPPROC) > 0
                    THEN 1 ELSE 0 END) AS com_zip
    FROM SPED_NFE.SPED156
    WHERE D_E_L_E_T_ = ' '
    GROUP BY SUBSTR(DOCDTEMIS, 1, 6)
),
ambas AS (
    SELECT SUBSTR(s.ZR_EMISSA, 1, 6) AS mes, COUNT(*) AS qtd
    FROM TOTVS_PRD.SZR010 s
    INNER JOIN SPED_NFE.SPED156 p ON TRIM(s.ZR_CHVNFE) = TRIM(p.DOCCHV)
    WHERE s.D_E_L_E_T_ = ' ' AND s.ZR_MODELO = '55'
      AND p.ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(p.ZIPPROC) > 0
    GROUP BY SUBSTR(s.ZR_EMISSA, 1, 6)
)
SELECT
    COALESCE(szr.mes, sped.mes)                                    AS "Mes",
    NVL(szr.qtd, 0)                                               AS "SZR010",
    NVL(sped.qtd, 0)                                              AS "SPED156 Total",
    NVL(sped.com_zip, 0)                                          AS "SPED156 c/ ZIP",
    NVL(ambas.qtd, 0)                                             AS "Em Ambas",
    NVL(szr.qtd, 0) - NVL(ambas.qtd, 0)                          AS "So SZR",
    NVL(sped.com_zip, 0) - NVL(ambas.qtd, 0)                     AS "So SPED156",
    NVL(sped.qtd, 0) - NVL(sped.com_zip, 0)                      AS "SPED156 s/ ZIP",
    CASE WHEN NVL(szr.qtd, 0) > 0
         THEN ROUND(NVL(ambas.qtd, 0) * 100.0 / szr.qtd, 1)
         ELSE NULL END                                             AS "% SZR Coberto"
FROM szr
FULL OUTER JOIN sped   ON szr.mes = sped.mes
FULL OUTER JOIN ambas  ON COALESCE(szr.mes, sped.mes) = ambas.mes
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 2. NFes QUE SO EXISTEM NO SPED156 (padrao) — ausentes no SZR010
--    Se essa lista cresce, o SZR esta perdendo NFes
-- ---------------------------------------------------------------------------
SELECT
    p.DOCCHV                                        AS "Chave NFe",
    TRIM(p.EMITNOME)                                AS "Emitente",
    TRIM(p.EMITCNPJ)                                AS "CNPJ Emit",
    p.DOCDTEMIS                                     AS "Dt Emissao",
    p.DOCSIT                                        AS "Situacao",
    DBMS_LOB.GETLENGTH(p.ZIPPROC)                   AS "ZIP Bytes",
    DBMS_LOB.GETLENGTH(p.DOCXMLRET)                 AS "Resumo Bytes",
    CASE WHEN EXISTS (
        SELECT 1 FROM TOTVS_PRD.SF1010 f
        WHERE TRIM(f.F1_CHVNFE) = TRIM(p.DOCCHV) AND f.D_E_L_E_T_ = ' '
    ) THEN 'SIM' ELSE 'NAO' END                    AS "Entrada Fiscal?"
FROM SPED_NFE.SPED156 p
WHERE p.D_E_L_E_T_ = ' '
  AND p.ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(p.ZIPPROC) > 0
  AND NOT EXISTS (
      SELECT 1 FROM TOTVS_PRD.SZR010 s
      WHERE TRIM(s.ZR_CHVNFE) = TRIM(p.DOCCHV) AND s.D_E_L_E_T_ = ' '
  )
ORDER BY p.DOCDTEMIS DESC;


-- ---------------------------------------------------------------------------
-- 3. NFes QUE SO EXISTEM NO SZR010 (custom) — ausentes no SPED156
--    Se essa lista cresce, o TSS nao esta recebendo via distDFe
-- ---------------------------------------------------------------------------
SELECT
    TRIM(s.ZR_CHVNFE)                              AS "Chave NFe",
    TRIM(s.ZR_ENOME)                                AS "Emitente",
    TRIM(s.ZR_ECNPJ)                                AS "CNPJ Emit",
    s.ZR_EMISSA                                     AS "Dt Emissao",
    s.ZR_NNF                                        AS "Num NF",
    s.ZR_SERIE                                      AS "Serie",
    DBMS_LOB.GETLENGTH(s.ZR_XML)                    AS "XML Bytes",
    CASE WHEN EXISTS (
        SELECT 1 FROM TOTVS_PRD.SF1010 f
        WHERE TRIM(f.F1_CHVNFE) = TRIM(s.ZR_CHVNFE) AND f.D_E_L_E_T_ = ' '
    ) THEN 'SIM' ELSE 'NAO' END                    AS "Entrada Fiscal?"
FROM TOTVS_PRD.SZR010 s
WHERE s.D_E_L_E_T_ = ' ' AND s.ZR_MODELO = '55'
  AND NOT EXISTS (
      SELECT 1 FROM SPED_NFE.SPED156 p
      WHERE TRIM(p.DOCCHV) = TRIM(s.ZR_CHVNFE)
  )
ORDER BY s.ZR_EMISSA DESC;


-- ---------------------------------------------------------------------------
-- 4. RESUMO EXECUTIVO — Totais atuais para acompanhamento rapido
-- ---------------------------------------------------------------------------
SELECT 'SZR010 — NFes (custom)'           AS "Indicador", COUNT(*) AS "Qtd" FROM TOTVS_PRD.SZR010 WHERE D_E_L_E_T_ = ' ' AND ZR_MODELO = '55'
UNION ALL
SELECT 'SPED156 — Total',                  COUNT(*)        FROM SPED_NFE.SPED156 WHERE D_E_L_E_T_ = ' '
UNION ALL
SELECT 'SPED156 — Com ZIPPROC',            SUM(CASE WHEN ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(ZIPPROC) > 0 THEN 1 ELSE 0 END) FROM SPED_NFE.SPED156 WHERE D_E_L_E_T_ = ' '
UNION ALL
SELECT 'SPED156 — Com DOCXMLRET (resumo)', SUM(CASE WHEN DOCXMLRET IS NOT NULL AND DBMS_LOB.GETLENGTH(DOCXMLRET) > 0 THEN 1 ELSE 0 END) FROM SPED_NFE.SPED156 WHERE D_E_L_E_T_ = ' '
UNION ALL
SELECT 'Em AMBAS (SZR + SPED156 c/ ZIP)',  COUNT(*) FROM TOTVS_PRD.SZR010 s INNER JOIN SPED_NFE.SPED156 p ON TRIM(s.ZR_CHVNFE) = TRIM(p.DOCCHV) WHERE s.D_E_L_E_T_ = ' ' AND s.ZR_MODELO = '55' AND p.ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(p.ZIPPROC) > 0
UNION ALL
SELECT 'So SZR010 (fora do padrao)',        COUNT(*) FROM TOTVS_PRD.SZR010 s WHERE s.D_E_L_E_T_ = ' ' AND s.ZR_MODELO = '55' AND NOT EXISTS (SELECT 1 FROM SPED_NFE.SPED156 p WHERE TRIM(p.DOCCHV) = TRIM(s.ZR_CHVNFE) AND p.ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(p.ZIPPROC) > 0)
UNION ALL
SELECT 'So SPED156 c/ ZIP (fora do SZR)',   COUNT(*) FROM SPED_NFE.SPED156 p WHERE p.D_E_L_E_T_ = ' ' AND p.ZIPPROC IS NOT NULL AND DBMS_LOB.GETLENGTH(p.ZIPPROC) > 0 AND NOT EXISTS (SELECT 1 FROM TOTVS_PRD.SZR010 s WHERE TRIM(s.ZR_CHVNFE) = TRIM(p.DOCCHV) AND s.D_E_L_E_T_ = ' ');
