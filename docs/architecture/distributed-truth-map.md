# Distributed Truth Map

Oltigo repeatedly chooses **multiple synchronized sources of truth** instead of pretending that one file is canonical for every concern.

That is not accidental. It is part of the architecture.

## 1. Map

| Concern                            | Source A                                                  | Source B                                     | Synchronization guard                                                                                                       |
| ---------------------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cron schedules                     | `wrangler.toml`                                           | `worker-cron-handler.ts`                     | `scripts/check-cron-mapping.ts`, `src/lib/__tests__/cron-schedule-sync.test.ts`                                             |
| Scope-control documentation        | `MVP_SCOPE.md`                                            | live code symbols and files                  | `scripts/check-mvp-scope-refs.mjs`                                                                                          |
| Dropped clinical schema boundary   | `supabase/migrations/00187_drop_clinical_emr_surface.sql` | runtime source under `src/`                  | `scripts/check-dropped-clinical-table-refs.mjs`                                                                             |
| Tenant safety                      | app-level `clinic_id` scoping in routes and data layers   | SQL helpers, RLS, and booking RPC validation | `scripts/check-tenant-scoping.mjs`, `supabase/tests/no_force_rls.test.sql`, `supabase/tests/booking_atomic_insert.test.sql` |
| Egress policy                      | integration modules                                       | `safeFetch()` allowlist wrapper              | `scripts/check-egress-safefetch.mjs`                                                                                        |
| Operations-first scope enforcement | `docs/adr/0013-operations-first-scope.md`                 | route/handler gating in code                 | `scripts/check-scope-enforcement.mjs`                                                                                       |

## 2. Why This Matters

A reviewer can easily get misled by reading only one layer:

- only infra config, not runtime routing
- only docs, not code
- only handlers, not SQL tests
- only migrations, not current runtime references

Oltigo's architecture is better described as **distributed truth with synchronization guards**.

## 3. Design Rule

When adding a new cross-cutting concern, decide explicitly:

1. Which files hold the truth?
2. Why is more than one source needed?
3. What automated guard keeps them synchronized?

If there is no answer to question 3, the concern is probably under-documented or under-enforced.
