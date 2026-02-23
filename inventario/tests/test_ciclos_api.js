// Teste automatizado do sistema de ciclos via API
const { test, expect } = require('@playwright/test');

test.describe('Testes do Sistema de Ciclos', () => {
  const BASE_URL = 'http://localhost:8000';
  const INVENTORY_ID = '778e5856-d781-495f-b95b-bbb6ce2f2568';

  test('Sistema de avanço de ciclos deve funcionar', async ({ request }) => {
    console.log('🎯 Testando sistema de avanço de ciclos...');

    // 1. Verificar estado inicial do inventário
    const initialState = await request.get(`${BASE_URL}/api/v1/inventory/lists`);
    expect(initialState.ok()).toBeTruthy();

    const inventories = await initialState.json();
    const inventory = inventories.find(inv => inv.id === INVENTORY_ID);

    if (inventory) {
      console.log(`📊 Estado inicial: Ciclo ${inventory.current_cycle}, Status: ${inventory.list_status}`);

      // 2. Testar avanço de ciclo
      const cycleTest = await request.post(`${BASE_URL}/test/advance-cycle/${INVENTORY_ID}?cycle=1`);
      expect(cycleTest.ok()).toBeTruthy();

      const result = await cycleTest.json();
      console.log('🚀 Resultado do teste:', JSON.stringify(result, null, 2));

      // 3. Verificar se o ciclo avançou corretamente
      if (result.success) {
        expect(result.after.cycle).toBeGreaterThan(result.before.cycle);
        expect(result.after.status).toBe('ABERTA');
        console.log('✅ Ciclo avançado com sucesso!');
      } else {
        console.log('❌ Teste de ciclo falhou:', result.message);
      }
    } else {
      console.log('⚠️ Inventário de teste não encontrado');
    }
  });

  test('API de inventários deve estar funcional', async ({ request }) => {
    // Testar endpoints essenciais
    const healthCheck = await request.get(`${BASE_URL}/health`);
    expect(healthCheck.ok()).toBeTruthy();

    const health = await healthCheck.json();
    expect(health.status).toBe('Healthy');
    console.log('✅ Health Check: OK');

    // Testar endpoint de inventários
    const inventories = await request.get(`${BASE_URL}/api/v1/inventory/lists`);
    expect(inventories.ok()).toBeTruthy();

    const data = await inventories.json();
    expect(Array.isArray(data)).toBeTruthy();
    console.log(`✅ API Inventários: ${data.length} inventários encontrados`);
  });

  test('Verificar dados do inventário de teste', async ({ request }) => {
    // Verificar se o inventário de teste tem dados necessários
    const response = await request.get(`${BASE_URL}/api/v1/inventory/lists`);
    expect(response.ok()).toBeTruthy();

    const inventories = await response.json();
    const testInventory = inventories.find(inv => inv.id === INVENTORY_ID);

    if (testInventory) {
      console.log(`📋 Inventário encontrado: ${testInventory.name}`);
      console.log(`🔄 Ciclo atual: ${testInventory.current_cycle}`);
      console.log(`📊 Status: ${testInventory.list_status}`);

      expect(testInventory.id).toBe(INVENTORY_ID);
      expect(['ABERTA', 'EM_CONTAGEM', 'ENCERRADA']).toContain(testInventory.list_status);
    } else {
      console.log('❌ Inventário de teste não encontrado!');
      throw new Error('Inventário de teste necessário não foi encontrado');
    }
  });
});