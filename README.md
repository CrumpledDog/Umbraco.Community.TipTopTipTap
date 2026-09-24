# Umbraco.Community.TipTopTipTap

A Rich Text Editor (TipTap) extension for Umbraco that cleans up the debris Word/Office paste leaves
behind: every `style` attribute (not just empty ones), empty `class=""` attributes, and meaningless empty
`span` marks. It's layered on top of the
[`@intevation/tiptap-extension-office-paste`](https://www.npmjs.com/package/@intevation/tiptap-extension-office-paste)
npm package's own `mso-*` style and list cleanup, so pasted content ends up genuinely clean instead of
carrying over the source application's inline formatting and dead attributes.

<img src="https://raw.githubusercontent.com/CrumpledDog/Umbraco.Community.TipTopTipTap/release/v1/icons/icon.png" width="120" height="120" alt="">

## Installation

```bash
dotnet add package Umbraco.Community.TipTopTipTap
```

No configuration is required - just install the package and enable the extension per Rich Text Editor
data type (see "How it works" below).

## How it works

The package registers a single TipTap extension, **Office Paste Cleanup**, with Umbraco's Rich Text Editor.
It does two things:

1. **On paste** (`transformPastedHTML`): before Umbraco's editor parses the pasted HTML, it strips every
   `style` attribute (regardless of content) and any `class=""` attribute Word/Office left behind empty.
   Inline styles from the source application (Word, a browser, another editor, etc.) are never allowed
   through - only the site's own CSS should control how content looks.
2. **After the paste lands in the document** (`appendTransaction`): it walks the resulting document and
   removes any `span` mark that has no meaningful attributes left, so editors aren't left with invisible,
   purposeless `<span>` wrappers cluttering the saved markup.

Both steps run immediately after `@intevation/tiptap-extension-office-paste`'s own cleanup, so the two
extensions work together rather than duplicating effort.

## Enabling it on a data type

This uses Umbraco's own standard mechanism for TipTap extensions - no custom configuration screen is
needed:

1. Go to **Settings → Data Types** and open (or create) a **Rich Text Editor** data type.
2. In the **Available extensions** list, tick **Office Paste Cleanup**.
3. Save the data type. Any content using it will now have the cleanup applied automatically whenever
   content is pasted into that RTE.

<img src="https://raw.githubusercontent.com/CrumpledDog/Umbraco.Community.TipTopTipTap/release/v1/docs/images/enable-extension.png" width="600" alt="The Rich Text Editor data type's Settings screen, with Office Paste Cleanup ticked in the Text formatting capabilities list">

## Requirements

- Umbraco CMS 17 or 18

## Testing

A Playwright end-to-end suite lives at
[`tests/e2e/`](https://github.com/CrumpledDog/Umbraco.Community.TipTopTipTap/tree/release/v1/tests/e2e/) and
exercises the actual paste-cleanup behaviour against a real backoffice (login, paste crafted Word-style HTML
into a seeded Rich Text Editor property, save, and assert on the resulting markup via a real DOM parse). See
[`tests/e2e/README.md`](https://github.com/CrumpledDog/Umbraco.Community.TipTopTipTap/blob/release/v1/tests/e2e/README.md)
for how to run it locally and how to regenerate its seed database fixture.

## Contributing

See [CONTRIBUTING.md](https://github.com/CrumpledDog/Umbraco.Community.TipTopTipTap/blob/release/v1/CONTRIBUTING.md)
for the branching strategy and formatting requirements.

## License

[MIT](https://github.com/CrumpledDog/Umbraco.Community.TipTopTipTap/blob/release/v1/LICENSE)
