# Oltigo Health -- Full End-to-End Technical Audit Report

> **Date:** 2026-04-30
> **Auditor:** Staff Engineer / Fractional CTO review
> **Repository:** groupsmix/webs-alots
> **Commit:** main (HEAD)

---

## EXECUTIVE SUMMARY

**Overall Project Health Score: 7.5 / 10**

Oltigo Health is a well-architected multi-tenant healthcare SaaS platform with unusually mature security controls for its stage. The codebase demonstrates strong tenant isolation (header-based + RLS defense-in-depth), comprehensive input validation (Zod on every API route), proper PHI encryption (AES-256-GCM), and a security-first CI pipeline (CodeQL, Gitleaks, Semgrep, SBOM signing). The operational documentation (SLOs, incident response, key rotation SOPs) is above-average for a pre-launch product.

**Go/No-Go:** **NOT READY -- CONDITIONAL.** The platform has no critical security blockers but has several HIGH-priority items that should be resolved before serving real patient data: the 4,252 ESLint warnings (many are accessibility and i18n gaps), the `notifications` table missing `clinic_id` FK, the sitemap using `createAdminClient` on a public render path, and several missing `loading.tsx` / `error.tsx` boundaries for non-primary routes.

**Top 3 Risks:**
1. Hardcoded French strings in UI components (4,000+ i18n warnings) will block Arabic/RTL users
2. `notifications` table lacks `clinic_id` column -- potential cross-tenant data leak in notification queries
3. RLS integration tests are all skipped (24 tests) -- the most critical security layer has zero automated verification against a real Postgres instance

---

## 1. RECONSTRUCTED ARCHITECTURE

```
                         Internet
                            |
                    [Cloudflare CDN/WAF]
                            |
                   [Cloudflare Workers]
                   (Next.js 16 via OpenNext)
                            |
              +-------------+-------------+
              |             |             |
         [Middleware]  [API Routes]  [Server Components]
         - CSP nonce   - withAuth     - getTenant()
         - CSRF        - withValidation
         - Rate limit  - Zod schemas
         - Tenant resolution
              |             |             |
              +------+------+------+------+
                     |             |
              [Supabase PG]    [Cloudflare R2]
              + RLS policies   + AES-256-GCM
              + GoTrue Auth    + PHI encryption
                     |
              [External APIs]
              - WhatsApp (Meta Cloud API)
              - Stripe / CMI payments
              - Resend email
              - OpenAI / Cloudflare AI
```

### Confirmed Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui + Base UI | latest |
| Database | Supabase (PostgreSQL + RLS) | supabase-js 2.99.3 |
| Auth | Supabase GoTrue + MFA (TOTP) | via @supabase/ssr 0.9.0 |
| Deployment | Cloudflare Workers (OpenNext) | wrangler 4.85.0 |
| Storage | Cloudflare R2 | via @aws-sdk/client-s3 |
| Monitoring | Sentry | @sentry/nextjs 10.50.0 |
| Notifications | WhatsApp + Email (Resend) + SMS | custom |
| Payments | Stripe + CMI (Morocco) | custom |
| Testing | Vitest + Playwright | vitest 4.1.5, playwright 1.59.1 |
| CI/CD | GitHub Actions | CodeQL, Gitleaks, Semgrep, SBOM |

---

## 2. FINDINGS

### LAYER 1: CODEBASE & ARCHITECTURE

#### 1. Massive i18n Warning Count (4,252 ESLint Warnings)
**Type:** Technical Debt | **Priority:** HIGH | **Layer:** Frontend
**File(s):** Across ~200+ component files
**Problem:** `npm run lint` produces 0 errors but 4,252 warnings, primarily `i18next/no-literal-string` violations. Thousands of user-facing strings are hardcoded in French rather than using the `t()` translation function.
**Impact:** Arabic and English users see French-only UI. RTL layout is structurally supported (`dir={dir}` in `layout.tsx:127`) but most content strings are not translatable.
**Solution:** Prioritize extracting hardcoded strings in booking, patient portal, and admin dashboard pages to locale JSON files (`src/locales/fr.json`, `ar.json`, `en.json`). The i18n infrastructure (`src/lib/i18n.ts`) already exists.
**Owner's Note:** This is the single largest volume issue. A bulk migration script (find French strings, wrap in `t()`) would be the fastest path.

