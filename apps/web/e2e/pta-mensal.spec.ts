import { test, expect } from "@playwright/test";

// Reutiliza sessão autenticada via storageState configurado no playwright.config.ts
test.describe("PTA Mensal", () => {
  test("página carrega sem erros críticos", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("Hydration")) errors.push(err.message);
    });
    await page.goto("/ptamensal");
    await page.waitForTimeout(3000);
    expect(errors).toHaveLength(0);
    await expect(page.locator("main")).toBeVisible();
  });

  test("botão Exportar gráfico mensal está visível", async ({ page }) => {
    await page.goto("/ptamensal");
    await expect(page.locator('button:has-text("Exportar gráfico mensal")')).toBeVisible({ timeout: 12000 });
  });

  test("botão Exportar .xlsx está visível", async ({ page }) => {
    await page.goto("/ptamensal");
    await expect(page.locator('button:has-text("Exportar .xlsx")')).toBeVisible({ timeout: 12000 });
  });

  test("exportar gráfico mensal gera download PNG quando há dados", async ({ page }) => {
    await page.goto("/ptamensal");
    await page.waitForTimeout(3000);

    const btn = page.locator('button:has-text("Exportar gráfico mensal")');
    await expect(btn).toBeVisible({ timeout: 10000 });

    if (await btn.isDisabled()) {
      test.skip(true, "Sem dados carregados — exportação desabilitada");
      return;
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      btn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(await download.failure()).toBeNull();
  });

  test("exportar .xlsx gera download quando há atividades", async ({ page }) => {
    await page.goto("/ptamensal");
    await page.waitForTimeout(3000);

    const btn = page.locator('button:has-text("Exportar .xlsx")');
    await expect(btn).toBeVisible({ timeout: 10000 });

    if (await btn.isDisabled()) {
      test.skip(true, "Sem atividades carregadas — exportação desabilitada");
      return;
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      btn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(await download.failure()).toBeNull();
  });

  test("filtros renderizam e não quebram a página", async ({ page }) => {
    await page.goto("/ptamensal");
    await page.waitForTimeout(3000);

    const selects = page.locator("select");
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);

    if (count > 0) {
      const opts = await selects.first().locator("option").count();
      if (opts > 1) {
        await selects.first().selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        await expect(page.locator("main")).toBeVisible();
      }
    }
  });
});
