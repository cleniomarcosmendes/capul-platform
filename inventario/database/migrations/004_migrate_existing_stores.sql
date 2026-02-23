-- =================================
-- Migration 004: Migração de Dados Existentes
-- Versão: v2.12.0
-- Data: 20/10/2025
-- =================================

-- Descrição:
-- Migra dados existentes de users.store_id para a nova tabela user_stores.
-- Garante compatibilidade com dados atuais, mantendo a loja atual como padrão.

-- =================================
-- PRÉ-REQUISITOS
-- =================================

-- Verificar que Migration 003 foi aplicada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'inventario'
        AND table_name = 'user_stores'
    ) THEN
        RAISE EXCEPTION '❌ Erro: Execute a Migration 003 primeiro (tabela user_stores não existe)';
    END IF;
END $$;

-- =================================
-- 1. ANÁLISE DE DADOS EXISTENTES
-- =================================

DO $$
DECLARE
    total_users INTEGER;
    users_with_store INTEGER;
    users_without_store INTEGER;
    admin_users INTEGER;
BEGIN
    -- Contar total de usuários
    SELECT COUNT(*) INTO total_users FROM inventario.users WHERE is_active = TRUE;

    -- Contar usuários com store_id
    SELECT COUNT(*) INTO users_with_store FROM inventario.users WHERE store_id IS NOT NULL AND is_active = TRUE;

    -- Contar usuários sem store_id
    SELECT COUNT(*) INTO users_without_store FROM inventario.users WHERE store_id IS NULL AND is_active = TRUE;

    -- Contar usuários ADMIN
    SELECT COUNT(*) INTO admin_users FROM inventario.users WHERE role = 'ADMIN' AND is_active = TRUE;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANÁLISE DE DADOS EXISTENTES';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de usuários ativos: %', total_users;
    RAISE NOTICE 'Usuários COM store_id: %', users_with_store;
    RAISE NOTICE 'Usuários SEM store_id: % (provavelmente ADMINs)', users_without_store;
    RAISE NOTICE 'Usuários ADMIN: %', admin_users;
    RAISE NOTICE '========================================';
END $$;

-- =================================
-- 2. MIGRAR DADOS: users.store_id → user_stores
-- =================================

-- Inserir registros em user_stores para todos os usuários que têm store_id
INSERT INTO inventario.user_stores (user_id, store_id, is_default, created_at)
SELECT
    u.id AS user_id,
    u.store_id,
    TRUE AS is_default,  -- A loja atual será marcada como padrão
    CURRENT_TIMESTAMP AS created_at
FROM inventario.users u
WHERE u.store_id IS NOT NULL  -- Apenas usuários com loja definida
  AND u.is_active = TRUE      -- Apenas usuários ativos
  AND NOT EXISTS (            -- Evitar duplicatas (caso migration seja executada 2x)
      SELECT 1 FROM inventario.user_stores us
      WHERE us.user_id = u.id AND us.store_id = u.store_id
  );

-- =================================
-- 3. VALIDAÇÃO DA MIGRAÇÃO
-- =================================

DO $$
DECLARE
    migrated_count INTEGER;
    users_with_store INTEGER;
    success BOOLEAN;
BEGIN
    -- Contar registros migrados
    SELECT COUNT(*) INTO migrated_count FROM inventario.user_stores;

    -- Contar usuários com store_id
    SELECT COUNT(*) INTO users_with_store FROM inventario.users WHERE store_id IS NOT NULL AND is_active = TRUE;

    -- Verificar se migração foi 100% bem sucedida
    success := (migrated_count = users_with_store);

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDAÇÃO DA MIGRAÇÃO';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Usuários com store_id: %', users_with_store;
    RAISE NOTICE 'Registros em user_stores: %', migrated_count;

    IF success THEN
        RAISE NOTICE '✅ Migração 100%% bem sucedida!';
    ELSE
        RAISE WARNING '⚠️ Migração parcial: % de % usuários migrados', migrated_count, users_with_store;
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- =================================
-- 4. VALIDAR INTEGRIDADE DOS DADOS
-- =================================

