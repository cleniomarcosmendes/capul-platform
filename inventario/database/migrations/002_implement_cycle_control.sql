-- =====================================================
-- MIGRAÇÃO: Implementar Controle de Ciclos Melhorado
-- Data: 2025-01-17
-- Descrição: Adiciona colunas para controle direto de
--            usuários por ciclo no cabeçalho e flags
--            de recontagem nos itens
-- =====================================================

-- 1. ALTERAÇÕES NO CABEÇALHO (inventory_lists)
-- ---------------------------------------------
ALTER TABLE inventario.inventory_lists
    ADD COLUMN IF NOT EXISTS counter_cycle_1 UUID REFERENCES inventario.users(id),
    ADD COLUMN IF NOT EXISTS counter_cycle_2 UUID REFERENCES inventario.users(id),
    ADD COLUMN IF NOT EXISTS counter_cycle_3 UUID REFERENCES inventario.users(id),
    ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1 CHECK (current_cycle BETWEEN 1 AND 3);

-- Adicionar comentários explicativos
COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_1 IS 'Usuário responsável pela 1ª contagem';
COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_2 IS 'Usuário responsável pela 2ª contagem';
COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_3 IS 'Usuário responsável pela 3ª contagem';
COMMENT ON COLUMN inventario.inventory_lists.current_cycle IS 'Ciclo atual de contagem (1, 2 ou 3)';

-- 2. ALTERAÇÕES NOS ITENS (inventory_items)
-- -----------------------------------------
ALTER TABLE inventario.inventory_items
    ADD COLUMN IF NOT EXISTS needs_recount_cycle_1 BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS needs_recount_cycle_2 BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS needs_recount_cycle_3 BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS count_cycle_1 NUMERIC(15,4),
    ADD COLUMN IF NOT EXISTS count_cycle_2 NUMERIC(15,4),
    ADD COLUMN IF NOT EXISTS count_cycle_3 NUMERIC(15,4);

-- Adicionar comentários explicativos
COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_1 IS 'Item precisa ser contado no 1º ciclo';
COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_2 IS 'Item precisa ser recontado no 2º ciclo';
COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_3 IS 'Item precisa ser recontado no 3º ciclo';
COMMENT ON COLUMN inventario.inventory_items.count_cycle_1 IS 'Quantidade contada no 1º ciclo';
COMMENT ON COLUMN inventario.inventory_items.count_cycle_2 IS 'Quantidade contada no 2º ciclo';
COMMENT ON COLUMN inventario.inventory_items.count_cycle_3 IS 'Quantidade contada no 3º ciclo';

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ---------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_lists_counters 
    ON inventario.inventory_lists(counter_cycle_1, counter_cycle_2, counter_cycle_3);

CREATE INDEX IF NOT EXISTS idx_inventory_items_recount_flags 
    ON inventario.inventory_items(needs_recount_cycle_1, needs_recount_cycle_2, needs_recount_cycle_3);

-- 4. ATUALIZAR DADOS EXISTENTES
-- -----------------------------
-- Migrar dados atuais para nova estrutura
UPDATE inventario.inventory_lists il
SET 
    counter_cycle_1 = COALESCE(
        (SELECT assigned_to FROM inventario.counting_assignments ca 
         WHERE ca.inventory_item_id IN (
             SELECT id FROM inventario.inventory_items 
             WHERE inventory_list_id = il.id LIMIT 1
         ) AND ca.count_number = 1 LIMIT 1),
        il.created_by
    ),
    current_cycle = CASE 
        WHEN il.cycle_number IS NOT NULL THEN il.cycle_number
        ELSE 1
    END;

-- Marcar todos os itens existentes para contagem no ciclo 1
UPDATE inventario.inventory_items
SET needs_recount_cycle_1 = TRUE
WHERE needs_recount_cycle_1 IS NULL;

