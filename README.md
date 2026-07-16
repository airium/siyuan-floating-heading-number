# Floating Heading Number

[简体中文](https://github.com/airium/siyuan-floating-heading-number/blob/main/README.zh-CN.md)

Floating Heading Number displays hierarchical numbers floating beside headings in SiYuan's desktop editor. Numbers are computed from the complete BlockDOM returned by the kernel, so they stay exact when a long document is only partially mounted in the editor.

## Demonstration

### Numbering logic

<img width="600" alt="Hierarchical heading numbering demonstration" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/numbering-logic.gif">

### Automatic hiding in narrow views

<img width="600" alt="Heading numbers automatically hiding in a narrow editor" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/narrow-view-auto-hide.gif">

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

## Benchmark

Synthetic detached-DOM benchmark recorded on 2026-07-16 with Node.js 24.15.0 and happy-dom 20.10.6. Each fixture contains one heading for every ten blocks, and rendering mounts the first 200 headings to model SiYuan's partial editor DOM.

| Blocks | BlockDOM bytes | Full-tree headings |  Parse time | Visible render time | Generated CSS bytes |
| -----: | -------------: | -----------------: | ----------: | ------------------: | ------------------: |
| 10,000 |      1,152,956 |              1,000 |   795.71 ms |            15.05 ms |              85,036 |
| 50,000 |      5,808,956 |              5,000 | 3,898.49 ms |             4.32 ms |              85,036 |

The benchmark preserves exact full-tree numbering at both sizes and never uses a visible-only fallback. Unit tests separately verify that simultaneous split-editor loads coalesce into one request.

Browser DOM parsing performance is implementation-dependent, so these numbers are a regression baseline rather than a prediction for SiYuan's Chromium runtime. No live SiYuan 3.7.1 kernel was available during this run; use `pnpm benchmark -- --endpoint http://127.0.0.1:6806 --root-id <id>` to append kernel response time and response size measurements for a real document.

## Development

Install Node.js 24+ and pnpm, then run:

```sh
pnpm install
pnpm check
```

`pnpm build` creates `package.zip` and verifies its marketplace contents. `pnpm benchmark` records detached BlockDOM parse and visible-rule rendering measurements for generated 10k- and 50k-block documents; pass `--endpoint http://127.0.0.1:6806 --root-id <id>` to also measure a live kernel request.

## License

AGPL-3.0. See [LICENSE](https://github.com/airium/siyuan-floating-heading-number/blob/main/LICENSE).
