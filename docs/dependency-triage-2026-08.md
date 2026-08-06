# Dependency Triage — 2026-08-06

> Repo: `groupsmix/webs-alots`  
> Scope: root `package.json` + `workers/ai/package.json`  
> Baseline: 7 moderate CVEs in root, 13 (6 low / 3 moderate / 4 high) in `workers/ai`  
> Result: **0 root vulnerabilities**, **6 low-severity upstream-only vulnerabilities** in `workers/ai`

## How we triaged

1. `npm audit` was run in both the root app and the AI Worker package.
2. Each finding was checked against actual usage in the codebase.
3. Transitive dependencies were pinned via `overrides` to patched versions.
4. Direct dependencies (`wrangler`) were bumped.
5. Remaining findings that cannot be fixed without breaking the AI Worker runtime are documented below.

## Root app (`package.json`)

### Findings before fix

| Package                                                                            | Severity | Advisory            | Why it mattered                                                                                                                                        |
| ---------------------------------------------------------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@hono/node-server`                                                                | moderate | GHSA-frvp-7c67-39w9 | Path traversal in `serve-static` on Windows. Pulled in by `@modelcontextprotocol/sdk` (dev/CLI tooling) and `@opennextjs/cloudflare` build-time paths. |
| `hono`                                                                             | moderate | GHSA-8j4g-w8fx-2239 | ReDoS in CORS middleware via `Access-Control-Request-Headers`. Pulled in by `@modelcontextprotocol/sdk` and AI Worker transitive deps.                 |
| `valibot`                                                                          | moderate | GHSA-5qjj-4xww-7phc | `flatten()` throws for inherited Object property names. Pulled in by `shadcn` CLI and Storybook MCP addons.                                            |
| `shadcn` / `@modelcontextprotocol/sdk` / `@storybook/addon-mcp` / `@storybook/mcp` | moderate | transitive          | These were flagged **only because** of the above three packages.                                                                                       |

### Fix

Added `overrides` in `package.json`:

```json
"@hono/node-server": "^2.0.5",
"hono": "^4.12.34",
"valibot": "^1.4.2"
```

After `npm install`:

```text
$ npm audit
found 0 vulnerabilities
```

### Validation

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test` — 2,282 passed / 117 skipped

## AI Worker (`workers/ai/package.json`)

### Findings before fix

| Package                  | Severity               | Advisory                     | Notes                                                                              |
| ------------------------ | ---------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `wrangler`               | high (via `miniflare`) | CVEs in `sharp` / `undici`   | `wrangler@4.102.0` pulled an old `miniflare` alpha.                                |
| `miniflare`              | high                   | CVEs in `sharp` and `undici` | Local dev / build emulator, not the deployed Worker, but still in the build graph. |
| `sharp`                  | high                   | GHSA-f88m-g3jw-g9cj          | Inherited from `miniflare`.                                                        |
| `undici`                 | high                   | multiple                     | `7.28.0` vulnerable to retry desync, CRLF, cookie injection.                       |
| `@hono/node-server`      | moderate               | GHSA-frvp-7c67-39w9          | Transitive from `@copilotkit/runtime`.                                             |
| `hono`                   | moderate               | GHSA-8j4g-w8fx-2239          | Transitive from `@copilotkit/runtime`.                                             |
| `body-parser`            | low                    | GHSA-v422-hmwv-36x6          | Inherited from `express` via `@modelcontextprotocol/sdk`.                          |
| `@ai-sdk/provider-utils` | low                    | GHSA-866g-f22w-33x8          | Transitive from `@copilotkit/runtime` -> `@ai-sdk/google-vertex`.                  |

### Fix

Bumped direct dependency:

```json
"wrangler": "^4.119.0"
```

Added `overrides`:

```json
"@copilotkit/runtime": {
  "uuid": "^11.1.1",
  "@hono/node-server": "^2.0.5",
  "hono": "^4.12.34"
},
"@hono/node-server": "^2.0.5",
"hono": "^4.12.34",
"body-parser": "^1.20.6",
"undici": "^7.29.0"
```

After `npm install`:

```text
$ npm audit --audit-level=moderate
found 0 vulnerabilities (6 low severity vulnerabilities remain)
```

### Validation

- `npm run typecheck` (inside `workers/ai`) — pass

## Remaining low-severity finding: `@ai-sdk/provider-utils`

### Why it is not patched

The 6 remaining low-severity findings in `workers/ai` all come from `@ai-sdk/provider-utils <= 3.0.97` pulled in by `@copilotkit/runtime` via `@ai-sdk/google-vertex` / `@ai-sdk/anthropic` / `@ai-sdk/google` / `@ai-sdk/openai-compatible`.

- The patched versions are `>= 4.0.0` of `@ai-sdk/provider-utils`.
- `@copilotkit/runtime` (including the latest `1.66.2`) still depends on `^3.x` AI SDK packages.
- Forcing a major-version override of `@ai-sdk/provider-utils` would break the CopilotKit runtime's internal provider contract and could silently break the AI Worker at runtime.
- `npm audit fix --force` suggests downgrading `@copilotkit/runtime` to `1.54.1`, which is a breaking change and moves backwards.

### Decision

Accept the **low-severity** finding and track it. It is:

- in the AI Worker, not the patient-facing clinic app;
- an uncontrolled resource consumption issue, not a data leak or RCE;
- blocked on `@copilotkit/runtime` updating its `@ai-sdk/*` transitive deps.

### Action

- File a dependency watch item for `@copilotkit/runtime` and `@ai-sdk/provider-utils`.
- When `@copilotkit/runtime` ships a version using `@ai-sdk/provider-utils >= 4.0.0`, remove the override and re-run `npm audit`.

## CI hardening

- `.github/workflows/ci.yml` already runs `npm audit --audit-level=high --omit=dev` and `npm audit --audit-level=critical` for the root app.
- A new step was added to run `npm audit --audit-level=moderate` inside `workers/ai` so the AI Worker package is also guarded against moderate/high/critical CVEs.

## Files changed

- `package.json` — root `overrides`
- `workers/ai/package.json` — `wrangler` bump + `overrides`
- `docs/archive/adr/0009-package-overrides.md` — updated rationale
- `docs/dependency-triage-2026-08.md` — this document
- `.github/workflows/ci.yml` — AI Worker `npm audit` step
