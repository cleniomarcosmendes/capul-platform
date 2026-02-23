/**
 * 🛡️ API Contract Validator
 * Versão: 1.0
 * Data: 05/10/2025
 *
 * Objetivo: Detectar quebras de contrato de API em TEMPO DE EXECUÇÃO
 *
 * Como usar:
 * 1. Importar no HTML: <script src="utils/api-validator.js"></script>
 * 2. Chamar após receber dados da API: validateApiResponse('nome-do-contrato', data)
 * 3. Se validação falhar: Alerta visual + erro no console + exceção lançada
 */

// ==========================================
// CONTRATOS DE API
// ==========================================

const API_CONTRACTS = {
    // Modal "Ver Detalhes" - Lista de produtos
    'counting-lists-products': {
        description: 'Lista de produtos de uma lista de contagem',
        endpoint: '/api/v1/counting-lists/{id}/products',
        dataPath: 'data.items',
        requiredFields: [
            {
                name: 'id',
                type: 'string',
                description: 'ID único do item'
            },
            {
                name: 'product_code',
                type: 'string',
                description: 'Código do produto'
            },
            {
                name: 'product_description',
                type: 'string',
                description: '⚠️ CRÍTICO: product_description (NÃO product_name!)',
                commonMistakes: ['product_name', 'description']
            },
            {
                name: 'warehouse',
                type: 'string',
                description: '⚠️ CRÍTICO: warehouse por produto (não global!)',
                commonMistakes: ['armazem', 'store']
            },
            {
                name: 'system_qty',
                type: 'number',
                description: '⚠️ CRÍTICO: system_qty (NÃO expected_quantity!)',
                commonMistakes: ['expected_quantity', 'system_quantity']
            },
            {
                name: 'count_1',
                type: ['number', 'null'],
                description: '⚠️ CRÍTICO: count_1 (NÃO count_cycle_1!)',
                commonMistakes: ['count_cycle_1', 'first_count']
            },
            {
                name: 'count_2',
                type: ['number', 'null'],
                description: '⚠️ CRÍTICO: count_2 (NÃO count_cycle_2!)',
                commonMistakes: ['count_cycle_2', 'second_count']
            },
            {
                name: 'count_3',
                type: ['number', 'null'],
                description: '⚠️ CRÍTICO: count_3 (NÃO count_cycle_3!)',
                commonMistakes: ['count_cycle_3', 'third_count']
            }
        ],
        optionalFields: ['counted_qty', 'unit', 'requires_lot', 'current_cycle', 'status']
    },

    // Finalização de Lista
    'finalize-list': {
        description: 'Resposta ao finalizar lista',
        endpoint: '/api/v1/counting-lists/{id}/finalizar',
        dataPath: null, // Raiz da resposta
        requiredFields: [
            { name: 'success', type: 'boolean' },
            { name: 'list_id', type: 'string' },
            { name: 'old_status', type: 'string' },
            { name: 'new_status', type: 'string' },
            { name: 'message', type: 'string' }
        ]
    },

    // Lista de Inventários
    'inventories-list': {
        description: 'Lista de inventários',
        endpoint: '/api/v1/inventories',
        dataPath: 'data',
        requiredFields: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'status', type: 'string' }
        ]
    }
};

// ==========================================
// FUNÇÕES DE VALIDAÇÃO
// ==========================================

/**
 * Valida resposta da API contra contrato definido
 * @param {string} contractName - Nome do contrato a validar
 * @param {object} response - Resposta da API
 * @param {object} options - Opções de validação
 */
