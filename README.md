# Floating Heading Number

[简体中文](https://github.com/airium/siyuan-floating-heading-number/blob/main/README.zh-CN.md)

Floating Heading Number displays hierarchical numbers floating beside headings in SiYuan's desktop editor. Numbers are computed from the complete BlockDOM returned by the kernel, so they stay exact when a long document is only partially mounted in the editor.

## Behavior

* Uses the highest heading level present in the document as the numbering root.
* Preserves skipped levels with zero placeholders, such as `1.0.1`.
* Excludes headings nested anywhere inside blockquotes, callouts, and query embeds.
* Shares one full-document snapshot across split editors and refreshes it after heading-affecting transactions.
* Shows numbers only when the editor has at least 48 px of left padding.
* Keeps folded-heading controls available and hides numbers during gutter, selection, highlight, range, and drag interactions.
* Does not modify heading block attributes, classes, styles, transactions, or undo data.

Floating heading numbering is enabled by default and can be changed globally in the plugin settings.

## Compatibility

SiYuan 3.7.1 or later is required. The plugin supports `desktop`, `browser-desktop`, and `desktop-window`. It is disabled in publishing mode and does not run on mobile frontends.

The implementation relies on the internal `/api/block/getBlockDOM` endpoint and SiYuan's Protyle DOM selectors. These are compatibility dependencies rather than new public APIs.

## Development

Install Node.js 24+ and pnpm, then run:

```sh
pnpm install
pnpm check
```

`pnpm build` creates `package.zip` and verifies its marketplace contents. `pnpm benchmark` records detached BlockDOM parse and visible-rule rendering measurements for generated 10k- and 50k-block documents; pass `--endpoint http://127.0.0.1:6806 --root-id <id>` to also measure a live kernel request.

## License

AGPL-3.0. See [LICENSE](https://github.com/airium/siyuan-floating-heading-number/blob/main/LICENSE).
