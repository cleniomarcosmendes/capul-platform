-- Migração: Adicionar status individual para cada lista de contagem
-- Data: 2025-09-14
-- Problema: Sistema usando um único status para múltiplas listas

-- 1. Adicionar campo list_status para cada atribuição/lista
ALTER TABLE inventario.counting_assignments
ADD COLUMN IF NOT EXISTS list_status VARCHAR(20) DEFAULT 'ABERTA';

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN inventario.counting_assignments.list_status IS
'Status individual da lista de contagem do usuário (ABERTA, EM_CONTAGEM, ENCERRADA)';

-- 3. Criar índice para busca por status
CREATE INDEX IF NOT EXISTS idx_counting_assignments_list_status
ON inventario.counting_assignments(list_status);

-- 4. Atualizar registros existentes baseado no status global
UPDATE inventario.counting_assignments ca
SET list_status = CASE
    WHEN il.list_status = 'EM_CONTAGEM' THEN 'EM_CONTAGEM'
    WHEN il.list_status = 'ENCERRADA' THEN 'ENCERRADA'
    ELSE 'ABERTA'
END
FROM inventario.inventory_lists il
JOIN inventario.inventory_items ii ON ii.inventory_list_id = il.id
WHERE ca.inventory_item_id = ii.id;