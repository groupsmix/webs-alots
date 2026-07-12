# ADR-0003: Supabase GoTrue for Authentication (JWT)

## Status

Accepted

## Date

2026-04-30

## Context

Oltigo Health requires multi-tenant authentication with role-based access
control (5 roles: super_admin, clinic_admin, receptionist, doctor,
patient). The platform uses Supabase as its database layer, which
includes GoTrue for authentication.

## Decision

Use **Supabase GoTrue** as the authentication provider. JWTs issued by
GoTrue are verified in middleware and API routes. User roles and
clinic_id are stored in the `users` table and looked up after JWT
verification via `withAuth()` (`src/lib/with-auth.ts`).

## Alternatives Considered

1. **NextAuth.js / Auth.js** - Flexible but adds another dependency;
   session management would duplicate what GoTrue already provides.
2. **Clerk** - Excellent DX but SaaS dependency, data residency
   concerns, and cost at scale.
3. **Custom JWT** - Full control but significant implementation and
   maintenance burden for token refresh, MFA, password reset flows.

## Consequences

- **Positive**: Tight integration with Supabase RLS policies; built-in
  email/password, phone OTP, and MFA support; no additional auth
  service to manage.
- **Negative**: GoTrue's role model is basic (app_metadata only);
  custom role lookup adds a DB query per authenticated request.
- **Risk**: Supabase GoTrue updates may change JWT claims structure;
  the `withAuth` wrapper isolates this risk.
