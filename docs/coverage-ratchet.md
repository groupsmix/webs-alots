# Coverage Ratchet Policy

Source: AUD-002 (audit 2026-05-28).

## Goal

Raise statement coverage from 13% to 80% (target) over time WITHOUT back-filling
tests on legacy code (which produces brittle, low-value tests).

## Rule

Every PR that ships new features or non-trivial logic MUST:

1. Include tests for the new code.
2. Raise `.vitest-coverage-floor.json` `statements` by at least 1 (e.g. 13 → 14)
   BUT only if real coverage rose. Never set the floor higher than actual.

## Gates

- At floor ≥ 30%: TASK-015 can run (promote security per-file gate to required).
- At floor ≥ 50%: re-evaluate this policy.
- At floor = 80%: ratchet retires.

## Anti-patterns to refuse

- Tests that only call `safeParse` on a Zod schema with valid input (tautological).
- Tests that import a function and assert it is truthy.
- Tests that mock everything to the point that the unit under test is bypassed.

## Reviewer checklist

- Does the new code have meaningful tests?
- Did the floor go up?
- Are the new tests behavior tests, not tautology tests?

## i18n guideline (AUD-006, TASK-019)

When modifying any component, wrap newly-touched user-facing text in `t()` calls.
Do not perform unrelated i18n sweeps.
