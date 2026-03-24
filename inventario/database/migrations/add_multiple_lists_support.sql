-- ============================================================
-- MIGRAÇÃO: Suporte para Múltiplas Listas de Contagem
-- Data: 2025-09-13
-- Descrição: Adiciona estrutura para suportar múltiplas listas
--            de contagem por inventário
-- ============================================================

-- 1. Criar tabela para listas de contagem (filhas do inventário)
CREATE TABLE IF NOT EXISTS inventario.counting_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL,  -- Referência ao inventário pai
    list_name VARCHAR(100) NOT NULL,  -- Nome da lista (Lista 1, Lista 2, etc)
    description TEXT,

    -- Contadores responsáveis por cada ciclo desta lista específica
    counter_cycle_1 UUID,
    counter_cycle_2 UUID,
    counter_cycle_3 UUID,

    -- Controle de ciclos desta lista específica
    current_cycle INTEGER DEFAULT 1 CHECK (current_cycle >= 1 AND current_cycle <= 3),
    list_status VARCHAR(20) DEFAULT 'PREPARACAO',  -- PREPARACAO, LIBERADA, EM_CONTAGEM, ENCERRADA

    -- Timestamps de controle desta lista
    released_at TIMESTAMP WITH TIME ZONE,
    released_by UUID,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL,

    -- Foreign Keys
    CONSTRAINT fk_counting_lists_inventory
        FOREIGN KEY (inventory_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_counting_lists_counter1
        FOREIGN KEY (counter_cycle_1) REFERENCES inventario.users(id),
    CONSTRAINT fk_counting_lists_counter2
        FOREIGN KEY (counter_cycle_2) REFERENCES inventario.users(id),
    CONSTRAINT fk_counting_lists_counter3
        FOREIGN KEY (counter_cycle_3) REFERENCES inventario.users(id),
    CONSTRAINT fk_counting_lists_released_by
        FOREIGN KEY (released_by) REFERENCES inventario.users(id),
    CONSTRAINT fk_counting_lists_closed_by
        FOREIGN KEY (closed_by) REFERENCES inventario.users(id),
    CONSTRAINT fk_counting_lists_created_by
        FOREIGN KEY (created_by) REFERENCES inventario.users(id)
);

