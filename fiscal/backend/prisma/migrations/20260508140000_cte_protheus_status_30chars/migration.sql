-- Migration 08/05/2026: bump cte_documento.protheus_status de varchar(20) pra
-- varchar(30) pra acomodar novo valor `GRAVADO_PRENOTA_FALHOU` (22 chars)
-- introduzido com a migracao do contrato grvXML simplificado.
ALTER TABLE fiscal.cte_documento ALTER COLUMN protheus_status TYPE VARCHAR(30);
