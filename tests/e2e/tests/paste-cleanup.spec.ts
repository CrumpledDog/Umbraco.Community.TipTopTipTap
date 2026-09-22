import { test, expect, type Page } from "@playwright/test";

/**
 * Reproduces (as a real, committed test) what an earlier one-off/throwaway Playwright script
 * proved manually: pasting Word/Office-formatted HTML into a Rich Text Editor with the
 * "Office Paste Cleanup" tiptap extension enabled (see
 * src/Umbraco.Community.TipTopTipTap/Client/src/tiptap/paste-attribute-cleanup.extension.ts and
 * office-paste.extension.ts) strips the debris Office paste leaves behind - every `style`
 * attribute (not just empty ones), empty `class=""` attributes, and meaningless empty `<span>`
 * wrappers - while leaving genuinely meaningful structural markup (a bold run) intact.
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
 * CI-only failure investigation (9 CI runs, resolved - not a bug in this test or in the
 * extension): the e2e job's own CI workflow was silently testing STALE code the whole time.
 * `~/.nuget/packages` (the global NuGet package cache, restored via ci.yml/release.yml's own
 * "Cache NuGet" step) is keyed by package ID + version, and this repo has never published a real
 * release, so semantic-release's dry-run "next version" (e.g. `1.0.0-alpha.1`) was IDENTICAL
 * across every run. `dotnet add package` saw that exact version already present in the cache from
 * an earlier run and silently reused it instead of the fresh .nupkg each run had just packed -
 * this repo's OWN packaging swap pattern (`dotnet remove reference` / `dotnet add package`) is
 * used by two jobs, `test-packages` and `e2e`, and both were affected. Confirmed by dumping every
 * `console`/`pageerror` from page load (not just during the paste, unlike two earlier diagnostic
 * attempts that only listened during the paste itself and missed load-time output): CI's browser
 * logged `"Hello from my extension 🎉"`, a leftover string that does not exist anywhere in this
 * repo's current source - proof CI was running a stale/earlier build of the package, not this
 * one. The real fix is in ci.yml/release.yml (`Clear cached local package` step, right before
 * `Replace ProjectReference with PackageReference` in both jobs) - nothing here needed to change
 * once that was found. Several earlier commits chased plausible-but-wrong theories first (paste
 * delivery mechanism, packed-nupkg vs dev build, Release vs Debug, extension-chunk load timing) -
 * each was ruled out with real evidence (temporary diagnostics, local A/B tests) before moving on,
 * which is how the actual cause was eventually found.
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
 * with a real (non-mso) inline style that must be stripped too - the cleanup removes every style
 * attribute on paste, not just mso-only/empty ones.
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
  This paragraph should lose its inline styling.<o:p></o:p>
</p>
<!--EndFragment-->
</body>
</html>
`;
const WORD_PASTE_PLAIN_TEXT = "Hello World this is a paste test. This paragraph should lose its inline styling.";

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

  // The second paragraph's real (non-mso) inline style was stripped too - the cleanup removes
  // every style attribute on paste, not just mso-only/empty ones.
  const styledParagraph = result.paragraphs.find((p) => p.text?.includes("lose its inline styling"));
  expect(styledParagraph, "second paragraph should still be present").toBeTruthy();
  expect(styledParagraph?.style === null || styledParagraph?.style === "").toBe(true);

  // And the mso-only-styled first paragraph is genuinely empty of style too.
  const firstParagraph = result.paragraphs.find((p) => p.text?.includes("paste test"));
  expect(firstParagraph?.style === null || firstParagraph?.style === "").toBe(true);
});
