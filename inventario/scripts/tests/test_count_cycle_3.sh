#!/bin/bash

echo "🔍 Testando visualização de contagem ciclo 3 para produtos com e sem lote"
echo "================================================"

# Token de autenticação
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "clenio", "password": "123456"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))")

if [ -z "$TOKEN" ]; then
    echo "❌ Erro ao obter token de autenticação"
    exit 1
fi

echo "✅ Token obtido"

# Buscar inventário clenio_00
INVENTORY_ID=$(curl -s "http://localhost:8000/api/v1/inventory/lists" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); inv = next((i for i in data['items'] if i['name'] == 'clenio_00'), None); print(inv['id'] if inv else '')")

if [ -z "$INVENTORY_ID" ]; then
    echo "❌ Inventário clenio_00 não encontrado"
    exit 1
fi

echo "✅ Inventário encontrado: $INVENTORY_ID"

# Verificar produtos específicos
echo ""
echo "📊 Verificando produtos específicos:"
echo "------------------------------------"

PRODUCTS=("00010037" "00010044" "00010239" "00010285" "00010288")

for PRODUCT_CODE in "${PRODUCTS[@]}"; do
    echo ""
    echo "🔍 Produto: $PRODUCT_CODE"
    docker-compose exec postgres psql -U inventario_user -d inventario_protheus -c "
    SELECT 
        ii.product_code,
        sb1.b1_rastro as controle_lote,
        ii.count_cycle_1,
        ii.count_cycle_2,
        ii.count_cycle_3,
        il.current_cycle,
        il.list_status
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_lists il ON ii.inventory_list_id = il.id
    LEFT JOIN inventario.sb1010 sb1 ON sb1.b1_cod = ii.product_code
    WHERE il.id = '$INVENTORY_ID'
      AND ii.product_code = '$PRODUCT_CODE';" 2>/dev/null | grep -v "^time=" | head -10
done

echo ""
echo "🔄 Testando endpoint de items da lista..."
echo "-----------------------------------------"

# Testar endpoint de items
curl -s "http://localhost:8000/api/v1/inventory/lists/$INVENTORY_ID/items?page=1&per_page=5" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "
import sys, json

data = json.load(sys.stdin)
items = data.get('data', {}).get('items', [])

target_codes = ['00010037', '00010044', '00010239', '00010285', '00010288']

for item in items:
    if item.get('product_code') in target_codes:
        print(f\"\\n📦 {item['product_code']}:\")
        print(f\"  count_cycle_1: {item.get('count_cycle_1', 'N/A')}\")
        print(f\"  count_cycle_2: {item.get('count_cycle_2', 'N/A')}\")
        print(f\"  count_cycle_3: {item.get('count_cycle_3', 'N/A')}\")
        print(f\"  b1_rastro: {item.get('b1_rastro', 'N/A')}\")
"

echo ""
echo "✅ Teste concluído"