#### 2. validations.ts is 753 Lines -- Needs Splitting
**Type:** Technical Debt | **Priority:** LOW | **Layer:** Codebase
**File(s):** [`src/lib/validations.ts`](src/lib/validations.ts:1)
**Problem:** The file itself documents this at line 7: "F-30: This 700+ LOC file should be split into domain-specific modules." All Zod schemas for booking, payments, patients, admin, chat, and webhooks live in one file.
**Impact:** Developer experience degrades as the file grows. No runtime impact.
**Solution:** Split into `validations/booking.ts`, `validations/payments.ts`, etc. Keep `validations.ts` as barrel re-export.

#### 3. Zero `any` Type Usage -- Excellent
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Codebase
**File(s):** Entire `src/` tree
**Problem:** None. Search for `: any` and `as any` returned zero results in application code. The codebase uses targeted type casts (`type UntypedRpc` in `src/lib/data/public.ts:316`) instead of blanket `any`.
**Impact:** Strong type safety across the board.

#### 4. `dangerouslySetInnerHTML` Used Safely
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** 14 occurrences across public pages
**Problem:** All 14 uses go through either `safeJsonLdStringify()` (JSON-LD structured data) or `sanitizeHtml()` (blog content). The `setup-2fa/page.tsx` explicitly documents why it avoids `dangerouslySetInnerHTML` for the QR code SVG.
**Impact:** No XSS risk from these patterns.

---

### LAYER 2: DATABASE & DATA LAYER

#### 5. `notifications` Table Missing `clinic_id` Column
**Type:** Security | **Priority:** HIGH | **Layer:** Database
**File(s):** [`supabase/migrations/00001_initial_schema.sql:83-91`](supabase/migrations/00001_initial_schema.sql:83)
**Problem:** The `notifications` table has `user_id` but no `clinic_id`. Every other core table (`appointments`, `services`, `payments`, `time_slots`) has a `clinic_id` FK. This makes it impossible to apply tenant-scoped RLS on notifications and risks cross-tenant notification leaks.
**Impact:** A query like `SELECT * FROM notifications WHERE user_id = ?` without clinic_id filtering could theoretically return notifications from another clinic if the user_id happens to collide or if the user is associated with multiple clinics.
**Solution:**
```sql
-- Migration 00072_notifications_clinic_id.sql
ALTER TABLE notifications ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_clinic_id ON notifications(clinic_id);
-- Backfill from users table
UPDATE notifications n SET clinic_id = u.clinic_id FROM users u WHERE n.user_id = u.id;
ALTER TABLE notifications ALTER COLUMN clinic_id SET NOT NULL;
```

#### 6. 71 Migration Files -- Well-Structured
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Database
**File(s):** `supabase/migrations/00001_*` through `00071_*`
**Problem:** None. Migrations use sequential 5-digit prefixes, include IF NOT EXISTS/IF EXISTS guards, and consistently add RLS policies for new tables. The `00018_missing_rls_policies.sql` through `00071_security_audit_remediation.sql` show a clear pattern of security hardening over time.

#### 7. Missing Index on `appointments.slot_start` for Cron Reminder Queries
**Type:** Performance | **Priority:** MEDIUM | **Layer:** Database
**File(s):** [`src/app/api/cron/reminders/route.ts:82-84`](src/app/api/cron/reminders/route.ts:82)
**Problem:** The cron reminders query filters on `slot_start.gte.${nowISO},slot_start.lte.${twentyFourHoursISO}` but there's no evidence of a composite index on `(status, slot_start)` for this access pattern. At scale (1000+ appointments/day), this becomes a sequential scan.
**Solution:**
```sql
CREATE INDEX CONCURRENTLY idx_appointments_status_slot_start
ON appointments(status, slot_start)
WHERE status IN ('pending', 'confirmed');
```

---

### LAYER 3: API & BACKEND

#### 8. Sitemap Uses `createAdminClient()` on Public Render Path
**Type:** Security | **Priority:** HIGH | **Layer:** API
**File(s):** [`src/app/sitemap.ts:9`](src/app/sitemap.ts:9), [`src/app/sitemap.ts:82`](src/app/sitemap.ts:82)
**Problem:** The file imports `createAdminClient` (service-role key) and uses it at line 82 to query clinic subdomains for the sitemap. The comment at line 6-8 says "S-20: Use createPublicAnonClient instead" but `createAdminClient` is still used. This means the service-role key is loaded into the sitemap render context unnecessarily.
**Impact:** The service-role key bypasses RLS. If a server-side rendering error leaks the client object or its headers, the key could be exposed. The sitemap only needs `subdomain` and `updated_at`, which are public data.
**Solution:** Replace `createAdminClient()` with `createPublicAnonClient(clinicId)` or a dedicated anonymous query, as the TODO comment already suggests.

