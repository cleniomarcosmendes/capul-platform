#!/bin/bash

# 🧪 SMOKE TESTS - Validação Rápida de Funcionalidades Críticas
# Versão: 1.0
# Data: 05/10/2025
# Objetivo: Detectar regressões ANTES de commitar

set -e  # Parar no primeiro erro

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo "⚠️ [WARNING] jq não está instalado. Instalando..."
    sudo apt-get update -qq && sudo apt-get install -y jq -qq || {
        echo "❌ [ERROR] Falha ao instalar jq. Por favor instale manualmente: sudo apt-get install jq"
        exit 1
    }
fi

API_BASE_URL="http://localhost:8000"
FRONTEND_URL="http://localhost"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para print colorido
print_test() {
    echo -e "${BLUE}🧪 [TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ [PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}❌ [FAIL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  [WARN]${NC} $1"
}

# Contador de testes
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Função para executar teste
run_test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$1"
}

# Função para marcar sucesso
test_passed() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    print_success "$1"
}

# Função para marcar falha
test_failed() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    print_error "$1"
    exit 1
}

echo ""
echo "=========================================="
echo "🧪 SMOKE TESTS - Sistema de Inventário"
echo "=========================================="
echo ""

# ==========================================
# TESTE 1: Backend Health Check
# ==========================================
run_test "Backend Health Check"
HEALTH_RESPONSE=$(curl -s -f "${API_BASE_URL}/health" 2>/dev/null) || {
    test_failed "Backend não está respondendo em ${API_BASE_URL}/health"
}

# Validar resposta JSON
STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null)

if [ -z "$STATUS" ]; then
    print_error "Resposta do health: $HEALTH_RESPONSE"
    test_failed "Resposta inválida do health check (JSON malformado)"
fi

if [[ "$STATUS" == *"Healthy"* ]]; then
    test_passed "Backend está saudável: $STATUS"
else
    test_failed "Backend não está saudável: $STATUS"
fi

# ==========================================
# TESTE 2: Autenticação
# ==========================================
run_test "Sistema de Autenticação (Login)"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    print_error "Resposta do login: $LOGIN_RESPONSE"
    test_failed "Falha ao obter token de autenticação"
fi

test_passed "Login bem-sucedido, token obtido"

# ==========================================
# TESTE 3: API de Inventários
# ==========================================
run_test "API de Inventários (Listagem)"
INVENTORIES_RESPONSE=$(curl -s -f "${API_BASE_URL}/api/v1/inventories" \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null) || {
    test_failed "Erro ao acessar API de inventários"
}

test_passed "API de inventários respondendo corretamente"

# ==========================================
# TESTE 4: API de Produtos
# ==========================================
run_test "API de Produtos (Listagem)"
PRODUCTS_RESPONSE=$(curl -s -f "${API_BASE_URL}/api/v1/products?page=1&limit=10" \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null) || {
    test_failed "Erro ao acessar API de produtos"
}

test_passed "API de produtos respondendo corretamente"

# ==========================================
# TESTE 5: Contrato de API - Campos Críticos
# ==========================================
run_test "Validação de Contrato de API (Campos Críticos)"

# Buscar primeiro inventário com listas
FIRST_INVENTORY=$(echo "$INVENTORIES_RESPONSE" | jq -r '.data[0].id // empty' 2>/dev/null)

