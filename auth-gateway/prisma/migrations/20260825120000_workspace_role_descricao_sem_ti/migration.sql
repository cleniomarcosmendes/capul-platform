-- Descrições dos papéis do WORKSPACE — tira o "TI" e diz a verdade sobre o ADMIN.
--
-- O texto aparece no Configurador em dois lugares (dica abaixo do seletor de papel
-- e guia do "?"), lido de core.roles_modulo.descricao. Sobrou da época em que o
-- módulo era só do departamento de T.I.: quem recebia SUPORTE em Compras lia
-- "Equipe de TI", e o ADMIN dizia "Acesso total a gestao de TI".
--
-- ⚠️ O ADMIN **não** vira administrador do departamento escolhido na linha: ele é
-- GLOBAL por design (D36 — `departamento-filter.helper.ts`: `if (role === 'ADMIN')
-- return where`), e o departamento da permissão é ignorado no filtro. Dizer
-- "administrador do departamento informado" seria pior que o texto velho — passaria
-- a SUBESTIMAR o poder concedido, e quem opera o Configurador escolheria ADMIN
-- achando que restringe. Quem precisa de poder só no departamento recebe GESTOR.
--
-- Data-only (não altera schema). Idempotente: define o valor final, não incrementa.
-- O catálogo de papéis é do CÓDIGO — não há tela nem endpoint que edite estes
-- textos, e o seed passou a propagá-los (antes o upsert tinha `update: {}`, então
-- correção de texto no seed nunca chegava a ambiente já criado).

UPDATE "core"."roles_modulo" r
SET "descricao" = v."descricao"
FROM "core"."modulos_sistema" m,
  (VALUES
    ('ADMIN',         'Acesso total ao Workspace — enxerga TODOS os departamentos, não só o escolhido na linha'),
    ('GESTOR',        'Gestão completa do departamento'),
    ('SUPORTE',       'Equipe do departamento: atende chamados, projetos, contratos, OS, paradas e base de conhecimento'),
    ('USUARIO_FINAL', 'Abrir chamados públicos e consultar o status dos próprios chamados'),
    ('USUARIO_CHAVE', 'Usuário-chave de projetos (acesso limitado a pendências)'),
    ('TERCEIRIZADO',  'Analista externo com acesso restrito a projetos e pendências vinculados')
  ) AS v("codigo", "descricao")
WHERE r."modulo_id" = m."id"
  AND m."codigo" = 'WORKSPACE'
  AND r."codigo" = v."codigo"
  AND r."descricao" IS DISTINCT FROM v."descricao";
