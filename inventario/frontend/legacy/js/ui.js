/**
 * UI.js - Funções de Interface do Usuário
 * Sistema de Inventário Protheus v2.19.13
 *
 * Funções consolidadas de UI usadas em múltiplas páginas:
 * - Alertas e notificações
 * - Badges e status
 * - Formatação de dados
 * - Modais e loading
 */

// =================================
// ALERTAS E NOTIFICAÇÕES
// =================================

/**
 * Exibe alerta visual no topo da página.
 *
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo: success, danger, warning, info (default: info)
 * @param {number} duration - Duração em ms (default: 5000)
 */
function showAlert(message, type = 'info', duration = 5000) {
    // Criar elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px; max-width: 500px;';
    alertDiv.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto-remover após tempo especificado
    if (duration > 0) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.classList.remove('show');
                setTimeout(() => alertDiv.remove(), 150);
            }
        }, duration);
    }

    return alertDiv;
}

/**
 * Exibe mensagem de sucesso.
 */
function showSuccess(message, duration = 5000) {
    return showAlert(message, 'success', duration);
}

/**
 * Exibe mensagem de erro.
 */
function showError(message, duration = 7000) {
    return showAlert(message, 'danger', duration);
}

/**
 * Exibe mensagem de aviso.
 */
function showWarning(message, duration = 6000) {
    return showAlert(message, 'warning', duration);
}

/**
 * Exibe mensagem informativa.
 */
function showInfo(message, duration = 5000) {
    return showAlert(message, 'info', duration);
}

// =================================
// BADGES E STATUS
// =================================

/**
 * Retorna classe CSS para status de inventário.
 *
 * @param {string} status - Status do inventário
 * @returns {string} Classe CSS Bootstrap
 */
function getStatusClass(status) {
    // Mapeamento de status para cores
    const statusMap = {
        // Finalizados (verde)
        'COMPLETED': 'bg-success',
        'FINALIZADO': 'bg-success',
        'CLOSED': 'bg-success',
        'ENCERRADO': 'bg-success',

        // Em andamento (azul)
        'IN_PROGRESS': 'bg-primary',
        'EM_ANDAMENTO': 'bg-primary',
        'ACTIVE': 'bg-primary',

        // Rascunho/Preparação (cinza)
        'DRAFT': 'bg-secondary',
        'PREPARACAO': 'bg-secondary',

        // Alerta (amarelo)
        'PENDING': 'bg-warning',
        'PENDENTE': 'bg-warning',

        // Erro (vermelho)
        'ERROR': 'bg-danger',
        'ERRO': 'bg-danger',
        'CANCELLED': 'bg-danger'
    };

    return statusMap[status?.toUpperCase()] || 'bg-primary';
}

/**
 * Retorna classe CSS para badge de status de produto.
 *
 * @param {string} status - Status do produto
 * @returns {string} Classe CSS
 */
function getStatusBadgeClass(status) {
    const statusMap = {
        'awaiting_count': 'badge-awaiting-count',
        'awaiting_release': 'badge-awaiting-release',
        'recount_pending': 'badge-recount-pending',
        'final_count_pending': 'badge-final-count-pending',
        'counted': 'badge-counted',
        'pending': 'badge-pending',
        'divergent': 'badge-divergent',
        'ok': 'badge-ok'
    };

    return statusMap[status] || 'bg-secondary';
}

/**
 * Retorna texto traduzido para status.
 *
 * @param {string} status - Status
 * @returns {string} Texto traduzido
 */
function getStatusText(status) {
    const statusText = {
        'DRAFT': 'Rascunho',
        'PREPARACAO': 'Em Preparação',
        'IN_PROGRESS': 'Em Andamento',
        'EM_ANDAMENTO': 'Em Andamento',
        'COMPLETED': 'Finalizado',
        'FINALIZADO': 'Finalizado',
        'CLOSED': 'Encerrado',
        'ENCERRADO': 'Encerrado',
        'PENDING': 'Pendente',
        'PENDENTE': 'Pendente',
        'ACTIVE': 'Ativo',
        'CANCELLED': 'Cancelado'
    };

    return statusText[status?.toUpperCase()] || status;
}

/**
 * Cria badge HTML para status.
 *
 * @param {string} status - Status
 * @param {string} text - Texto opcional (default: status traduzido)
 * @returns {string} HTML do badge
 */
function createStatusBadge(status, text = null) {
    const className = getStatusClass(status);
    const displayText = text || getStatusText(status);
    return `<span class="badge ${escapeHtml(className)}">${escapeHtml(displayText)}</span>`;
}

// =================================
// FORMATAÇÃO DE DADOS
// =================================

/**
 * Formata data para exibição.
 *
 * @param {string|Date} dateStr - Data a formatar
 * @param {boolean} includeTime - Incluir hora (default: false)
 * @returns {string} Data formatada
 */
function formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '-';

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };

        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return date.toLocaleString('pt-BR', options);
    } catch (e) {
        return '-';
    }
}

/**
 * Formata data e hora.
 */
function formatDateTime(dateStr) {
    return formatDate(dateStr, true);
}

/**
 * Formata valor monetário.
 *
 * @param {number} value - Valor
 * @returns {string} Valor formatado (R$ X.XXX,XX)
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'R$ 0,00';
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Formata número com separadores de milhar.
 *
 * @param {number} value - Número
 * @param {number} decimals - Casas decimais (default: 0)
 * @returns {string} Número formatado
 */
