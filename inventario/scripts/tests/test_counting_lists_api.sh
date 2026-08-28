#!/bin/bash

echo "🚀 Testando API de Listas de Contagem"
echo "======================================"
echo ""

# 1. Fazer login e obter token
echo "1️⃣ Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X GET "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

# Como o sistema usa token simples no formato token_username_timestamp
TOKEN="token_admin_$(date +%s)"
echo "Token gerado: $TOKEN"
echo ""

# 2. Listar inventários
echo "2️⃣ Listando inventários disponíveis..."
INVENTORIES=$(curl -s -X GET "http://localhost:8000/api/v1/inventory/lists" \
  -H "Authorization: Bearer $TOKEN")

echo "$INVENTORIES" | python3 -m json.tool 2>/dev/null || echo "$INVENTORIES"
echo ""

# Extrair o primeiro inventory_id
INVENTORY_ID=$(echo "$INVENTORIES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        print(data[0]['id'])
except:
    pass
" 2>/dev/null)

if [ -z "$INVENTORY_ID" ]; then
    echo "⚠️ Nenhum inventário encontrado. Criando um novo..."

    CREATE_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/inventory/lists" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Teste Listas Contagem",
        "description": "Inventário para testar listas de contagem",
        "store_id": "e4d6c8f2-5b3a-4e1d-9c2b-8a7e6f5d4c3b"
      }')

    echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"

    INVENTORY_ID=$(echo "$CREATE_RESPONSE" | python3 -c "
    import sys, json
    try:
        data = json.load(sys.stdin)
        print(data['id'])
    except:
        pass
    " 2>/dev/null)
fi

if [ ! -z "$INVENTORY_ID" ]; then
    echo "📋 Usando inventário ID: $INVENTORY_ID"
    echo ""

    # 3. Buscar listas de contagem do inventário
    echo "3️⃣ Buscando listas de contagem do inventário..."
    COUNTING_LISTS=$(curl -s -X GET "http://localhost:8000/api/v1/inventory/$INVENTORY_ID/counting-lists" \
      -H "Authorization: Bearer $TOKEN")

    echo "$COUNTING_LISTS" | python3 -m json.tool 2>/dev/null || echo "$COUNTING_LISTS"
    echo ""

    # 4. Criar uma nova lista de contagem
    echo "4️⃣ Criando nova lista de contagem..."
    CREATE_LIST=$(curl -s -X POST "http://localhost:8000/api/v1/inventory/$INVENTORY_ID/counting-lists" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Lista Teste '"$(date +%H%M%S)"'",
        "description": "Lista criada via teste API",
        "assigned_users": []
      }')

    echo "$CREATE_LIST" | python3 -m json.tool 2>/dev/null || echo "$CREATE_LIST"
    echo ""

    # Extrair ID da lista criada
    LIST_ID=$(echo "$CREATE_LIST" | python3 -c "
    import sys, json
    try:
        data = json.load(sys.stdin)
        print(data['id'])
    except:
        pass
    " 2>/dev/null)

    if [ ! -z "$LIST_ID" ]; then
        echo "✅ Lista criada com ID: $LIST_ID"
        echo ""

        # 5. Buscar detalhes da lista
        echo "5️⃣ Buscando detalhes da lista criada..."
        LIST_DETAILS=$(curl -s -X GET "http://localhost:8000/api/v1/inventory/counting-lists/$LIST_ID" \
          -H "Authorization: Bearer $TOKEN")

        echo "$LIST_DETAILS" | python3 -m json.tool 2>/dev/null || echo "$LIST_DETAILS"
        echo ""

        # 6. Atualizar a lista
        echo "6️⃣ Atualizando a lista de contagem..."
        UPDATE_LIST=$(curl -s -X PUT "http://localhost:8000/api/v1/inventory/counting-lists/$LIST_ID" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "name": "Lista Atualizada '"$(date +%H%M%S)"'",
            "description": "Descrição atualizada via API",
            "status": "IN_PROGRESS"
          }')

        echo "$UPDATE_LIST" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_LIST"
        echo ""

        # 7. Listar todas as listas novamente
        echo "7️⃣ Listando todas as listas de contagem após criação..."
        FINAL_LISTS=$(curl -s -X GET "http://localhost:8000/api/v1/inventory/$INVENTORY_ID/counting-lists" \
          -H "Authorization: Bearer $TOKEN")

        echo "$FINAL_LISTS" | python3 -m json.tool 2>/dev/null || echo "$FINAL_LISTS"
        echo ""
    fi
else
    echo "❌ Não foi possível obter ou criar um inventário"
fi

echo "✅ Teste concluído!"