-- =============================================
-- Migration 003 — Migrar users, registrar modulos e roles
-- =============================================

-- Registrar modulos do sistema
INSERT INTO core.modulos_sistema (id, codigo, nome, descricao, icone, cor, url_frontend, url_backend, ordem, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'INVENTARIO', 'Inventario de Estoque', 'Sistema de inventario e contagem de estoque', 'package', '#3B82F6', '/inventario/', '/api/v1/inventory', 1, 'ATIVO', NOW(), NOW()),
    (gen_random_uuid(), 'GESTAO_TI', 'Gestao de T.I.', 'Sistema de gestao do departamento de TI', 'monitor', '#8B5CF6', '/gestao-ti/', '/api/v1/gestao-ti', 2, 'ATIVO', NOW(), NOW());

-- Registrar roles do modulo Inventario
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid(), r.codigo, r.nome, r.descricao, m.id
FROM (VALUES
    ('ADMIN', 'Administrador', 'Acesso total ao inventario'),
    ('SUPERVISOR', 'Supervisor', 'Criar e gerenciar inventarios da filial'),
    ('OPERATOR', 'Operador', 'Contar itens do inventario')
) AS r(codigo, nome, descricao)
CROSS JOIN core.modulos_sistema m
WHERE m.codigo = 'INVENTARIO';

-- Registrar roles do modulo Gestao TI
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid(), r.codigo, r.nome, r.descricao, m.id
FROM (VALUES
    ('ADMIN', 'Administrador', 'Acesso total a gestao de TI'),
    ('GESTOR_TI', 'Gestor de TI', 'Gestao completa do departamento'),
    ('TECNICO', 'Tecnico', 'Atender chamados (publicos e privados) e registrar atividades'),
    ('DESENVOLVEDOR', 'Desenvolvedor', 'Chamados internos e projetos dev'),
    ('GERENTE_PROJETO', 'Gerente de Projeto', 'Projetos, custos e aprovacoes'),
    ('USUARIO_FINAL', 'Usuario Final', 'Abrir chamados publicos e consultar status dos proprios chamados'),
    ('FINANCEIRO', 'Financeiro', 'Contratos, rateio e custos')
) AS r(codigo, nome, descricao)
CROSS JOIN core.modulos_sistema m
WHERE m.codigo = 'GESTAO_TI';

-- Migrar users -> usuarios (preservando UUIDs e hashes)
INSERT INTO core.usuarios (
    id, username, email, nome, senha, status,
    filial_principal_id, ultimo_login, primeiro_acesso,
    created_at, updated_at
)
SELECT
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.password_hash,
    CASE WHEN u.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
    u.store_id,
    u.last_login,
    false,
    COALESCE(u.created_at, NOW()),
    COALESCE(u.updated_at, NOW())
FROM inventario.users u;

-- Migrar user_stores -> usuario_filiais
INSERT INTO core.usuario_filiais (
    id, usuario_id, filial_id, is_default, created_at, created_by, updated_at
)
SELECT
    us.id,
    us.user_id,
    us.store_id,
    us.is_default,
    COALESCE(us.created_at, NOW()),
    us.created_by::text,
    us.updated_at
FROM inventario.user_stores us;

-- Criar permissoes de modulo (mapeando roles)
INSERT INTO core.permissoes_modulo (id, usuario_id, modulo_id, role_modulo_id, status, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    m.id,
    rm.id,
    'ATIVO',
    NOW(),
    NOW()
FROM inventario.users u
JOIN core.modulos_sistema m ON m.codigo = 'INVENTARIO'
JOIN core.roles_modulo rm ON rm.modulo_id = m.id AND rm.codigo = u.role::text;
