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

/**
 * Word/Office-style HTML: a full, realistic Word-clipboard document (xmlns:o wrapper,
 * StartFragment/EndFragment comments, <o:p> tags) - not just a bare fragment of mso-* junk.
 *
 * This matters for more than realism: @intevation/tiptap-extension-office-paste's own
 * transformPastedHTML (src/index.ts, compiled to node_modules/@intevation/tiptap-extension-
 * office-paste/dist/index.js) only runs its mso/list/bookmark cleanup at all when
 * `html.indexOf("microsoft-com") !== -1 && html.indexOf("office") !== -1` - i.e. it's gated on
 * the `xmlns:o="urn:schemas-microsoft-com:office:office"` wrapper real Word/Outlook paste always
 * includes. An earlier version of this fixture used a bare `<p class="MsoNormal" style="mso-...">`
 * fragment with no such wrapper, which happened to still get cleaned up locally (our own
 * cleanup-empty-attrs.extension.ts's transformPastedHTML strips empty class=""/style="" and empty
 * <span> marks unconditionally, independent of office-paste's own detection) but failed
 * reproducibly in CI - confirmed live, not flaky, identical failure on both the initial attempt
 * and the retry. Rather than chase an environment-specific discrepancy in an under-specified
 * paste payload, this uses the realistic full document so both extensions' real, intended code
 * paths are exercised deterministically everywhere.
 *
 * mso-* junk: an empty class/style span, a bare <span><b>, an <o:p> tag, and a second paragraph
 * with a real (non-mso) inline style that must survive unchanged.
 */
const WORD_PASTE_HTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
</head>
<body lang="EN-US">
<!--StartFragment-->
<p class="MsoNormal" style="mso-margin-top-alt:auto;mso-margin-bottom-alt:auto;mso-line-height-alt:14.0pt">
  <span style="">Hello </span><span class="" style=""><b>World</b></span> this is a paste test.<o:p></o:p>
</p>
<p style="color:#FF0000;mso-fareast-language:EN-US">
  This paragraph keeps its real styling.<o:p></o:p>
</p>
<!--EndFragment-->
</body>
</html>
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

  // Write to the REAL OS clipboard, then send a genuine Ctrl+V, rather than dispatching a
  // synthetic `ClipboardEvent` directly at the editor. This matters, not just for realism:
  // a synthetic/untrusted event was confirmed live to behave inconsistently across platforms -
  // it worked reliably on Windows (both against a local dev build and a packed-nupkg Release
  // build) but reproducibly failed on CI's Linux runner every single time (3 separate CI runs,
  // never a timing issue - `defaultPrevented` was true and the DOM was already in its final,
  // uncleaned state the instant the synthetic event's dispatch returned, both immediately and
  // 500ms later). Routing through the browser's own native clipboard + paste handling instead
  // exercises the exact same code path a real user's paste would, which is consistent across
  // OSes because it no longer depends on how each platform's Chromium build happens to process
  // a JS-constructed, untrusted ClipboardEvent.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(
    async ({ html, text }) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    },
    { html: WORD_PASTE_HTML, text: WORD_PASTE_PLAIN_TEXT },
  );
  await editable.click();
  await page.keyboard.press("ControlOrMeta+V");

  // Let the paste + our ProseMirror plugins (transformPastedHTML, then appendTransaction's
  // empty-span-mark removal) settle before reading the result back out.
  await expect(editable.locator("strong")).toBeVisible();
  await expect(editable.locator("span")).toHaveCount(0, { timeout: 10_000 });
}

// TEMPORARY diagnostic test - isolates whether our OWN cleanup-empty-attrs.extension.ts logic
// (which has no mso/office gating condition at all - it fires whenever the pasted html literally
// contains `class=""`, `style=""`, or `<span`) ever runs in CI independently of office-paste's
// own processing. The main test above has failed identically in CI 4 times regardless of paste
// delivery mechanism (synthetic ClipboardEvent vs real OS clipboard + Ctrl+V) and regardless of
// whether the payload triggers office-paste's own mso detection - always "2 spans, stuck". This
// pastes a minimal fragment with no mso/office markers at all, to see if the simplest possible
// case (no interaction with office-paste's own transformPastedHTML chain) works in CI.
test("diagnostic: minimal non-Office span cleanup in isolation", async ({ page }) => {
  await openPasteTestPage(page);
  const editable = page.locator('[contenteditable="true"]');
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const minimalHtml = `<span class="">bare span text</span>`;
  await page.evaluate(
    async ({ html, text }) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    },
    { html: minimalHtml, text: "bare span text" },
  );

  // Intercept the paste event in the CAPTURE phase (guaranteed to run before ProseMirror's own
  // bubble-phase listener on the same element, regardless of attachment order) to see the exact
  // raw clipboardData ProseMirror itself would receive, and to independently replicate
  // cleanup-empty-attrs.extension.ts's own check/DOMParser logic outside the extension entirely -
  // this tells us whether the raw data or the DOM APIs themselves differ in CI, vs. the extension
  // simply not running. Stashed on `window` (not returned via a Promise) so this setup call
  // doesn't block waiting for a paste event that hasn't happened yet.
  await editable.evaluate((el) => {
    (window as unknown as { __diag?: unknown }).__diag = undefined;
    el.addEventListener(
      "paste",
      (event) => {
        const html = (event as ClipboardEvent).clipboardData?.getData("text/html") ?? "(none)";
        const includesEmptyClass = html.includes('class=""');
        let queryMatchCount = -1;
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          queryMatchCount = doc.querySelectorAll('[class=""]').length;
        } catch {
          queryMatchCount = -2;
        }
        (window as unknown as { __diag?: unknown }).__diag = { html, includesEmptyClass, queryMatchCount };
      },
      { capture: true, once: true },
    );
  });

  await editable.click();
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(1000);

  const captured = await page.evaluate(() => (window as unknown as { __diag?: unknown }).__diag);
  console.log("DIAGNOSTIC captured raw clipboardData:", JSON.stringify(captured));

  const innerHTML = await editable.evaluate((el) => el.innerHTML);
  console.log("DIAGNOSTIC minimal paste result:", innerHTML);
});

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
