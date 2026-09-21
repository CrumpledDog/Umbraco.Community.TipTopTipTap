# Copilot / Agent Instructions — Umbraco.Community.TipTopTipTap

A Rich Text Editor (TipTap) extension for Umbraco that cleans up the debris Word/Office paste leaves
behind - empty `class=""`/`style=""` attributes and meaningless empty `span` marks - layered on top of the
`@intevation/tiptap-extension-office-paste` npm package's own mso-style/list cleanup. See
[README.md](../README.md) for the feature overview and [CONTRIBUTING.md](../CONTRIBUTING.md) for the full
branching strategy.

## Repo shape

```
src/
  Umbraco.Community.TipTopTipTap/            - the whole package: just the embedded Client/ (Lit/TS)
                                                backoffice UI - no backend C# logic, no Management API
  Umbraco.Community.TipTopTipTap.DemoSite/   - minimal Umbraco 17 site, CI-only fixture (no starter kit)
tests/
  Umbraco.Community.TipTopTipTap.Tests/      - no C# logic exists to unit test; kept as scaffolding
                                                only, in case backend logic is ever added
```

Single packable project, generated from Umbraco's own `umbraco-extension` dotnet template (not a
hand-rolled Core/Client split) - the Client folder lives inside the same `.csproj`, not a separate one.

**This package is 100% frontend.** The `.csproj` intentionally references only `Umbraco.Cms.Web.Common`
(the `Microsoft.NET.Sdk.Razor` RCL still needs it to ship `App_Plugins` static web assets correctly) - no
`Umbraco.Cms.Api.Common`/`Api.Management`, no `Microsoft.AspNetCore.OpenApi`, no Controllers/Composers
folders. The real logic lives entirely under `Client/src/tiptap/`:
`cleanup-empty-attrs.extension.ts` is the actual TipTap `Extension` (a ProseMirror plugin - strips empty
`class`/`style` attrs from raw pasted HTML via `transformPastedHTML`, then strips attribute-less `span`
marks from the resulting doc via `appendTransaction`); `office-paste.extension.ts` is the
`UmbTiptapExtensionApiBase` entry point combining it with the npm `@intevation/tiptap-extension-office-paste`
package; `manifest.ts` registers it as a `tiptapExtension` (alias
`Umbraco.Community.TipTopTipTap.OfficePaste`).

## Two Umbraco majors, one repo

`develop/v1`/`release/v1` (Umbraco 17) is where all development happens. `develop/v2`/`release/v2`
(Umbraco 18, added later) only ever receives merges *from* v1 — never branch features directly against v2,
never cherry-pick. See CONTRIBUTING.md's "Umbraco 17/18 branch lines" section for the full git worktree
workflow and which files are marked `merge=ours` in `.gitattributes`.

Unlike most Crumpled packages, there is **no** genuine code-level difference between majors to isolate -
no Management API means no Swashbuckle-vs-native-OpenAPI split, so there's no
`Composers/OpenApiRegistration.UmbracoNN.cs` pair and no `$(UmbracoTargetMajor)`-conditional compilation in
the `.csproj`. The only thing expected to diverge between the two branch lines is the
`@umbraco-cms/backoffice` version pin in `Client/package.json`/`package-lock.json`.

## Formatting

`dotnet format --verify-no-changes` must pass in CI. Run `dotnet format` before committing.

## Frontend changes

This package has no Management API and no OpenAPI codegen step - there's nothing to regenerate a
TypeScript client against. Never use raw `fetch()` in Client code regardless; there's simply no backend
endpoint to call. If you touch the TipTap extension logic, verify it by pasting real Word/Office-formatted
HTML into a Rich Text Editor data type with the extension enabled and confirming the resulting markup has
no stray empty `class=""`/`style=""` attributes or empty `span` wrappers.

## Versioning

No hardcoded versions in the `.csproj` — semantic-release computes the version from Conventional Commits
and injects it at pack time via `/p:PackageVersion=`. Don't hand-edit version numbers anywhere.
