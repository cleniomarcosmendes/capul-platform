-- Remove a tabela gestao_ti.terceirizados_projeto.
--
-- Contexto (13/05/2026): bug "Acesso restrito ao projeto" para usuario
-- TERCEIRIZADO em HOM. Diagnostico revelou mismatch entre escrita e leitura:
--
--   - A aba "Usuarios-Chave" do front (ProjetoDetalhePage.tsx:3016) sempre
--     gravava o vinculo em UsuarioChaveProjeto, mesmo para usuarios com role
--     TERCEIRIZADO.
--   - O guard checkProjetoAccessChave buscava em TerceirizadoProjeto quando
--     a role era TERCEIRIZADO — dai o 403.
--
-- A tabela `terceirizados_projeto` estava efetivamente abandonada: tinha 0
-- registros ativos em todos ambientes consultados. Eliminada em favor de
-- uma fonte unica (`usuario_chave_projeto`). A role especifica (UC ou
-- TERCEIRIZADO) passa a vir apenas de core.permissoes_modulo do usuario.
--
-- Foreign keys e indices sao removidos automaticamente pelo DROP TABLE
-- CASCADE. Idempotente via `IF EXISTS` (PostgreSQL).

DROP TABLE IF EXISTS "gestao_ti"."terceirizados_projeto" CASCADE;
