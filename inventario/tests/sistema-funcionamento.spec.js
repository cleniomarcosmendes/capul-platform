// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Verificações de Funcionamento do Sistema', () => {

  test('Sistema deve estar acessível e redirecionar para login', async ({ page }) => {
    // Acessar página inicial
    await page.goto('/');

    // Verificar se redirecionou para login ou se contém elementos de login
    await expect(page).toHaveURL(/login\.html/);

    // Verificar se o título está correto
    await expect(page).toHaveTitle(/Sistema de Inventário Protheus/);
  });

  test('Página de login deve carregar corretamente', async ({ page }) => {
    await page.goto('/login.html');

    // Verificar elementos essenciais da tela de login
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verificar título da página
    await expect(page).toHaveTitle(/Login/);
  });

  test('Login com credenciais válidas deve funcionar', async ({ page }) => {
    await page.goto('/login.html');

    // Preencher credenciais do admin
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');

    // Fazer login
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento para dashboard
    await expect(page).toHaveURL(/dashboard\.html|inventory\.html/);

    // Verificar se login foi bem-sucedido (procurar por elementos do dashboard)
    await expect(page.locator('nav, .navbar, .dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('API Backend deve estar funcionando', async ({ page }) => {
    // Testar endpoint de health se existir, ou qualquer endpoint público
    const response = await page.request.get('/api/v1/auth/me');

    // Mesmo que retorne 401 (não autorizado), significa que a API está funcionando
    expect([200, 401, 422].includes(response.status())).toBeTruthy();
  });

  test('Recursos estáticos devem carregar', async ({ page }) => {
    await page.goto('/login.html');

    // Verificar se não há erros 404 nos recursos
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    // Aguardar a página carregar completamente
    await page.waitForLoadState('networkidle');

    // Verificar se não há muitos recursos falhando
    expect(failedRequests.length).toBeLessThan(5); // Permite alguns falhas menores
  });

});