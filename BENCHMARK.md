# Benchmark

Synthetic detached-DOM benchmark recorded on 2026-07-16 with Node.js 24.15.0 and happy-dom 20.10.6. Each fixture contains one heading for every ten blocks, and rendering mounts the first 200 headings to model SiYuan's partial editor DOM.

| Blocks | BlockDOM bytes | Full-tree headings |  Parse time | Visible render time | Generated CSS bytes |
| -----: | -------------: | -----------------: | ----------: | ------------------: | ------------------: |
| 10,000 |      1,152,956 |              1,000 |   795.71 ms |            15.05 ms |              85,036 |
| 50,000 |      5,808,956 |              5,000 | 3,898.49 ms |             4.32 ms |              85,036 |

The benchmark preserves exact full-tree numbering at both sizes and never uses a visible-only fallback. Unit tests separately verify that simultaneous split-editor loads coalesce into one request.

Browser DOM parsing performance is implementation-dependent, so these numbers are a regression baseline rather than a prediction for SiYuan's Chromium runtime. No live SiYuan 3.7.1 kernel was available during this run; use `pnpm benchmark -- --endpoint http://127.0.0.1:6806 --root-id <id>` to append kernel response time and response size measurements for a real document.
