import { test, expect } from "@playwright/test";

// Esses testes verificam o comportamento da autenticação sem depender de sessão pré-carregada
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Autenticação", () => {
  test("redireciona para /login quando não autenticado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("exibe formulário de login corretamente", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login com credenciais inválidas mostra erro", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[autocomplete="username"]', "usuario_invalido_teste");
    await page.fill('input[autocomplete="current-password"]', "senhaerrada123");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/incorretos|inválidas|incorret/i)).toBeVisible({ timeout: 10000 });
  });
});
