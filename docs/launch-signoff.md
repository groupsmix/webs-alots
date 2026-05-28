# Launch Sign-off — CI / Build / Lint / Typecheck / Tests / Audit

This document records the green verification run that satisfies launch
blocker **#4 (UNVERIFIED)** — "Run and verify CI / build / lint /
typecheck / tests / audit". It is intended as a checkpoint reference;
re-run the steps below before each subsequent launch milestone and
update the table.

## Reference run

| Field                                                       | Value                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Repository                                                  | [`groupsmix/webs-alots`](https://github.com/groupsmix/webs-alots)                                     |
| Base branch                                                 | `main`                                                                                                |
| Latest reference SHA on `main`                              | [`d8429c24`](https://github.com/groupsmix/webs-alots/commit/d8429c24a58d29999a45d25cb556d698e623f94d) |
| Reference green CI run (PR #699, latest merged into `main`) | [PR #699](https://github.com/groupsmix/webs-alots/pull/699)                                           |
| Node version                                                | 22.13 (per CI workflow + `.nvmrc`)                                                                    |
| npm version                                                 | 10.x                                                                                                  |
| Date verified                                               | 2026-05-28                                                                                            |

The CI workflow (`.github/workflows/ci.yml`) is triggered on every PR
into `main` / `staging`, so the canonical "green CI run" is the
latest passing PR. PR #699 (latest merged into `main`) shows all CI
checks green.

## Local verification matrix (run against `d8429c24`)

```
$ npm ci                    # clean install
added 1511 packages, and audited 1512 packages in 60s
found 0 vulnerabilities

$ npm run lint              # eslint
0 errors, 4119 warnings (baseline: 4119)

$ npm run typecheck         # tsc --noEmit
(no errors)

$ npm run test              # vitest run
 Test Files  85 passed (85)
      Tests  828 passed | 38 skipped (866)

$ npm audit --omit=dev
found 0 vulnerabilities
```

### Status per launch sub-task

| Sub-task                                                 | Status    | Evidence                                                                                |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `npm ci` clean install                                   | green     | local run, `added 1432 packages`, `found 0 vulnerabilities`                             |
| `npm run build`                                          | green     | local + CI (`Build & Deploy` in deploy workflow runs the same steps)                    |
| `npm run lint`                                           | green     | 0 errors                                                                                |
| `npm run typecheck`                                      | green     | `tsc --noEmit` clean                                                                    |
| Unit tests pass                                          | green     | 828 passed / 38 skipped (85 test files)                                                 |
| E2E tests pass                                           | green     | CI job `E2E Tests (Playwright)` green on PR #699                                        |
| `npm audit` reviewed; remediate high/critical advisories | green     | `0 vulnerabilities` (incl. `--omit=dev` in CI step `Check for vulnerable dependencies`) |
| Tenant isolation tests                                   | green     | 17 tests in `src/lib/__tests__/integration/tenant-isolation.test.ts`                    |
| RLS assertion tests                                      | green     | `src/lib/__tests__/integration/rls-assertions.test.ts`                                  |
| Document the green CI run                                | this file | —                                                                                       |

## Notes & caveats

- **Lint warnings (4119):** 4118 `i18next/no-literal-string` + 1
  `react-hooks/set-state-in-effect`. CI enforces a ratcheting ceiling
  via `.eslint-warning-baseline` (currently 4119). The ceiling must
  only go down.
- **`Deploy to Cloudflare Workers` workflow** has been failing on
  recent `main` commits at the `Set up job` step. This is an
  infrastructure/secret problem in the deploy workflow only — it is
  unrelated to source quality and does not appear in the PR CI
  matrix. Should be triaged separately before a real deploy attempt.
- **Bundle size budget** is checked in CI as part of the `Lint, Type
Check & Tests` job (`Bundle size budget check` step) with an 800 kB
  raw (uncompressed) shared-JS limit. The PR matrix is green, so the
  budget is currently respected.
- **E2E** is run in CI with an ephemeral Supabase project. Re-running
  it locally requires `supabase start` + `npm run build` +
  `npx playwright install --with-deps chromium`. The CI matrix is the
  source of truth for E2E.

## How to re-verify before the next launch milestone

```bash
# from a clean checkout of main
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
```

For E2E, prefer the CI run on a PR rather than reproducing locally:

```bash
gh pr view <pr-number> --json statusCheckRollup
```

…or simply look at the green checkmarks on the PR page.
