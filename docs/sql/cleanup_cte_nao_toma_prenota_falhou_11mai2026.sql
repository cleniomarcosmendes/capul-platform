-- =============================================================================
-- Cleanup: CT-es não-TOMA marcados como GRAVADO_PRENOTA_FALHOU
-- =============================================================================
-- Contexto (11/05/2026): setor fiscal confirmou que apenas CT-e onde Capul é
-- tomadora do serviço (papel_capul = 'TOMA') gera pré-nota no Protheus.
-- CT-es onde Capul é DEST/REM/EXPED não devem ir pro Protheus — o XML fica
-- apenas no cache local da plataforma (fiscal.cte_documento).
--
-- O backend foi corrigido em 11/05/2026 para não enviar mais não-TOMA pro
-- grvXML. Este script limpa o backlog histórico: marca como
-- "inconsistência resolvida" os ~837 docs que ficaram em
-- GRAVADO_PRENOTA_FALHOU sem que houvesse falha real (pré-nota simplesmente
-- não se aplica).
--
-- Idempotente: a cláusula `inconsistencia_resolvida_em IS NULL` garante que
-- re-execução não sobrescreve resoluções legítimas posteriores.
-- =============================================================================

\timing on

-- Quantos serão afetados (preview)
SELECT papel_capul, COUNT(*) AS docs_para_resolver
  FROM fiscal.cte_documento
 WHERE papel_capul IN ('DEST', 'REM', 'EXPED')
   AND protheus_status = 'GRAVADO_PRENOTA_FALHOU'
   AND inconsistencia_resolvida_em IS NULL
 GROUP BY papel_capul
 ORDER BY papel_capul;

BEGIN;

UPDATE fiscal.cte_documento
   SET inconsistencia_resolvida_em = NOW(),
       inconsistencia_resolvida_por_nome = 'Sistema (regra papel-TOMA aplicada 11/05/2026)',
       inconsistencia_observacao =
         'CT-e papel ' || papel_capul || ' não gera pré-nota no Protheus — ' ||
         'Capul não é tomadora do serviço de frete. Status GRAVADO_PRENOTA_FALHOU ' ||
         'aparece por compatibilidade com o fluxo antigo (backend enviava todos os ' ||
         'papéis ao grvXML antes do fix 11/05/2026). XML segue gravado em ' ||
         'XMLCAB/XMLIT no Protheus; ausência da pré-nota é comportamento esperado.'
 WHERE papel_capul IN ('DEST', 'REM', 'EXPED')
   AND protheus_status = 'GRAVADO_PRENOTA_FALHOU'
   AND inconsistencia_resolvida_em IS NULL;

-- Verificar resultado antes de commitar
SELECT papel_capul,
       COUNT(*) FILTER (WHERE inconsistencia_resolvida_em IS NULL) AS ainda_pendentes,
       COUNT(*) FILTER (WHERE inconsistencia_resolvida_em IS NOT NULL) AS resolvidos
  FROM fiscal.cte_documento
 WHERE papel_capul IN ('DEST', 'REM', 'EXPED')
   AND protheus_status = 'GRAVADO_PRENOTA_FALHOU'
 GROUP BY papel_capul
 ORDER BY papel_capul;

COMMIT;
