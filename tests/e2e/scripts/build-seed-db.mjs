// Regeneration script for tests/e2e/fixtures/seed.Umbraco.sqlite.db - see tests/e2e/README.md
// for the full procedure. This drives the real backoffice (via Playwright, headless Chromium) to
// create the e2e fixture content:
//   - a dedicated Rich Text Editor data type ("Paste Test RTE") with the "Office Paste Cleanup"
//     extension enabled - NOT the built-in "Richtext editor" data type, so the seed is clearly
//     test-owned and unaffected by any unrelated change to the built-in one
//   - a document type ("Paste Test Page") with a "Body Text" property using that data type,
//     allowed at the content root
//   - a published content node ("Paste Test") of that type
//
// Run this against a FRESH unattended-installed DemoSite (delete umbraco/Data first, then
// `dotnet run` once to let unattended install complete, then run this script against it).
// Not run in CI - CI restores the committed fixtures/seed.Umbraco.sqlite.db instead.
//
// Usage: node scripts/build-seed-db.mjs
import { chromium } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "https://localhost:44399";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "dev@crumpled-dog.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "SuperSecret123!";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  // --- Log in (same two-app OAuth/PKCE flow as support/login.ts) ---
  await page.goto("/umbraco");
  const signIn = page.getByRole("button", { name: /sign in with umbraco/i });
  if (await signIn.isVisible({ timeout: 15_000 }).catch(() => false)) await signIn.click();
  await page.waitForURL(/\/umbraco\/login/, { timeout: 15_000 });
  await page.locator("#username-input").fill(ADMIN_EMAIL);
  await page.locator("#password-input").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /login/i }).click();
  const secondSignIn = page.getByRole("button", { name: /sign in with umbraco/i });
  if (await secondSignIn.isVisible({ timeout: 10_000 }).catch(() => false)) await secondSignIn.click();
  await page.waitForURL(/\/umbraco\/section\//, { timeout: 20_000 });
  console.log("Logged in as", ADMIN_EMAIL);

  // --- 1. Create a dedicated "Paste Test RTE" data type ---
  await page.goto("/umbraco/section/settings");
  await page.waitForTimeout(1000);
  await page.getByRole("link", { name: "Data Types" }).first().hover();
  await page.waitForTimeout(300);
  await page.getByLabel("Create item for Data Types").click();
  await page.waitForTimeout(800);
  await page.getByText("Data Type...", { exact: true }).click();
  await page.waitForTimeout(1200);

  await page.locator("#nameInput").getByRole("textbox").fill("Paste Test RTE");
  await page.getByRole("button", { name: "Select a property editor" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("searchbox", { name: "Type to filter..." }).fill("Richtext");
  await page.waitForTimeout(600);
  await page.getByText("Rich Text Editor", { exact: true }).click();
  await page.waitForTimeout(1200);

  // "Office Paste Cleanup" defaults to enabled (it's registered in the tiptap_extGroup_formatting
  // group, weight 100, alongside the other essentials) - this data type's config is left at
  // defaults otherwise, so no explicit checkbox toggling is needed here. Verified by inspecting
  // the saved umbracoDataType.config JSON, which lists
  // "Umbraco.Community.TipTopTipTap.OfficePaste" in "extensions".
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1200);
  console.log("Data type 'Paste Test RTE' saved.");

  // --- 2. Create "Paste Test Page" document type ---
  await page.goto("/umbraco/section/settings");
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: "Document Types" }).first().hover();
  await page.waitForTimeout(300);
  await page.getByLabel("Create item for Document Types").click();
  await page.waitForTimeout(800);
  await page.getByText("Document Type...", { exact: true }).click();
  await page.waitForTimeout(1200);

  await page.getByRole("textbox", { name: "Enter a name..." }).fill("Paste Test Page");
  await page.waitForTimeout(300);

  await page.getByText("Add property", { exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("textbox", { name: "Name" }).first().fill("Body Text");
  await page.getByText("Select Property Editor", { exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("searchbox", { name: "Type to filter..." }).fill("Paste Test RTE");
  await page.waitForTimeout(600);
  // Exact match only - a re-run against a dirty DB could have suffixed duplicates
  // ("Paste Test RTE (1)" etc.); the fresh-DB precondition above keeps this exact.
  await page.getByText("Paste Test RTE", { exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(1000);

  await page.locator("umb-workspace-editor").getByRole("tab", { name: "Structure" }).click();
  await page.waitForTimeout(800);
  await page.locator("uui-toggle").filter({ hasText: "Allow at root" }).click();
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1200);
  console.log("Document type 'Paste Test Page' saved (allowed at root).");

  // --- 3. Create and publish the "Paste Test" content node ---
  await page.goto("/umbraco/section/content");
  await page.waitForTimeout(1200);
  await page.getByLabel("Create item for Content").click();
  await page.waitForTimeout(800);
  await page.locator("uui-ref-node-document-type").filter({ hasText: "Paste Test Page" }).click();
  await page.waitForTimeout(1200);

  await page.getByRole("textbox", { name: "Enter a name..." }).fill("Paste Test");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.waitForTimeout(3000);
  console.log("Content node 'Paste Test' saved and published.");

  await browser.close();
  console.log("Done. Stop the DemoSite and copy umbraco/Data/Umbraco.sqlite.db to fixtures/seed.Umbraco.sqlite.db.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
