# ADR-0011: Do Not Enable FORCE ROW LEVEL SECURITY

## Status

Accepted

## Date

2026-06-19

## Context

All `public` tables have RLS **enabled but not forced**
(`relrowsecurity = true`, `relforcerowsecurity = false`). A recurring
recommendation (Supabase Security Advisor / external review) is to additionally
run `ALTER TABLE … FORCE ROW LEVEL SECURITY` on every table so that even the
table owner is subject to RLS.

In this codebase that change is **all downside, no upside** — it would take down
the tenant layer while closing no real bypass. Three facts establish this:

1. **Tenant isolation depends on SECURITY DEFINER functions that read across the
   RLS boundary using the owner's bypass.** The RLS policy helpers
   `get_user_clinic_id()`, `get_user_role()`, `is_clinic_staff()`,
   `is_clinic_admin()` (migration `00002`) are `SECURITY DEFINER` and read
   `FROM users`. The `users` policies themselves (`admin_users_all`,
   `doctor_users_select`, `receptionist_users_select`) **call those helpers**.
   They are SECURITY DEFINER precisely so the helper's read of `users` uses the
   owner's RLS bypass instead of re-triggering `users`' own policies. The
   public-booking RPC `booking_atomic_insert` (migrations `00074` / `00143`)
   follows the same pattern: SECURITY DEFINER, granted to `anon`, it validates
   that `doctor_id` / `service_id` / `patient_id` belong to the supplied
   `clinic_id` by reading `users` / `services` directly. Its own comment states:
   _"SECURITY DEFINER bypasses RLS, so we enforce tenant scoping manually."_

2. **FORCE strips exactly the bypass those functions rely on.** With FORCE on,
   the owner is no longer exempt, so:
   - `booking_atomic_insert`'s validation reads return zero rows for an `anon`
     caller with no clinic context → `INVALID_TENANT` → **every public booking
     fails**. Minimal reproduction: an identical SECURITY DEFINER probe returns
     `1` without FORCE and `0` with it.
   - The RLS helpers' read of `users` becomes subject to `users`' own policies,
     which call the helpers again → `infinite recursion detected in policy for
relation "users"` / empty results → **authenticated staff and admins are
     locked out of their own rows.** The blast radius is the whole tenant layer,
     not just booking.

3. **FORCE closes nothing here.** The roles that carry tenant traffic — `anon`
   and `authenticated` — are not table owners and are already fully subject to
   RLS _without_ FORCE. The one role that bypasses RLS, `service_role`, does so
   via the `BYPASSRLS` **role attribute**, which FORCE does not touch. So FORCE
   adds zero protection against either the public path or the service-role path;
   it only removes the owner bypass, and no application traffic connects as the
   table owner.

This matches the model in `AGENTS.md`: RLS is **defense-in-depth behind
mandatory application-level `clinic_id` scoping**, not the sole tenant guard.

> **Environment note.** On Supabase **cloud**, `postgres` (the table owner) is
> not a superuser, so FORCE subjects it to RLS and the breakage above is real.
> On the local `supabase start` stack `postgres` is a superuser and always
> bypasses RLS, so the breakage does **not** reproduce locally. That is why this
> decision is pinned by a _structural_ guard (assert nothing is force-enabled)
> rather than a live FORCE-toggle test — see Consequences.

## Decision

**Keep RLS enabled but never forced on `public` tables.** Do not add
`ALTER TABLE … FORCE ROW LEVEL SECURITY` to any migration.

Enforced two ways:

1. **CI, always-on** — a grep guard in `.github/workflows/ci.yml`
   (`Guard against FORCE ROW LEVEL SECURITY`) rejects any migration that enables
   FORCE, with no live database required.
2. **Database, `rls` job** — `supabase/tests/no_force_rls.test.sql` asserts that
   no `public` table is force-enabled, that RLS stays _enabled_ on the core PHI
   tables, and that the tenant-critical helpers remain SECURITY DEFINER. Any of
   those flips fails the build loudly.

The genuine residual risk a "force everything" reflex is trying to address —
`service_role` bypassing RLS — is handled where it actually lives: mandatory
app-level `clinic_id` scoping (`AGENTS.md` rule #1), the `check-tenant-scoping`
CI guard, and the per-RPC manual tenant validation in SECURITY DEFINER functions
(pinned by `booking_atomic_insert.test.sql`).

## Alternatives Considered

1. **Enable FORCE on all tables (the original suggestion).** Rejected: breaks
   public booking and the RLS helper layer (recursion / lockout) as shown above,
   while closing neither the `anon` nor the `service_role` path.
2. **Make every SECURITY DEFINER function FORCE-safe (e.g. a dedicated
   `BYPASSRLS` validation role) and then enable FORCE.** Rejected for now: a
   substantial refactor of ~40 functions and the helper layer to earn a setting
   that provides no security benefit in this architecture. Revisit only if a
   concrete owner-bypass threat (application traffic connecting as the table
   owner) ever materializes.
3. **Disable RLS and rely solely on app-level scoping.** Rejected: removes the
   defense-in-depth layer `AGENTS.md` requires.

## Consequences

- **Positive**: The tenant layer and public booking keep working; the decision
  is documented and machine-enforced, so a future advisor flag or well-meaning
  PR cannot silently re-introduce the outage.
- **Negative**: The Supabase advisor "RLS not forced" hint will keep showing;
  dismiss it with a link to this ADR.
- **Risk**: If a future table genuinely needs FORCE (a leaf table with no
  SECURITY DEFINER dependency and no owner-path traffic), this ADR and
  `supabase/tests/no_force_rls.test.sql` must be updated together, deliberately.
