# Flaky Test Quarantine

> **Audience:** Contributors, QA engineers
> **Last updated:** May 2026

## Purpose

When a test is known-flaky (passes on retry but fails intermittently), it
should be quarantined here rather than silently skipped or deleted. This
provides visibility into test health and prevents flaky tests from blocking
CI while they are investigated.

## Quarantine Process

1. Open a GitHub issue tagged `flaky-test` describing the failure pattern.
2. Add a `describe.skip` or `it.skip` with a comment linking the issue:
   ```typescript
   // QUARANTINED: https://github.com/groupsmix/webs-alots/issues/XXX
   it.skip("should handle concurrent bookings", () => { ... });
   ```
3. Add the test to the table below.
4. Fix the root cause, remove the skip, and close the issue.

## Currently Quarantined Tests

| File | Test name | Issue | Date quarantined | Root cause                           |
| ---- | --------- | ----- | ---------------- | ------------------------------------ |
| —    | —         | —     | —                | No flaky tests currently quarantined |

## Conditional Skips (not quarantined)

These 16 tests are gated on environment variables (e.g. `SUPABASE_SERVICE_ROLE_KEY`)
and are expected to skip in standard CI. They are **not** flaky — they require
infrastructure that is only available in integration environments:

- `src/lib/__tests__/integration/rls-real-postgres.test.ts` — requires `SUPABASE_LOCAL=true`
- Various integration tests requiring live Supabase connection

See `npm run test` output for the full skip list.
