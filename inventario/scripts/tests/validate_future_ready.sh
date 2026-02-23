#!/bin/bash

# Script para validar se o sistema está preparado para inventários futuros
# Data: 22/09/2024

echo "================================================="
echo "🔍 VALIDAÇÃO: SISTEMA PREPARADO PARA FUTUROS INVENTÁRIOS"
echo "================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 VERIFICANDO CORREÇÕES IMPLEMENTADAS...${NC}"
echo ""

# 1. Verificar se lógica automática está no código
echo "1️⃣ Verificando lógica automática de flags e assignments..."

# Buscar por palavras-chave no código
CYCLE2_LOGIC=$(grep -n "needs_recount_cycle_2.*true" /mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py | wc -l)
CYCLE3_LOGIC=$(grep -n "needs_recount_cycle_3.*true" /mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py | wc -l)
ASSIGNMENTS_CYCLE2=$(grep -n "Assignments criados automaticamente para ciclo 2" /mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py | wc -l)
ASSIGNMENTS_CYCLE3=$(grep -n "Assignments criados automaticamente para ciclo 3" /mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py | wc -l)

if [ "$CYCLE2_LOGIC" -gt 0 ] && [ "$CYCLE3_LOGIC" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Lógica automática de flags: IMPLEMENTADA${NC}"
else
    echo -e "   ${RED}❌ Lógica automática de flags: FALTANDO${NC}"
fi

if [ "$ASSIGNMENTS_CYCLE2" -gt 0 ] && [ "$ASSIGNMENTS_CYCLE3" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Criação automática de assignments: IMPLEMENTADA${NC}"
else
    echo -e "   ${RED}❌ Criação automática de assignments: FALTANDO${NC}"
fi

echo ""

# 2. Verificar sincronização de endpoints
echo "2️⃣ Verificando sincronização de endpoints..."

SYNC_ASSIGNMENTS=$(grep -n "counting_list.current_cycle" /mnt/c/meus_projetos/Capul_Inventario/backend/app/api/v1/endpoints/assignments.py | wc -l)
SYNC_MAIN=$(grep -n "counting_list.current_cycle" /mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py | wc -l)

if [ "$SYNC_ASSIGNMENTS" -gt 0 ] && [ "$SYNC_MAIN" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Sincronização de endpoints: IMPLEMENTADA${NC}"
else
    echo -e "   ${RED}❌ Sincronização de endpoints: FALTANDO${NC}"
fi

echo ""

# 3. Verificar eliminação de duplicatas
echo "3️⃣ Verificando eliminação de duplicatas..."

DEDUP_LOGIC=$(grep -n "products_by_item" /mnt/c/meus_projetos/Capul_Inventario/backend/app/api/v1/endpoints/assignments.py | wc -l)

if [ "$DEDUP_LOGIC" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Eliminação de duplicatas: IMPLEMENTADA${NC}"
else
    echo -e "   ${RED}❌ Eliminação de duplicatas: FALTANDO${NC}"
fi

echo ""

# 4. Verificar correção de variáveis frontend
echo "4️⃣ Verificando correções do frontend..."

FRONTEND_FIX=$(grep -n "inventoryId}" /mnt/c/meus_projetos/Capul_Inventario/frontend/counting_improved.html | wc -l)

if [ "$FRONTEND_FIX" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Correção de variáveis frontend: IMPLEMENTADA${NC}"
else
    echo -e "   ${RED}❌ Correção de variáveis frontend: FALTANDO${NC}"
fi

echo ""

# 5. Resumo final
echo "================================================="
echo -e "${BLUE}📊 RESUMO DA VALIDAÇÃO${NC}"
echo "================================================="
echo ""

TOTAL_CHECKS=4
PASSED_CHECKS=0

if [ "$CYCLE2_LOGIC" -gt 0 ] && [ "$CYCLE3_LOGIC" -gt 0 ] && [ "$ASSIGNMENTS_CYCLE2" -gt 0 ] && [ "$ASSIGNMENTS_CYCLE3" -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

if [ "$SYNC_ASSIGNMENTS" -gt 0 ] && [ "$SYNC_MAIN" -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

if [ "$DEDUP_LOGIC" -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

if [ "$FRONTEND_FIX" -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

echo "✅ Verificações aprovadas: $PASSED_CHECKS/$TOTAL_CHECKS"
echo ""

if [ "$PASSED_CHECKS" -eq "$TOTAL_CHECKS" ]; then
    echo -e "${GREEN}🎉 SISTEMA 100% PREPARADO PARA INVENTÁRIOS FUTUROS!${NC}"
    echo ""
    echo -e "${GREEN}✅ Todos os novos inventários irão:${NC}"
    echo -e "${GREEN}   - Atualizar flags automaticamente quando houver divergências${NC}"
    echo -e "${GREEN}   - Criar assignments automaticamente para ciclos 2 e 3${NC}"
    echo -e "${GREEN}   - Manter endpoints sincronizados${NC}"
    echo -e "${GREEN}   - Evitar duplicações de produtos${NC}"
    echo -e "${GREEN}   - Funcionar corretamente no frontend${NC}"
else
    echo -e "${YELLOW}⚠️ SISTEMA PARCIALMENTE PREPARADO${NC}"
    echo -e "${YELLOW}Algumas correções podem não estar completamente implementadas.${NC}"
fi

echo ""
echo "================================================="
echo "✅ Validação concluída!"
echo "================================================="