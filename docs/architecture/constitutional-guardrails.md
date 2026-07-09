# Constitutional Guardrails

Oltigo's architecture is defined as much by what the system refuses to allow as by what modules exist.

This document captures the repo's **constitutional layer**: the CI guards, tests, ADRs, and runtime constraints that turn subtle invariants into machine-checked rules.

## 1. Executable Governance Layer

| Invariant                                                                       | Where it is enforced                                                                                | Why it matters                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Every tenant-scoped mutation must visibly carry `clinic_id` scoping             | `scripts/check-tenant-scoping.mjs`, `.github/workflows/ci.yml`                                      | Tenant isolation is a build-breaking architectural rule, not a code-review preference                |
| `FORCE ROW LEVEL SECURITY` must never be enabled on `public` tables             | `docs/adr/0011-no-force-rls.md`, `supabase/tests/no_force_rls.test.sql`, `.github/workflows/ci.yml` | The tenant layer depends on carefully constrained `SECURITY DEFINER` paths                           |
| Every cron route must authenticate before dispatch                              | `scripts/check-cron-auth.ts`, `src/lib/cron-auth.ts`                                                | Cron routes are intentionally outside browser CSRF protections and therefore need their own protocol |
| `wrangler.toml` cron expressions and the runtime cron router must stay aligned  | `scripts/check-cron-mapping.ts`, `src/lib/__tests__/cron-schedule-sync.test.ts`                     | Cron behavior is split across infra config and runtime code                                          |
| Egress-sensitive integrations must route outbound traffic through `safeFetch()` | `scripts/check-egress-safefetch.mjs`, `src/lib/fetch-wrapper.ts`                                    | Third-party outbound traffic is centralized behind an allowlist and audit choke-point                |
| `MVP_SCOPE.md` must only reference symbols that still exist in code             | `scripts/check-mvp-scope-refs.mjs`                                                                  | Scope-control documentation is treated as an interface, not informal prose                           |
| Runtime code must not reference tables dropped by migration `00187`             | `scripts/check-dropped-clinical-table-refs.mjs`, `.github/workflows/ci.yml`                         | Prevents deleted EMR schema from silently re-entering the runtime surface                            |
| Architecture-B route groups must be explicitly gated before shipping            | `scripts/check-scope-enforcement.mjs`, `docs/adr/0013-operations-first-scope.md`                    | The operations-first scope decision is enforced in code, not left to convention                      |
| Cross-tenant validation inside booking RPCs must remain intact                  | `supabase/tests/booking_atomic_insert.test.sql`                                                     | Some tenant safety rules live in SQL functions, not only in app handlers                             |

## 2. Negative Architecture Register

These are the most important "never-events" in the repo:

- Never trust inbound tenant headers. Tenant identity must be derived server-side.
- Never trust unsigned internal auth-context headers.
- Never allow cron routes without explicit bearer-secret authentication.
- Never allow raw egress from sensitive integrations when `safeFetch()` is required.
- Never enable `FORCE ROW LEVEL SECURITY` on the `public` schema.
- Never let tenant-scoped runtime code drift back toward tables dropped by migration `00187`.
- Never let scope-control documents or route gating drift silently away from actual code.

## 3. Reading Rule

When changing architecture-sensitive code, read the visible implementation **and** the matching guard:

- route logic + CI script
- migration + pgTAP test
- infra config + runtime router
- ADR + enforcement point

In Oltigo, the guard is often as architecturally important as the feature itself.
