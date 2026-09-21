import { test, expect, type Page } from "@playwright/test";

/**
 * Reproduces (as a real, committed test) what an earlier one-off/throwaway Playwright script
 * proved manually: pasting Word/Office-formatted HTML into a Rich Text Editor with the
 * "Office Paste Cleanup" tiptap extension enabled (see
 * src/Umbraco.Community.TipTopTipTap/Client/src/tiptap/cleanup-empty-attrs.extension.ts and
 * office-paste.extension.ts) strips the debris Office paste leaves behind - empty `class=""`/
 * `style=""` attributes and meaningless empty `<span>` wrappers - while leaving genuinely
 * meaningful markup (a real inline style, a bold run) intact.
 *
 * Fixture: tests/e2e/fixtures/seed.Umbraco.sqlite.db (restored into place before the DemoSite
 * starts - see package.json's restore-seed-db script and tests/e2e/README.md) already contains:
 *  - a dedicated "Paste Test RTE" data type (Rich Text Editor, "Office Paste Cleanup" extension
 *    enabled) - deliberately NOT the built-in "Richtext editor" data type
 *  - a "Paste Test Page" document type with a "Body Text" property using that data type,
 *    allowed at the content root
 *  - a published "Paste Test" content node of that type
 *
 * Playwright's own locators auto-pierce open shadow roots (Lit's default, which the whole
 * backoffice is built from), so no custom shadow-DOM query helper is needed here - same as
 * documented in Crumpled.UmbracoAzureHostingKit's tests/e2e suite.
 */

/** Word/Office-style HTML: mso-* junk, an empty class/style span, a bare <span><b>, and a
 * second paragraph with a real (non-mso) inline style that must survive unchanged. */
const WORD_PASTE_HTML = `
  <p class="MsoNormal" style="mso-margin-top-alt:auto;mso-margin-bottom-alt:auto;mso-line-height-alt:14.0pt">
    <span style="">Hello </span><span class="" style=""><b>World</b></span> this is a paste test.
  </p>
  <p style="color:#FF0000;mso-fareast-language:EN-US">
    This paragraph keeps its real styling.
  </p>
`;
const WORD_PASTE_PLAIN_TEXT = "Hello World this is a paste test. This paragraph keeps its real styling.";

async function openPasteTestPage(page: Page): Promise<void> {
  await page.goto("/umbraco/section/content");
  await page.getByRole("link", { name: "Paste Test", exact: true }).first().click();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
}

async function pasteWordHtml(page: Page): Promise<void> {
  const editable = page.locator('[contenteditable="true"]');
  await editable.click();

  // Clear any existing content first so repeated local runs (without restoring the seed DB
  // each time) stay deterministic rather than appending to whatever was there before.
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");

  // Dispatch a real ClipboardEvent - `transformPastedHTML` (see cleanup-empty-attrs.extension.ts)
  // is a ProseMirror clipboard hook that only fires during actual paste event processing, not
  // for programmatic content insertion.
  await editable.evaluate(
    (el, { html, text }) => {
      el.focus();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/html", html);
      dataTransfer.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      el.dispatchEvent(pasteEvent);
    },
    { html: WORD_PASTE_HTML, text: WORD_PASTE_PLAIN_TEXT },
  );

  // Let the paste + our ProseMirror plugins (transformPastedHTML, then appendTransaction's
  // empty-span-mark removal) settle before reading the result back out.
  await expect(editable.locator("strong")).toBeVisible();
}

test("Office Paste Cleanup strips Word paste debris while preserving real content", async ({ page }) => {
  await openPasteTestPage(page);
  await pasteWordHtml(page);

  // The Save button re-enables optimistically before the actual persist request resolves, so
  // waiting on button state alone can race a reload against an in-flight save (confirmed live:
  // the reload below would occasionally see the pre-save empty content). Wait for the real
  // PUT .../management/api/v1/document/{id} response instead - not the .../v1.1/.../validate
  // call that precedes it.
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "PUT" &&
        /\/management\/api\/v1\/document\/[0-9a-f-]+$/.test(new URL(res.url()).pathname) &&
        res.status() === 200,
      { timeout: 15_000 },
    ),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);

  // Reload from the server so the assertions below cover what was actually persisted, not just
  // the in-memory editor state immediately after paste.
  await page.reload();
  const editable = page.locator('[contenteditable="true"]');
  await expect(editable.locator("strong")).toBeVisible({ timeout: 15_000 });

  // A real DOM parse of the resulting content, not substring matching - the previous throwaway
  // script found substring matching gives false positives (e.g. matching the literal text
  // `class=""` if it ever appeared inside ordinary sentence content).
  const result = await editable.evaluate((el) => {
    const emptyClassEls = el.querySelectorAll('[class=""]');
    const emptyStyleEls = el.querySelectorAll('[style=""]');
    const spans = el.querySelectorAll("span");
    const strongEls = Array.from(el.querySelectorAll("strong")).map((n) => n.textContent);
    const paragraphs = Array.from(el.querySelectorAll("p")).map((p) => ({
      text: p.textContent?.trim(),
      style: p.getAttribute("style"),
    }));

    return {
      emptyClassCount: emptyClassEls.length,
      emptyStyleCount: emptyStyleEls.length,
      spanCount: spans.length,
      strongTexts: strongEls,
      paragraphs,
    };
  });

  expect(result.emptyClassCount, "no element should have an empty class attribute").toBe(0);
  expect(result.emptyStyleCount, "no element should have an empty style attribute").toBe(0);
  expect(result.spanCount, "no <span> elements should remain").toBe(0);

  // The bold run ("World", originally wrapped in a bare <span><b>) became a clean <strong>.
  expect(result.strongTexts.some((t) => t?.includes("World"))).toBe(true);

  // The second paragraph's real (non-mso) inline style survived - the cleanup is surgical, not
  // destructive.
  const styledParagraph = result.paragraphs.find((p) => p.text?.includes("keeps its real styling"));
  expect(styledParagraph, "styled paragraph should still be present").toBeTruthy();
  expect(styledParagraph?.style, "real inline style should survive unchanged").toBeTruthy();
  expect(styledParagraph?.style).toContain("color");
  expect(styledParagraph?.style).not.toBe("");

  // And, for completeness, the mso-only-styled first paragraph is genuinely empty of style now,
  // not just "some junk removed" - it never had a real style property to keep in the first place.
  const firstParagraph = result.paragraphs.find((p) => p.text?.includes("paste test"));
  expect(firstParagraph?.style === null || firstParagraph?.style === "").toBe(true);
});
