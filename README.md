# Floating Heading Number

[简体中文](https://github.com/airium/siyuan-floating-heading-number/blob/main/README.zh-CN.md)

Floating Heading Number adds accurate, configurable hierarchical numbering to headings in SiYuan's desktop editor.

* **Exact across the whole document.** Numbering stays correct even when a long document is only partially rendered.
* **Flexible presentation.** Choose five placements and customize the prefix and suffix; by default, numbers appear as `§1` inside the left edge.
* **Non-invasive.** The plugin leaves heading blocks, transactions, and undo data untouched while adapting to editor interactions.

## Demonstration

### Numbering logic (outside-left placement)

<img width="600" alt="Hierarchical heading numbering demonstration" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/numbering-logic.gif">

### Automatic hiding in narrow views

<img width="600" alt="Heading numbers automatically hiding in a narrow editor" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/narrow-view-auto-hide.gif">

## Behavior

Floating heading numbering is enabled by default. Placement, prefix, suffix, and the minimum outside-gutter width are configured globally in the plugin settings. The defaults are inside left, a `§` prefix, no suffix, and a 48 px minimum gutter width for outside placements.

* Numbers are computed from the complete BlockDOM returned by the kernel, so they stay exact when a long document is only partially mounted in the editor.
* Uses the highest heading level present in the document as the numbering root.
* Preserves skipped levels with zero placeholders, such as `1.0.1`.
* Excludes headings nested anywhere inside lists, blockquotes, callouts, and query embeds.
* Shares one full-document snapshot across split editors and refreshes it after heading-affecting transactions.
* Places numbers outside or inside either edge of the heading row, or immediately after heading text.
* Adds configurable text before and after each number, defaulting to the section sign (`§`) prefix and no suffix.
* Auto-hides outside placements when the corresponding gutter is narrower than the configured minimum width.
* Keeps folded-heading controls available, hides outside numbers during heading hover or gutter activity, and hides all numbers during selection, highlight, range, and drag interactions.
* Does not modify heading block attributes, classes, styles, transactions, or undo data.

## Compatibility

SiYuan 3.7.1 or later is required. The plugin supports `desktop`, `browser-desktop`, and `desktop-window`. It is disabled in publishing mode and does not run on mobile frontends.

The implementation relies on the internal `/api/block/getBlockDOM` endpoint and SiYuan's Protyle DOM selectors. These are compatibility dependencies rather than new public APIs.

## Benchmark

Synthetic detached-DOM benchmark recorded on 2026-07-22 with Node.js 24.15.0 and happy-dom 20.10.6. Each fixture contains one heading for every ten blocks, and rendering mounts the first 200 headings to model SiYuan's partial editor DOM.

| Blocks | BlockDOM bytes | Full-tree headings |  Parse time | Visible render time | Generated CSS bytes |
| -----: | -------------: | -----------------: | ----------: | ------------------: | ------------------: |
| 10,000 |      1,152,956 |              1,000 |   973.79 ms |            26.59 ms |             109,284 |
| 50,000 |      5,808,956 |              5,000 | 3,916.16 ms |             7.52 ms |             109,284 |

The benchmark preserves exact full-tree numbering at both sizes and never uses a visible-only fallback. Unit tests separately verify that simultaneous split-editor loads coalesce into one request.

Browser DOM parsing performance is implementation-dependent, so these numbers are a regression baseline rather than a prediction for SiYuan's Chromium runtime. No live SiYuan 3.7.1 kernel was available during this run; use `pnpm benchmark -- --endpoint http://127.0.0.1:6806 --root-id <id>` to append kernel response time and response size measurements for a real document.

## Development

Install Node.js 24+ and pnpm, then run:

```sh
pnpm install
pnpm check
```

`pnpm build` creates `package.zip` and verifies its marketplace contents. `pnpm benchmark` records detached BlockDOM parse and visible-rule rendering measurements for generated 10k- and 50k-block documents; pass `--endpoint http://127.0.0.1:6806 --root-id <id>` to also measure a live kernel request.

## Release preparation

`plugin.json` is the canonical version source. To prepare a stable release:

1. From an up-to-date `main` branch, run `pnpm version:set 0.4.0` with the intended `MAJOR.MINOR.PATCH` version. This updates both `plugin.json` and `package.json`.
2. Add a dated `## v0.4.0 - YYYY-MM-DD` section to `CHANGELOG.md`. Its contents become the GitHub release notes.
3. Run `pnpm check`, review the resulting `package.zip`, then commit and push the manifest and changelog changes to `main`.
4. On GitHub, open **Actions > Release > Run workflow**, select `main`, and enter `0.4.0` without a `v` prefix.

The workflow accepts releases only from `main`, checks that the input matches both manifests, rejects an existing tag or release, installs from the frozen lockfile, runs the complete check/build/package verification, and requires matching changelog notes. It then creates tag and release `v0.4.0` at the dispatched commit and attaches exactly `package.zip`. Do not create the tag manually or replace an asset on an existing release; publish a new version for any correction.

For the first Marketplace publication, create the GitHub release before adding `airium/siyuan-floating-heading-number` to SiYuan Bazaar's `plugins.txt` in a pull request. After the repository is accepted, Bazaar discovers later GitHub releases automatically.

## License

AGPL-3.0. See [LICENSE](https://github.com/airium/siyuan-floating-heading-number/blob/main/LICENSE).
