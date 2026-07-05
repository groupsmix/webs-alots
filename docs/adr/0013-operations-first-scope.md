# ADR 0013: Operations-First Scope Enforcement

## Status

Accepted

## Date

2026-07-05

## Context

Migration `00187_drop_clinical_emr_surface.sql` and `MVP_SCOPE.md` declare that Oltigo is an
**operations platform** (scheduling, reminders, payments, WhatsApp, owner analytics) — NOT an
EMR. However, clinical API routes (`prescriptions/`, `vitals/`, `radiology/`,
`insurance-claims/`, `admissions/`), non-healthcare verticals (`pets/`, `menus/`,
`restaurant-orders/`, `restaurant-tables/`), and their validation schemas still ship ungated.

This creates a governance gap (documented as P9 in `deep_dive_analysis.md`): the database layer
committed to Architecture A by dropping 12 clinical tables, while the application layer retains
Architecture B surface. Any fresh clinic provisioned today gets access to all routes regardless
of its type or subscription.

## Decision

**Oltigo is operations-first. Clinical and non-healthcare verticals are opt-in per clinic type
and feature flag.**

Specifically:

1. Every surface classified as "Clinical PHI" or "Non-healthcare vertical" in §4 of
   `project_architecture_analysis(2).md` ships **flag-OFF by default**.

2. A capability matrix (`src/lib/config/verticals.ts`) maps each `ClinicType` to its
   `enabledApiGroups` and `enabledFlags`. A `doctor`-type (general medicine) clinic does NOT
   get dialysis, IVF, restaurant, pets, etc. unless its vertical/flag is explicitly enabled.

3. Enabling a vertical for a clinic is an **explicit, audit-logged super-admin action** —
   never implicit from clinic type alone.

4. Validation schemas for gated verticals are not reachable unless the vertical is enabled
   for the requesting clinic.

5. A CI guard (`scripts/check-scope-enforcement.mjs`) fails the build if any Architecture-B
   route/handler is reachable without a gating flag check.

6. Clinical and non-healthcare code is **retained** (not deleted) — it is gated, not removed.
   This preserves the option to graduate to Lane B deliberately in the future.

## Consequences

- Fresh clinics see only operational dashboards and API surfaces by default.
- Super-admins can opt clinics into verticals explicitly (audit-logged).
- Existing clinics that rely on clinical features must be explicitly flagged before the next
  deploy that enforces gating at the route level.
- CI prevents regression: new ungated Architecture-B routes fail the build.
- The `ClinicFeatureKey` union in `src/lib/features.ts` remains the single source of truth
  for all feature flags; vertical scope builds on top of it.

## References

- `supabase/migrations/00187_drop_clinical_emr_surface.sql`
- `docs/PRODUCT_FOCUS_MAP.md` §2 (Lane A vs Lane B)
- `alayse and acrchiculture/deep_dive_analysis.md` P9 (Live Conflict Status)
- `alayse and acrchiculture/project_architecture_analysis(2).md` §4.2
