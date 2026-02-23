-- =========================================================
-- MIGRATION: Adicionar controle de ciclos e status de listas
-- =========================================================
-- Objetivo: Implementar o controle de status e ciclos nas listas
-- de inventário conforme plano de desenvolvimento
-- =========================================================

-- 1. Criar novo tipo ENUM para status das listas de contagem
CREATE TYPE IF NOT EXISTS list_status AS ENUM ('ABERTA', 'EM_CONTAGEM', 'ENCERRADA');

-- 2. Adicionar campos de controle de ciclo na tabela inventory_lists
ALTER TABLE inventory_lists 
ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1 CHECK (cycle_number BETWEEN 1 AND 3),
ADD COLUMN IF NOT EXISTS list_status list_status DEFAULT 'ABERTA',
ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id);

-- 3. Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_inventory_lists_cycle ON inventory_lists(cycle_number);
CREATE INDEX IF NOT EXISTS idx_inventory_lists_list_status ON inventory_lists(list_status);

-- 4. Criar tabela para histórico de ciclos
CREATE TABLE IF NOT EXISTS inventory_cycle_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_list_id UUID NOT NULL REFERENCES inventory_lists(id),
    cycle_number INTEGER NOT NULL CHECK (cycle_number BETWEEN 1 AND 3),
    assigned_user_id UUID REFERENCES users(id),
    status list_status NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    items_count INTEGER DEFAULT 0,
    counted_items INTEGER DEFAULT 0,
    discrepancy_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Adicionar índices para histórico
CREATE INDEX IF NOT EXISTS idx_cycle_history_list ON inventory_cycle_history(inventory_list_id);
CREATE INDEX IF NOT EXISTS idx_cycle_history_user ON inventory_cycle_history(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_cycle_history_cycle ON inventory_cycle_history(cycle_number);

-- 6. Adicionar campo de ciclo na tabela counting_assignments
ALTER TABLE counting_assignments
ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1 CHECK (cycle_number BETWEEN 1 AND 3);

-- 7. Criar índice para o campo de ciclo
CREATE INDEX IF NOT EXISTS idx_counting_assignments_cycle ON counting_assignments(cycle_number);

-- 8. Comentários para documentação
COMMENT ON COLUMN inventory_lists.cycle_number IS 'Ciclo atual do inventário (1, 2 ou 3)';
COMMENT ON COLUMN inventory_lists.list_status IS 'Status da lista: ABERTA (pode alterar), EM_CONTAGEM (bloqueada para contagem), ENCERRADA (finalizada)';
COMMENT ON COLUMN inventory_lists.released_at IS 'Data/hora em que a lista foi liberada para contagem';
COMMENT ON COLUMN inventory_lists.released_by IS 'Usuário que liberou a lista para contagem';
COMMENT ON COLUMN inventory_lists.closed_at IS 'Data/hora em que a rodada foi encerrada';
COMMENT ON COLUMN inventory_lists.closed_by IS 'Usuário que encerrou a rodada';

COMMENT ON TABLE inventory_cycle_history IS 'Histórico de ciclos de contagem para rastreabilidade completa';
COMMENT ON COLUMN counting_assignments.cycle_number IS 'Ciclo em que a atribuição foi criada';