-- Persiste body JSON do POST /grvXML em documento_consulta + cte_documento
-- Pra setor fiscal autoatender debug com equipe Protheus sem depender
-- de SSH/Docker logs. Modal de detalhe na UI expõe o JSON com botão Copiar.
--
-- Adições:
--   documento_consulta.protheus_grv_request — body NF-e/CT-e Onda 1 (legado)
--   cte_documento.protheus_grv_request      — body CT-e novo (distNSU/Fase 4)
--
-- Tipo TEXT (JSON serializado). Tamanho típico 2-10 KB. Sem índice
-- (não filtrado, só consultado por chave/id).

ALTER TABLE "fiscal"."documento_consulta"
  ADD COLUMN "protheus_grv_request" TEXT;

ALTER TABLE "fiscal"."cte_documento"
  ADD COLUMN "protheus_grv_request" TEXT;
