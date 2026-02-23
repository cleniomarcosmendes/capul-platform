-- =============================================
-- Migration 004 — VIEWs de compatibilidade
-- O FastAPI do inventario continua funcionando sem alteracao
-- =============================================

-- Backup das tabelas originais
ALTER TABLE inventario.stores RENAME TO stores_backup;
ALTER TABLE inventario.users RENAME TO users_backup;
ALTER TABLE inventario.user_stores RENAME TO user_stores_backup;

-- VIEW inventario.stores
CREATE OR REPLACE VIEW inventario.stores AS
SELECT
    id,
    codigo AS code,
    nome_fantasia AS name,
    descricao AS description,
    endereco AS address,
    telefone AS phone,
    email,
    (status = 'ATIVO') AS is_active,
    created_at,
    updated_at
FROM core.filiais;

-- VIEW inventario.users
CREATE OR REPLACE VIEW inventario.users AS
SELECT
    u.id,
    u.username,
    u.senha AS password_hash,
    u.nome AS full_name,
    u.email,
    rm.codigo::inventario.user_role AS role,
    u.filial_principal_id AS store_id,
    (u.status = 'ATIVO') AS is_active,
    u.ultimo_login AS last_login,
    u.created_at,
    u.updated_at
FROM core.usuarios u
LEFT JOIN core.permissoes_modulo pm
    ON pm.usuario_id = u.id AND pm.modulo_id = (
        SELECT id FROM core.modulos_sistema WHERE codigo = 'INVENTARIO'
    )
LEFT JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id;

-- VIEW inventario.user_stores
CREATE OR REPLACE VIEW inventario.user_stores AS
SELECT
    uf.id,
    uf.usuario_id AS user_id,
    uf.filial_id AS store_id,
    uf.is_default,
    uf.created_at,
    uf.created_by::uuid AS created_by,
    uf.updated_at
FROM core.usuario_filiais uf;
