/**
 * ========================================
 * CONTROLE DE ACESSO BASEADO EM ROLES (RBAC)
 * Sistema de Inventário Protheus v2.9
 * ========================================
 *
 * Este módulo implementa controle de acesso baseado em perfis de usuário.
 *
 * REGRAS DE ACESSO:
 * - OPERADOR (OPERATOR): Acesso SOMENTE ao menu "Contagem" (counting_improved.html)
 * - SUPERVISOR: Acesso a TODOS os menus administrativos
 * - ADMIN: Acesso COMPLETO a todos os menus
 *
 * @version 2.9
 * @date 12/10/2025
 */

// ========================================
// DEFINIÇÃO DE REGRAS DE ACESSO
// ========================================

const ACCESS_RULES = {
    // Mapeamento de perfis para páginas permitidas
    pageAccess: {
        'OPERATOR': ['counting_improved.html', 'counting_mobile.html'],  // ✅ OPERADOR: Contagem Desktop e Mobile (v2.11.0)
        'SUPERVISOR': ['dashboard.html', 'products.html', 'inventory.html', 'counting_improved.html', 'counting_mobile.html', 'users.html', 'stores.html', 'reports.html'],  // ✅ SUPERVISOR: Tudo
        'ADMIN': ['dashboard.html', 'products.html', 'inventory.html', 'counting_improved.html', 'counting_mobile.html', 'users.html', 'stores.html', 'reports.html']  // ✅ ADMIN: Tudo
    },

    // Mapeamento de perfis para menus permitidos (IDs dos elementos)
    menuAccess: {
        'OPERATOR': ['menuCounting'],
        'SUPERVISOR': ['menuDashboard', 'menuProducts', 'menuInventory', 'menuCounting', 'menuUsers', 'menuStores', 'menuReports'],
        'ADMIN': ['menuDashboard', 'menuProducts', 'menuInventory', 'menuCounting', 'menuUsers', 'menuStores', 'menuReports']
    },

    // Lista completa de todos os menus (para ocultar os não permitidos)
    allMenus: ['menuDashboard', 'menuProducts', 'menuInventory', 'menuCounting', 'menuUsers', 'menuStores', 'menuReports'],

    // Página padrão para redirecionamento por perfil
    defaultPage: {
        'OPERATOR': 'counting_improved.html',
        'SUPERVISOR': 'dashboard.html',
        'ADMIN': 'dashboard.html'
    }
};

// ========================================
// FUNÇÕES DE CONTROLE DE ACESSO
// ========================================

/**
 * Obtém o role do usuário atual
 * @returns {string} Role do usuário (OPERATOR, SUPERVISOR, ADMIN)
 */
function getUserRole() {
    try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            return userData.role || 'OPERATOR';
        }

        // Fallback: verificar role direto no localStorage
        return localStorage.getItem('user_role') || 'OPERATOR';
    } catch (error) {
        console.error('❌ Erro ao obter role do usuário:', error);
        return 'OPERATOR';  // Default seguro
    }
}

/**
 * Verifica se o usuário tem acesso à página atual
 * @param {string} userRole - Role do usuário
 * @returns {boolean} true se tem acesso, false caso contrário
 */
function hasPageAccess(userRole) {
    const currentPage = window.location.pathname.split('/').pop();
    const allowedPages = ACCESS_RULES.pageAccess[userRole] || ACCESS_RULES.pageAccess['OPERATOR'];

    const hasAccess = allowedPages.includes(currentPage);

    console.log(`🔐 Verificação de acesso à página:`);
    console.log(`   - Página: ${currentPage}`);
    console.log(`   - Role: ${userRole}`);
    console.log(`   - Permitidas: ${allowedPages.join(', ')}`);
    console.log(`   - Resultado: ${hasAccess ? '✅ PERMITIDO' : '🚫 NEGADO'}`);

    return hasAccess;
}

