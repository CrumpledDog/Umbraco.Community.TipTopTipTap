# Umbraco.Community.TipTopTipTap

A Rich Text Editor (TipTap) extension for Umbraco that cleans up the debris Word/Office paste leaves
behind: empty `class=""`/`style=""` attributes and meaningless empty `span` marks. It's layered on top of
the [`@intevation/tiptap-extension-office-paste`](https://www.npmjs.com/package/@intevation/tiptap-extension-office-paste)
npm package's own `mso-*` style and list cleanup, so pasted Word/Office content ends up genuinely clean
instead of littered with dead attributes and pointless wrapper spans.

<img src="icons/icon.png" width="120" height="120" alt="">

## Installation

```bash
dotnet add package Umbraco.Community.TipTopTipTap
```

No configuration is required - just install the package and enable the extension per Rich Text Editor
data type (see "How it works" below).

## How it works

The package registers a single TipTap extension, **Office Paste Cleanup**, with Umbraco's Rich Text Editor.
It does two things:

1. **On paste** (`transformPastedHTML`): before Umbraco's editor parses the pasted HTML, it strips any
   `class=""` or `style=""` attribute that Word/Office left behind empty (a very common artifact of
   copy-pasting from Word or Outlook).
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

## Requirements

- Umbraco CMS 17 or 18

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy and formatting requirements.

## License

[MIT](LICENSE)
