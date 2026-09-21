import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loginToBackoffice } from "./support/login.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_FILE } from "./playwright.config.js";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL as string;

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await loginToBackoffice(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