-- Verificar lojas padrão
DO $$
DECLARE
    users_without_default INTEGER;
    users_with_multiple_defaults INTEGER;
BEGIN
    -- Usuários com lojas mas sem loja padrão
    SELECT COUNT(DISTINCT us.user_id) INTO users_without_default
    FROM inventario.user_stores us
    WHERE NOT EXISTS (
        SELECT 1 FROM inventario.user_stores us2
        WHERE us2.user_id = us.user_id AND us2.is_default = TRUE
    );

    -- Usuários com múltiplas lojas padrão (NÃO DEVE ACONTECER!)
    SELECT COUNT(*) INTO users_with_multiple_defaults
    FROM (
        SELECT user_id, COUNT(*) as default_count
        FROM inventario.user_stores
        WHERE is_default = TRUE
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) subquery;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDAÇÃO DE INTEGRIDADE';
    RAISE NOTICE '========================================';

    IF users_without_default > 0 THEN
        RAISE WARNING '⚠️ % usuários com lojas mas SEM loja padrão definida', users_without_default;
    ELSE
        RAISE NOTICE '✅ Todos os usuários com lojas têm loja padrão definida';
    END IF;

    IF users_with_multiple_defaults > 0 THEN
        RAISE EXCEPTION '❌ ERRO CRÍTICO: % usuários com múltiplas lojas padrão! Trigger não está funcionando!', users_with_multiple_defaults;
    ELSE
        RAISE NOTICE '✅ Nenhum usuário com múltiplas lojas padrão (trigger funcionando)';
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- =================================
-- 5. EXEMPLO DE CONSULTA: Verificar migração
-- =================================

-- Listar alguns usuários migrados (máximo 10)
DO $$
DECLARE
    rec RECORD;
    count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'EXEMPLOS DE USUÁRIOS MIGRADOS (max 10)';
    RAISE NOTICE '========================================';

    FOR rec IN
        SELECT
            u.username,
            u.full_name,
            u.role,
            s.code AS store_code,
            s.name AS store_name,
            us.is_default
        FROM inventario.users u
        INNER JOIN inventario.user_stores us ON us.user_id = u.id
        INNER JOIN inventario.stores s ON s.id = us.store_id
        WHERE u.is_active = TRUE
        ORDER BY u.username
        LIMIT 10
    LOOP
        count := count + 1;
        RAISE NOTICE '% - % (%) → Loja [%] % (Padrão: %)',
            count,
            rec.username,
            rec.role,
            rec.store_code,
            rec.store_name,
            CASE WHEN rec.is_default THEN 'SIM' ELSE 'NÃO' END;
    END LOOP;

    IF count = 0 THEN
        RAISE NOTICE '(Nenhum usuário migrado para exibir)';
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- =================================
-- 6. OBSERVAÇÕES IMPORTANTES
-- =================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'OBSERVAÇÕES IMPORTANTES';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. O campo users.store_id FOI MANTIDO para compatibilidade';
    RAISE NOTICE '   durante o período de transição (1-2 meses)';
    RAISE NOTICE '';
    RAISE NOTICE '2. Sistema agora usa tabela user_stores como fonte principal';
    RAISE NOTICE '   de lojas do usuário';
    RAISE NOTICE '';
    RAISE NOTICE '3. Usuários ADMIN não devem ter registros em user_stores';
    RAISE NOTICE '   (eles acessam todas as lojas por padrão)';
    RAISE NOTICE '';
    RAISE NOTICE '4. Para adicionar novas lojas a um usuário, use o endpoint:';
    RAISE NOTICE '   PUT /api/v1/users/{user_id}/stores';
    RAISE NOTICE '';
    RAISE NOTICE '5. O trigger enforce_single_default_store garante que';
    RAISE NOTICE '   cada usuário tenha apenas UMA loja padrão';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =================================
-- MIGRATION COMPLETA
-- =================================

RAISE NOTICE '========================================';
RAISE NOTICE '✅ Migration 004 aplicada com sucesso!';
RAISE NOTICE 'Dados existentes migrados para user_stores';
RAISE NOTICE 'Sistema Multi-Filial v2.12.0 - Pronto para uso!';
RAISE NOTICE '========================================';