#### 9. Webhook Route Missing Tenant Isolation for Status Updates
**Type:** Security | **Priority:** MEDIUM | **Layer:** API
**File(s):** [`src/app/api/webhooks/route.ts:186`](src/app/api/webhooks/route.ts:186)
**Problem:** The webhook POST handler calls `createClient()` (cookie-based, no tenant context) for all database operations. For status updates (delivery/read receipts at line 191), it updates `notification_log` rows by `message_id` without `clinic_id` scoping. The AGENTS.md rule says: "Webhooks must resolve tenant from the webhook payload."
**Impact:** A message_id collision (unlikely but possible) could update the wrong clinic's notification log.
**Solution:** Resolve `clinic_id` from the `phone_number_id` in the webhook metadata and add `.eq("clinic_id", clinicId)` to all updates.

#### 10. Cron Reminders -- Correctly Uses Admin Client with Per-Clinic Iteration
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** API
**File(s):** [`src/app/api/cron/reminders/route.ts:12-13`](src/app/api/cron/reminders/route.ts:12)
**Problem:** None. Uses `createAdminClient()` (justified for cookieless cron context) and validates each appointment's `clinic_id` via `assertClinicId()` at line 148.

#### 11. Upload Route -- Comprehensive Security Controls
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** API
**File(s):** [`src/app/api/upload/route.ts`](src/app/api/upload/route.ts:1)
**Problem:** None. The upload route implements: magic byte validation, per-category size limits, MIME type allowlist (SVG explicitly excluded), path traversal prevention via `buildUploadKey()`, clinic_id derivation from profile (never client-supplied), and PHI auto-encryption for medical categories.

#### 12. Booking Route -- Properly Token-Gated
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** API
**File(s):** [`src/app/api/booking/route.ts:192-200`](src/app/api/booking/route.ts:192)
**Problem:** None. Requires `x-booking-token` (HMAC-SHA256 signed, time-limited) issued after OTP verification. Constant-time signature comparison prevents timing attacks.

---

### LAYER 4: FRONTEND & UX/UI

#### 13. Loading States -- Good Coverage but Gaps
**Type:** UX Issue | **Priority:** MEDIUM | **Layer:** Frontend
**File(s):** Various route groups
**Problem:** Loading states exist for: `(public)`, `(admin)`, `(doctor)`, `(patient)`, `(receptionist)`, `(super-admin)`, and key sub-pages (dashboard, billing, patients, reports). Missing for: `(clinic-public)`, `(demo)`, `(lab)`, `(pharmacist)`, `(specialist)`, `(auth)`, `api-docs`.
**Impact:** Users navigating to clinic public pages, lab, pharmacist, or specialist routes see no loading indicator during data fetches.
**Solution:** Add `loading.tsx` to each missing route group with a consistent skeleton/spinner pattern.

#### 14. Error Boundaries -- Good Coverage
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Frontend
**File(s):** 13 `error.tsx` files + `global-error.tsx`
**Problem:** None. Error boundaries exist at root level and for all major route groups.

#### 15. Accessibility Warnings in shadcn Components
**Type:** UX Issue | **Priority:** MEDIUM | **Layer:** Frontend
**File(s):** [`src/components/ui/dialog.tsx:27`](src/components/ui/dialog.tsx:27), [`src/components/ui/dropdown-menu.tsx:93`](src/components/ui/dropdown-menu.tsx:93), [`src/components/ui/select.tsx:116`](src/components/ui/select.tsx:116), [`src/components/ui/sheet.tsx:31`](src/components/ui/sheet.tsx:31), [`src/components/ui/tooltip.tsx:40`](src/components/ui/tooltip.tsx:40), [`src/components/ui/label.tsx:5`](src/components/ui/label.tsx:5)
**Problem:** `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-static-element-interactions`, and `jsx-a11y/label-has-associated-control` warnings on overlay/backdrop elements in shadcn components.
**Impact:** Keyboard-only users cannot dismiss overlays. Screen readers may not announce interactive elements correctly.
**Solution:** Add `onKeyDown` handlers for Escape key on backdrop elements. Add `role="button"` and `tabIndex={0}` where appropriate. These are upstream shadcn patterns but should be customized for WCAG 2.1 AA compliance.

