import { test, expect } from "@playwright/test";

// Reutiliza sessão autenticada via storageState configurado no playwright.config.ts
test.describe("Dashboard e páginas principais", () => {
  test("página /dashboard carrega sem erros críticos", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("Hydration")) errors.push(err.message);
    });
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    expect(errors).toHaveLength(0);
    await expect(page.locator("main")).toBeVisible();
  });

  test("página /ciclos carrega e exibe conteúdo", async ({ page }) => {
    await page.goto("/ciclos");
    await page.waitForTimeout(3000);
    const content = page.locator("table, h1, h2").first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });

  test("página /upload contém componente de upload", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Arraste|arquivo|upload/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("página /relatorios carrega sem erro", async ({ page }) => {
    await page.goto("/relatorios");
    await page.waitForTimeout(2000);
    await expect(page.locator("main")).toBeVisible();
  });

  test("página /configuracoes carrega sem erro", async ({ page }) => {
    await page.goto("/configuracoes");
    await page.waitForTimeout(2000);
    await expect(page.locator("main")).toBeVisible();
  });
});
