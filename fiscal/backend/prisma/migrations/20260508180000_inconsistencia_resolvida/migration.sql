-- Migration 08/05/2026: overlay de resolucao manual de inconsistencias.
--
-- Quando Protheus retorna grvXML com preNotaFalhou=true ou pendenteAmarracao=true,
-- setor fiscal precisa atuar manualmente no Protheus pra concluir a operacao.
-- Como nao temos como saber automaticamente que foi resolvido, criamos overlay
-- onde o proprio operador marca explicitamente "esta pendencia foi resolvida
-- no Protheus".
--
-- Aplicado em ambas tabelas (cte_documento + documento_consulta) por simetria.
-- Status original do Protheus (protheus_status, protheus_grv_*) eh PRESERVADO —
-- overlay so indica desfecho operacional manual. Operador pode desmarcar caso
-- erro de marcacao.

ALTER TABLE fiscal.cte_documento ADD COLUMN inconsistencia_resolvida_em        TIMESTAMP(3);
ALTER TABLE fiscal.cte_documento ADD COLUMN inconsistencia_resolvida_por_id    UUID;
ALTER TABLE fiscal.cte_documento ADD COLUMN inconsistencia_resolvida_por_nome  VARCHAR(120);
ALTER TABLE fiscal.cte_documento ADD COLUMN inconsistencia_observacao          TEXT;

ALTER TABLE fiscal.documento_consulta ADD COLUMN inconsistencia_resolvida_em        TIMESTAMP(3);
ALTER TABLE fiscal.documento_consulta ADD COLUMN inconsistencia_resolvida_por_id    UUID;
ALTER TABLE fiscal.documento_consulta ADD COLUMN inconsistencia_resolvida_por_nome  VARCHAR(120);
ALTER TABLE fiscal.documento_consulta ADD COLUMN inconsistencia_observacao          TEXT;

-- Indices pra filtros do grid (mostrar pendencias nao resolvidas):
-- pendentes ativas = status problematico AND resolvida_em IS NULL.
CREATE INDEX cte_documento_inconsistencia_pendente_idx
  ON fiscal.cte_documento (protheus_status)
  WHERE inconsistencia_resolvida_em IS NULL;

CREATE INDEX documento_consulta_inconsistencia_pendente_idx
  ON fiscal.documento_consulta (protheus_grv_xml_gravado, protheus_grv_prenota_falhou, protheus_grv_pend_amarracao)
  WHERE inconsistencia_resolvida_em IS NULL;
