---
inclusion: fileMatch
fileMatchPattern: ["src/**/__tests__/**/*.ts", "src/**/__tests__/**/*.tsx", "e2e/**/*.ts", "**/*.test.ts"]
---

# Oltigo — Tests (Kiro)

Builds on `AGENTS.md` §Test Conventions. Locations: unit in `src/**/__tests__/`, integration in `src/lib/__tests__/integration/`, e2e in `e2e/`.

## Use the existing test infrastructure

Reuse the shared mocks in `src/components/__tests__/test-utils.ts`: `createMockSupabaseClient()`, `createMockTenantHeaders()`, `mockLogger`, `createMockRequest()`, `createJsonRequest()`. Don't hand-roll new mock plumbing.

## Real tests, not tautologies

- Import and invoke the **actual** route handler / function. A test that checks test data against itself, or only asserts a mock returned what you set, proves nothing.
- **Schema tests are supplementary.** Always pair a Zod-schema test with a route-handler test that exercises the full chain: request → auth → validation → mutation → response.
- Coverage never drops below `.vitest-coverage-floor.json`.

## Security tests are required (AGENTS.md implies them; make them explicit)

For any feature reading/writing tenant data, add tests that prove the guardrails, not just the happy path:

- **Tenant isolation:** a request for clinic A cannot read or mutate clinic B's rows.
- **Permission denied:** a role below the required level is rejected (e.g. `patient` reaching another patient's record, `doctor` doing a `clinic_admin` action).
- **Validation failure:** malformed/oversized/missing input is rejected before any DB call.
- **Audit:** a state-changing path records a `logAuditEvent()`.

## E2E (Playwright)

Cover the primary path plus at least one failure path, and test Arabic (RTL) where layout matters. Tests are self-contained; no real PHI in fixtures — use synthetic data.
