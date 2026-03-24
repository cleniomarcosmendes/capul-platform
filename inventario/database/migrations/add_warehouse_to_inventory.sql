-- ===============================================
-- Migration: Adicionar campo warehouse em inventory_lists
-- Data: 2025-08-12
-- Descrição: Adiciona campo warehouse (armazém/local) para 
--            especificar qual armazém está sendo inventariado
-- ===============================================

-- Adicionar coluna warehouse na tabela inventory_lists
ALTER TABLE inventario.inventory_lists 
ADD COLUMN IF NOT EXISTS warehouse VARCHAR(10) NOT NULL DEFAULT '01';

-- Comentário explicativo
COMMENT ON COLUMN inventario.inventory_lists.warehouse IS 'Código do armazém/local sendo inventariado (equivalente ao B2_LOCAL do Protheus)';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_inventory_lists_warehouse 
ON inventario.inventory_lists(warehouse);

-- Adicionar constraint para validar formato do armazém (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_warehouse_format') THEN
        ALTER TABLE inventario.inventory_lists
        ADD CONSTRAINT chk_warehouse_format
        CHECK (LENGTH(warehouse) = 2 AND warehouse ~ '^[0-9A-Z]+$');
    END IF;
END $$;

-- ===============================================
-- Criar tabela de armazéns para referência
-- ===============================================
CREATE TABLE IF NOT EXISTS inventario.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(2) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    store_id UUID NOT NULL REFERENCES inventario.stores(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint para código único por loja
    CONSTRAINT uk_warehouse_store UNIQUE (code, store_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON inventario.warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_store ON inventario.warehouses(store_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON inventario.warehouses(is_active);

-- ===============================================
-- Garantir constraint única para ON CONFLICT funcionar
-- ===============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_warehouse_store') THEN
        ALTER TABLE inventario.warehouses ADD CONSTRAINT uk_warehouse_store UNIQUE (code, store_id);
    END IF;
END $$;

-- ===============================================
-- Inserir armazéns padrão
-- ===============================================
INSERT INTO inventario.warehouses (code, name, description, store_id)
SELECT 
    armazem.code,
    armazem.name,
    armazem.description,
    s.id as store_id
FROM inventario.stores s
CROSS JOIN (
    VALUES 
        ('01', 'Armazém Principal', 'Armazém principal da loja'),
        ('02', 'Armazém Secundário', 'Armazém de apoio'),
        ('03', 'Armazém de Devoluções', 'Produtos em processo de devolução'),
        ('04', 'Quarentena', 'Produtos em quarentena/avaria')
) AS armazem(code, name, description)
WHERE s.is_active = true
ON CONFLICT (code, store_id) DO NOTHING;

-- ===============================================
-- Adicionar campo warehouse na tabela products
-- Para simular a estrutura SB2 do Protheus
-- ===============================================
ALTER TABLE inventario.products 
ADD COLUMN IF NOT EXISTS warehouse VARCHAR(2) NOT NULL DEFAULT '01';

COMMENT ON COLUMN inventario.products.warehouse IS 'Código do armazém onde o produto está armazenado (B2_LOCAL)';

-- Criar índice composto para busca eficiente
CREATE INDEX IF NOT EXISTS idx_products_store_warehouse 
ON inventario.products(store_id, warehouse);

-- Atualizar produtos existentes com armazéns variados para teste
UPDATE inventario.products 
SET warehouse = CASE 
    WHEN RANDOM() < 0.7 THEN '01'  -- 70% no armazém principal
    WHEN RANDOM() < 0.9 THEN '02'  -- 20% no armazém secundário
    ELSE '03'                       -- 10% em outros armazéns
END
WHERE warehouse = '01';