-- 014_widen_mercadologico_codes.sql
-- Alarga os códigos (PK) e descrições do dicionário mercadológico (tabelas-espelho
-- do Protheus: Grupo/Categoria/Subcategoria/Segmento).
--
-- Motivo: o Protheus PRODUÇÃO retorna códigos de 6 dígitos (ex.: '003687') e
-- descrições maiores que 30 chars. As colunas estavam varchar(4)/varchar(30)
-- (dimensionadas pelos dados de HOMOLOGAÇÃO), causando
-- StringDataRightTruncation ("value too long for type character varying(4)")
-- na sincronização (sync_protheus_hierarchy).
--
-- Não-destrutivo: apenas ALARGA (varchar maior). Nenhuma FK referencia estas
-- tabelas (verificado). Idempotente: re-rodar é seguro.

ALTER TABLE inventario.sbm010 ALTER COLUMN bm_grupo TYPE varchar(20);
ALTER TABLE inventario.sbm010 ALTER COLUMN bm_desc  TYPE varchar(100);

ALTER TABLE inventario.szd010 ALTER COLUMN zd_xcod  TYPE varchar(20);
ALTER TABLE inventario.szd010 ALTER COLUMN zd_xdesc TYPE varchar(100);

ALTER TABLE inventario.sze010 ALTER COLUMN ze_xcod  TYPE varchar(20);
ALTER TABLE inventario.sze010 ALTER COLUMN ze_xdesc TYPE varchar(100);

ALTER TABLE inventario.szf010 ALTER COLUMN zf_xcod  TYPE varchar(20);
ALTER TABLE inventario.szf010 ALTER COLUMN zf_xdesc TYPE varchar(100);

-- NOTA (07/08/2026): esta migration se AUTO-REGISTRAVA em schema_migrations.
-- Removido. A escrituracao e responsabilidade do runner (database/migrate.sh),
-- e ter os dois registrando causava colisao de chave unica: o INSERT do runner
-- estourava, o `set -e` matava o script e as migrations SEGUINTES ficavam sem
-- aplicar. Foi assim que a 015 ficou para tras sem ninguem perceber.
-- O runner agora usa ON CONFLICT (defesa em profundidade), mas migration nova
-- NAO deve registrar a si mesma.
