/**
 * UTILIDADES GLOBAIS DO SISTEMA
 * v2.17.4 - Sistema de profissionalização
 *
 * Funcionalidades:
 * - Interceptor de sessão expirada (401)
 * - Mensagens de erro amigáveis
 * - Loading state global
 * - Confirmações de ações destrutivas
 */

// ==========================================
// 1. INTERCEPTOR GLOBAL DE SESSÃO EXPIRADA
// ==========================================

(function() {
    // Guardar referência original do fetch
    const originalFetch = window.fetch;

    // Sobrescrever fetch global
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch(...args);

            // Se sessão expirou (401), redirecionar para login
            if (response.status === 401) {
                // Limpar storage
                localStorage.clear();
                sessionStorage.clear();

                // Notificar usuário
                alert('⏱️ Sua sessão expirou. Redirecionando para login...');

                // Redirecionar
                window.location.href = '/login.html';

                // Retornar response vazio para evitar erros
                return new Response(null, { status: 401 });
            }

            return response;
        } catch (error) {
            console.error('Erro na requisição:', error);
            throw error;
        }
    };
})();

console.log('✅ Interceptor de sessão expirada carregado');

// ==========================================
// 2. MENSAGENS DE ERRO AMIGÁVEIS
// ==========================================

/**
 * Converte códigos de erro HTTP em mensagens amigáveis
 * @param {Object} error - Objeto de erro com propriedade 'status'
 * @returns {string} Mensagem amigável
 */
function getErrorMessage(error) {
    const errorCode = error?.status || error?.code || 500;

    const messages = {
        400: '❌ Dados inválidos. Por favor, verifique o preenchimento dos campos.',
        401: '🔒 Sessão expirada. Faça login novamente.',
        403: '⛔ Você não tem permissão para esta ação.',
        404: '🔍 Item não encontrado.',
        409: '⚠️ Este item já existe no sistema.',
        422: '📝 Dados incompletos. Verifique os campos obrigatórios.',
        500: '🔧 Erro no servidor. Tente novamente em alguns instantes.',
        502: '🌐 Serviço temporariamente indisponível.',
        503: '🔨 Sistema em manutenção. Tente novamente mais tarde.',
        504: '⏱️ Tempo de requisição esgotado. Tente novamente.'
    };

    return messages[errorCode] || '❌ Erro desconhecido. Contate o suporte técnico.';
}

/**
 * Exibe mensagem de erro de forma amigável
 * @param {Response} response - Resposta do fetch
 * @param {string} context - Contexto da operação (ex: "ao salvar contagem")
 */
async function showFriendlyError(response, context = '') {
    const errorMsg = getErrorMessage({ status: response.status });
    const fullMessage = context
        ? `${errorMsg}\n\nOperação: ${context}`
        : errorMsg;

    // Tentar extrair mensagem do backend
    try {
        const data = await response.json();
        if (data.detail) {
            console.error('Detalhe do erro:', data.detail);
        }
    } catch (e) {
        // Ignorar se não for JSON
    }

    alert(fullMessage);
}

console.log('✅ Sistema de mensagens amigáveis carregado');

// ==========================================
// 3. LOADING STATE GLOBAL
// ==========================================

/**
 * Exibe overlay de loading
 * @param {string} message - Mensagem a exibir (default: 'Processando...')
 */
function showLoading(message = 'Processando...') {
    let loader = document.getElementById('globalLoading');

    // Se não existe, criar
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoading';
        loader.innerHTML = `
            <div style="text-align: center; color: white;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-3" id="loadingMessage">Processando...</p>
            </div>
        `;
        loader.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(loader);
    }

    // Atualizar mensagem
    const messageEl = document.getElementById('loadingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }

    // Exibir
    loader.style.display = 'flex';
}

/**
 * Oculta overlay de loading
 */
function hideLoading() {
    const loader = document.getElementById('globalLoading');
    if (loader) {
        loader.style.display = 'none';
    }
}

console.log('✅ Sistema de loading global carregado');

// ==========================================
// 4. CONFIRMAÇÕES DE AÇÕES DESTRUTIVAS
// ==========================================

/**
 * Exibe confirmação para ações destrutivas
 * @param {string} action - Ação a ser realizada (ex: "deletar este inventário")
 * @param {string} warning - Aviso adicional (opcional)
 * @returns {boolean} True se confirmado, False se cancelado
 */
