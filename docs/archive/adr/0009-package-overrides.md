# ADR-0009: npm package overrides

**Status:** Accepted
**Date:** 2026-05-28

## Context

Several transitive dependencies ship with known vulnerabilities or
regressions that affect our Cloudflare Workers build. npm `overrides`
pins these to patched versions across the entire dependency tree.

## Decision

Maintain an `overrides` block in `package.json` with the following pins:

| Package                   | Pin        | Reason                                                                                                                                         |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `postcss`                 | `^8.5.10`  | CVE-2026-41305 — XSS via unescaped `</style>` in CSS stringify output (GHSA-qx2v-qp2m-jg93). OpenNext and tailwindcss depend on older postcss. |
| `@hono/node-server`       | `^1.19.13` | Body-parsing regression in Cloudflare Workers. OpenNext's `@opennextjs/cloudflare` transitively depends on hono.                               |
| `react-copy-to-clipboard` | `^5.1.1`   | Peer dependency conflict with React 19.                                                                                                        |

## Consequences

- Each override must be reviewed when bumping the parent dependency.
- Remove an override once the parent ships the patched version natively.
- `npm audit` in CI ensures no new high/critical vulns slip through.
