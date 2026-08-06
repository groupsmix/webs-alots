<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Oltigo Health — Agent Guide

> **Before editing code, read [`.ai/TASK-ROUTER.md`](.ai/TASK-ROUTER.md)** — it maps each task
> type to the exact files to edit and the SEALED files to never touch. For UI work, also read
> [`.ai/skills/ui-ux/SKILL.md`](.ai/skills/ui-ux/SKILL.md). A self-contained launch-blocker
> audit prompt lives at [`.ai/prompts/BLOCKER-AUDIT-PROMPT.md`](.ai/prompts/BLOCKER-AUDIT-PROMPT.md).

## Architecture Overview

Oltigo Health is a **multi-tenant SaaS** healthcare platform for Moroccan clinics.

- **Framework:** Next.js 16 + React 19 (App Router)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Deployment:** Cloudflare Workers via OpenNext
- **Storage:** Cloudflare R2 (encrypted PHI files)
- **Notifications:** WhatsApp (Meta Cloud API / Twilio), Email (Resend / SMTP), In-App, SMS

## AI Agent Coding Rules (Cloudflare + Supabase Stack)

### 1. Cloudflare Environment Constraints

- **Edge Runtime Compatibility:** This app is deployed on Cloudflare Workers. Never import Node.js-only modules (`fs`, `path`, `child_process`, `net`, `crypto` Node module) unless `nodejs_compat` is explicitly enabled. Use Web APIs (`fetch`, `Request`, `Response`, `Web Crypto`) instead.
- **Bindings & Env Vars:** Access Cloudflare bindings and environment variables through the provided helpers (`@/lib/cf-bindings`, `@/lib/env`). Never hardcode secrets or credentials in source files.
- **Image / Asset Domains:** Adding a new external image domain requires updating `next.config.ts` `images.remotePatterns` and the CSP `img-src` directive in `src/lib/middleware/security-headers.ts`.

### 2. Supabase Security & Database Rules

- **Row Level Security (RLS):** Every table created or modified must have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and explicit, `clinic_id`-scoped policies. Application-level `.eq("clinic_id", clinicId)` filtering is still required.
- **Secret Key Isolation:**
  - `SUPABASE_SERVICE_ROLE_KEY` must stay strictly on the server. Never import or reference it in client components.
  - Client-side queries must only use the public `ANON` key and must be subject to RLS policies.
- **Client Instantiation:** Use the existing helpers (`createScopedAdminClient`, `@supabase/ssr` server clients, `@/lib/supabase-client` for browser). Do not create ad-hoc Supabase clients in individual files.

### 3. Bug Fixing & Code Quality Standards

- **Root-Cause Fixes:** When fixing a bug, never just wrap failing code in a blank `try/catch`, add `setTimeout` workarounds, or call `e.preventDefault()` to hide an error. Reproduce the issue, identify the underlying logic failure, fix it, and verify the data still saves correctly.
- **Modular Code:** Keep files focused. If a file exceeds ~250 lines, split it into smaller components or utilities. Avoid copy-pasting large blocks between files.
- **Verification:** Before marking a task complete, run `npm run lint`, `npx tsc --noEmit`, and `npm run test` (or the subset relevant to the change). For UI changes, visually verify in the browser or with a screen recording.

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

## Audit Baseline

The pre-existing quality baseline is documented in [`docs/archive/audit/baseline.md`](docs/archive/audit/baseline.md).
Any cleanup PR should reference this file to compare before/after metrics.

## CI Pipeline

PRs run: ESLint → TypeScript → Unit tests → Bundle size check (800 kB shared JS limit, see `scripts/check-bundle-budget.mjs`) → E2E tests

Deploy pipeline (main/staging): lint → unit tests → build → deploy to Cloudflare Workers → health check

## Vibe Coder / Non-Technical Product Owner Workflow

The user often acts as a product tester: they click the UI, notice a symptom, and report it in plain language. Do not treat every short prompt as a complete spec. Follow these rules so the fixes stay clean and production-grade.

### 1. Ask Clarifying Questions Before Coding

If the prompt is vague, ambiguous, or contains only a symptom, ask up to three concrete questions before touching code. Good questions cover:

- **Where:** exact URL, page, tab, or component.
- **What I did:** the exact user action (clicked button, typed text, switched template, uploaded image).
- **What I expected:** the desired outcome.
- **Evidence:** screenshot, browser console output, or HAR file.

Examples:

- "Which clinic subdomain should I test on?"
- "Do you want the change on all templates or only the currently selected one?"
- "Should the old behavior be removed, or kept as a fallback?"

### 2. Fix Root Causes, Not Symptoms

Never hide an error just to make the UI stop failing. Do **not** wrap functions in blind `try/catch` blocks, add `setTimeout` workarounds, or disable checks without understanding why the failure happens.

Required process:

1. Reproduce the bug in the browser or with a failing test.
2. Read the relevant code path, logs, and network responses.
3. Explain the root cause in one sentence in the PR description.
4. Fix the cause and verify the original flow still works end-to-end.

### 3. Keep Changes Minimal and Scoped

Do not refactor unrelated code, rename files, or change architecture outside the requested task unless required to make the fix work.

- Prefer editing existing files over creating new ones.
- Do not add new npm dependencies unless the dependency is already used elsewhere or the task cannot be done without it.
- Do not create new template packages or pages unless the user explicitly asks for them.
- Do not touch `src/middleware.ts`, auth/RLS modules, encryption, or `src/lib/tenant.ts` unless explicitly asked (see TASK-ROUTER.md).

### 4. Verify Visually Before Marking Complete

A green test or successful build is not enough. For UI changes:

- Run the dev server or open the deployed preview.
- Confirm the change renders correctly on desktop and mobile.
- Confirm the original flow still works (e.g., switching back to the previous template does not break).
- For high-risk changes, record a short screen capture and attach it to the PR or message.

### 5. Template and Branding Changes Must Reflect Immediately

Public pages are cached at the Cloudflare edge. When a user changes a template, color, or image in the admin dashboard:

- Ensure the public page fetches fresh data on the next request.
- Ensure `next.config.ts` `images.remotePatterns` allows the storage domain being used.
- After changing branding, purge the relevant clinic cache or use `Cache-Control` headers that force revalidation.
- Test the canonical `/` URL without `?_cache_bust`.

### 6. Do Not Pollute the Repo with Test Artifacts

E2E specs, Playwright configs, screenshots, and diagnostic scripts created during a debugging session are **untracked by default**. Do not `git add .` and do not commit them unless the user explicitly asks for them.

### 7. Standard Bug Report Template

When the user reports a bug, fill in this template with them before starting work:

```text
Where: <URL or page>
What I did: <exact steps>
What I expected: <desired result>
What happened: <actual result>
```

This small amount of context is usually enough to locate and fix the issue without guessing.
