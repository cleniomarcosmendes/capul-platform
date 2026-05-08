-- Migration 08/05/2026: bump id_evento de varchar(54) pra varchar(60).
-- Motivo: emitente real (NSU 10174-10176, filial 08) usou nSeqEvento com 3 digitos
-- zero-padded ("006" em vez de "06"), gerando idEvento de 55 chars que nao cabia
-- no varchar(54). Variacao nao-padrao mas existente no campo SEFAZ.
-- Aplicado em ambas tabelas pra prevenir mesma falha na NF-e (eventos via /eventosNfe).
ALTER TABLE fiscal.cte_evento ALTER COLUMN id_evento TYPE VARCHAR(60);
ALTER TABLE fiscal.documento_evento ALTER COLUMN id_evento TYPE VARCHAR(60);