function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Formata quantidade (com 2 casas decimais se necessário).
 *
 * @param {number} value - Quantidade
 * @returns {string} Quantidade formatada
 */
function formatQuantity(value) {
    if (value === null || value === undefined) return '-';

    const num = parseFloat(value);
    if (isNaN(num)) return '-';

    // Se for inteiro, não mostrar decimais
    if (Number.isInteger(num)) {
        return formatNumber(num, 0);
    }

    return formatNumber(num, 2);
}

/**
 * Formata exibição de lote (lotectl e lotefor).
 *
 * @param {string} lotectl - Lote de controle
 * @param {string} lotefor - Lote do fornecedor
 * @returns {string} Lote formatado
 */
function formatLoteDisplay(lotectl, lotefor) {
    const hasLotectl = lotectl && lotectl.trim() !== '' && lotectl !== 'null';
    const hasLotefor = lotefor && lotefor.trim() !== '' && lotefor !== 'null';

    if (hasLotectl && hasLotefor) {
        return `${lotectl} | ${lotefor}`;
    } else if (hasLotectl) {
        return lotectl;
    } else if (hasLotefor) {
        return `${lotefor} (Forn.)`;
    } else {
        return '-';
    }
}

/**
 * Formata porcentagem.
 *
 * @param {number} value - Valor (0-100 ou 0-1)
 * @param {number} decimals - Casas decimais
 * @returns {string} Porcentagem formatada
 */
function formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0%';
    }

    // Se valor > 1, assumir que já está em porcentagem
    const pct = value > 1 ? value : value * 100;

    return `${formatNumber(pct, decimals)}%`;
}

// =================================
// LOADING E MODAIS
// =================================

/**
 * Mostra indicador de carregamento.
 *
 * @param {string} message - Mensagem (default: 'Carregando...')
 * @returns {HTMLElement} Elemento de loading
 */
function showLoading(message = 'Carregando...') {
    // Remover loading existente
    hideLoading();

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'global-loading';
    loadingDiv.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center';
    loadingDiv.style.cssText = 'background: rgba(0,0,0,0.5); z-index: 9999;';
    loadingDiv.innerHTML = `
        <div class="bg-white p-4 rounded shadow text-center">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <div class="text-dark">${escapeHtml(message)}</div>
        </div>
    `;

    document.body.appendChild(loadingDiv);
    return loadingDiv;
}

/**
 * Esconde indicador de carregamento.
 */
function hideLoading() {
    const loading = document.getElementById('global-loading');
    if (loading) {
        loading.remove();
    }
}

/**
 * Mostra modal de confirmação.
 *
 * @param {object} options - Opções do modal
 * @param {string} options.title - Título
 * @param {string} options.message - Mensagem
 * @param {string} options.confirmText - Texto do botão confirmar
 * @param {string} options.cancelText - Texto do botão cancelar
 * @param {string} options.confirmClass - Classe do botão confirmar
 * @returns {Promise<boolean>} Se confirmou
 */
function showConfirm(options = {}) {
    const {
        title = 'Confirmação',
        message = 'Tem certeza?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        confirmClass = 'btn-primary'
    } = options;

    return new Promise((resolve) => {
        const modalId = 'confirm-modal-' + Date.now();

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${escapeHtml(title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${escapeHtml(message)}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${escapeHtml(cancelText)}</button>
                            <button type="button" class="btn ${escapeHtml(confirmClass)}" id="${modalId}-confirm">${escapeHtml(confirmText)}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalEl);

        // Evento de confirmação
        document.getElementById(`${modalId}-confirm`).addEventListener('click', () => {
            modal.hide();
            resolve(true);
        });

        // Evento de cancelamento
        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
            resolve(false);
        });

        modal.show();
    });
}

// =================================
// UTILITÁRIOS DE DOM
// =================================

// escapeHtml() é fornecido por security.js (carregado antes).
// Fallback caso security.js não esteja disponível.
if (typeof escapeHtml !== 'function') {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    window.escapeHtml = escapeHtml;
}

/**
 * Habilita/desabilita botão com loading.
 *
 * @param {HTMLElement|string} button - Botão ou ID
 * @param {boolean} loading - Se está carregando
 * @param {string} loadingText - Texto durante loading
 */
function setButtonLoading(button, loading, loadingText = 'Aguarde...') {
    const btn = typeof button === 'string' ? document.getElementById(button) : button;

    if (!btn) return;

    if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${loadingText}`;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
}

// =================================
// EXPORTAR PARA USO GLOBAL
// =================================

window.showAlert = showAlert;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.getStatusClass = getStatusClass;
window.getStatusBadgeClass = getStatusBadgeClass;
window.getStatusText = getStatusText;
window.createStatusBadge = createStatusBadge;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;
window.formatNumber = formatNumber;
window.formatQuantity = formatQuantity;
window.formatLoteDisplay = formatLoteDisplay;
window.formatPercentage = formatPercentage;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showConfirm = showConfirm;
window.escapeHtml = escapeHtml;
window.setButtonLoading = setButtonLoading;

console.log('✅ UI.js carregado - Sistema de Inventário Protheus v2.19.13');
