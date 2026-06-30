# Audit Baseline — Oltigo Health

> Frozen on **2026-05-30** as part of cleanup wave C1.

> **Note (historical snapshot):** The numbers below record the state at freeze
> time and are intentionally _not_ updated as the codebase changes. The live,
> CI-enforced values are the source of truth and currently are: ESLint warning
> baseline **3,457** (`.eslint-warning-baseline`); coverage floors
> **14% statements / 11% branches / 14% lines / 11% functions**
> (`.vitest-coverage-floor.json`); i18n coverage baseline **0 / 0** EN/AR
> (`.i18n-coverage-baseline.json`). Refer to those files, not this snapshot, for
> the current gates.

## Baseline Commit

| Field       | Value                                      |
| ----------- | ------------------------------------------ |
| Branch      | `main`                                     |
| SHA         | `ac45f75831d05c4f808eab243d7aa36f7c7905be` |
| Date frozen | 2026-05-30                                 |

## ESLint Warnings

- **Warning count:** 3,451 (re-verified 2026-06-30; frozen baseline file `.eslint-warning-baseline` records 3,457)
- **Source file:** `.eslint-warning-baseline`
- **Composition:** ~3,365 `i18next/no-literal-string`, 81 `react-hooks/set-state-in-effect`, remainder misc. 0 errors.

## Code Coverage Floors

From `.vitest-coverage-floor.json`:

| Metric     | Current Floor | Target |
| ---------- | ------------- | ------ |
| Statements | 14%           | 80%    |
| Branches   | 11%           | 70%    |
| Lines      | 14%           | 70%    |
| Functions  | 11%           | 60%    |

## i18n Empty Keys

- **Empty key count:** 0 (EN/AR) — re-verified 2026-06-30 (`.i18n-coverage-baseline.json` = {en:0, ar:0}). The historical 342 figure has been resolved.

## npm Audit (CVEs)

- **Status:** 0 vulnerabilities (re-verified 2026-06-30 via `npm audit`).

## Finding References

| Finding ID | Description             |
| ---------- | ----------------------- |
| FR-001     | ESLint warning baseline |
| FR-002     | Coverage floor baseline |
| FR-005     | i18n empty key count    |
