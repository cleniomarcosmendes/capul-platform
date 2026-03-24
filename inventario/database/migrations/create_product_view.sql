-- Criar view que mapeia sb1010 para o formato esperado pela aplicação
-- Esta view adiciona campos que não existem em sb1010 mas são necessários

DROP VIEW IF EXISTS inventario.v_products CASCADE;

CREATE VIEW inventario.v_products AS
SELECT 
    -- Gerar UUID baseado no código do produto para consistência
    uuid_generate_v5(uuid_ns_url(), b1_cod) as id,
    
    -- Campos da SB1010
    trim(b1_cod) as code,
    trim(b1_desc) as name,
    b1_desc as description,
    COALESCE(b1_um, 'UN') as unit,
    0.0 as cost_price,  -- Não disponível em SB1010
    0.0 as sale_price,  -- Não disponível em SB1010
    0.0 as current_stock,  -- Deve vir de SB2010.B2_QATU
    
    -- Campos de controle
    TRUE as is_active,  -- sb1010 nao tem is_active, usar TRUE como default
    
    -- Campos espelho SB1010
    b1_cod,
    b1_desc,
    b1_tipo,
    b1_um,
    b1_locpad,
    b1_grupo,
    b1_xcatgor,
    b1_xsubcat,
    b1_xsegmen,
    b1_rastro,
    b1_codbar as barcode,
    b1_codbar,
    'N' as b2_lote,  -- Por padrão, sem controle de lote (deve ser atualizado via integração)
    
    -- Store ID - por enquanto usando a primeira loja
    (SELECT id FROM inventario.stores LIMIT 1) as store_id,
    
    -- Timestamps
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    COALESCE(updated_at, CURRENT_TIMESTAMP) as updated_at
FROM 
    inventario.sb1010
WHERE 
    b1_filial = '01';  -- Filial padrão

COMMENT ON VIEW inventario.v_products IS 'View que mapeia produtos da SB1010 para o formato esperado pela aplicação';