-- 5. CRIAR FUNÇÃO PARA VALIDAR CONTAGEM
-- -------------------------------------
CREATE OR REPLACE FUNCTION inventario.can_user_count(
    p_inventory_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_cycle INTEGER;
    v_counter_id UUID;
BEGIN
    -- Obter ciclo atual e contador responsável
    SELECT 
        current_cycle,
        CASE current_cycle
            WHEN 1 THEN counter_cycle_1
            WHEN 2 THEN counter_cycle_2
            WHEN 3 THEN counter_cycle_3
        END
    INTO v_current_cycle, v_counter_id
    FROM inventario.inventory_lists
    WHERE id = p_inventory_id;
    
    -- Verificar se usuário é o responsável pelo ciclo atual
    RETURN v_counter_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 6. CRIAR FUNÇÃO PARA AVANÇAR CICLO
-- ----------------------------------
CREATE OR REPLACE FUNCTION inventario.advance_cycle(
    p_inventory_id UUID,
    p_tolerance_percent NUMERIC DEFAULT 5.0
) RETURNS TABLE(
    items_needing_recount INTEGER,
    next_cycle INTEGER
) AS $$
DECLARE
    v_current_cycle INTEGER;
    v_next_cycle INTEGER;
    v_items_needing_recount INTEGER;
BEGIN
    -- Obter ciclo atual
    SELECT current_cycle INTO v_current_cycle
    FROM inventario.inventory_lists
    WHERE id = p_inventory_id;
    
    -- Calcular próximo ciclo
    v_next_cycle := LEAST(v_current_cycle + 1, 3);
    
    -- Identificar itens que precisam recontagem
    WITH discrepancies AS (
        SELECT 
            ii.id,
            ii.expected_quantity,
            CASE v_current_cycle
                WHEN 1 THEN ii.count_cycle_1
                WHEN 2 THEN ii.count_cycle_2
                WHEN 3 THEN ii.count_cycle_3
            END as counted_quantity
        FROM inventario.inventory_items ii
        WHERE ii.inventory_list_id = p_inventory_id
    )
    SELECT COUNT(*) INTO v_items_needing_recount
    FROM discrepancies
    WHERE ABS(COALESCE(counted_quantity, 0) - COALESCE(expected_quantity, 0)) > 
          (COALESCE(expected_quantity, 1) * p_tolerance_percent / 100);
    
    -- Atualizar flags de recontagem para próximo ciclo
    IF v_next_cycle = 2 THEN
        UPDATE inventario.inventory_items ii
        SET needs_recount_cycle_2 = TRUE
        FROM discrepancies d
        WHERE ii.id = d.id
        AND ABS(COALESCE(d.counted_quantity, 0) - COALESCE(d.expected_quantity, 0)) > 
            (COALESCE(d.expected_quantity, 1) * p_tolerance_percent / 100);
    ELSIF v_next_cycle = 3 THEN
        UPDATE inventario.inventory_items ii
        SET needs_recount_cycle_3 = TRUE
        FROM discrepancies d
        WHERE ii.id = d.id
        AND ABS(COALESCE(d.counted_quantity, 0) - COALESCE(d.expected_quantity, 0)) > 
            (COALESCE(d.expected_quantity, 1) * p_tolerance_percent / 100);
    END IF;
    
    -- Atualizar ciclo atual
    UPDATE inventario.inventory_lists
    SET current_cycle = v_next_cycle,
        list_status = 'ABERTA'
    WHERE id = p_inventory_id;
    
    RETURN QUERY SELECT v_items_needing_recount, v_next_cycle;
END;
$$ LANGUAGE plpgsql;

-- 7. CRIAR VIEW PARA FACILITAR CONSULTAS
-- --------------------------------------
CREATE OR REPLACE VIEW inventario.v_inventory_cycle_status AS
SELECT 
    il.id as inventory_id,
    il.name as inventory_name,
    il.current_cycle,
    il.list_status,
    u1.full_name as counter_cycle_1_name,
    u2.full_name as counter_cycle_2_name,
    u3.full_name as counter_cycle_3_name,
    COUNT(DISTINCT ii.id) as total_items,
    COUNT(DISTINCT CASE WHEN ii.needs_recount_cycle_1 THEN ii.id END) as items_cycle_1,
    COUNT(DISTINCT CASE WHEN ii.needs_recount_cycle_2 THEN ii.id END) as items_cycle_2,
    COUNT(DISTINCT CASE WHEN ii.needs_recount_cycle_3 THEN ii.id END) as items_cycle_3
FROM inventario.inventory_lists il
LEFT JOIN inventario.users u1 ON il.counter_cycle_1 = u1.id
LEFT JOIN inventario.users u2 ON il.counter_cycle_2 = u2.id
LEFT JOIN inventario.users u3 ON il.counter_cycle_3 = u3.id
LEFT JOIN inventario.inventory_items ii ON ii.inventory_list_id = il.id
GROUP BY 
    il.id, il.name, il.current_cycle, il.list_status,
    u1.full_name, u2.full_name, u3.full_name;

-- 8. ADICIONAR TRIGGERS PARA GARANTIR CONSISTÊNCIA
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION inventario.validate_cycle_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Ao liberar para contagem, garantir que o contador está definido
    IF NEW.list_status = 'EM_CONTAGEM' AND OLD.list_status = 'ABERTA' THEN
        -- Se não há contador para o ciclo atual, copiar do ciclo anterior
        IF NEW.current_cycle = 2 AND NEW.counter_cycle_2 IS NULL THEN
            NEW.counter_cycle_2 := NEW.counter_cycle_1;
        ELSIF NEW.current_cycle = 3 AND NEW.counter_cycle_3 IS NULL THEN
            NEW.counter_cycle_3 := COALESCE(NEW.counter_cycle_2, NEW.counter_cycle_1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_cycle_assignment ON inventario.inventory_lists;
CREATE TRIGGER trg_validate_cycle_assignment
    BEFORE UPDATE ON inventario.inventory_lists
    FOR EACH ROW
    EXECUTE FUNCTION inventario.validate_cycle_assignment();

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================