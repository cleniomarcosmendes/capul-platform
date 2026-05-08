-- Migration 08/05/2026: adiciona flag jaExistia (idempotencia grvXML).
--
-- Equipe Protheus alinhou em 08/05/2026 que retorno grvXML quando XML ja
-- esta em SZR010+SZQ010 deveria ser sucesso=true, xmlGravado=true,
-- jaExistia=true (semantica de idempotencia, padrao Stripe/S3/etc) em vez
-- do atual sucesso=false que gera retry-loop falso e PROTHEUS_DESISTIU
-- enganoso.
--
-- Aplicado em ambas tabelas (cte_documento + documento_consulta) por simetria.
-- Retrofit baseado em protheus_status existente: docs com JA_EXISTIA passam
-- a ter protheus_grv_ja_existia=TRUE (preservando a semantica historica).

ALTER TABLE fiscal.cte_documento ADD COLUMN protheus_grv_ja_existia BOOLEAN;
ALTER TABLE fiscal.documento_consulta ADD COLUMN protheus_grv_ja_existia BOOLEAN;

-- Retrofit cte_documento: JA_EXISTIA → flag true; outros → flag false
-- (precisa coexistir com flags ja existentes do retrofit anterior)
UPDATE fiscal.cte_documento SET protheus_grv_ja_existia = TRUE
WHERE protheus_status = 'JA_EXISTIA';

UPDATE fiscal.cte_documento SET protheus_grv_ja_existia = FALSE
WHERE protheus_status IN ('GRAVADO', 'GRAVADO_PRENOTA_FALHOU', 'GRAVADO_AGUARDANDO_AMARRACAO', 'FALHA_TECNICA', 'PROTHEUS_DESISTIU');

-- (NULL em protheus_status mantem NULL em jaExistia — semantica desconhecido)
