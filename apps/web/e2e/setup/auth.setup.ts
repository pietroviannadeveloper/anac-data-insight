import { test as setup, expect } from "@playwright/test";
import path from "path";

export const authFile = path.join(__dirname, "../.auth/user.json");

setup("autenticar uma vez e salvar sessão", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[autocomplete="username"]', "pietro.rocha");
  await page.fill('input[autocomplete="current-password"]', "Pietro007@");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await expect(page).not.toHaveURL(/\/login/);
  // Salva cookies (anac_role, anac_username) para reutilizar nos demais testes
  await page.context().storageState({ path: authFile });
});
