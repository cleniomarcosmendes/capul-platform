#!/bin/bash

# Script para adicionar produtos ao inventário de teste
echo "======================================="
echo "ADICIONANDO PRODUTOS AO INVENTÁRIO"
echo "======================================="

# Pegar o ID do último inventário criado
INVENTORY_ID=$(docker-compose exec -T postgres psql -U inventario_user -d inventario_protheus -t -c "
SELECT id FROM inventario.inventory_lists
WHERE name LIKE 'teste_def%'
ORDER BY created_at DESC
LIMIT 1" | tr -d ' ')

echo "Inventário encontrado: $INVENTORY_ID"

if [ "$INVENTORY_ID" == "" ]; then
    echo "❌ Nenhum inventário de teste encontrado"
    exit 1
fi

# Adicionar produtos diretamente no banco
echo ""
echo "Adicionando produtos com quantidades diferentes para gerar divergências..."

docker-compose exec -T postgres psql -U inventario_user -d inventario_protheus << EOF
-- Adicionar produtos ao inventário
INSERT INTO inventario.inventory_items (
    inventory_list_id,
    product_code,
    expected_quantity,
    warehouse,
    sequence,
    needs_recount_cycle_1,
    status
) VALUES
    ('$INVENTORY_ID', '00015210', 10.0, '02', 1, true, 'PENDING'),
    ('$INVENTORY_ID', '00014837', 0.0, '02', 2, true, 'PENDING'),
    ('$INVENTORY_ID', '00015195', 25.0, '02', 3, true, 'PENDING'),
    ('$INVENTORY_ID', '00015202', 50.0, '02', 4, true, 'PENDING')
ON CONFLICT DO NOTHING;

-- Verificar produtos adicionados
SELECT product_code, expected_quantity, needs_recount_cycle_1
FROM inventario.inventory_items
WHERE inventory_list_id = '$INVENTORY_ID';
EOF

echo ""
echo "======================================="
echo "✅ PRODUTOS ADICIONADOS COM SUCESSO!"
echo "======================================="
echo ""
echo "Agora você pode:"
echo "1. Voltar à tela do inventário"
echo "2. Clicar em 'Liberar 1ª Contagem'"
echo "3. Atribuir produtos aos usuários"
echo "4. Fazer contagens com divergências"
echo "5. Encerrar rodada e verificar se ciclo 2 funciona"
echo ""
echo "Produtos adicionados:"
echo "- 00015210: Esperado = 10 (conte 15 para gerar divergência)"
echo "- 00014837: Esperado = 0 (conte 5 para gerar divergência)"
echo "- 00015195: Esperado = 25 (conte 30 para gerar divergência)"
echo "- 00015202: Esperado = 50 (conte 50 para NÃO gerar divergência)"