/**
 * Utilitarios de seguranca para o frontend do Inventario.
 * Sistema de Inventario Protheus v2.19.54
 *
 * Deve ser carregado ANTES de todos os outros scripts JS.
 */

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} text - Texto para escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Cria um elemento de texto seguro (sem interpretar HTML).
 * @param {string} tag - Tag HTML (div, span, p, etc.)
 * @param {string} text - Texto seguro
 * @param {string} [className] - Classes CSS opcionais
 * @returns {HTMLElement} Elemento DOM seguro
 */
function createSafeElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

// Exportar para uso global
window.escapeHtml = escapeHtml;
window.createSafeElement = createSafeElement;

/**
 * Protecao contra perda de dados nao salvos.
 * Intercepta fechamento do browser/aba e navegacao quando formulario tem dados alterados.
 *
 * Uso:
 *   const guard = new UnsavedChangesGuard('formId');
 *   // Ao salvar com sucesso:
 *   guard.reset();
 */
class UnsavedChangesGuard {
  constructor(formSelector) {
    this._dirty = false;
    this._enabled = true;
    this._form = typeof formSelector === 'string'
      ? document.getElementById(formSelector) || document.querySelector(formSelector)
      : formSelector;

    // Listener para detectar mudancas no form
    if (this._form) {
      this._form.addEventListener('input', () => this._markDirty());
      this._form.addEventListener('change', () => this._markDirty());
    }

    // Interceptar fechamento do browser/aba
    this._beforeUnloadHandler = (e) => {
      if (this._dirty && this._enabled) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', this._beforeUnloadHandler);

    // Interceptar cliques em links de navegacao (menu lateral, etc.)
    this._clickHandler = (e) => {
      if (!this._dirty || !this._enabled) return;
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:') || anchor.target === '_blank') return;
      // Link interno — confirmar saida
      e.preventDefault();
      e.stopPropagation();
      if (typeof showConfirm === 'function') {
        showConfirm({
          title: 'Alteracoes nao salvas',
          message: 'Voce tem alteracoes que ainda nao foram salvas. Deseja realmente sair?',
          confirmText: 'Sair sem salvar',
          cancelText: 'Continuar editando',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            this._dirty = false;
            window.location.href = href;
          }
        });
      } else if (confirm('Voce tem alteracoes nao salvas. Deseja sair?')) {
        this._dirty = false;
        window.location.href = href;
      }
    };
    document.addEventListener('click', this._clickHandler, true);
  }

  _markDirty() {
    this._dirty = true;
  }

  /** Marca o formulario como "sujo" manualmente */
  markDirty() {
    this._dirty = true;
  }

  /** Reseta o estado (chamar apos salvar com sucesso) */
  reset() {
    this._dirty = false;
  }

  /** Desabilita temporariamente (para navegacao programatica) */
  disable() {
    this._enabled = false;
  }

  /** Destroi o guard (remover listeners) */
  destroy() {
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    document.removeEventListener('click', this._clickHandler, true);
  }
}

console.log('✅ Security.js carregado - Utilitarios de seguranca + UnsavedChangesGuard');