#### 16. 404 Page -- Properly Branded and Localized
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Frontend
**File(s):** [`src/app/not-found.tsx`](src/app/not-found.tsx:1)
**Problem:** None. Returns proper 404 status, uses `t()` for translation, includes a "back home" CTA.

#### 17. Skip-to-Content Link Present
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Frontend
**File(s):** [`src/app/layout.tsx:133-138`](src/app/layout.tsx:133)
**Problem:** None. WCAG 2.4.1 compliant skip link with proper sr-only/focus styles.

---

### LAYER 5: PERFORMANCE

#### 18. Image Optimization -- Properly Configured
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Performance
**File(s):** [`next.config.ts:62-87`](next.config.ts:62)
**Problem:** None. AVIF and WebP formats enabled, device sizes defined, SVG processing disabled for security, remote patterns restricted to project Supabase host and `uploads.oltigo.com`.

#### 19. Cache Headers -- Well Designed
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Performance
**File(s):** [`next.config.ts:23-59`](next.config.ts:23)
**Problem:** None. Static assets cached 1 year with immutable. API responses default to `private, no-store`. `_next/static` assets cached 1 year (content-hashed).

#### 20. Font Loading Strategy -- Optimal
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Performance
**File(s):** [`src/app/layout.tsx:15-31`](src/app/layout.tsx:15)
**Problem:** None. Three Google Fonts loaded with `display: "swap"` (prevents FOIT), scoped to required subsets (latin, arabic), with CSS variable approach.

#### 21. Recharts Bundle Size Risk
**Type:** Performance | **Priority:** LOW | **Layer:** Performance
**File(s):** [`package.json:40`](package.json:40)
**Problem:** `recharts@3.8.1` is a large charting library (~200KB gzipped). It's used in admin analytics pages. If not dynamically imported, it inflates the shared JS bundle for all pages.
**Impact:** The CI bundle budget check (`BUNDLE_BUDGET_KB: 1024`) may pass now but could become a concern as more chart pages are added.
**Solution:** Verify recharts is only imported in admin pages via `dynamic(() => import(...))` or Next.js route-level code splitting.

---

### LAYER 6: SECURITY

#### 22. CSP -- Strict and Enforced
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/lib/middleware/security-headers.ts:74-118`](src/lib/middleware/security-headers.ts:74)
**Problem:** None. Production CSP uses `'self'` + nonce + `'strict-dynamic'` (no `'unsafe-inline'` or `'unsafe-eval'` in production). `frame-ancestors 'none'` prevents clickjacking. `object-src 'none'` blocks Flash/Java. Reporting configured via Sentry.

#### 23. CSRF Protection -- Robust
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/lib/middleware/csrf.ts`](src/lib/middleware/csrf.ts:1)
**Problem:** None. Origin-based CSRF validation on all mutation API routes. Missing Origin header is rejected (not silently allowed). Webhooks and cron endpoints are properly exempted. Per-tenant Origin locking (line 47-48) prevents cross-tenant CSRF.

#### 24. Tenant Header Stripping -- Critical Control Present
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/middleware.ts:128-149`](src/middleware.ts:128)
**Problem:** None. All `x-tenant-*` headers, `x-clinic-id`, and `x-auth-profile-*` headers are stripped from incoming requests before tenant resolution. This prevents client-side header injection attacks.

#### 25. Seed User Blocking -- 3-Layer Protection
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/middleware.ts:342-344`](src/middleware.ts:342), [`src/lib/seed-guard.ts`](src/lib/seed-guard.ts)
**Problem:** None. Production blocks seed users (known passwords from `seed.sql`) at middleware level, auth callback, and API route level.

#### 26. Rate Limiter -- Distributed with Circuit Breaker
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts:1)
**Problem:** None. Supports KV, Supabase, and in-memory backends with automatic selection. Circuit breaker pattern prevents cascade failures. Security-critical endpoints (auth, AI) use `failClosed: true`.

#### 27. Sentry PHI Scrubbing -- Comprehensive
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`sentry.client.config.ts`](sentry.client.config.ts:1)
**Problem:** None. Session Replay masks all text/inputs/media. Breadcrumbs scrub request/response bodies and PHI URL params. `beforeSend` hook strips PHI fields.

