# Copilot / Agent Instructions — Umbraco.Community.TipTopTipTap

TODO: describe what this package does. See [README.md](../README.md) for the feature overview and
[CONTRIBUTING.md](../CONTRIBUTING.md) for the full branching strategy.

## Repo shape

```
src/
  Umbraco.Community.TipTopTipTap/            - the whole package: Management API, Composers, and (if generated
                                          with a backoffice UI) the embedded Client/ (Lit/TS)
  Umbraco.Community.TipTopTipTap.DemoSite/   - minimal Umbraco 17 site, CI-only fixture (no starter kit)
tests/
  Umbraco.Community.TipTopTipTap.Tests/
```

Single packable project, generated from Umbraco's own `umbraco-extension` dotnet template (not a
hand-rolled Core/Client split) - the Client folder lives inside the same `.csproj`, not a separate one.

## Two Umbraco majors, one repo

`develop/v1`/`release/v1` (Umbraco 17) is where all development happens. `develop/v2`/`release/v2`
(Umbraco 18, added later) only ever receives merges *from* v1 — never branch features directly against v2,
never cherry-pick. See CONTRIBUTING.md's "Umbraco 17/18 branch lines" section for the full git worktree
workflow and which files are marked `merge=ours` in `.gitattributes`.

The one genuine code-level difference between majors (Swashbuckle vs native OpenAPI document registration)
lives in `Composers/OpenApiRegistration.Umbraco17.cs`/`.Umbraco18.cs`, conditionally compiled via
`$(UmbracoTargetMajor)` from the repo-root `Directory.Build.props`. Everything else in the Composers/
Controllers is version-agnostic and merges cleanly across the two branches.

## Formatting

`dotnet format --verify-no-changes` must pass in CI. Run `dotnet format` before committing.

## API changes & codegen

If you change any Management API controller (routes, request/response models), regenerate the TypeScript
client: start `Umbraco.Community.TipTopTipTap.DemoSite` (`dotnet run`, `https://localhost:44399`), then
`cd src/Umbraco.Community.TipTopTipTap/Client && npm run generate-client`. Never hand-edit `src/api/*.gen.ts` -
it's gitignored and CI always regenerates it. Never use raw `fetch()` in Client code - always the generated
SDK functions from `src/api/index.js`.

## Versioning

No hardcoded versions in the `.csproj` — semantic-release computes the version from Conventional Commits
and injects it at pack time via `/p:PackageVersion=`. Don't hand-edit version numbers anywhere.
