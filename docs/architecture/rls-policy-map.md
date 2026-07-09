# RLS Policy Map

> **Status:** Living architecture contract  
> **Source of truth:** Supabase migrations + pgTAP tests  
> **Scope:** Tenant isolation and global-table exceptions

Oltigo is a multi-tenant healthcare SaaS. Database isolation is enforced in four layers:

1. Middleware derives tenant context from trusted host/subdomain data.
2. Auth wrappers bind the request to an authenticated profile and `clinic_id`.
3. Tenant-aware Supabase clients set `app.clinic_id` for PostgreSQL.
4. PostgreSQL RLS policies enforce tenant predicates.

Application scoping is still mandatory even when RLS exists. RLS is defense-in-depth, not a substitute for `.eq("clinic_id", clinicId)` in application queries.

## Policy classes

| Class                               | Tables                                                                                                            | Required policy shape                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant-owned operational data       | appointments, patients, invoices, notifications, services, staff-facing workflow tables                           | RLS enabled; policies require `clinic_id = current_setting('app.clinic_id', true)::uuid` or an equivalent tenant helper; app queries must also filter by `clinic_id` |
| Tenant-owned optional vertical data | specialty, diagnostic, equipment, restaurant/veterinary, and other feature-gated vertical tables that still exist | Same as tenant-owned operational data, plus feature/scope gating at app/API boundary when the surface is Architecture-B                                              |
| Public tenant discovery data        | public clinic profile/branding/website metadata                                                                   | Read policies may be public only for deliberately public columns; mutation policies remain authenticated and tenant-scoped                                           |
| Platform-global reference data      | clinic type catalog, pricing/plan definitions, capability/config catalog rows                                     | No tenant predicate when data is truly global; writes restricted to service role or super-admin paths                                                                |
| Security/audit data                 | audit logs, login/security events, retention events                                                               | Insert paths are authenticated/system-owned; read paths are least-privilege and tenant-scoped unless explicitly platform-admin only                                  |
| Background/cron control data        | retry queues, outbox rows, maintenance state                                                                      | Service-role functions may process across tenants only by iterating tenant-by-tenant and setting tenant context before touching tenant rows                          |

## Tenant predicate contract

For tenant-owned tables, policies must satisfy all of the following:

- RLS is enabled.
- User-facing `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies include a tenant predicate.
- Mutation policies prevent caller-controlled `clinic_id` escalation.
- Service-role bypasses are limited to audited functions, cron workers, or admin-only maintenance paths.
- Helper functions that read request context do not trust raw client-supplied tenant headers.

Canonical runtime helpers and constraints:

- `src/lib/tenant.ts` — derives tenant context.
- `src/lib/tenant-context.ts` — sets/logs tenant context.
- `src/lib/assert-tenant.ts` — validates UUID tenant IDs at runtime.
- `src/middleware.ts` — strips incoming tenant headers and re-derives context.

## Global-table exceptions

A table may omit `clinic_id` only when it is one of these explicit global islands:

- Platform/catalog configuration shared by all clinics.
- Pricing or plan metadata.
- Template or feature catalog definitions that do not contain PHI or tenant data.
- Operational scheduler metadata that does not include tenant-owned row content.

If a supposedly global table stores tenant-specific configuration, PHI, billing state, or user workflow state, it is not global and must become tenant-scoped.

## SECURITY DEFINER helpers

`SECURITY DEFINER` functions are allowed only when they narrow privileges or perform an audited system action. They must:

- Pin `search_path`.
- Validate tenant context before reading/writing tenant-owned tables.
- Avoid trusting `request.headers` for tenant identity.
- Avoid returning cross-tenant row sets.
- Be covered by pgTAP where practical.

## Regression tests

The living contract is enforced by pgTAP and CI guardrails. Important test files:

| Test                                                                  | What it protects                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `supabase/tests/no_force_rls.test.sql`                                | Detects RLS posture drift and policy mistakes around forced RLS expectations   |
| `supabase/tests/booking_atomic_insert.test.sql`                       | Verifies booking insert semantics remain tenant-safe and atomic                |
| `supabase/tests/00201_00202_fix_header_trust_rls_retry_cron.test.sql` | Covers header-trust hardening and retry/cron tenant behavior                   |
| `supabase/tests/match_fns_tenant_guard.test.sql`                      | Ensures tenant guard functions do not leak or match across clinics             |
| `supabase/tests/drop_clinical_emr_surface.test.sql`                   | Confirms removed clinical EMR tables stay removed unless deliberately restored |
| `supabase/tests/admin_rpc_grants_hardening.test.sql`                  | Protects administrative RPC grant boundaries                                   |
| `supabase/tests/cron_fns_service_role_lockdown.test.sql`              | Ensures cron/service-role functions remain locked down                         |

## Change checklist

When adding or changing a table:

1. Decide whether it is tenant-owned or truly global.
2. Tenant-owned tables must include `clinic_id`, indexes for tenant-filtered access, RLS, and app-level `.eq("clinic_id", clinicId)` filters.
3. Public reads must expose only public fields and must be documented as public.
4. Add or update pgTAP coverage for any new RLS helper or sensitive policy.
5. If the table belongs to an Architecture-B surface, add it to the scope/feature enforcement path in `src/lib/config/verticals.ts` and related CI guards.

This document is the architecture-level map. The exhaustive implementation remains the migration history under `supabase/migrations/` and the pgTAP suite under `supabase/tests/`.
