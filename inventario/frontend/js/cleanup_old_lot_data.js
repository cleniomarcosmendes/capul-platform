/**
 * Script de limpeza de dados antigos de lotes do localStorage
 * Executar este script limpa todos os dados de lotes salvos localmente
 * para forçar o carregamento do ciclo atual do backend
 *
 * Para usar: Cole este código no console do navegador (F12)
 */

(function cleanupOldLotData() {
    console.log('🧹 Iniciando limpeza de dados antigos de lotes...');

    let removedCount = 0;
    const keysToRemove = [];

    // Iterar sobre todas as chaves do localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // Identificar chaves relacionadas a lotes
        if (key && (
            key.startsWith('lotData_') ||
            key.includes('lot_draft') ||
            key.includes('lotCount')
        )) {
            keysToRemove.push(key);
        }
    }

    // Remover as chaves identificadas
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
        console.log(`  ❌ Removido: ${key}`);
    });

    // Limpar sessionStorage também
    let sessionRemoved = 0;
    const sessionKeysToRemove = [];

    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);

        if (key && key.includes('lotData')) {
            sessionKeysToRemove.push(key);
        }
    }

    sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        sessionRemoved++;
        console.log(`  ❌ Removido (session): ${key}`);
    });

    console.log(`✅ Limpeza concluída!`);
    console.log(`   - localStorage: ${removedCount} chaves removidas`);
    console.log(`   - sessionStorage: ${sessionRemoved} chaves removidas`);
    console.log(`   - Recarregue a página para ver os dados atualizados`);

    return {
        localStorageRemoved: removedCount,
        sessionStorageRemoved: sessionRemoved,
        total: removedCount + sessionRemoved
    };
})();
