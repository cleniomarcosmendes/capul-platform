-- Script para adicionar tabela de controle de rodadas fechadas
-- Sistema de Inventário - Capul

-- Criar tabela closed_counting_rounds
CREATE TABLE IF NOT EXISTS inventario.closed_counting_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_list_id UUID NOT NULL REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES inventario.users(id),
    round_number INTEGER NOT NULL DEFAULT 1,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Constraint para evitar duplicatas
    UNIQUE(inventory_list_id, user_id, round_number)
);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_closed_counting_rounds_inventory_user 
    ON inventario.closed_counting_rounds(inventory_list_id, user_id);

CREATE INDEX IF NOT EXISTS idx_closed_counting_rounds_user_round 
    ON inventario.closed_counting_rounds(user_id, round_number);

-- Comentários da tabela
COMMENT ON TABLE inventario.closed_counting_rounds IS 'Controle de rodadas de contagem encerradas por usuário';
COMMENT ON COLUMN inventario.closed_counting_rounds.inventory_list_id IS 'ID da lista de inventário';
COMMENT ON COLUMN inventario.closed_counting_rounds.user_id IS 'ID do usuário que encerrou a rodada';
COMMENT ON COLUMN inventario.closed_counting_rounds.round_number IS 'Número da rodada (1, 2, 3...)';
COMMENT ON COLUMN inventario.closed_counting_rounds.closed_at IS 'Data/hora do encerramento';
COMMENT ON COLUMN inventario.closed_counting_rounds.notes IS 'Observações sobre o encerramento';