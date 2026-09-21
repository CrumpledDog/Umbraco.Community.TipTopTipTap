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
 *
 * CI-only failure investigation (5 CI runs, resolved): the RTE's toolbar/contenteditable area
 * renders and becomes interactive before all of the data type's ~30 tiptap extensions (each its
 * own dynamically-imported JS chunk - `api: () => import(...)` in every extension's manifest,
 * including ours) have finished loading and registering their ProseMirror plugins. Locally this
 * gap is imperceptible; on CI's colder/slower runner it was wide enough that a paste fired before
 * "Office Paste Cleanup" was actually registered on the editor. Proven with temporary diagnostics
 * across several commits: a capture-phase `paste` listener confirmed the raw clipboardData
 * reaching the page, and an independent replica of the extension's own
 * `html.includes('class=""')` + `DOMParser`/`querySelectorAll` check, were both byte-identical
 * and correct in CI - the extension's OWN logic simply never ran, even though every dependency it
 * relies on (clipboard data, DOM APIs) worked. Delivery mechanism (synthetic `ClipboardEvent` vs
 * real OS clipboard + Ctrl+V) and build (packed nupkg vs dev build, Release vs Debug) were both
 * ruled out first via local A/B testing and further CI runs. Waiting for the network to settle
 * after opening the content node (below) gives every extension's chunk time to load before the
 * paste is attempted.
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
 * includes. Using the realistic full document exercises both extensions' real, intended code
 * paths rather than an under-specified fragment.
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

  // See the file-level comment above: the editor is interactive before all of the data type's
  // tiptap extensions (each a separate dynamically-imported chunk, including ours) have finished
  // registering. Wait for the network to go quiet - covers a cold CI runner still fetching/
  // evaluating those chunks - with a floor in case the persistent server-events WebSocket
  // connection (see `serverEventHub` in the console log) keeps "networkidle" from ever firing.
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1_000);
}

async function pasteWordHtml(page: Page): Promise<void> {
  const editable = page.locator('[contenteditable="true"]');
  await editable.click();

  // Clear any existing content first so repeated local runs (without restoring the seed DB
  // each time) stay deterministic rather than appending to whatever was there before.
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");

  // Write to the REAL OS clipboard, then send a genuine Ctrl+V, rather than dispatching a
  // synthetic `ClipboardEvent` directly at the editor - this exercises the exact same code path
  // a real user's paste would.
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

test("Office Paste Cleanup strips Word paste debris while preserving real content", async ({ page }) => {
  // TEMPORARY diagnostics, registered before any navigation so nothing is missed. Every previous
  // theory (delivery mechanism, packed nupkg vs dev build, Release vs Debug, extension-chunk load
  // timing) has been ruled out via local A/B testing and further CI runs - the CI-only failure is
  // still "2 spans, stuck" every time. This catches any failed network request for a .js chunk
  // (e.g. a case-sensitivity mismatch between an import path and the actual file on Linux's
  // case-sensitive filesystem, which would silently succeed on Windows/local) and any console/page
  // error that a listener registered only during the paste (as in earlier diagnostics) would miss
  // if it happens during the RTE's own initial extension loading, before the paste ever starts.
  page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("BROWSER PAGE ERROR:", err.message));
  page.on("requestfailed", (req) => console.log("REQUEST FAILED:", req.url(), req.failure()?.errorText));
  page.on("response", (res) => {
    if (res.url().endsWith(".js") && res.status() >= 400) {
      console.log("JS CHUNK BAD STATUS:", res.status(), res.url());
    }
  });

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
