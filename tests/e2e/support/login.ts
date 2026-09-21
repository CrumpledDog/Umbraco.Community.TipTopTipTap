import type { Page } from "@playwright/test";

/**
 * Umbraco's backoffice login is two cooperating apps (confirmed by reading Umbraco's own
 * source - `Umbraco.Cms.Api.Management/Controllers/Security/BackOfficeController.cs`,
 * `Umbraco.Web.UI.Login/src/auth.element.ts`, `packages/core/auth/components/umb-auth-view.element.ts`
 * - same pattern documented in Crumpled.UmbracoAzureHostingKit's tests/e2e/global-setup.ts):
 *
 *  - `/umbraco` is the Lit SPA (`umb-auth-view`, shadow DOM). When unauthenticated it shows a
 *    "Sign in with Umbraco" button that starts an OAuth/PKCE authorize request.
 *  - `/umbraco/login` is a separate, non-SPA login page (`umb-auth` from `Umbraco.Web.UI.Login`)
 *    with real light-DOM `#username-input`/`#password-input` fields (deliberately not shadow DOM,
 *    so Chrome autofill works) and a "Login" submit button.
 *
 * Starting from `/umbraco` (rather than jumping straight to `/umbraco/login`) means the SPA's
 * own button supplies the OAuth authorize URL as `ReturnUrl`, so submitting credentials completes
 * the whole authorize/token exchange in one pass. A defensive fallback click handles the case
 * where a second "Sign in with Umbraco" screen appears anyway (e.g. navigating directly to
 * `/umbraco/login` with no `ReturnUrl`).
 */
export async function loginToBackoffice(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/umbraco");

  const signInWithUmbraco = page.getByRole("button", { name: /sign in with umbraco/i });
  if (await signInWithUmbraco.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await signInWithUmbraco.click();
  }

  await page.waitForURL(/\/umbraco\/login/, { timeout: 15_000 });
  await page.locator("#username-input").fill(email);
  await page.locator("#password-input").fill(password);
  await page.getByRole("button", { name: /login/i }).click();

  const secondSignIn = page.getByRole("button", { name: /sign in with umbraco/i });
  if (await secondSignIn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await secondSignIn.click();
  }

  await page.waitForURL(/\/umbraco\/section\//, { timeout: 20_000 });
}
