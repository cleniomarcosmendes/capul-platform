#!/bin/bash

echo "🧪 Teste Completo - Atualização Grid Modal"
echo "=========================================="

# Verificar se backend está funcionando
echo ""
echo "1️⃣ Verificando Backend..."
HEALTH_CHECK=$(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$HEALTH_CHECK" = "🟢 Healthy" ]; then
    echo "✅ Backend funcionando"
else
    echo "❌ Backend não está funcionando"
    exit 1
fi

# Buscar inventário de teste
echo ""
echo "2️⃣ Buscando inventário de teste..."
INVENTORY_ID="6941e49d-ba43-4b20-8ebc-03bca98e07cb"
echo "📋 Usando inventário: $INVENTORY_ID"

# Verificar produtos do inventário
echo ""
echo "3️⃣ Verificando produtos disponíveis..."
timeout 10 curl -s -X GET "http://localhost:8000/api/v1/cycles/inventory/$INVENTORY_ID/my-products" \
    -H "Authorization: Bearer token_clenio_$(date +%s)" | grep -o '"product_code":"[^"]*"' | head -3 | cut -d'"' -f4 | while read code; do echo "🎯 Produto: $code"; done

# Teste de salvamento de contagem
echo ""
echo "4️⃣ Testando salvamento de contagem..."
PRODUCT_CODE="00015062"
QUANTITY=75

echo "📝 Salvando contagem para produto $PRODUCT_CODE (Qtd: $QUANTITY)..."

SAVE_RESPONSE=$(timeout 15 curl -s -X POST "http://localhost:8000/api/v1/counting/inventory/$INVENTORY_ID/register-count" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer token_clenio_$(date +%s)" \
    -d "{
        \"inventory_id\": \"$INVENTORY_ID\",
        \"product_code\": \"$PRODUCT_CODE\",
        \"quantity\": $QUANTITY,
        \"batch_number\": \"LOTE123\",
        \"expiry_date\": \"2025-12-31\",
        \"cycle_number\": 1
    }")

if echo "$SAVE_RESPONSE" | grep -q "sucesso\|success"; then
    echo "✅ Contagem salva com sucesso"
    echo "📄 Resposta: $SAVE_RESPONSE"
else
    echo "❌ Erro ao salvar contagem"
    echo "📄 Resposta: $SAVE_RESPONSE"
fi

# Verificar se localStorage seria atualizado
echo ""
echo "5️⃣ Simulando atualização localStorage..."
echo "📨 O frontend salvaria no localStorage:"
cat << EOF
{
    "type": "PRODUCT_COUNT_UPDATE",
    "productId": "ID_DO_PRODUTO_$PRODUCT_CODE",
    "cycleNumber": 1,
    "quantity": $QUANTITY,
    "listId": "$INVENTORY_ID",
    "timestamp": $(date +%s)000
}
EOF

echo ""
echo "6️⃣ Verificando dados atualizados no banco..."
docker-compose exec -T postgres psql -U inventario_user -d inventario_protheus -c "
SELECT
    product_code,
    count_cycle_1,
    last_counted_at,
    status
FROM inventario.inventory_items
WHERE inventory_list_id = '$INVENTORY_ID'
  AND product_code = '$PRODUCT_CODE';" 2>/dev/null

echo ""
echo "✅ Teste concluído!"
echo ""
echo "🔍 Para verificar se funcionou:"
echo "   1. Abra: http://localhost:8080/inventory.html"
echo "   2. Faça login (admin/admin123)"
echo "   3. Abra inventário '$INVENTORY_ID'"
echo "   4. Clique 'Gerenciar Lista'"
echo "   5. Verifique se a coluna '1ª Cont' mostra $QUANTITY para produto $PRODUCT_CODE"
echo ""
echo "🧪 Para testar comunicação:"
echo "   1. Abra: http://localhost:8080/test_localstorage_communication.html"
echo "   2. Clique 'Inicializar Listener'"
echo "   3. Clique 'Enviar Contagem'"
echo "   4. Verifique logs de comunicação"