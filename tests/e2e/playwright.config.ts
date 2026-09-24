import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The seed database's unattended-install admin - see
// src/Umbraco.Community.TipTopTipTap.DemoSite/appsettings.json's Unattended section
// (UnattendedUserEmail/UnattendedUserPassword). These were baked into the committed
// fixtures/seed.Umbraco.sqlite.db at seed-build time - see tests/e2e/README.md.
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "dev@crumpled-dog.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "SuperSecret123!";

export const AUTH_FILE = path.join(__dirname, ".auth/backoffice.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"], ["list"], ["json", { outputFile: "results.json" }]]
    : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://localhost:44399",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: AUTH_FILE,
  },
  globalSetup: "./global-setup.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
