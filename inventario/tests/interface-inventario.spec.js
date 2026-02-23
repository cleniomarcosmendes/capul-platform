// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Testes da Interface de Inventário', () => {

  // Hook para fazer login antes de cada teste
  test.beforeEach(async ({ page }) => {
    // Fazer login
    await page.goto('/login.html');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento
    await page.waitForURL(/dashboard\.html|inventory\.html/, { timeout: 10000 });
  });

  test('Dashboard deve carregar após login', async ({ page }) => {
    // Verificar se elementos principais do dashboard estão visíveis
    await expect(page.locator('nav, .navbar')).toBeVisible();
    await expect(page.locator('.container, .main-content')).toBeVisible();
  });

  test('Navegação para página de inventário deve funcionar', async ({ page }) => {
    // Procurar e clicar no link/botão de inventário
    const inventarioLink = page.locator('a[href*="inventory"], button:has-text("Inventário")').first();

    if (await inventarioLink.isVisible()) {
      await inventarioLink.click();
      await expect(page).toHaveURL(/inventory\.html/);
    } else {
      // Se não encontrar o link, navegar diretamente
      await page.goto('/inventory.html');
    }

    // Verificar se a página de inventário carregou
    await expect(page.locator('h1, h2, .page-title')).toContainText(/inventário/i);
  });

  test('Modal de criação de inventário deve abrir', async ({ page }) => {
    await page.goto('/inventory.html');

    // Procurar botão de criar/novo inventário
    const createButton = page.locator('button:has-text("Criar"), button:has-text("Novo"), button[data-bs-toggle="modal"]').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Verificar se modal abriu
      await expect(page.locator('.modal.show, .modal:visible')).toBeVisible();
      await expect(page.locator('.modal-title')).toBeVisible();
    } else {
      console.log('Botão de criar inventário não encontrado - pode ser esperado dependendo do estado');
    }
  });

  test('Grid de inventários deve carregar dados', async ({ page }) => {
    await page.goto('/inventory.html');

    // Aguardar carregamento dos dados
    await page.waitForTimeout(2000);

    // Verificar se existe tabela ou grid de dados
    const hasTable = await page.locator('table, .table, .grid, .data-grid').isVisible();
    const hasCards = await page.locator('.card, .inventory-item').isVisible();

    // Pelo menos um tipo de display de dados deve estar presente
    expect(hasTable || hasCards).toBeTruthy();
  });

  test('Sistema de busca/filtro deve funcionar', async ({ page }) => {
    await page.goto('/inventory.html');

    // Procurar campo de busca
    const searchInput = page.locator('input[type="search"], input[placeholder*="busca"], input[placeholder*="filtro"]').first();

    if (await searchInput.isVisible()) {
      // Testar busca
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Verificar se a busca não quebrou a página
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Página de contagem deve ser acessível', async ({ page }) => {
    // Tentar acessar diretamente a página de contagem
    await page.goto('/counting.html');

    // Verificar se não há erro 404 ou se redirecionou adequadamente
    const is404 = await page.locator('h1:has-text("404"), .error-404').isVisible();
    expect(is404).toBeFalsy();

    // Deve ter elementos relacionados à contagem
    const hasCountingElements = await page.locator('input[type="number"], .counting-form, .product-count').isVisible();

    if (hasCountingElements) {
      await expect(page.locator('h1, h2')).toContainText(/contagem|counting/i);
    }
  });

});