#### 28. MFA Enforcement for Privileged Roles
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/middleware.ts:443-459`](src/middleware.ts:443)
**Problem:** None. `super_admin`, `doctor`, and `clinic_admin` roles are redirected to MFA verification if their session is AAL1 but AAL2 is required.

#### 29. PHI Encryption Key Required in Production
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Security
**File(s):** [`src/lib/env.ts:91`](src/lib/env.ts:91)
**Problem:** None. `PHI_ENCRYPTION_KEY` is marked as required in production. Server refuses to boot without it, preventing silent plaintext PHI storage.

---

### LAYER 7: SEO & STRUCTURED DATA

#### 30. robots.txt -- Properly Configured
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** SEO
**File(s):** [`src/app/robots.ts`](src/app/robots.ts:1)
**Problem:** None. Allows public pages, disallows admin/doctor/patient/API routes. References sitemap.

#### 31. Sitemap -- Dynamic with Clinic Subdomains
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** SEO
**File(s):** [`src/app/sitemap.ts`](src/app/sitemap.ts:1)
**Problem:** None (except the `createAdminClient` issue noted in Finding #8). Generates entries for static pages, blog posts, clinic subdomain pages, and directory pages.

#### 32. JSON-LD Structured Data Present on All Public Pages
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** SEO
**File(s):** [`src/app/(public)/page.tsx`](src/app/(public)/page.tsx), services, reviews, contact, book, blog, annuaire
**Problem:** None. All public pages include JSON-LD via `safeJsonLdStringify()`.

#### 33. Open Graph and Twitter Meta Tags
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** SEO
**File(s):** [`src/app/layout.tsx:94-101`](src/app/layout.tsx:94)
**Problem:** None. OG type, locale, alternateLocale, siteName, title, description all configured.

#### 34. `<html lang>` Dynamically Set
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** SEO
**File(s):** [`src/app/layout.tsx:126`](src/app/layout.tsx:126)
**Problem:** None. `lang={locale}` and `dir={dir}` are set based on preferred locale cookie or tenant config.

---

### LAYER 8: DEPLOYMENT & INFRASTRUCTURE

#### 35. Deploy Pipeline with Auto-Rollback
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Deployment
**File(s):** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:1)
**Problem:** None. Build -> Deploy -> Health check -> Auto-rollback if health check fails. Rollback verification step confirms the previous version is healthy. Failure always surfaces as a red CI signal.

#### 36. Supply Chain Security -- Exemplary
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Deployment
**File(s):** [`.github/workflows/ci.yml:16-18`](.github/workflows/ci.yml:16)
**Problem:** None. GH Actions pinned to full SHAs (not tags). `npm ci --ignore-scripts` prevents malicious postinstall. SBOM generated with CycloneDX, signed with cosign (keyless), SLSA provenance attestation.

#### 37. Environment Variable Validation at Startup
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Deployment
**File(s):** [`src/lib/env.ts`](src/lib/env.ts:1)
**Problem:** None. 30+ env vars validated at boot. Required vars block startup. Optional vars warn with feature degradation.

#### 38. Secrets Template Well-Documented
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Deployment
**File(s):** [`secrets-template.env`](secrets-template.env:1)
**Problem:** None. All 30+ secrets documented with descriptions, generation commands, and rotation references.

#### 39. Missing `wrangler.toml` / `wrangler.jsonc` in Repository
**Type:** Missing Feature | **Priority:** MEDIUM | **Layer:** Deployment
**File(s):** Root directory
**Problem:** No `wrangler.toml` or `wrangler.jsonc` is present in the repository. The deploy script runs `wrangler deploy` which relies on either a config file or CLI flags. Cron triggers, KV namespace bindings, R2 bucket bindings, and environment variable bindings should be declaratively configured.
**Impact:** New developers cannot understand the Cloudflare Worker configuration from the repo alone. Cron trigger schedules are not version-controlled.
**Solution:** Add a `wrangler.toml` (or `wrangler.jsonc`) to the repo with cron triggers, KV bindings, R2 bindings, and compatibility settings. Sensitive values can use `wrangler secret` while structural config is committed.

---

### LAYER 9: TESTING & QUALITY

#### 40. Test Results -- 676 Passing, 24 Skipped, 0 Failures
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Testing
**File(s):** 66 test files
**Problem:** None for pass/fail. The 24 skipped tests are all in `rls-real-postgres.test.ts` which requires a real Supabase local instance.

#### 41. RLS Integration Tests Skipped -- Critical Gap
**Type:** Testing | **Priority:** HIGH | **Layer:** Testing
**File(s):** [`src/lib/__tests__/integration/rls-real-postgres.test.ts`](src/lib/__tests__/integration/rls-real-postgres.test.ts:1)
**Problem:** 24 RLS tests are permanently skipped with `// TODO: Implement with real Supabase local once CI is configured`. For a multi-tenant healthcare platform, RLS is the most critical security control. Zero automated verification against a real Postgres engine is a significant gap.
**Impact:** RLS policy regressions could go undetected until production. A malformed policy could leak PHI across tenants.
**Solution:** Set up `supabase start` in CI (GitHub Actions) and run the RLS tests against a local Supabase instance. The test stubs already exist -- they just need the infrastructure.