-- 2. Criar tabela para itens de cada lista de contagem
CREATE TABLE IF NOT EXISTS inventario.counting_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    counting_list_id UUID NOT NULL,  -- Referência à lista de contagem
    inventory_item_id UUID NOT NULL,  -- Referência ao item do inventário

    -- Controle de contagem por ciclo para este item nesta lista
    needs_count_cycle_1 BOOLEAN DEFAULT TRUE,
    needs_count_cycle_2 BOOLEAN DEFAULT FALSE,
    needs_count_cycle_3 BOOLEAN DEFAULT FALSE,

    count_cycle_1 NUMERIC(15,4),
    count_cycle_2 NUMERIC(15,4),
    count_cycle_3 NUMERIC(15,4),

    -- Status e controle
    status public.countingstatus DEFAULT 'PENDING',
    last_counted_at TIMESTAMP WITH TIME ZONE,
    last_counted_by UUID,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,

    -- Foreign Keys
    CONSTRAINT fk_counting_list_items_list
        FOREIGN KEY (counting_list_id) REFERENCES inventario.counting_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_counting_list_items_inventory_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_counting_list_items_counted_by
        FOREIGN KEY (last_counted_by) REFERENCES inventario.users(id),

    -- Constraint única para evitar duplicação
    CONSTRAINT unique_list_item
        UNIQUE (counting_list_id, inventory_item_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_counting_lists_inventory
    ON inventario.counting_lists(inventory_id);
CREATE INDEX IF NOT EXISTS idx_counting_lists_status
    ON inventario.counting_lists(list_status);
CREATE INDEX IF NOT EXISTS idx_counting_lists_counters
    ON inventario.counting_lists(counter_cycle_1, counter_cycle_2, counter_cycle_3);

CREATE INDEX IF NOT EXISTS idx_counting_list_items_list
    ON inventario.counting_list_items(counting_list_id);
CREATE INDEX IF NOT EXISTS idx_counting_list_items_inventory_item
    ON inventario.counting_list_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_counting_list_items_status
    ON inventario.counting_list_items(status);

-- 4. Adicionar campo para identificar se inventário usa múltiplas listas
ALTER TABLE inventario.inventory_lists
    ADD COLUMN IF NOT EXISTS use_multiple_lists BOOLEAN DEFAULT FALSE;

-- 5. Adicionar campo para contar quantas listas existem
ALTER TABLE inventario.inventory_lists
    ADD COLUMN IF NOT EXISTS total_lists INTEGER DEFAULT 0;

-- 6. View para facilitar consultas de listas com informações completas
CREATE OR REPLACE VIEW inventario.v_counting_lists_summary AS
SELECT
    cl.id as list_id,
    cl.list_name,
    cl.description,
    cl.current_cycle,
    cl.list_status,
    il.id as inventory_id,
    il.name as inventory_name,
    il.warehouse,
    il.status as inventory_status,
    u1.full_name as counter_cycle_1_name,
    u2.full_name as counter_cycle_2_name,
    u3.full_name as counter_cycle_3_name,
    COUNT(cli.id) as total_items,
    COUNT(CASE WHEN cli.status = 'COUNTED' THEN 1 END) as counted_items,
    COUNT(CASE WHEN cli.status = 'PENDING' THEN 1 END) as pending_items
FROM inventario.counting_lists cl
JOIN inventario.inventory_lists il ON cl.inventory_id = il.id
LEFT JOIN inventario.users u1 ON cl.counter_cycle_1 = u1.id
LEFT JOIN inventario.users u2 ON cl.counter_cycle_2 = u2.id
LEFT JOIN inventario.users u3 ON cl.counter_cycle_3 = u3.id
LEFT JOIN inventario.counting_list_items cli ON cl.id = cli.counting_list_id
GROUP BY
    cl.id, cl.list_name, cl.description, cl.current_cycle, cl.list_status,
    il.id, il.name, il.warehouse, il.status,
    u1.full_name, u2.full_name, u3.full_name;

-- 7. Função para migrar dados existentes (caso existam inventários já criados)
CREATE OR REPLACE FUNCTION inventario.migrate_existing_inventories()
RETURNS void AS $$
DECLARE
    inv_record RECORD;
    new_list_id UUID;
BEGIN
    -- Para cada inventário existente
    FOR inv_record IN
        SELECT id, name, counter_cycle_1, counter_cycle_2, counter_cycle_3,
               current_cycle, list_status, released_at, released_by,
               closed_at, closed_by, created_by
        FROM inventario.inventory_lists
        WHERE use_multiple_lists IS NULL OR use_multiple_lists = FALSE
    LOOP
        -- Criar uma lista de contagem padrão
        INSERT INTO inventario.counting_lists (
            inventory_id, list_name, description,
            counter_cycle_1, counter_cycle_2, counter_cycle_3,
            current_cycle, list_status,
            released_at, released_by, closed_at, closed_by,
            created_by
        ) VALUES (
            inv_record.id,
            'Lista Principal',
            'Lista migrada do sistema anterior',
            inv_record.counter_cycle_1,
            inv_record.counter_cycle_2,
            inv_record.counter_cycle_3,
            inv_record.current_cycle,
            inv_record.list_status,
            inv_record.released_at,
            inv_record.released_by,
            inv_record.closed_at,
            inv_record.closed_by,
            inv_record.created_by
        ) RETURNING id INTO new_list_id;

        -- Migrar os itens para a nova estrutura
        INSERT INTO inventario.counting_list_items (
            counting_list_id, inventory_item_id,
            needs_count_cycle_1, needs_count_cycle_2, needs_count_cycle_3,
            count_cycle_1, count_cycle_2, count_cycle_3,
            status, last_counted_at, last_counted_by
        )
        SELECT
            new_list_id,
            id,
            needs_recount_cycle_1,
            needs_recount_cycle_2,
            needs_recount_cycle_3,
            count_cycle_1,
            count_cycle_2,
            count_cycle_3,
            status,
            last_counted_at,
            last_counted_by
        FROM inventario.inventory_items
        WHERE inventory_list_id = inv_record.id;

        -- Marcar inventário como usando múltiplas listas
        UPDATE inventario.inventory_lists
        SET use_multiple_lists = TRUE,
            total_lists = 1
        WHERE id = inv_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Comentários explicativos
COMMENT ON TABLE inventario.counting_lists IS 'Listas de contagem - Múltiplas por inventário, cada uma com seus contadores';
COMMENT ON TABLE inventario.counting_list_items IS 'Itens de cada lista de contagem com controle individual de ciclos';
COMMENT ON COLUMN inventario.counting_lists.inventory_id IS 'Referência ao inventário pai';
COMMENT ON COLUMN inventario.counting_lists.list_name IS 'Nome da lista (ex: Lista 1, Lista Setor A, etc)';
COMMENT ON COLUMN inventario.counting_lists.current_cycle IS 'Ciclo atual desta lista específica (1, 2 ou 3)';
COMMENT ON COLUMN inventario.counting_list_items.counting_list_id IS 'Referência à lista de contagem específica';
COMMENT ON COLUMN inventario.counting_list_items.inventory_item_id IS 'Referência ao item do inventário geral';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================