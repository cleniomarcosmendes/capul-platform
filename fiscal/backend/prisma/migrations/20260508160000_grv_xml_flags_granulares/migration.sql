-- Migration 08/05/2026: adiciona flags granulares do retorno grvXML.
--
-- Contrato Protheus simplificado (08/05/2026) retorna 4 flags ortogonais +
-- mensagem por item: sucesso, xmlGravado, pendenteAmarracao, preNotaFalhou,
-- mensagem. Antes colapsavamos tudo em protheus_status (1 enum), perdendo
-- combinacoes ortogonais (ex: xmlGravado=t + pendenteAmarracao=t sem
-- preNotaFalhou — nao tinha enum mapeado).
--
-- Novo desenho hibrido:
--   - 4 colunas booleanas + 1 coluna mensagem = fonte de verdade granular
--   - protheus_status (existente) continua como derivado pra filtro/badge rapido
--
-- Aplicado em ambas tabelas (cte_documento + documento_consulta) por simetria
-- e pra suportar futuras analises cruzadas NF-e vs CT-e.

-- ============================================================
-- cte_documento
-- ============================================================

ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_sucesso         BOOLEAN;
ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_xml_gravado     BOOLEAN;
ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_pend_amarracao  BOOLEAN;
ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_prenota_falhou  BOOLEAN;
ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_mensagem        TEXT;

-- Retrofit dos docs existentes baseado em protheus_status atual:
-- - GRAVADO: tudo OK
UPDATE fiscal.cte_documento SET
  protheus_grv_sucesso = TRUE,
  protheus_grv_xml_gravado = TRUE,
  protheus_grv_pend_amarracao = FALSE,
  protheus_grv_prenota_falhou = FALSE
WHERE protheus_status = 'GRAVADO';

-- - GRAVADO_PRENOTA_FALHOU: XML em SZR/SZQ OK, mas pre-nota falhou
UPDATE fiscal.cte_documento SET
  protheus_grv_sucesso = TRUE,
  protheus_grv_xml_gravado = TRUE,
  protheus_grv_pend_amarracao = FALSE,
  protheus_grv_prenota_falhou = TRUE,
  protheus_grv_mensagem = protheus_erro
WHERE protheus_status = 'GRAVADO_PRENOTA_FALHOU';

-- - JA_EXISTIA: XML ja estava em SZR (race condition benigna)
UPDATE fiscal.cte_documento SET
  protheus_grv_sucesso = TRUE,
  protheus_grv_xml_gravado = TRUE,
  protheus_grv_pend_amarracao = FALSE,
  protheus_grv_prenota_falhou = FALSE
WHERE protheus_status = 'JA_EXISTIA';

-- - FALHA_TECNICA / PROTHEUS_DESISTIU: gravacao falhou, preserva mensagem em
--   protheus_grv_mensagem (ja temos protheus_erro tambem — ficam consistentes)
UPDATE fiscal.cte_documento SET
  protheus_grv_sucesso = FALSE,
  protheus_grv_xml_gravado = FALSE,
  protheus_grv_pend_amarracao = FALSE,
  protheus_grv_prenota_falhou = FALSE,
  protheus_grv_mensagem = protheus_erro
WHERE protheus_status IN ('FALHA_TECNICA', 'PROTHEUS_DESISTIU');

-- (NULL em protheus_status = nunca foi tentado; flags ficam NULL tambem,
-- mantendo semantica "estado desconhecido")

-- ============================================================
-- documento_consulta (NF-e)
-- ============================================================

ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_sucesso         BOOLEAN;
ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_xml_gravado     BOOLEAN;
ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_pend_amarracao  BOOLEAN;
ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_prenota_falhou  BOOLEAN;
ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_mensagem        TEXT;

-- documento_consulta nao tem campo protheus_status (status agregado eh
-- montado runtime via ProtheusStatus). Sem retrofit possivel — ficam NULL
-- ate proxima consulta NF-e popular os flags.
