/**
 * Sistema de Validação Cruzada Frontend/Backend
 * Sistema de Inventário Protheus v2.16.0
 *
 * Previne inconsistências que causam bugs críticos de ciclos.
 * Criado em resposta ao bug v2.15.5.
 */

const ValidationSystem = {
    API_BASE: 'http://localhost:8000/api/v1',
    enabled: true,
    debugMode: false,

    /**
     * Valida lista de produtos exibida no frontend vs backend
     * @param {Object} params - Parâmetros da validação
     * @param {string} params.inventoryListId - ID do inventário
     * @param {string} params.countingListId - ID da lista de contagem (opcional)
     * @param {number} params.currentCycle - Ciclo atual (1, 2 ou 3)
     * @param {string} params.filterType - Tipo de filtro ("all", "pending", "divergent", "counted")
     * @param {Array<string>} params.frontendProductCodes - Lista de códigos exibidos no frontend
     * @returns {Promise<Object>} Resultado da validação
     */
    async validateProducts(params) {
        if (!this.enabled) {
            return { isValid: true, message: 'Validação desabilitada' };
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
            console.error('[VALIDATION] Token não encontrado');
            return { isValid: false, message: 'Não autenticado' };
        }

        try {
            // Obter lista definitiva do backend
            const backendResponse = await fetch(`${this.API_BASE}/validation/filter-products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    inventory_list_id: params.inventoryListId,
                    counting_list_id: params.countingListId,
                    current_cycle: params.currentCycle,
                    filter_type: params.filterType
                })
            });

            if (!backendResponse.ok) {
                throw new Error(`Backend retornou status ${backendResponse.status}`);
            }

            const backendData = await backendResponse.json();
            const backendCodes = new Set(backendData.products.map(p => p.product_code));
            const frontendCodes = new Set(params.frontendProductCodes);

            // Comparar
            const missing = [...backendCodes].filter(code => !frontendCodes.has(code));
            const extra = [...frontendCodes].filter(code => !backendCodes.has(code));

            const isMatch = missing.length === 0 && extra.length === 0;

            const result = {
                isValid: isMatch,
                backendTotal: backendCodes.size,
                frontendTotal: frontendCodes.size,
                missing: missing,
                extra: extra,
                severity: missing.length > 0 ? 'CRITICAL' : (extra.length > 0 ? 'WARNING' : 'OK'),
                message: isMatch
                    ? '✅ Frontend e backend estão sincronizados'
                    : `⚠️ Dessincronização detectada: ${missing.length} faltando, ${extra.length} extras`,
                backendProducts: backendData.products,
                validation: backendData.validation
            };

            if (this.debugMode) {
                console.log('[VALIDATION] Resultado:', result);
            }

            // Exibir alerta se houver problemas críticos
            if (result.severity === 'CRITICAL') {
                this.showCriticalAlert(result);
            }

            return result;

        } catch (error) {
            console.error('[VALIDATION] Erro:', error);
            return {
                isValid: false,
                error: error.message,
                message: 'Erro ao validar produtos com backend'
            };
        }
    },

    /**
     * Compara lista frontend vs backend (método alternativo)
     * @param {string} inventoryListId - ID do inventário
     * @param {Array<string>} frontendProductCodes - Códigos exibidos no frontend
     * @param {string} filterType - Tipo de filtro
     * @param {number} currentCycle - Ciclo atual
     * @returns {Promise<Object>} Resultado da comparação
     */
    async compareWithBackend(inventoryListId, frontendProductCodes, filterType, currentCycle) {
        const token = localStorage.getItem('access_token');
        if (!token) {
            return { isValid: false, message: 'Não autenticado' };
        }

        try {
            const response = await fetch(`${this.API_BASE}/validation/compare-frontend-backend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    inventory_list_id: inventoryListId,
                    frontend_product_codes: frontendProductCodes,
                    filter_type: filterType,
                    current_cycle: currentCycle
                })
            });

            if (!response.ok) {
                throw new Error(`Backend retornou status ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('[VALIDATION] Erro na comparação:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Exibe alerta crítico na tela
     * @param {Object} result - Resultado da validação
     */
    showCriticalAlert(result) {
        const alertDiv = document.getElementById('validation-alert');
        if (!alertDiv) {
            // Criar div de alerta se não existir
            const div = document.createElement('div');
            div.id = 'validation-alert';
            div.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
            `;
            document.body.appendChild(div);
        }

        const alert = document.getElementById('validation-alert');
        alert.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show shadow-lg" role="alert">
                <h5 class="alert-heading">
                    <i class="fas fa-exclamation-triangle"></i> Dessincronização Detectada!
                </h5>
                <p class="mb-2"><strong>${typeof escapeHtml === 'function' ? escapeHtml(result.message) : result.message}</strong></p>
                <hr>
                <div class="small">
                    <p class="mb-1"><strong>Backend:</strong> ${Number(result.backendTotal)} produtos</p>
                    <p class="mb-1"><strong>Frontend:</strong> ${Number(result.frontendTotal)} produtos</p>
                    ${result.missing.length > 0 ? `
                        <p class="mb-1 text-danger">
                            <strong>Faltando:</strong> ${typeof escapeHtml === 'function' ? result.missing.map(escapeHtml).join(', ') : result.missing.join(', ')}
                        </p>
                    ` : ''}
                    ${result.extra.length > 0 ? `
                        <p class="mb-1 text-warning">
                            <strong>Extras:</strong> ${typeof escapeHtml === 'function' ? result.extra.map(escapeHtml).join(', ') : result.extra.join(', ')}
                        </p>
                    ` : ''}
                </div>
                <hr>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-danger" onclick="ValidationSystem.reloadPage()">
                        <i class="fas fa-sync-alt"></i> Recarregar Página
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="alert">
                        Ignorar
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Recarrega a página atual
     */
    reloadPage() {
        window.location.reload();
    },

    /**
     * Valida produto individual
     * @param {string} inventoryListId - ID do inventário
     * @param {string} productCode - Código do produto
     * @param {number} currentCycle - Ciclo atual
     * @returns {Promise<Object>} Informações do produto
     */
    async validateProduct(inventoryListId, productCode, currentCycle) {
        const result = await this.validateProducts({
            inventoryListId: inventoryListId,
            currentCycle: currentCycle,
            filterType: 'all',
            frontendProductCodes: [productCode]
        });

        if (result.backendProducts) {
            const product = result.backendProducts.find(p => p.product_code === productCode);
            return product || null;
        }

        return null;
    },

    /**
     * Habilita/desabilita modo debug
     * @param {boolean} enable - Habilitar debug
     */
    setDebugMode(enable) {
        this.debugMode = enable;
        console.log(`[VALIDATION] Modo debug: ${enable ? 'ATIVADO' : 'DESATIVADO'}`);
    },

    /**
     * Habilita/desabilita validação
     * @param {boolean} enable - Habilitar validação
     */
    setEnabled(enable) {
        this.enabled = enable;
        console.log(`[VALIDATION] Sistema de validação: ${enable ? 'ATIVADO' : 'DESATIVADO'}`);
    },

    /**
     * Executa validação automática ao carregar produtos
     * @param {Object} params - Parâmetros da página
     */
    async autoValidate(params) {
        if (!this.enabled) return;

        console.log('[VALIDATION] Executando validação automática...');

        // Aguardar 500ms para garantir que produtos foram carregados
        await new Promise(resolve => setTimeout(resolve, 500));

        // Coletar códigos de produtos exibidos na página
        const productElements = document.querySelectorAll('[data-product-code]');
        const frontendProductCodes = Array.from(productElements).map(el =>
            el.getAttribute('data-product-code')
        );

        if (frontendProductCodes.length === 0) {
            console.warn('[VALIDATION] Nenhum produto encontrado na página');
            return;
        }

        const result = await this.validateProducts({
            inventoryListId: params.inventoryListId,
            countingListId: params.countingListId,
            currentCycle: params.currentCycle,
            filterType: params.filterType || 'all',
            frontendProductCodes: frontendProductCodes
        });

        // Log resultado
        if (result.isValid) {
            console.log('✅ [VALIDATION] Frontend e backend sincronizados:', result);
        } else {
            console.error('❌ [VALIDATION] Dessincronização detectada:', result);
        }

        return result;
    },

    /**
     * Adiciona validação a um formulário de contagem
     * @param {HTMLFormElement} form - Formulário
     * @param {Object} params - Parâmetros
     */
    addFormValidation(form, params) {
        form.addEventListener('submit', async (e) => {
            if (!this.enabled) return;

            const productCode = form.querySelector('[name="product_code"]')?.value;
            if (!productCode) return;

            // Validar se produto deveria estar disponível
            const product = await this.validateProduct(
                params.inventoryListId,
                productCode,
                params.currentCycle
            );

            if (!product) {
                e.preventDefault();
                alert(`⚠️ ATENÇÃO: Produto ${productCode} não deveria estar disponível neste ciclo! Verifique com supervisor.`);
                return false;
            }
        });
    }
};

// Expor globalmente
window.ValidationSystem = ValidationSystem;

// Auto-executar validação se parâmetros estiverem presentes
document.addEventListener('DOMContentLoaded', () => {
    const params = {
        inventoryListId: new URLSearchParams(window.location.search).get('inventory_id'),
        countingListId: new URLSearchParams(window.location.search).get('list_id'),
        currentCycle: parseInt(new URLSearchParams(window.location.search).get('cycle') || '1'),
        filterType: new URLSearchParams(window.location.search).get('filter') || 'all'
    };

    if (params.inventoryListId && window.location.pathname.includes('counting')) {
        console.log('[VALIDATION] Parâmetros detectados, executando validação automática...');
        ValidationSystem.autoValidate(params).catch(error => {
            console.error('[VALIDATION] Erro na validação automática:', error);
        });
    }
});