#### 42. Good Test Coverage of Critical Paths
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Testing
**File(s):** `src/app/api/__tests__/`, `src/lib/__tests__/`
**Problem:** None. Tests cover: booking flow, cancellation, webhooks, billing, auth flow, impersonation, CSP reporting, rate limiting (including chaos tests), encryption, email, notifications, timezone handling, tenant resolution, subdomain parsing, cron auth, upload validation, and integration flows.

#### 43. E2E Tests Present but Limited
**Type:** Testing | **Priority:** MEDIUM | **Layer:** Testing
**File(s):** `e2e/admin-dashboard.spec.ts`, `e2e/booking-flow.spec.ts`, `e2e/booking-full-cycle.spec.ts`
**Problem:** Only 3 E2E test files. Critical user flows not covered: patient login/portal, doctor dashboard, receptionist check-in, payment flow, file upload/download, MFA enrollment.
**Impact:** Regressions in these flows would only be caught manually.
**Solution:** Add E2E specs for: patient registration + login, appointment confirmation via WhatsApp, payment checkout, file upload with PHI encryption verification.

#### 44. TypeScript Strict Mode Passing -- Zero Errors
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Testing
**File(s):** `tsconfig.json`
**Problem:** None. `npx tsc --noEmit` passes with zero errors.

#### 45. npm audit -- Zero Vulnerabilities
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Testing
**File(s):** `package-lock.json`
**Problem:** None. `npm audit --omit=dev` reports 0 vulnerabilities.

---

### LAYER 10: DOCUMENTATION & DEVELOPER EXPERIENCE

#### 46. Comprehensive Operational Documentation
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Documentation
**File(s):** `docs/` directory (14 files including compliance subdirectory)
**Problem:** None. Includes: SLOs with error budgets, incident response runbook with severity classifications, backup recovery runbook, PHI key rotation SOP, secret rotation SOP, VAPID rotation SOP, data residency documentation, DB rollback constraints, on-call guide, and compliance documentation (CNDP, DPIA, data flow map, retention policy).

#### 47. README Missing `.env.example` File
**Type:** Documentation | **Priority:** LOW | **Layer:** Documentation
**File(s):** [`README.md:33`](README.md:33)
**Problem:** README says `cp .env.example .env.local` but there is no `.env.example` file. There is a `secrets-template.env` which serves the same purpose.
**Impact:** New developers follow README instructions and get a "file not found" error.
**Solution:** Either rename `secrets-template.env` to `.env.example` or update README to reference `secrets-template.env`.

#### 48. AGENTS.md -- Excellent Agent/Developer Guide
**Type:** Improvement (positive) | **Priority:** N/A | **Layer:** Documentation
**File(s):** [`AGENTS.md`](AGENTS.md:1)
**Problem:** None. Comprehensive guide covering architecture, tenant isolation rules, test conventions, security requirements, API conventions, domain-specific Morocco guidance, and CI pipeline.

---

## 3. LAUNCH READINESS VERDICT

**NOT READY -- CONDITIONAL**

The following conditions must be met before serving real patient data:

| # | Condition | Finding # | Est. Fix Time |
|---|-----------|-----------|---------------|
| 1 | Add `clinic_id` to `notifications` table | #5 | 2 hours |
| 2 | Replace `createAdminClient` in sitemap.ts | #8 | 30 min |
| 3 | Add `wrangler.toml` to repo | #39 | 2 hours |
| 4 | Fix README `.env.example` reference | #47 | 5 min |

