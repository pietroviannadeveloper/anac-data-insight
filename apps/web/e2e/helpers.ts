import { Page } from "@playwright/test";

/** Login manual — usado SOMENTE no setup de autenticação. Demais testes usam storageState. */
export async function login(page: Page, username = "pietro.rocha", password = "Pietro007@") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
}
