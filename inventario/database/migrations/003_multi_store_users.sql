-- =================================
-- Migration 003: Sistema Multi-Filial por Usuário
-- Versão: v2.12.0
-- Data: 20/10/2025
-- =================================

-- Descrição:
-- Cria estrutura para permitir que usuários acessem múltiplas lojas/filiais.
-- Implementa relacionamento N:N entre users e stores através da tabela user_stores.

-- =================================
-- 1. CRIAR TABELA USER_STORES
-- =================================

CREATE TABLE IF NOT EXISTS inventario.user_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES inventario.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES inventario.stores(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,  -- Loja padrão sugerida no login
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES inventario.users(id),
    updated_at TIMESTAMP WITH TIME ZONE,

    -- Constraint: Usuário não pode ter a mesma loja duplicada
    CONSTRAINT user_stores_unique UNIQUE (user_id, store_id)
);

-- =================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- =================================

-- Índice para buscar lojas de um usuário (query mais comum)
CREATE INDEX IF NOT EXISTS idx_user_stores_user ON inventario.user_stores(user_id);

-- Índice para buscar usuários de uma loja
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON inventario.user_stores(store_id);

-- Índice composto para buscar loja padrão de um usuário
CREATE INDEX IF NOT EXISTS idx_user_stores_default ON inventario.user_stores(user_id, is_default) WHERE is_default = TRUE;

-- Índice para queries de auditoria (created_by)
CREATE INDEX IF NOT EXISTS idx_user_stores_created_by ON inventario.user_stores(created_by);

-- =================================
-- 3. TRIGGER: GARANTIR APENAS UMA LOJA PADRÃO POR USUÁRIO
-- =================================

CREATE OR REPLACE FUNCTION inventario.enforce_single_default_store()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a loja sendo inserida/atualizada é marcada como padrão
    IF NEW.is_default = TRUE THEN
        -- Desmarcar todas as outras lojas padrão do mesmo usuário
        UPDATE inventario.user_stores
        SET is_default = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND is_default = TRUE;

        RAISE NOTICE 'Loja % marcada como padrão para usuário %. Outras lojas desmarcadas.', NEW.store_id, NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE INSERT OR UPDATE
CREATE TRIGGER trigger_enforce_single_default_store
BEFORE INSERT OR UPDATE OF is_default ON inventario.user_stores
FOR EACH ROW
EXECUTE FUNCTION inventario.enforce_single_default_store();

-- =================================
-- 4. TRIGGER: AUTO-ATUALIZAR updated_at
-- =================================

CREATE OR REPLACE FUNCTION inventario.update_user_stores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stores_timestamp
BEFORE UPDATE ON inventario.user_stores
FOR EACH ROW
EXECUTE FUNCTION inventario.update_user_stores_timestamp();

-- =================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =================================

COMMENT ON TABLE inventario.user_stores IS
'Relacionamento N:N entre usuários e lojas/filiais. Permite que um usuário acesse múltiplas lojas.';

COMMENT ON COLUMN inventario.user_stores.id IS
'Chave primária UUID';

COMMENT ON COLUMN inventario.user_stores.user_id IS
'Referência ao usuário (FK para users.id)';

COMMENT ON COLUMN inventario.user_stores.store_id IS
'Referência à loja/filial (FK para stores.id)';

COMMENT ON COLUMN inventario.user_stores.is_default IS
'Indica se esta é a loja padrão sugerida no login para este usuário. Apenas uma loja pode ser padrão por usuário (garantido por trigger).';

COMMENT ON COLUMN inventario.user_stores.created_at IS
'Data/hora de criação do registro';

COMMENT ON COLUMN inventario.user_stores.created_by IS
'Usuário (ADMIN) que criou o vínculo';

COMMENT ON COLUMN inventario.user_stores.updated_at IS
'Data/hora da última atualização (auto-atualizada por trigger)';

-- =================================
-- 6. VALIDAÇÃO
-- =================================

-- Verificar que tabela foi criada
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'inventario'
        AND table_name = 'user_stores'
    ) THEN
        RAISE NOTICE '✅ Tabela inventario.user_stores criada com sucesso';
    ELSE
        RAISE EXCEPTION '❌ Erro: Tabela inventario.user_stores não foi criada';
    END IF;
END $$;

-- Verificar índices
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'inventario'
        AND tablename = 'user_stores'
    ) THEN
        RAISE NOTICE '✅ Índices criados com sucesso';
    END IF;
END $$;

-- Verificar triggers
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_enforce_single_default_store'
    ) THEN
        RAISE NOTICE '✅ Trigger enforce_single_default_store criado com sucesso';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_user_stores_timestamp'
    ) THEN
        RAISE NOTICE '✅ Trigger update_user_stores_timestamp criado com sucesso';
    END IF;
END $$;

-- =================================
-- MIGRATION COMPLETA
-- =================================

RAISE NOTICE '========================================';
RAISE NOTICE '✅ Migration 003 aplicada com sucesso!';
RAISE NOTICE 'Sistema Multi-Filial v2.12.0 - Estrutura criada';
RAISE NOTICE '========================================';
