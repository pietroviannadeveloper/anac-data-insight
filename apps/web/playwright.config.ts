import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Faz login uma vez e salva o estado da sessão
    {
      name: "setup",
      testMatch: /setup\/auth\.setup\.ts/,
    },
    // Todos os outros testes reutilizam os cookies salvos
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
      testIgnore: /setup\//,
    },
  ],
  // Para rodar: `npm run dev` + `uvicorn app.main:app` devem estar ativos.
  // Depois: BASE_URL=http://localhost:3001 npm run test:e2e
});
