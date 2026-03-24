-- Popula a tabela products com dados da sb1010
-- Isso permite que o sistema continue funcionando sem grandes mudanças

-- Limpar tabela products
TRUNCATE TABLE inventario.products CASCADE;

-- Inserir produtos da sb1010 (colunas alinhadas com schema atual)
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
    b1_grupo,
    hierarchy_category,
    hierarchy_subcategory,
    hierarchy_segment,
    b1_rastro,
    b1_codbar,
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
    TRUE as is_active,   -- sb1010 nao tem is_active, usar TRUE como default
    b1_cod,
    b1_desc,
    b1_um,
    b1_grupo,
    b1_xcatgor,          -- mapeia para hierarchy_category
    b1_xsubcat,          -- mapeia para hierarchy_subcategory
    b1_xsegmen,          -- mapeia para hierarchy_segment
    b1_rastro,
    b1_codbar,
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
