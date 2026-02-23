-- Popula a tabela products com dados da sb1010
-- Isso permite que o sistema continue funcionando sem grandes mudanças

-- Limpar tabela products
TRUNCATE TABLE inventario.products CASCADE;

-- Inserir produtos da sb1010
INSERT INTO inventario.products (
    id,
    code,
    name,
    description,
    unit,
    cost_price,
    sale_price,
    current_stock,
    is_active,
    b1_cod,
    b1_desc,
    b1_um,
    b1_locpad,
    b1_grupo,
    b1_xcatgor,
    b1_xsubcat,
    b1_xsegmen,
    b1_rastro,
    b1_codbar,
    b2_lote,
    store_id,
    created_at,
    updated_at
)
SELECT 
    uuid_generate_v5(uuid_ns_url(), trim(b1_cod)) as id,
    trim(b1_cod) as code,
    trim(b1_desc) as name,
    b1_desc as description,
    COALESCE(b1_um, 'UN') as unit,
    0.0 as cost_price,
    0.0 as sale_price,
    0.0 as current_stock,
    is_active,
    b1_cod,
    b1_desc,
    b1_um,
    b1_locpad,
    b1_grupo,
    b1_xcatgor,
    b1_xsubcat,
    b1_xsegmen,
    b1_rastro,
    b1_codbar,
    CASE 
        WHEN b1_rastro = 'L' THEN 'S'  -- Se tem rastreabilidade por lote, tem controle de lote
        ELSE 'N'
    END as b2_lote,
    (SELECT id FROM inventario.stores LIMIT 1) as store_id,
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    COALESCE(updated_at, CURRENT_TIMESTAMP) as updated_at
FROM 
    inventario.sb1010
WHERE 
    1=1  -- Inserir todos os produtos
ON CONFLICT (id) DO NOTHING;

-- Verificar resultado
SELECT COUNT(*) as total_produtos FROM inventario.products;