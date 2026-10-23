import { defineConfig, devices } from "@playwright/test";

// Ponta a ponta: o app já compilado (npm run build) com um Sankhya simulado e um Postgres de teste (TEST_DATABASE_URL).
const PORT = 3123;
export const E2E_SECRET = "segredo-de-teste-e2e-com-mais-de-32-caracteres";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"], locale: "pt-BR", trace: "retain-on-failure" },
  webServer: [
    { command: "node tests/e2e/fake-sankhya.mjs", port: 3999, reuseExistingServer: !process.env.CI },
    {
      command: "npm start",
      port: PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(PORT),
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        SANKHYA_API_URL: "http://127.0.0.1:3999",
        SANKHYA_CLIENT_ID: "e2e",
        SANKHYA_CLIENT_SECRET: "e2e",
        SANKHYA_X_TOKEN: "e2e",
        SESSION_SECRET: E2E_SECRET,
        ADMIN_USER: "admin",
        ADMIN_PASSWORD: "senha-admin-e2e",
      },
    },
  ],
});