function validateApiResponse(contractName, response, options = {}) {
    const {
        throwOnError = true,
        showAlert = true,
        logDetails = true
    } = options;

    console.log(`🔍 [API VALIDATOR] Validando contrato: ${contractName}`);

    // Buscar contrato
    const contract = API_CONTRACTS[contractName];
    if (!contract) {
        console.warn(`⚠️ [API VALIDATOR] Contrato não encontrado: ${contractName}`);
        console.warn('   Contratos disponíveis:', Object.keys(API_CONTRACTS));
        return;
    }

    // Extrair dados do caminho especificado
    let data = response;
    if (contract.dataPath) {
        const path = contract.dataPath.split('.');
        for (const key of path) {
            data = data?.[key];
            if (data === undefined) {
                _reportError(
                    contractName,
                    `Caminho de dados não encontrado: ${contract.dataPath}`,
                    { response, contract },
                    { throwOnError, showAlert, logDetails }
                );
                return;
            }
        }
    }

    // Se data é array, validar primeiro item
    const itemToValidate = Array.isArray(data) ? data[0] : data;

    if (!itemToValidate) {
        console.warn(`⚠️ [API VALIDATOR] Nenhum dado para validar (array vazio ou null)`);
        return;
    }

    // Validar campos obrigatórios
    const errors = [];
    const warnings = [];

    for (const field of contract.requiredFields) {
        const value = itemToValidate[field.name];

        // Verificar se campo existe
        if (value === undefined) {
            errors.push({
                field: field.name,
                error: 'Campo ausente',
                description: field.description,
                commonMistakes: field.commonMistakes
            });
            continue;
        }

        // Verificar tipo
        const expectedTypes = Array.isArray(field.type) ? field.type : [field.type];
        const actualType = value === null ? 'null' : typeof value;

        if (!expectedTypes.includes(actualType)) {
            warnings.push({
                field: field.name,
                warning: `Tipo incorreto (esperado: ${expectedTypes.join(' ou ')}, recebido: ${actualType})`,
                value: value
            });
        }
    }

    // Verificar se há erros críticos (campos ausentes)
    const missingFields = errors.map(e => e.field);

    if (missingFields.length > 0) {
        _reportError(
            contractName,
            `Campos obrigatórios ausentes: ${missingFields.join(', ')}`,
            { errors, itemToValidate, contract },
            { throwOnError, showAlert, logDetails }
        );
        return;
    }

    // Reportar warnings (tipos incorretos) mas não falhar
    if (warnings.length > 0 && logDetails) {
        console.warn(`⚠️ [API VALIDATOR] Warnings encontrados:`);
        warnings.forEach(w => {
            console.warn(`   - ${w.field}: ${w.warning}`);
            console.warn(`     Valor recebido:`, w.value);
        });
    }

    console.log(`✅ [API VALIDATOR] Contrato validado com sucesso: ${contractName}`);
    if (warnings.length > 0) {
        console.log(`   (${warnings.length} warning(s) - verifique console)`);
    }
}

/**
 * Reporta erro de validação
 */
function _reportError(contractName, message, details, options) {
    const { throwOnError, showAlert, logDetails } = options;

    console.error(`❌ [API VALIDATOR] VIOLAÇÃO DE CONTRATO!`);
    console.error(`   Contrato: ${contractName}`);
    console.error(`   Erro: ${message}`);

    if (logDetails) {
        console.error(`   Detalhes:`, details);

        if (details.errors) {
            console.error(`\n   📋 Campos com erro:`);
            details.errors.forEach(e => {
                console.error(`      - ${e.field}: ${e.error}`);
                if (e.description) {
                    console.error(`        ${e.description}`);
                }
                if (e.commonMistakes) {
                    console.error(`        ⚠️ Possíveis erros: ${e.commonMistakes.join(', ')}`);
                }
            });
        }

        if (details.itemToValidate) {
            console.error(`\n   📦 Dados recebidos:`, details.itemToValidate);
            console.error(`   🔑 Campos disponíveis:`, Object.keys(details.itemToValidate));
        }

        if (details.contract) {
            console.error(`\n   📄 Contrato esperado:`, details.contract.endpoint);
            console.error(`   ✅ Campos obrigatórios:`, details.contract.requiredFields.map(f => f.name));
        }
    }

    // Alerta visual para desenvolvedor
    if (showAlert) {
        const alertMessage = `⚠️ ERRO DE CONTRATO DE API!\n\n` +
            `Contrato: ${contractName}\n` +
            `Erro: ${message}\n\n` +
            `Verifique o console (F12) para detalhes completos.\n\n` +
            `NÃO COMMITAR até resolver este problema!`;

        alert(alertMessage);
    }

    if (throwOnError) {
        throw new Error(`API Contract Violation: ${contractName} - ${message}`);
    }
}

/**
 * Listar todos os contratos disponíveis
 */
function listContracts() {
    console.log('📋 Contratos de API disponíveis:');
    for (const [name, contract] of Object.entries(API_CONTRACTS)) {
        console.log(`\n   ${name}:`);
        console.log(`      Endpoint: ${contract.endpoint}`);
        console.log(`      Descrição: ${contract.description}`);
        console.log(`      Campos obrigatórios: ${contract.requiredFields.map(f => f.name).join(', ')}`);
    }
}

// Exportar funções para uso global
window.validateApiResponse = validateApiResponse;
window.listApiContracts = listContracts;

// Log de inicialização
console.log('🛡️ [API VALIDATOR] Inicializado');
console.log(`   Contratos carregados: ${Object.keys(API_CONTRACTS).length}`);
console.log('   Use window.listApiContracts() para ver todos os contratos');