---

## 4. LAUNCH BLOCKER TABLE

| # | Issue | Why It Blocks Launch | Estimated Fix Time |
|---|-------|---------------------|---------------------|
| 5 | `notifications` table missing `clinic_id` | Potential cross-tenant notification leak in a healthcare platform | 2 hours |
| 8 | Sitemap uses service-role key on public path | Unnecessary privilege escalation on public render | 30 min |

---

## 5. WHAT'S ALREADY STRONG

1. **Tenant isolation** -- Triple-layered (middleware header stripping + app-level scoping + RLS), with dedicated assertion functions (`assertClinicId`, `requireTenant`) and cross-tenant profile mismatch detection in `withAuth`
2. **Security headers** -- Strict CSP with nonces, HSTS with preload, X-Frame-Options DENY, all applied consistently via composable middleware modules
3. **PHI protection** -- AES-256-GCM encryption with unique IVs, key rotation SOP, Sentry PHI scrubbing, Session Replay masking
4. **Input validation** -- Zod schemas on every API route via `withValidation` / `withAuthValidation` wrappers
5. **Rate limiting** -- Distributed (KV/Supabase/memory) with circuit breaker, fail-closed for auth endpoints
6. **CI/CD security** -- SHA-pinned actions, SBOM with cosign signing, CodeQL + Gitleaks + Semgrep, DB dump detection
7. **Auto-rollback deploys** -- Health check with body validation, automatic `wrangler rollback`, rollback health verification
8. **Operational documentation** -- SLOs, incident response, backup/recovery, key rotation SOPs, compliance docs
9. **Webhook signature verification** -- HMAC-SHA256 with timing-safe comparison on WhatsApp webhooks
10. **MFA enforcement** -- TOTP for super_admin, doctor, and clinic_admin roles
11. **Booking token security** -- HMAC-signed, time-limited tokens with constant-time comparison
12. **Zero npm vulnerabilities**, zero TypeScript errors, zero `any` usage

---

## 6. PRIORITIZED ACTION PLAN

