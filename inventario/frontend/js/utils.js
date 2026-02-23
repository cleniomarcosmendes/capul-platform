/**
 * Utils.js - Funções Utilitárias de Segurança
 * Sistema de Inventário Protheus v2.19.13
 *
 * Este arquivo contém funções para:
 * - Sanitização de HTML (prevenir XSS)
 * - Gerenciamento seguro de localStorage
 * - Gerenciamento de timers e event listeners (prevenir memory leaks)
 */

// =================================
// SANITIZAÇÃO HTML (Prevenir XSS)
// =================================

/**
 * Sanitiza uma string para uso seguro em HTML.
 * Converte caracteres especiais para entidades HTML.
 *
 * @param {string} str - String a ser sanitizada
 * @returns {string} String segura para uso em HTML
 */
function sanitizeHTML(str) {
    if (str === null || str === undefined) {
        return '';
    }

    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Escapa caracteres especiais para uso em atributos HTML.
 *
 * @param {string} str - String a ser escapada
 * @returns {string} String segura para uso em atributos
 */
function escapeAttribute(str) {
    if (str === null || str === undefined) {
        return '';
    }

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Cria elemento HTML de forma segura.
 *
 * @param {string} tag - Nome da tag
 * @param {object} attrs - Atributos do elemento
 * @param {string|Node} content - Conteúdo (texto ou elemento)
 * @returns {HTMLElement} Elemento criado
 */
function createElement(tag, attrs = {}, content = '') {
    const element = document.createElement(tag);

    // Adicionar atributos
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on')) {
            // Event handlers
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, escapeAttribute(value));
        }
    });

    // Adicionar conteúdo
    if (typeof content === 'string') {
        element.textContent = content;
    } else if (content instanceof Node) {
        element.appendChild(content);
    }

    return element;
}

// =================================
// SECURE STORAGE
// =================================

/**
 * Wrapper seguro para localStorage com tratamento de erros.
 */
const SecureStorage = {
    /**
     * Salva um valor no localStorage.
     *
     * @param {string} key - Chave
     * @param {any} value - Valor (será convertido para JSON)
     * @returns {boolean} Sucesso da operação
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('SecureStorage.set erro:', e);
            return false;
        }
    },

    /**
     * Recupera um valor do localStorage.
     *
     * @param {string} key - Chave
     * @param {any} defaultValue - Valor padrão se não encontrado
     * @returns {any} Valor recuperado ou valor padrão
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) {
                return defaultValue;
            }
            return JSON.parse(item);
        } catch (e) {
            console.error('SecureStorage.get erro:', e);
            return defaultValue;
        }
    },

    /**
     * Remove um valor do localStorage.
     *
     * @param {string} key - Chave
     * @returns {boolean} Sucesso da operação
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('SecureStorage.remove erro:', e);
            return false;
        }
    },

    /**
     * Limpa todo o localStorage.
     *
     * @returns {boolean} Sucesso da operação
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('SecureStorage.clear erro:', e);
            return false;
        }
    },

    /**
     * Verifica se uma chave existe.
     *
     * @param {string} key - Chave
     * @returns {boolean} Se a chave existe
     */
    has(key) {
        try {
            return localStorage.getItem(key) !== null;
        } catch (e) {
            return false;
        }
    }
};

// =================================
// TIMER MANAGER (Prevenir Memory Leaks)
// =================================

/**
 * Gerenciador de timers para prevenir memory leaks.
 * Mantém registro de todos os timers ativos para limpeza.
 */
