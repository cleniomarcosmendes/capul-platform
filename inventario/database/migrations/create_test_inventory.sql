-- Criar inventário de teste com LOCAL definido

-- 1. Atualizar inventário existente com LOCAL
UPDATE inventario.inventory_lists 
SET warehouse_location = '01'
WHERE name LIKE '%Teste Contagem%' OR name LIKE '%clenio%'
LIMIT 1;

-- 2. Criar um novo inventário de teste se necessário
INSERT INTO inventario.inventory_lists (
    id,
    name,
    description,
    warehouse_location,
    status,
    store_id,
    created_by
) 
SELECT 
    uuid_generate_v4(),
    'Inventário Armazém 01 - Teste',
    'Inventário do armazém 01 para testar integração Protheus',
    '01',
    'IN_PROGRESS',
    s.id,
    u.id
FROM inventario.stores s, inventario.users u
WHERE s.code = '001' AND u.username = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. Adicionar produto 00010299 ao inventário
WITH inv AS (
    SELECT id FROM inventario.inventory_lists 
    WHERE warehouse_location = '01' 
    LIMIT 1
),
prod AS (
    SELECT id FROM inventario.products 
    WHERE code = '00010299'
)
INSERT INTO inventario.inventory_items (
    id,
    inventory_list_id,
    product_id,
    sequence,
    expected_quantity,
    status
)
SELECT 
    uuid_generate_v4(),
    inv.id,
    prod.id,
    1,
    150.0,  -- Quantidade esperada do Local 01
    'PENDING'
FROM inv, prod
ON CONFLICT DO NOTHING;

-- 4. Verificar resultado
SELECT 
    il.name,
    il.warehouse_location,
    p.code,
    ii.expected_quantity
FROM inventario.inventory_lists il
JOIN inventario.inventory_items ii ON il.id = ii.inventory_list_id
JOIN inventario.products p ON ii.product_id = p.id
WHERE p.code = '00010299';