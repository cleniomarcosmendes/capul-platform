-- =============================================
-- Migration 005 — INSTEAD OF Triggers
-- CRITICO: VIEWs com JOIN sao read-only no PostgreSQL
-- Triggers interceptam INSERT/UPDATE/DELETE e redirecionam para core
-- =============================================

-- =======================================
-- STORES — INSERT trigger
-- =======================================
CREATE OR REPLACE FUNCTION inventario.fn_stores_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO core.filiais (id, codigo, nome_fantasia, descricao, endereco, telefone, email,
        status, empresa_id, created_at, updated_at)
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.code, NEW.name, NEW.description, NEW.address, NEW.phone, NEW.email,
        CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        (SELECT id FROM core.empresas LIMIT 1),
        NOW(), NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_insert
    INSTEAD OF INSERT ON inventario.stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_stores_insert();

-- STORES — UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_stores_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.filiais SET
        codigo = NEW.code,
        nome_fantasia = NEW.name,
        descricao = NEW.description,
        endereco = NEW.address,
        telefone = NEW.phone,
        email = NEW.email,
        status = CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_update
    INSTEAD OF UPDATE ON inventario.stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_stores_update();

-- =======================================
-- USERS — INSERT trigger
-- =======================================
CREATE OR REPLACE FUNCTION inventario.fn_users_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.id, gen_random_uuid());

    INSERT INTO core.usuarios (id, username, senha, nome, email,
        filial_principal_id, status, primeiro_acesso, created_at, updated_at)
    VALUES (
        v_user_id,
        NEW.username, NEW.password_hash, NEW.full_name, NEW.email,
        NEW.store_id,
        CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        true, NOW(), NOW()
    );

    -- Criar permissao do modulo inventario
    INSERT INTO core.permissoes_modulo (id, usuario_id, modulo_id, role_modulo_id, status, created_at, updated_at)
    SELECT gen_random_uuid(), v_user_id, m.id, rm.id, 'ATIVO', NOW(), NOW()
    FROM core.modulos_sistema m
    JOIN core.roles_modulo rm ON rm.modulo_id = m.id AND rm.codigo = NEW.role::text
    WHERE m.codigo = 'INVENTARIO';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_insert
    INSTEAD OF INSERT ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_insert();

-- USERS — UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_users_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.usuarios SET
        username = NEW.username,
        senha = NEW.password_hash,
        nome = NEW.full_name,
        email = NEW.email,
        filial_principal_id = NEW.store_id,
        status = CASE WHEN NEW.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
        ultimo_login = NEW.last_login,
        updated_at = NOW()
    WHERE id = OLD.id;

    -- Atualizar role se mudou
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        UPDATE core.permissoes_modulo SET
            role_modulo_id = (
                SELECT rm.id FROM core.roles_modulo rm
                JOIN core.modulos_sistema m ON m.id = rm.modulo_id
                WHERE m.codigo = 'INVENTARIO' AND rm.codigo = NEW.role::text
            ),
            updated_at = NOW()
        WHERE usuario_id = OLD.id
          AND modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'INVENTARIO');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_update
    INSTEAD OF UPDATE ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_update();

-- USERS — DELETE trigger (soft delete)
CREATE OR REPLACE FUNCTION inventario.fn_users_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.usuarios SET status = 'INATIVO', updated_at = NOW()
    WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_delete
    INSTEAD OF DELETE ON inventario.users
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_users_delete();

-- =======================================
-- USER_STORES — INSERT trigger
-- =======================================
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO core.usuario_filiais (id, usuario_id, filial_id, is_default, created_at, created_by, updated_at)
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.user_id, NEW.store_id, COALESCE(NEW.is_default, false),
        NOW(), NEW.created_by::text, NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_insert
    INSTEAD OF INSERT ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_insert();

-- USER_STORES — UPDATE trigger
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE core.usuario_filiais SET
        is_default = NEW.is_default,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_update
    INSTEAD OF UPDATE ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_update();

-- USER_STORES — DELETE trigger
CREATE OR REPLACE FUNCTION inventario.fn_user_stores_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM core.usuario_filiais WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_stores_delete
    INSTEAD OF DELETE ON inventario.user_stores
    FOR EACH ROW EXECUTE FUNCTION inventario.fn_user_stores_delete();
