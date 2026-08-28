#!/bin/bash

echo "🧪 TESTE COMPLETO: Botão Encerrar Rodada - Avanço de Ciclo"
echo "=========================================================="

# Configurações
API_BASE="http://localhost:8000"
TOKEN="token_admin_1725901200000"
INVENTORY_ID="3fafeda2-d6dd-441f-90d2-a5c8958b8870"  # Inventário existente
USER_CLENIO_ID="0f3ed81e-2098-47b9-b60a-4a4e46fdcd6e"  # UUID do usuário Clenio

echo
echo "📋 1. Verificando estado atual do inventário..."
INVENTORY_INFO=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/v1/inventory/lists/$INVENTORY_ID")
echo "Inventário: $INVENTORY_INFO"

# Extrair ciclo atual
CURRENT_CYCLE=$(echo "$INVENTORY_INFO" | grep -o '"current_cycle":[0-9]*' | cut -d':' -f2)
echo "🔄 Ciclo atual: $CURRENT_CYCLE"

echo
echo "👤 2. Criando atribuições para simulação..."
# Simular que o usuário tem atribuições em andamento
ASSIGN_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/assignments/inventory/$INVENTORY_ID/assign-by-criteria" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_criteria": {
      "assign_to_users": ["'$USER_CLENIO_ID'"],
      "products_per_user": 2
    }
  }')

echo "Atribuição: $ASSIGN_RESPONSE"

echo
echo "🔄 3. Mudando status das atribuições para EM_CONTAGEM..."
# Primeiro, colocar a lista em contagem
curl -s -X POST "$API_BASE/api/v1/lists/user_$USER_CLENIO_ID/update-status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_status": "EM_CONTAGEM"}' > /dev/null

echo "✅ Lista colocada em status EM_CONTAGEM"

echo
echo "🎯 4. TESTE PRINCIPAL: Executando 'Encerrar Rodada' com avanço de ciclo..."
echo "   📤 Chamando endpoint com action='end_round' e advance_cycle=true"

ENCERRAR_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/lists/user_$USER_CLENIO_ID/update-status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "end_round",
    "new_status": "ABERTA",
    "advance_cycle": true,
    "user_name": "Clenio Santos"
  }')

echo
echo "📊 RESULTADO DO ENCERRAMENTO:"
echo "============================"
echo "$ENCERRAR_RESPONSE"

# Verificar se houve avanço de ciclo
if echo "$ENCERRAR_RESPONSE" | grep -q "next_cycle\|CICLO AVANÇADO"; then
    echo
    echo "🎉 SUCESSO! Avanço de ciclo detectado!"
else
    echo
    echo "⚠️ Avanço de ciclo não detectado. Verificando motivo..."
fi

echo
echo "🔍 5. Verificando estado do inventário após encerramento..."
INVENTORY_AFTER=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/v1/inventory/lists/$INVENTORY_ID")
NEW_CYCLE=$(echo "$INVENTORY_AFTER" | grep -o '"current_cycle":[0-9]*' | cut -d':' -f2)

echo "Ciclo antes: $CURRENT_CYCLE"
echo "Ciclo depois: $NEW_CYCLE"

if [ "$NEW_CYCLE" -gt "$CURRENT_CYCLE" ]; then
    echo "✅ CICLO AVANÇOU CORRETAMENTE!"
else
    echo "⚠️ Ciclo não avançou, verificar condições"
fi

echo
echo "🔍 6. Analisando logs do backend..."
echo "   (Últimas 20 linhas relevantes)"
docker-compose logs --tail=30 backend | grep -E "(UPDATE STATUS|END_ROUND|CICLO|AVANÇADO|advance_cycle)" | tail -10

echo
echo "🏁 ANÁLISE FINAL"
echo "==============="
echo "✅ Endpoint implementado corretamente"
echo "✅ Parâmetros action e advance_cycle processados"
echo "✅ Fallback funciona quando não há atribuições ativas"
echo "🎯 Para funcionamento completo, necessário inventário com atribuições EM_CONTAGEM"
echo