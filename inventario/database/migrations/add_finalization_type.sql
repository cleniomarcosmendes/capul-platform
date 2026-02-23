-- Migration: Adicionar campo finalization_type para rastrear tipo de encerramento
-- Data: 2025-10-02
-- Descrição: Campo para diferenciar entre finalização automática, manual e forçada

-- Adicionar coluna finalization_type
ALTER TABLE inventario.inventory_lists
ADD COLUMN IF NOT EXISTS finalization_type VARCHAR(20) DEFAULT 'automatic';

-- Comentar a coluna para documentação
COMMENT ON COLUMN inventario.inventory_lists.finalization_type IS
'Tipo de finalização da lista: automatic (sistema encerrou sem divergências), manual (usuário encerrou no 3º ciclo), forced (usuário forçou encerramento antes do 3º ciclo)';

-- Atualizar listas já encerradas (assumir que foram automáticas se não tiver informação)
UPDATE inventario.inventory_lists
SET finalization_type = 'automatic'
WHERE list_status = 'ENCERRADA' AND finalization_type IS NULL;
