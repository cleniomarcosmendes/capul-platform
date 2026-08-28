#!/bin/bash

echo "🧪 Teste direto da API - Botão Encerrar Rodada"
echo "================================================"

# Simular token de autenticação
TOKEN="token_clenio_$(date +%s)"
echo "🔑 Token simulado: $TOKEN"

# ID do inventário de teste
INVENTORY_ID="778e5856-d781-495f-b95b-bbb6ce2f2568"
echo "📋 ID do inventário: $INVENTORY_ID"

echo ""
echo "1️⃣ Testando endpoint cycle-assignments (novo endpoint)..."
curl -s -X GET "http://localhost:8000/api/v1/inventory/$INVENTORY_ID/cycle-assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -10

echo ""
echo ""
echo "2️⃣ Testando endpoint de status do inventário..."
curl -s -X GET "http://localhost:8000/api/v1/inventory/lists/$INVENTORY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -10

echo ""
echo ""
echo "3️⃣ Testando endpoint de encerramento de rodada..."
curl -s -X PUT "http://localhost:8000/api/v1/inventory/lists/$INVENTORY_ID/end-round" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -10

echo ""
echo ""
echo "4️⃣ Verificando mudança após encerramento..."
curl -s -X GET "http://localhost:8000/api/v1/inventory/$INVENTORY_ID/cycle-assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -10

echo ""
echo "✅ Teste concluído!"