const TimerManager = {
    _timers: [],
    _intervals: [],

    /**
     * Cria um setTimeout gerenciado.
     *
     * @param {Function} callback - Função a ser executada
     * @param {number} delay - Delay em milissegundos
     * @returns {number} ID do timer
     */
    setTimeout(callback, delay) {
        const id = window.setTimeout(() => {
            callback();
            // Remover da lista após execução
            this._timers = this._timers.filter(t => t !== id);
        }, delay);
        this._timers.push(id);
        return id;
    },

    /**
     * Cria um setInterval gerenciado.
     *
     * @param {Function} callback - Função a ser executada
     * @param {number} delay - Intervalo em milissegundos
     * @returns {number} ID do interval
     */
    setInterval(callback, delay) {
        const id = window.setInterval(callback, delay);
        this._intervals.push(id);
        return id;
    },

    /**
     * Limpa um timeout específico.
     *
     * @param {number} id - ID do timeout
     */
    clearTimeout(id) {
        window.clearTimeout(id);
        this._timers = this._timers.filter(t => t !== id);
    },

    /**
     * Limpa um interval específico.
     *
     * @param {number} id - ID do interval
     */
    clearInterval(id) {
        window.clearInterval(id);
        this._intervals = this._intervals.filter(i => i !== id);
    },

    /**
     * Limpa todos os timers e intervals.
     */
    clearAll() {
        this._timers.forEach(id => window.clearTimeout(id));
        this._intervals.forEach(id => window.clearInterval(id));
        this._timers = [];
        this._intervals = [];
    },

    /**
     * Retorna quantidade de timers ativos.
     *
     * @returns {object} Contagem de timers e intervals
     */
    getActiveCount() {
        return {
            timers: this._timers.length,
            intervals: this._intervals.length
        };
    }
};

// =================================
// EVENT MANAGER (Prevenir Memory Leaks)
// =================================

/**
 * Gerenciador de event listeners para prevenir memory leaks.
 */
const EventManager = {
    _listeners: [],

    /**
     * Adiciona um event listener gerenciado.
     *
     * @param {HTMLElement} element - Elemento alvo
     * @param {string} event - Nome do evento
     * @param {Function} handler - Handler do evento
     * @param {object} options - Opções do addEventListener
     * @returns {object} Referência do listener para remoção manual
     */
    add(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        const listener = { element, event, handler, options };
        this._listeners.push(listener);
        return listener;
    },

    /**
     * Remove um event listener específico.
     *
     * @param {object} listener - Referência do listener
     */
    remove(listener) {
        listener.element.removeEventListener(
            listener.event,
            listener.handler,
            listener.options
        );
        this._listeners = this._listeners.filter(l => l !== listener);
    },

    /**
     * Remove todos os event listeners de um elemento.
     *
     * @param {HTMLElement} element - Elemento alvo
     */
    removeFromElement(element) {
        const toRemove = this._listeners.filter(l => l.element === element);
        toRemove.forEach(listener => {
            listener.element.removeEventListener(
                listener.event,
                listener.handler,
                listener.options
            );
        });
        this._listeners = this._listeners.filter(l => l.element !== element);
    },

    /**
     * Remove todos os event listeners.
     */
    removeAll() {
        this._listeners.forEach(listener => {
            try {
                listener.element.removeEventListener(
                    listener.event,
                    listener.handler,
                    listener.options
                );
            } catch (e) {
                // Elemento pode não existir mais
            }
        });
        this._listeners = [];
    },

    /**
     * Retorna quantidade de listeners ativos.
     *
     * @returns {number} Quantidade de listeners
     */
    getActiveCount() {
        return this._listeners.length;
    }
};

// =================================
// CLEANUP AUTOMÁTICO
// =================================

// Limpar timers e eventos ao sair da página
window.addEventListener('beforeunload', () => {
    TimerManager.clearAll();
    EventManager.removeAll();
});

window.addEventListener('pagehide', () => {
    TimerManager.clearAll();
    EventManager.removeAll();
});

// =================================
// FORMATAÇÃO DE DADOS
// =================================

/**
 * Formata data para exibição.
 *
 * @param {string|Date} dateStr - Data a ser formatada
 * @param {boolean} includeTime - Incluir hora
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
 * Formata valor monetário.
 *
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado
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
 * @param {number} value - Número a ser formatado
 * @param {number} decimals - Casas decimais
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

// =================================
// EXPORTAR PARA USO GLOBAL
// =================================

// Disponibilizar no escopo global
window.sanitizeHTML = sanitizeHTML;
window.escapeAttribute = escapeAttribute;
window.createElement = createElement;
window.SecureStorage = SecureStorage;
window.TimerManager = TimerManager;
window.EventManager = EventManager;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.formatNumber = formatNumber;

console.log('✅ Utils.js carregado - Sistema de Inventário Protheus v2.19.13');
