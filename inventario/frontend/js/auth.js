/**
 * Auth.js - Funções de Autenticação
 * Sistema de Inventário Protheus v2.19.13
 *
 * Funções consolidadas de autenticação usadas em múltiplas páginas.
 * Elimina duplicação de código e centraliza lógica de auth.
 */

// =================================
// CONSTANTES
// =================================

const AUTH_TOKEN_KEY = 'access_token';
const TOKEN_TYPE_KEY = 'token_type';
const LOGIN_TIME_KEY = 'login_time';
const USER_DATA_KEY = 'user_data';
const LOGIN_PAGE = '/static/login.html';

// =================================
// FUNÇÕES DE AUTENTICAÇÃO
// =================================

/**
 * Verifica se o usuário está autenticado.
 * Redireciona para login se não estiver.
 *
 * @param {object} options - Opções de configuração
 * @param {boolean} options.redirect - Se deve redirecionar (default: true)
 * @param {function} options.onAuthenticated - Callback quando autenticado
 * @returns {boolean} Se está autenticado
 */
function checkAuthentication(options = {}) {
    const { redirect = true, onAuthenticated = null } = options;

    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!authToken) {
        if (redirect) {
            window.location.href = LOGIN_PAGE;
        }
        return false;
    }

    // Token existe, verificar dados do usuário
    const userDataStr = localStorage.getItem(USER_DATA_KEY);
    if (userDataStr) {
        try {
            const userData = JSON.parse(userDataStr);
            const userRole = userData.role || 'OPERATOR';

            console.log(`🔐 Autenticado: ${userData.username} (${userRole})`);

            // Aplicar controle de acesso ao menu se a função existir
            if (typeof applyMenuAccessControl === 'function') {
                applyMenuAccessControl(userRole);
            }

            if (onAuthenticated) {
                onAuthenticated(userData);
            }
        } catch (e) {
            console.error('Erro ao parsear user_data:', e);
        }
    }

    return true;
}

/**
 * Alias para checkAuthentication (compatibilidade).
 */
function checkAuth() {
    return checkAuthentication();
}

/**
 * Efetua logout do usuário.
 * Limpa tokens e redireciona para login.
 *
 * @param {string} redirectUrl - URL para redirecionar (default: login)
 */
function logout(redirectUrl = LOGIN_PAGE) {
    // Limpar dados de autenticação
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_TYPE_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
    localStorage.removeItem(USER_DATA_KEY);

    // Limpar dados adicionais de sessão
    localStorage.removeItem('user_role');
    localStorage.removeItem('store_id');
    localStorage.removeItem('store_name');

    console.log('👋 Logout realizado');

    // Redirecionar
    window.location.href = redirectUrl;
}

/**
 * Retorna headers de autenticação para requisições API.
 *
 * @returns {object} Headers com Authorization
 */
