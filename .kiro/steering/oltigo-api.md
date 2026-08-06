---
inclusion: fileMatch
fileMatchPattern: ["src/app/api/**/*.ts"]
---

# Oltigo — API routes (Kiro)

Builds on `AGENTS.md` §API Conventions / §Security — don't restate it, comply with it. Mirror an existing route; **create new routes, don't modify existing handlers** (`.ai/TASK-ROUTER.md`).

## Real shapes (these are the actual helpers — match them exactly)

- **Auth + RBAC:** `withAuth(handler, allowedRoles)` from `@/lib/with-auth`. The handler is `(request, { supabase, profile }, routeCtx) => { ... }` — `supabase` and `profile` come from this `AuthContext`, not from anywhere else.
- **Validation:** `withValidation(schema, handler)` and `withAuthValidation(schema, handler, roles)` from `@/lib/api-validate`. Validate with a Zod schema from `@/lib/validations` before any DB call.
- **Tenant:** `const { clinicId } = await requireTenant()` from `@/lib/tenant` — **takes no argument.** Scope every query with `.eq("clinic_id", clinicId)`.
- **Responses:** `apiSuccess(data)` / `apiError(message, status, code)` plus `apiNotFound()`, `apiForbidden()`, `apiRateLimited()`, `apiValidationError()` from `@/lib/api-response`. Shape: `{ ok: true, data }` / `{ ok: false, error, code? }`.
- **Audit:** `logAuditEvent()` from `@/lib/audit-log` on every state-changing operation.

**Canonical route to mirror:** `#[[file:src/app/api/invoices/route.ts]]`

## Never

- Spread a request body into a write (`.insert({ ...body })` / `.update(body)`) — pick explicit fields (mass-assignment guard).
- Trust `x-clinic-id` — middleware strips it; the tenant comes only from `requireTenant()`.
- Let an error leak PHI — `apiError` messages stay generic; detail goes to `@/lib/logger`, never to the client and never raw to Sentry.

## Webhooks (`src/app/api/webhooks/**`)

1. Verify the signature **before** parsing (`X-Hub-Signature-256` for WhatsApp, `stripe-signature` for Stripe).
2. Resolve `clinic_id` from the payload (WABA phone number id / Stripe metadata); if it can't be resolved, **skip — never query across tenants**.
3. Process **idempotently**, keyed on the provider event id, so retries can't double-apply.

## Patient-facing / unauthenticated endpoints

Rate-limit them (`apiRateLimited()`) against abuse and enumeration. Reuse the existing limiter; don't invent one.