if [ -n "$FIRST_INVENTORY" ]; then
    # Buscar listas de contagem
    LISTS_RESPONSE=$(curl -s "${API_BASE_URL}/api/v1/counting-lists?inventory_id=${FIRST_INVENTORY}" \
        -H "Authorization: Bearer ${TOKEN}" 2>/dev/null)

    FIRST_LIST=$(echo "$LISTS_RESPONSE" | jq -r '.data[0].id // empty' 2>/dev/null)

    if [ -n "$FIRST_LIST" ]; then
        # Buscar produtos da lista
        PRODUCTS_LIST_RESPONSE=$(curl -s "${API_BASE_URL}/api/v1/counting-lists/${FIRST_LIST}/products" \
            -H "Authorization: Bearer ${TOKEN}" 2>/dev/null)

        # Verificar se tem produtos
        PRODUCT_COUNT=$(echo "$PRODUCTS_LIST_RESPONSE" | jq -r '.data.items | length' 2>/dev/null)

        if [ "$PRODUCT_COUNT" -gt 0 ]; then
            # Validar campos críticos
            FIRST_PRODUCT=$(echo "$PRODUCTS_LIST_RESPONSE" | jq -r '.data.items[0]' 2>/dev/null)

            # Campos obrigatórios
            HAS_PRODUCT_DESC=$(echo "$FIRST_PRODUCT" | jq -e '.product_description' > /dev/null 2>&1 && echo "yes" || echo "no")
            HAS_COUNT_1=$(echo "$FIRST_PRODUCT" | jq -e '.count_1' > /dev/null 2>&1 && echo "yes" || echo "no")
            HAS_WAREHOUSE=$(echo "$FIRST_PRODUCT" | jq -e '.warehouse' > /dev/null 2>&1 && echo "yes" || echo "no")
            HAS_SYSTEM_QTY=$(echo "$FIRST_PRODUCT" | jq -e '.system_qty' > /dev/null 2>&1 && echo "yes" || echo "no")

            if [ "$HAS_PRODUCT_DESC" == "no" ]; then
                test_failed "Campo 'product_description' não encontrado na API!"
            fi

            if [ "$HAS_COUNT_1" == "no" ]; then
                test_failed "Campo 'count_1' não encontrado na API!"
            fi

            if [ "$HAS_WAREHOUSE" == "no" ]; then
                test_failed "Campo 'warehouse' não encontrado na API!"
            fi

            if [ "$HAS_SYSTEM_QTY" == "no" ]; then
                test_failed "Campo 'system_qty' não encontrado na API!"
            fi

            test_passed "Todos os campos críticos presentes na API"
        else
            print_warning "Nenhum produto encontrado para validar campos (skipping)"
            test_passed "API respondeu corretamente (sem produtos para validar)"
        fi
    else
        print_warning "Nenhuma lista de contagem encontrada (skipping validação de campos)"
        test_passed "API de listas respondeu corretamente"
    fi
else
    print_warning "Nenhum inventário encontrado (skipping validação de campos)"
    test_passed "API de inventários respondeu corretamente"
fi

# ==========================================
# TESTE 6: Frontend Acessível
# ==========================================
run_test "Frontend Acessível"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/" 2>/dev/null)

if [ "$FRONTEND_STATUS" == "200" ]; then
    test_passed "Frontend acessível em ${FRONTEND_URL}"
else
    test_failed "Frontend não acessível (HTTP $FRONTEND_STATUS)"
fi

# ==========================================
# TESTE 7: Documentação da API
# ==========================================
run_test "Documentação da API (Swagger)"
DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/docs" 2>/dev/null)

if [ "$DOCS_STATUS" == "200" ]; then
    test_passed "Documentação da API acessível"
else
    print_warning "Documentação da API não acessível (HTTP $DOCS_STATUS)"
    test_passed "Teste passou com warning"
fi

# ==========================================
# RESUMO FINAL
# ==========================================
echo ""
echo "=========================================="
echo "📊 RESUMO DOS TESTES"
echo "=========================================="
echo -e "${BLUE}Total de testes:${NC} $TESTS_RUN"
echo -e "${GREEN}Testes passados:${NC} $TESTS_PASSED"
echo -e "${RED}Testes falhados:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
    echo -e "${GREEN}Sistema está funcionando corretamente.${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ ALGUNS TESTES FALHARAM!${NC}"
    echo -e "${RED}NÃO COMMITAR até resolver os problemas.${NC}"
    echo ""
    exit 1
fi
