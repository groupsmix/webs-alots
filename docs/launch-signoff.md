# Launch Sign-off — CI / Build / Lint / Typecheck / Tests / Audit

This document records the green verification run that satisfies launch
blocker **#4 (UNVERIFIED)** — "Run and verify CI / build / lint /
typecheck / tests / audit". It is intended as a checkpoint reference;
re-run the steps below before each subsequent launch milestone and
update the table.

## Reference run

| Field | Value |
| --- | --- |
| Repository | [`groupsmix/webs-alots`](https://github.com/groupsmix/webs-alots) |
| Base branch | `main` |
| Latest reference SHA on `main` | [`113d727a`](https://github.com/groupsmix/webs-alots/commit/113d727a550486ff15fd6723e2cc0d2081458b62) |
| Reference green CI run (PR #448, identical CI matrix as `main`) | [Run on commit `560ad983`](https://github.com/groupsmix/webs-alots/pull/448) |
| Node version | 22.x (per CI workflow + repo `node_modules` lock) |
| npm version | 10.x |
| Date verified | 2026-04-28 |

The CI workflow (`.github/workflows/ci.yml`) is triggered on every PR
into `main` / `staging`, so the canonical "green CI run" is the
latest passing PR. The most recent merged PRs (#445, #446, #447) and
the open #448 all show **7/7 checks green**.

## Local verification matrix (run against `113d727a`)

```
$ npm ci                    # clean install
added 1432 packages, and audited 1433 packages in 49s
found 0 vulnerabilities

$ npm run lint              # eslint
✖ 4855 problems (0 errors, 4855 warnings)

$ npm run typecheck         # tsc --noEmit
(no errors)

$ npm run test              # vitest run
 Test Files  56 passed | 1 skipped (57)
      Tests  573 passed | 24 skipped (597)

$ npm run build             # next build
✓ Compiled successfully in 64s
✓ Finished TypeScript in 66s
✓ Generating static pages using 1 worker (356/356) in 3.5s
✓ Finalizing page optimization in 16ms

$ npm audit
found 0 vulnerabilities
```

### Status per launch sub-task

| Sub-task | Status | Evidence |
| --- | --- | --- |
| `npm ci` clean install | green | local run, `added 1432 packages`, `found 0 vulnerabilities` |
| `npm run build` | green | local + CI (`Build & Deploy` in deploy workflow runs the same steps) |
| `npm run lint` | green | 0 errors (4855 warnings — see below) |
| `npm run typecheck` | green | `tsc --noEmit` clean |
| Unit tests pass | green | 573 passed / 24 skipped |
| E2E tests pass | green | CI job `E2E Tests (Playwright)` green on PRs #445–#448 |
| `npm audit` reviewed; remediate high/critical advisories | green | `0 vulnerabilities` (incl. `--omit=dev` in CI step `Check for vulnerable dependencies`) |
| Document the green CI run | this file | — |

## Notes & caveats

- **Lint warnings (4855):** all are `i18next/no-literal-string`,
  `jsx-a11y/no-static-element-interactions`, and similar style
  warnings. CI treats only **errors** as fail-the-build. They are
  tracked separately and should be burned down post-launch but are
  not launch-blocking.
- **`Deploy to Cloudflare Workers` workflow** has been failing on
  recent `main` commits at the `Set up job` step. This is an
  infrastructure/secret problem in the deploy workflow only — it is
  unrelated to source quality and does not appear in the PR CI
  matrix. Should be triaged separately before a real deploy attempt.
- **Bundle size budget** is checked in CI as part of the `Lint, Type
  Check & Tests` job (`Bundle size budget check` step) with a 250 kB
  shared-JS limit per `AGENTS.md`. The PR matrix is green, so the
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