### Week 1 (Critical)
- [ ] Add `clinic_id` to `notifications` table (Finding #5)
- [ ] Replace `createAdminClient` in sitemap.ts with anon client (Finding #8)
- [ ] Add `wrangler.toml` to repository (Finding #39)
- [ ] Fix README `.env.example` reference (Finding #47)
- [ ] Add `loading.tsx` to missing route groups (Finding #13)

### Week 2 (High)
- [ ] Set up Supabase local in CI for RLS integration tests (Finding #41)
- [ ] Add tenant resolution to webhook status updates (Finding #9)
- [ ] Begin i18n string extraction for booking flow (Finding #1)
- [ ] Add composite index on `appointments(status, slot_start)` (Finding #7)

### Week 3 (Medium)
- [ ] Fix accessibility warnings in shadcn overlay components (Finding #15)
- [ ] Continue i18n extraction for patient portal and admin pages (Finding #1)
- [ ] Add E2E tests for patient login and payment flows (Finding #43)
- [ ] Verify recharts is dynamically imported (Finding #21)

### Post-launch (Low)
- [ ] Split `validations.ts` into domain modules (Finding #2)
- [ ] Complete i18n extraction for all remaining components (Finding #1)
- [ ] Expand E2E coverage to doctor dashboard and MFA flows (Finding #43)

---

## 7. PRODUCTION READINESS CHECKLIST

- [x] All CRITICAL issues have clear remediation plans
- [x] Error monitoring configured (Sentry with PHI scrubbing)
- [ ] Database backups verified (backup scripts exist but UNVERIFIED -- requires manual check)
- [x] All environment variables documented in `secrets-template.env`
- [ ] DNS configured for all domains (UNVERIFIED -- requires production access)
- [x] SSL certificates (Cloudflare manages automatically)
- [x] Rate limiting configured with KV/Supabase backends
- [x] Cron jobs authenticated via `CRON_SECRET` bearer token
- [x] `robots.txt` serving correctly with sitemap reference
- [x] `sitemap.xml` valid with static + dynamic pages
- [x] 404 pages returning proper status codes with localized content
- [x] All admin routes protected via role-based middleware
- [x] Cookie consent component present (`cookie-consent.tsx`)
- [x] Build succeeds with zero TypeScript errors
- [x] All 676 tests passing in CI
- [ ] `wrangler.toml` committed with cron triggers and bindings
- [ ] `notifications` table `clinic_id` migration applied
- [ ] RLS integration tests running against real Postgres

---

## 8. WHAT BREAKS FIRST AT 10X TRAFFIC

1. **In-memory rate limiter** -- If KV/Supabase backends are unavailable, the memory fallback resets on cold starts and is not shared across Cloudflare Worker isolates. At 10x traffic with multiple isolates, each starts with a fresh counter.
2. **Subdomain resolution cache** -- The in-memory `subdomainCache` in middleware is per-isolate. At 10x traffic, cache misses generate redundant Supabase queries across isolates. Consider KV-backed subdomain cache.
3. **Cron reminders `.limit(500)`** -- At [`src/app/api/cron/reminders/route.ts:85`](src/app/api/cron/reminders/route.ts:85), the query is hard-limited to 500 appointments. At 10x scale (5,000+ appointments/day), some reminders would be silently dropped.
4. **Notification dispatch batching** -- `DISPATCH_BATCH_SIZE = 10` with sequential batches. At 10x scale, the cron endpoint could timeout before processing all notifications.

---

## 9. WHAT FAILS A SECURITY REVIEW

1. **RLS tests are skipped** -- Auditors would flag that the most critical security control has zero automated verification
2. **Webhook tenant isolation gap** -- Status update writes without `clinic_id` scoping (Finding #9)
3. **Sitemap service-role key usage** -- Unnecessary privilege on a public path (Finding #8)

Everything else would likely pass: CSP, CSRF, input validation, PHI encryption, audit logging, seed user blocking, MFA, header stripping, rate limiting, webhook signature verification.

---

## 10. WHAT FAILS A COMPLIANCE REVIEW (Moroccan Law 09-08)

1. **`notifications` table lacks `clinic_id`** -- Cannot demonstrate per-tenant data isolation for notification records
2. **RLS tests not running** -- Cannot demonstrate automated verification of data isolation policies
3. **GDPR purge cron exists** (`/api/cron/gdpr-purge`) but effectiveness is UNVERIFIED without real integration tests

Everything else is well-positioned: DPIA documented, data flow map exists, retention policy defined, PHI encryption with key rotation SOP, audit logging with structured metadata, consent management infrastructure present.

---

## 11. HARD TRUTHS ABOUT THIS ARCHITECTURE

**What's genuinely good:** The security posture is above-average for a pre-launch SaaS. The multi-tenant isolation model is well thought out. The CI/CD pipeline would pass most enterprise security reviews. The operational documentation is mature for this stage.

**What's concerning:** The i18n debt is substantial (4,000+ warnings). For a Moroccan healthcare platform targeting Arabic-speaking users, this is not cosmetic -- it's a market blocker. The RLS integration test gap is risky for a healthcare platform where data isolation is legally mandated.

**What's hidden complexity:** The middleware at 484 lines is the most critical piece of code in the system. It handles CSP, CSRF, rate limiting, tenant resolution, auth, seed blocking, MFA enforcement, profile header signing, and role-based routing. Any regression here affects every request. This file needs its own dedicated test suite.

**What's over-engineered:** The triple-backend rate limiter (KV + Supabase + Memory with circuit breaker) is sophisticated but adds complexity. For the current scale, the Supabase backend alone would suffice.

**What's under-engineered:** The notification system. The `notifications` table missing `clinic_id`, the webhook handler missing tenant context, and the cron reminders' hard limit of 500 records suggest notifications were added incrementally without the same rigor applied to the booking/appointment core.

---

## 12. MISSING ARTIFACTS I SHOULD PROVIDE NEXT

**High Priority:**
- [ ] `wrangler.toml` -- Required to verify cron triggers, KV/R2 bindings, compatibility settings
- [ ] Production environment variable matrix -- Verify all required vars are set
- [ ] Cloudflare dashboard screenshots -- WAF rules, cache rules, custom domains

**Medium Priority:**
- [ ] Database schema dump (live) -- Verify migrations match actual schema
- [ ] Sentry dashboard screenshots -- Verify error tracking is active
- [ ] Load testing results -- Verify latency SLOs under realistic load

**Low Priority:**
- [ ] Branch protection rules screenshot -- Verify PR requirements
- [ ] Cloudflare R2 lifecycle rules -- Verify cleanup is working
