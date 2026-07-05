-- Adiciona as roles COORDENADOR e SUPERVISOR ao módulo LOGISTICA (core.roles_modulo).
-- O @Roles do backend da Logística (fluxo Supervisores/RDV) usa essas roles, mas elas
-- NUNCA foram semeadas: o módulo LOGISTICA + as 8 roles originais entraram manualmente
-- (não estão em nenhuma migration/seed do repo). Sem COORDENADOR, ninguém pode receber
-- essa role → a RBAC do coordenador (aba Coordenação/Fechamento, aprovação escopada)
-- não funciona em HOM/PROD.
--
-- Idempotente: ON CONFLICT (modulo_id, codigo) DO NOTHING. Guardado na existência do
-- módulo — se LOGISTICA ainda não existir no ambiente, não insere nada (as roles entram
-- quando o módulo for criado, no 1º deploy da Logística). Data-only (não altera schema;
-- por isso não é coberta pelo check-migrations, que audita tabelas).
INSERT INTO "core"."roles_modulo" ("id", "codigo", "nome", "descricao", "modulo_id")
SELECT gen_random_uuid()::text, r."codigo", r."nome", r."descricao", m."id"
FROM "core"."modulos_sistema" m
CROSS JOIN (VALUES
  ('COORDENADOR', 'Coordenador', 'Aprova planejamentos e despesas dos seus supervisores + fechamento (RDV)'),
  ('SUPERVISOR',  'Supervisor de Área', 'Cria e executa seus planejamentos (fluxo de campo)')
) AS r("codigo", "nome", "descricao")
WHERE m."codigo" = 'LOGISTICA'
ON CONFLICT ("modulo_id", "codigo") DO NOTHING;
