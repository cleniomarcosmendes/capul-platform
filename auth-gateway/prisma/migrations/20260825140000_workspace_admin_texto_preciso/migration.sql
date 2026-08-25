-- Correção do texto do ADMIN escrito na migration anterior (20260825120000).
--
-- Lá o texto ficou "enxerga TODOS os departamentos" — verdade PELA METADE, e por
-- isso pior que uma verdade inteira. A auditoria de 25/08 (docs/AUDITORIA_
-- WORKSPACE_ADMIN_GESTOR_25AGO.md) mostrou que o escape do ADMIN (D36) vale só em
-- chamado, projeto, dashboard e indicadores. Nos 6 cadastros operacionais
-- (software, licença, contrato, NF, ativo, parada) o D36 foi REVOGADO (decisão E1,
-- 24/05): lá o bypass vem da capability OVERSIGHT_PLATAFORMA, que hoje só o usuário
-- `admin` tem — um ADMIN de departamento NÃO vê contrato/NF/ativo de outro.
--
-- Migration nova em vez de editar a anterior: a 20260825120000 já foi aplicada (o
-- Prisma guarda o checksum; editar migration aplicada quebra o próximo deploy).

UPDATE "core"."roles_modulo" r
SET "descricao" = 'Acesso total ao Workspace — não fica restrito ao departamento escolhido: vê chamados, projetos e indicadores de TODOS. Cadastros (contrato, NF, ativo, licença, parada) continuam por departamento.'
FROM "core"."modulos_sistema" m
WHERE r."modulo_id" = m."id"
  AND m."codigo" = 'WORKSPACE'
  AND r."codigo" = 'ADMIN'
  AND r."descricao" IS DISTINCT FROM 'Acesso total ao Workspace — não fica restrito ao departamento escolhido: vê chamados, projetos e indicadores de TODOS. Cadastros (contrato, NF, ativo, licença, parada) continuam por departamento.';