function confirmDestructiveAction(action, warning = '') {
    const warningText = warning ? `\n\n${warning}` : '';

    const confirmed = confirm(
        `⚠️ ATENÇÃO!\n\n` +
        `Você está prestes a ${action}.\n` +
        `Esta ação NÃO pode ser desfeita!${warningText}\n\n` +
        `Deseja realmente continuar?`
    );

    return confirmed;
}

/**
 * Wrapper para deletar com confirmação
 * @param {string} url - URL do endpoint DELETE
 * @param {string} itemName - Nome do item (ex: "inventário MED_01")
 * @param {Function} onSuccess - Callback de sucesso
 * @param {Object} options - Opções adicionais (headers, etc)
 */
async function deleteWithConfirmation(url, itemName, onSuccess, options = {}) {
    // Confirmar ação
    const confirmed = confirmDestructiveAction(
        `deletar ${itemName}`,
        'Todos os dados relacionados serão perdidos permanentemente.'
    );

    if (!confirmed) {
        return; // Cancelado pelo usuário
    }

    // Executar deleção
    showLoading(`Deletando ${itemName}...`);

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        hideLoading();

        if (response.ok) {
            alert(`✅ ${itemName} deletado com sucesso!`);
            if (onSuccess) onSuccess();
        } else {
            await showFriendlyError(response, `ao deletar ${itemName}`);
        }
    } catch (error) {
        hideLoading();
        console.error('Erro ao deletar:', error);
        alert(`❌ Erro ao deletar ${itemName}. Verifique sua conexão e tente novamente.`);
    }
}

console.log('✅ Sistema de confirmações destrutivas carregado');

// ==========================================
// 5. WRAPPER DE FETCH COM LOADING E ERROS
// ==========================================

/**
 * Fetch com loading automático e tratamento de erros
 * @param {string} url - URL do endpoint
 * @param {Object} options - Opções do fetch
 * @param {string} loadingMessage - Mensagem do loading
 * @param {string} errorContext - Contexto do erro
 * @returns {Promise} Response do fetch
 */
async function fetchWithLoading(url, options = {}, loadingMessage = 'Carregando...', errorContext = '') {
    showLoading(loadingMessage);

    try {
        const response = await fetch(url, options);
        hideLoading();

        if (!response.ok) {
            await showFriendlyError(response, errorContext);
            return null;
        }

        return response;
    } catch (error) {
        hideLoading();
        console.error('Erro na requisição:', error);
        alert('❌ Erro de conexão. Verifique sua internet e tente novamente.');
        return null;
    }
}

console.log('✅ Wrapper de fetch com loading carregado');

// ==========================================
// 6. VALIDAÇÕES DE FORMULÁRIO
// ==========================================

/**
 * Valida campo numérico (não aceita negativo nem texto)
 * @param {HTMLInputElement} input - Campo input
 * @param {number} min - Valor mínimo (default: 0)
 */
function validateNumericInput(input, min = 0) {
    const value = parseFloat(input.value);

    // Não pode ser negativo
    if (value < min) {
        input.value = min;
        input.classList.add('is-invalid');
        return false;
    }

    // Não pode ser texto
    if (isNaN(value)) {
        input.value = '';
        input.classList.add('is-invalid');
        return false;
    }

    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    return true;
}

/**
 * Marca campos obrigatórios vazios
 * @param {HTMLFormElement} form - Formulário a validar
 * @returns {boolean} True se válido, False se há campos vazios
 */
function validateRequiredFields(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });

    if (!isValid) {
        alert('📝 Por favor, preencha todos os campos obrigatórios marcados em vermelho.');
    }

    return isValid;
}

console.log('✅ Sistema de validação de formulários carregado');

// ==========================================
// EXPORTAR PARA WINDOW (GLOBAL)
// ==========================================

window.globalUtils = {
    getErrorMessage,
    showFriendlyError,
    showLoading,
    hideLoading,
    confirmDestructiveAction,
    deleteWithConfirmation,
    fetchWithLoading,
    validateNumericInput,
    validateRequiredFields
};

console.log('✅ Global Utils v2.17.4 carregado com sucesso!');