/**
 * Aplica controle de acesso aos menus da navegação
 * @param {string} userRole - Role do usuário
 */
function applyMenuAccessControl(userRole) {
    console.log(`🔐 Aplicando controle de acesso ao menu para role: ${userRole}`);

    const allowedMenus = ACCESS_RULES.menuAccess[userRole] || ACCESS_RULES.menuAccess['OPERATOR'];

    console.log(`✅ Menus permitidos:`, allowedMenus);

    // Aplicar visibilidade aos menus
    ACCESS_RULES.allMenus.forEach(menuId => {
        const menuElement = document.getElementById(menuId);
        if (menuElement) {
            if (allowedMenus.includes(menuId)) {
                menuElement.style.display = 'block';
                console.log(`   ✅ Menu ${menuId} → VISÍVEL`);
            } else {
                menuElement.style.display = 'none';
                console.log(`   🚫 Menu ${menuId} → OCULTO`);
            }
        }
    });
}

/**
 * Redireciona usuário para página padrão do seu perfil
 * @param {string} userRole - Role do usuário
 * @param {string} reason - Motivo do redirecionamento
 */
function redirectToDefaultPage(userRole, reason = 'Acesso negado') {
    const defaultPage = ACCESS_RULES.defaultPage[userRole] || 'counting_improved.html';

    console.warn(`⚠️ Redirecionamento: ${reason}`);
    console.warn(`   → Destino: ${defaultPage}`);

    // Mostrar alerta se a função showAlert existir
    if (typeof showAlert === 'function') {
        showAlert(`Você não tem permissão para acessar esta página. Redirecionando...`, 'warning', 2000);
    } else {
        alert('Você não tem permissão para acessar esta página.');
    }

    setTimeout(() => {
        window.location.href = defaultPage;
    }, 2000);
}

/**
 * Função principal de verificação de acesso
 * Deve ser chamada no DOMContentLoaded de cada página
 */
function checkAccess() {
    console.log('🔐 ========== VERIFICAÇÃO DE ACESSO ==========');

    // 1. Verificar autenticação
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.error('❌ Token não encontrado. Redirecionando para login...');
        window.location.href = 'login.html';
        return false;
    }

    // 2. Obter role do usuário
    const userRole = getUserRole();
    console.log(`👤 Usuário autenticado com role: ${userRole}`);

    // 3. Aplicar controle de acesso ao menu
    applyMenuAccessControl(userRole);

    // 4. Verificar se tem acesso à página atual
    if (!hasPageAccess(userRole)) {
        redirectToDefaultPage(userRole, `OPERADOR não pode acessar páginas administrativas`);
        return false;
    }

    console.log('✅ Acesso concedido à página');
    console.log('🔐 ============================================');

    return true;
}

/**
 * Função auxiliar para proteger uma página específica
 * Uso: protectPage(['ADMIN', 'SUPERVISOR']) no DOMContentLoaded
 *
 * @param {Array<string>} allowedRoles - Array de roles permitidos
 */
function protectPage(allowedRoles) {
    const userRole = getUserRole();

    if (!allowedRoles.includes(userRole)) {
        console.error(`🚫 Acesso negado! Role ${userRole} não está em [${allowedRoles.join(', ')}]`);
        redirectToDefaultPage(userRole, `Acesso restrito para perfil ${userRole}`);
        return false;
    }

    console.log(`✅ Acesso permitido para role ${userRole}`);
    return true;
}

// ========================================
// EXPORT (para uso modular)
// ========================================

// Tornar funções disponíveis globalmente
window.getUserRole = getUserRole;
window.hasPageAccess = hasPageAccess;
window.applyMenuAccessControl = applyMenuAccessControl;
window.redirectToDefaultPage = redirectToDefaultPage;
window.checkAccess = checkAccess;
window.protectPage = protectPage;
window.ACCESS_RULES = ACCESS_RULES;

console.log('✅ Módulo de controle de acesso carregado com sucesso!');
