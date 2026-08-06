# ADR-0009: npm package overrides

**Status:** Accepted
**Date:** 2026-05-28

## Context

Several transitive dependencies ship with known vulnerabilities or
regressions that affect our Cloudflare Workers build. npm `overrides`
pins these to patched versions across the entire dependency tree.

## Decision

Maintain an `overrides` block in `package.json` (and `workers/ai/package.json` where applicable) with the following pins:

| Package                   | Pin        | Reason                                                                                                                                                                     |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postcss`                 | `^8.5.10`  | CVE-2026-41305 — XSS via unescaped `</style>` in CSS stringify output (GHSA-qx2v-qp2m-jg93). OpenNext and tailwindcss depend on older postcss.                             |
| `@hono/node-server`       | `^2.0.5`   | GHSA-frvp-7c67-39w9 path traversal in `serve-static` on Windows. Bumped from `^1.19.13` after the `2.0.5` release fixed the issue and kept `hono` `^4` peer compatibility. |
| `hono`                    | `^4.12.34` | GHSA-8j4g-w8fx-2239 ReDoS in CORS middleware via `Access-Control-Request-Headers`.                                                                                         |
| `valibot`                 | `^1.4.2`   | GHSA-5qjj-4xww-7phc `flatten()` throws on inherited Object property names. Used by `shadcn` and Storybook MCP tooling.                                                     |
| `react-copy-to-clipboard` | `^5.1.1`   | Peer dependency conflict with React 19.                                                                                                                                    |

`workers/ai/package.json` adds additional runtime-specific overrides for `body-parser` (`^1.20.6`), `undici` (`^7.29.0`), `wrangler` (`^4.119.0`), `@hono/node-server` and `hono` to keep the AI Worker build free of moderate/high CVEs in its bundled dependencies.

## Consequences

- Each override must be reviewed when bumping the parent dependency.
- Remove an override once the parent ships the patched version natively.
- `npm audit` in CI ensures no new moderate/high/critical vulns slip through; the AI Worker package is audited separately at `--audit-level=moderate`.