function getAuthHeaders() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!token) {
        return {
            'Content-Type': 'application/json'
        };
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Obtém token de autenticação.
 *
 * @returns {string|null} Token ou null
 */
function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Obtém dados do usuário logado.
 *
 * @returns {object|null} Dados do usuário ou null
 */
function getCurrentUser() {
    try {
        const userDataStr = localStorage.getItem(USER_DATA_KEY);
        return userDataStr ? JSON.parse(userDataStr) : null;
    } catch (e) {
        console.error('Erro ao obter dados do usuário:', e);
        return null;
    }
}

/**
 * Obtém role do usuário atual.
 *
 * @returns {string} Role do usuário (ADMIN, SUPERVISOR, OPERATOR)
 */
function getCurrentUserRole() {
    const userData = getCurrentUser();
    return userData?.role || localStorage.getItem('user_role') || 'OPERATOR';
}

/**
 * Verifica se o usuário tem determinada role.
 *
 * @param {string|string[]} roles - Role(s) para verificar
 * @returns {boolean} Se o usuário tem a role
 */
function hasRole(roles) {
    const userRole = getCurrentUserRole();
    if (Array.isArray(roles)) {
        return roles.includes(userRole);
    }
    return userRole === roles;
}

/**
 * Verifica se o usuário é admin.
 *
 * @returns {boolean} Se é admin
 */
function isAdmin() {
    return hasRole('ADMIN');
}

/**
 * Verifica se o usuário é supervisor ou admin.
 *
 * @returns {boolean} Se é supervisor ou admin
 */
function isSupervisorOrAbove() {
    return hasRole(['ADMIN', 'SUPERVISOR']);
}

// =================================
// FUNÇÕES DE LOJA/FILIAL
// =================================

/**
 * Carrega informações da loja/filial atual no header.
 * Busca do localStorage e exibe no elemento com ID 'storeName' ou 'storeInfo'.
 *
 * @returns {Promise<object|null>} Dados da loja ou null
 */
async function loadCurrentStoreInfo() {
    console.log('🏢 Carregando info da loja...');

    try {
        // Tentar obter do user_data primeiro
        const userData = getCurrentUser();
        let storeName = userData?.store_name;
        let storeId = userData?.store_id;

        // Se não tiver, tentar do localStorage direto
        if (!storeName) {
            storeName = localStorage.getItem('store_name');
            storeId = localStorage.getItem('store_id');
        }

        // Se ainda não tiver, buscar da API
        if (!storeName && storeId) {
            try {
                const response = await fetch(`/api/v1/stores/${storeId}`, {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    storeName = data.data?.name || data.name;
                }
            } catch (e) {
                console.warn('Não foi possível buscar loja da API:', e);
            }
        }

        // Atualizar elementos do DOM
        const storeNameEl = document.getElementById('storeName');
        const storeInfoEl = document.getElementById('storeInfo');

        if (storeName) {
            if (storeNameEl) storeNameEl.textContent = storeName;
            if (storeInfoEl) storeInfoEl.textContent = storeName;
            console.log(`✅ Loja: ${storeName}`);
        } else {
            if (storeNameEl) storeNameEl.textContent = 'Todas as Lojas';
            if (storeInfoEl) storeInfoEl.textContent = 'Admin';
        }

        return { store_id: storeId, store_name: storeName };

    } catch (e) {
        console.error('Erro ao carregar info da loja:', e);
        return null;
    }
}

/**
 * Carrega informações do usuário no header.
 * Exibe nome do usuário no elemento com ID 'userName' ou 'userInfo'.
 */
function loadUserInfo() {
    const userData = getCurrentUser();

    if (userData) {
        const userNameEl = document.getElementById('userName');
        const userInfoEl = document.getElementById('userInfo');
        const userRoleEl = document.getElementById('userRole');

        if (userNameEl) userNameEl.textContent = userData.full_name || userData.username;
        if (userInfoEl) userInfoEl.textContent = userData.full_name || userData.username;
        if (userRoleEl) userRoleEl.textContent = userData.role;
    }
}

// =================================
// CONTROLE DE ACESSO AO MENU
// =================================

/**
 * Aplica controle de acesso ao menu baseado na role do usuário.
 * Esconde itens de menu que o usuário não tem permissão.
 *
 * @param {string} userRole - Role do usuário
 */
function applyMenuAccessControl(userRole) {
    // Menu items e suas permissões mínimas
    const menuPermissions = {
        'menu-inventarios': ['OPERATOR', 'SUPERVISOR', 'ADMIN'],
        'menu-produtos': ['SUPERVISOR', 'ADMIN'],
        'menu-relatorios': ['SUPERVISOR', 'ADMIN'],
        'menu-usuarios': ['ADMIN'],
        'menu-lojas': ['ADMIN'],
        'menu-configuracoes': ['ADMIN'],
        'menu-importacao': ['ADMIN'],
        'menu-integracao': ['ADMIN']
    };

    // Hierarquia de roles
    const roleHierarchy = {
        'OPERATOR': 1,
        'SUPERVISOR': 2,
        'ADMIN': 3
    };

    const userLevel = roleHierarchy[userRole] || 1;

    // Aplicar visibilidade
    Object.entries(menuPermissions).forEach(([menuId, allowedRoles]) => {
        const menuItem = document.getElementById(menuId);
        if (menuItem) {
            const minLevel = Math.min(...allowedRoles.map(r => roleHierarchy[r] || 1));
            if (userLevel < minLevel) {
                menuItem.style.display = 'none';
            }
        }
    });
}

// =================================
// INICIALIZAÇÃO
// =================================

/**
 * Inicializa autenticação na página.
 * Verifica auth, carrega info do usuário e loja.
 *
 * @param {object} options - Opções
 * @param {boolean} options.requireAuth - Se requer autenticação (default: true)
 * @param {boolean} options.loadStore - Se deve carregar info da loja (default: true)
 * @returns {Promise<boolean>} Se inicializou com sucesso
 */
async function initAuth(options = {}) {
    const { requireAuth = true, loadStore = true } = options;

    if (requireAuth && !checkAuthentication()) {
        return false;
    }

    // Carregar informações
    loadUserInfo();

    if (loadStore) {
        await loadCurrentStoreInfo();
    }

    return true;
}

// =================================
// EXPORTAR PARA USO GLOBAL
// =================================

window.checkAuthentication = checkAuthentication;
window.checkAuth = checkAuth;
window.logout = logout;
window.getAuthHeaders = getAuthHeaders;
window.getAuthToken = getAuthToken;
window.getCurrentUser = getCurrentUser;
window.getCurrentUserRole = getCurrentUserRole;
window.hasRole = hasRole;
window.isAdmin = isAdmin;
window.isSupervisorOrAbove = isSupervisorOrAbove;
window.loadCurrentStoreInfo = loadCurrentStoreInfo;
window.loadUserInfo = loadUserInfo;
window.applyMenuAccessControl = applyMenuAccessControl;
window.initAuth = initAuth;

console.log('✅ Auth.js carregado - Sistema de Inventário Protheus v2.19.13');
