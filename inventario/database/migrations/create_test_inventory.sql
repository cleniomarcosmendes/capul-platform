-- Inventário de teste — envolto em bloco seguro (ignora erros de schema evolution)
DO $$
BEGIN
    -- Atualizar inventário existente com warehouse (coluna pode variar)
    BEGIN
        UPDATE inventario.inventory_lists
        SET warehouse = '01'
        WHERE (name LIKE '%Teste Contagem%' OR name LIKE '%clenio%')
        AND id = (
            SELECT id FROM inventario.inventory_lists
            WHERE name LIKE '%Teste Contagem%' OR name LIKE '%clenio%'
            LIMIT 1
        );
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'update warehouse ignorado: %', SQLERRM;
    END;

    -- Criar inventário de teste
    BEGIN
        INSERT INTO inventario.inventory_lists (id, name, description, warehouse, status, store_id, created_by)
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
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'insert test inventory ignorado: %', SQLERRM;
    END;

    RAISE NOTICE 'create_test_inventory concluido (erros ignorados se ocorreram).';
END $$;
