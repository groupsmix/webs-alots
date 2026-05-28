<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Oltigo Health — Agent Guide

## Architecture Overview

Oltigo Health is a **multi-tenant SaaS** healthcare platform for Moroccan clinics.

- **Framework:** Next.js 16 + React 19 (App Router)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Deployment:** Cloudflare Workers via OpenNext
- **Storage:** Cloudflare R2 (encrypted PHI files)
- **Notifications:** WhatsApp (Meta Cloud API / Twilio), Email (Resend / SMTP), In-App, SMS

## Tenant Isolation (CRITICAL)

Every database operation **must** be scoped to a `clinic_id`. Failing to do so can leak patient data across clinics.

### Rules

1. **Always filter by `clinic_id`** — Every `.from("table").select()`, `.insert()`, `.update()`, `.delete()` must include `.eq("clinic_id", clinicId)`.
2. **Use `requireTenant()` or `requireTenantWithConfig()`** — Never hardcode or trust client-supplied clinic IDs.
3. **Middleware strips tenant headers** — The middleware (`src/middleware.ts`) removes any incoming `x-clinic-id` headers and re-derives tenant context from the subdomain. Never trust client-supplied tenant headers.
4. **RLS is defense-in-depth** — Application-level scoping is required even though database RLS policies exist. Both layers must agree.
5. **Webhooks must resolve tenant** — In webhook handlers (WhatsApp, Stripe), resolve the `clinic_id` from the webhook payload (e.g., WABA phone number ID, Stripe metadata). If resolution fails, skip processing — never query across tenants.
6. **Cron jobs iterate per-clinic** — Scheduled tasks must iterate over clinics and scope each operation to the current clinic's ID.
7. **Never spread request body into DB** — Always destructure and pick specific fields: `.insert({ name: body.name, phone: body.phone })`. Never `.insert({ ...body })` or `.insert(body)` — this prevents mass-assignment of unintended columns (e.g., `role`, `clinic_id`).

### Key Files

- `src/lib/tenant.ts` — `requireTenant()`, `requireTenantWithConfig()`, `getTenant()`
- `src/lib/tenant-context.ts` — `setTenantContext()`, `logTenantContext()`
- `src/lib/assert-tenant.ts` — `assertClinicId()` runtime UUID validation
- `src/middleware.ts` — Subdomain routing, tenant header injection, CSRF checks

## Test Conventions

### Unit Tests (Vitest)

- Location: `src/lib/__tests__/`, `src/components/__tests__/`, `src/app/api/__tests__/`
- Shared mocks: `src/components/__tests__/test-utils.ts` — provides `createMockSupabaseClient()`, `createMockTenantHeaders()`, `mockLogger`, `createMockRequest()`, `createJsonRequest()`
- **Test actual behavior** — Import and invoke real functions/route handlers. Do not write tautological tests that only validate test data against itself.
- **Schema tests are supplementary** — Zod schema validation tests (e.g., `bookingCancelSchema.safeParse(...)`) are useful but insufficient. Always pair with route handler tests that exercise the full request → auth → validation → mutation → response chain.

### E2E Tests (Playwright)

- Location: `e2e/`
- Config: `playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Each test file should be self-contained and not depend on other test files' state

### Integration Tests

- Location: `src/lib/__tests__/integration/`
- Pattern: Mock Supabase client, import actual route handlers, verify the full chain
- Example: `booking-flow.test.ts` — tests booking → cancellation → notification flow

### Running Tests

```bash
npm run test              # Unit tests (Vitest)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # E2E tests (Playwright)
```

## Security Requirements

1. **Never log secrets or PHI** — Use `@/lib/logger` for structured logging. Never `console.log` sensitive data.
2. **PHI encryption** — Patient files must be encrypted with AES-256-GCM via `@/lib/encryption`. Each file gets a unique IV.
3. **Audit logging** — All state-changing operations must call `logAuditEvent()` from `@/lib/audit-log`.
4. **Input validation** — All API inputs validated with Zod schemas defined in `@/lib/validations`.
5. **CSRF protection** — Middleware enforces Origin header checks on mutation methods (POST, PUT, PATCH, DELETE).
6. **Seed user blocking** — 3-layer protection prevents seed users (with well-known passwords) from accessing production.
7. **File uploads** — Magic byte validation + MIME type checking + path traversal prevention via `buildUploadKey()`.
8. **Webhook signatures** — WhatsApp (HMAC-SHA256 via `X-Hub-Signature-256`) and Stripe (via `stripe-signature`) webhooks must be verified before processing.

## API Conventions

### Response Shape

All API routes use standardized helpers from `@/lib/api-response`:

```typescript
// Success: { ok: true, data: T }
return apiSuccess({ appointment });

// Error: { ok: false, error: string, code?: string }
return apiError("Not found", 404, "NOT_FOUND");

// Shorthand helpers: apiUnauthorized(), apiForbidden(), apiNotFound(),
//                    apiRateLimited(), apiInternalError(), apiValidationError()
```

### Route Handler Wrappers

- `withAuth(handler, allowedRoles)` — Authentication + RBAC (`@/lib/with-auth`)
- `withValidation(schema, handler)` — Zod body validation (`@/lib/api-validate`)
- `withAuthValidation(schema, handler, roles)` — Combined auth + validation

### User Roles

5 roles in order of privilege: `super_admin` > `clinic_admin` > `receptionist` > `doctor` > `patient`

## Domain-Specific Guidance (Morocco)

- **Timezone:** Always use `Africa/Casablanca` — helper functions in `@/lib/timezone`
- **Currency:** MAD (Moroccan Dirham) — smallest unit is centimes
- **Insurance types:** CNSS, CNOPS, AMO, RAMED
- **Languages:** French (default UI), Arabic (RTL support), Darija (WhatsApp templates), English
- **Phone format:** +212 prefix (Moroccan)
- **Data protection:** Moroccan Law 09-08 governs PHI handling
- **Payment gateways:** CMI (Moroccan interbank) + Stripe (international)
- **WhatsApp templates:** 10 Darija-language templates — see `docs/whatsapp-template-approval.md` for Meta Business API submission guide

## Database Migrations

- Location: `supabase/migrations/`
- Naming: Sequential 5-digit prefix — `00060_description.sql`, `00061_description.sql`
- Always include `IF NOT EXISTS` / `IF EXISTS` guards
- Always add RLS policies for new tables with `clinic_id` scoping
- Never drop columns or tables in production without a migration plan

## CI Pipeline

PRs run: ESLint → TypeScript → Unit tests → Bundle size check (800 kB shared JS limit, see `scripts/check-bundle-budget.mjs`) → E2E tests

Deploy pipeline (main/staging): lint → unit tests → build → deploy to Cloudflare Workers → health check
