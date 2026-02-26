-- ============================================================
-- Migration 006: Sincronizar inventario.stores e inventario.users
-- com dados do schema core (mesmos UUIDs).
--
-- Garante que FKs em inventory_lists.store_id, countings.counted_by,
-- counting_assignments.assigned_to apontem para registros validos.
-- ============================================================

-- 1. Sincronizar inventario.stores com core.filiais (mesmos UUIDs)
INSERT INTO inventario.stores (id, code, name, is_active, created_at, updated_at)
SELECT
    f.id::uuid,
    f.codigo,
    f.nome_fantasia,
    (f.status = 'ATIVO'),
    NOW(),
    NOW()
FROM core.filiais f
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 2. Sincronizar inventario.users com usuarios que tem acesso ao INVENTARIO
-- Nota: inventario.users.role e do tipo enum userrole (ADMIN, SUPERVISOR, OPERATOR)
INSERT INTO inventario.users (id, username, password_hash, full_name, email, role, store_id, is_active, created_at, updated_at)
SELECT
    u.id::uuid,
    u.username,
    u.senha,
    u.nome,
    COALESCE(u.email, ''),
    UPPER(rm.codigo)::userrole,
    COALESCE(uf.filial_id::uuid, (SELECT id::uuid FROM core.filiais LIMIT 1)),
    (u.status = 'ATIVO'),
    NOW(),
    NOW()
FROM core.usuarios u
JOIN core.permissoes_modulo pm ON pm.usuario_id = u.id
JOIN core.modulos_sistema ms ON ms.id = pm.modulo_id AND ms.codigo = 'INVENTARIO'
JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id
LEFT JOIN core.usuario_filiais uf ON uf.usuario_id = u.id AND uf.is_default = true
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    store_id = EXCLUDED.store_id,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 3. Garantir que user_stores tambem exista para os usuarios sincronizados
INSERT INTO inventario.user_stores (id, user_id, store_id, is_default, created_at)
SELECT
    gen_random_uuid(),
    uf.usuario_id::uuid,
    uf.filial_id::uuid,
    uf.is_default,
    NOW()
FROM core.usuario_filiais uf
JOIN core.permissoes_modulo pm ON pm.usuario_id = uf.usuario_id
JOIN core.modulos_sistema ms ON ms.id = pm.modulo_id AND ms.codigo = 'INVENTARIO'
WHERE EXISTS (SELECT 1 FROM inventario.stores s WHERE s.id = uf.filial_id::uuid)
ON CONFLICT DO NOTHING;
