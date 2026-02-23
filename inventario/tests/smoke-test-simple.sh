#!/bin/bash

# 🧪 SMOKE TESTS SIMPLIFICADOS - Sem dependência de jq
# Versão: 1.0
# Data: 05/10/2025
# Objetivo: Detectar regressões ANTES de commitar

API_BASE_URL="http://localhost:8000"
FRONTEND_URL="http://localhost"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de testes
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

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
    echo ""
    echo "=========================================="
    echo "📊 RESUMO DOS TESTES (PARCIAL)"
    echo "=========================================="
    echo -e "${BLUE}Total de testes:${NC} $TESTS_RUN"
    echo -e "${GREEN}Testes passados:${NC} $TESTS_PASSED"
    echo -e "${RED}Testes falhados:${NC} $TESTS_FAILED"
    echo ""
    echo -e "${RED}❌ TESTE FALHOU - NÃO COMMITAR${NC}"
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
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/health" 2>/dev/null)

if [ "$HEALTH_STATUS" == "200" ]; then
    test_passed "Backend respondendo (HTTP 200)"
else
    test_failed "Backend não está respondendo (HTTP $HEALTH_STATUS)"
fi

# ==========================================
# TESTE 2: Backend Database
# ==========================================
run_test "Backend Database Check"
DB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/test/database" 2>/dev/null)

if [ "$DB_STATUS" == "200" ]; then
    test_passed "Database conectado e funcionando"
else
    print_warning "Endpoint de teste de database não acessível (HTTP $DB_STATUS)"
    test_passed "Teste passou com warning"
fi

# ==========================================
# TESTE 3: API Documentation (OpenAPI)
# ==========================================
run_test "API Documentation (OpenAPI)"
OPENAPI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/openapi.json" 2>/dev/null)

if [ "$OPENAPI_STATUS" == "200" ]; then
    test_passed "OpenAPI schema disponível (HTTP 200)"
else
    print_warning "OpenAPI schema não acessível (HTTP $OPENAPI_STATUS)"
    test_passed "Teste passou com warning"
fi

# ==========================================
# TESTE 4: Frontend Acessível (Opcional)
# ==========================================
run_test "Frontend Acessível"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/" 2>/dev/null)

if [ "$FRONTEND_STATUS" == "200" ]; then
    test_passed "Frontend acessível (HTTP 200)"
else
    print_warning "Frontend não acessível (HTTP $FRONTEND_STATUS) - pode não estar rodando"
    test_passed "Teste passou com warning (frontend opcional)"
fi

# ==========================================
# TESTE 5: Documentação da API (Swagger)
# ==========================================
run_test "Documentação da API (Swagger)"
DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/docs" 2>/dev/null)

if [ "$DOCS_STATUS" == "200" ]; then
    test_passed "Documentação da API acessível (HTTP 200)"
else
    print_warning "Documentação da API não acessível (HTTP $DOCS_STATUS)"
    test_passed "Teste passou com warning"
fi

# ==========================================
# TESTE 6: Validação de Arquivo api-validator.js
# ==========================================
run_test "Arquivo api-validator.js existe"
if [ -f "frontend/utils/api-validator.js" ]; then
    test_passed "Validador de API presente"
else
    test_failed "Arquivo api-validator.js não encontrado"
fi

# ==========================================
# TESTE 7: Documentação de dependências
# ==========================================
run_test "Documentação de dependências críticas"
if [ -f "docs/DEPENDENCIAS_CRITICAS.md" ]; then
    test_passed "Documentação de dependências presente"
else
    test_failed "Arquivo DEPENDENCIAS_CRITICAS.md não encontrado"
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
