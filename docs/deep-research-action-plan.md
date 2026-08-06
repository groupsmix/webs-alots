# Oltigo Health — Actionable plan from deep-research report

> **Repo:** `groupsmix/webs-alots` (Oltigo Health)  
> **Commit:** `01cffc6c`  
> **Date:** 2026-08-06  
> **Scope:** turn the generic deep-research checklist into a repo-specific, prioritized roadmap.

## TL;DR

The attached deep-research report is a generic OWASP / Supabase / Cloudflare checklist. It did **not** have access to the actual `webs-alots` code, and most of its critical findings are already implemented. The codebase is already multi-tenant by design, has strict CSP/CSRF/RLS, validates uploads by magic bytes, encrypts PHI, runs 2,282 passing tests, and has lint/typecheck green.

The real remaining work is **operational hardening, coverage, and hygiene** — the kind of work that is cheap to ignore now and expensive to fix after an incident. This plan maps every report section to the current repo state and gives a flexible, phased set of next actions.

## How this plan was built

Gates run on `node@22.13.0`:

| Gate             | Command             | Result                                             |
| ---------------- | ------------------- | -------------------------------------------------- |
| Lint             | `npm run lint`      | pass (baseline `0`)                                |
| Typecheck        | `npm run typecheck` | pass                                               |
| Unit tests       | `npm run test`      | 2,282 passed / 117 skipped / 2 files skipped       |
| Dependency audit | `npm audit`         | **7 moderate** (0 high/critical)                   |
| Dead-code scan   | `npm run knip`      | 13 unused exports, 22 unused types, 1 unlisted dep |

Targeted code scan:

- `supabase/migrations` contains **1,355** `CREATE TABLE` / `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` references and **766** `CREATE INDEX` references.
- `src/app/api` contains **86** Supabase `.from(...).select/insert/update/delete` calls and **1,122** `clinic_id` references, indicating tenant scoping is pervasive.
- No raw SQL string construction (`.query(...)`, `execute(...)`) was found in `src/`.
- No hardcoded `createClient("url", "key")` calls were found in `src/`.
- `dangerouslySetInnerHTML` appears only in `src/components/seo/sanitized-html.tsx` (via `sanitizeHtml`), `src/components/seo/json-ld.tsx` (via `safeJsonLdStringify`), and `src/components/analytics-script.tsx` (with ID sanitized to `[a-zA-Z0-9_-]` and gated by `consentGiven`).
- Middleware CSRF uses Origin-header allow-listing: `src/lib/middleware/csrf.ts`.

## Deep-research findings vs. repo reality

| Report section       | Finding                          | Repo status     | Evidence                                                                                                                               |
| -------------------- | -------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Secrets**          | Keys/API secrets coded in source | **Resolved**    | `.env.example` + `src/lib/env.ts` getters, `.gitleaks.toml`, no hardcoded keys in `src/`                                               |
| **RLS**              | Row Level Security missing       | **Resolved**    | `supabase/migrations` has 1,355 RLS/policy/index refs; `src/lib/tenant.ts` derives `clinic_id` from subdomain                          |
| **Auth/RBAC**        | Weak auth / missing roles        | **Resolved**    | `src/lib/with-auth.ts`, role map, MFA enforcement in middleware, `src/lib/seed-guard.ts`                                               |
| **SQLi**             | Raw SQL / string concat          | **Resolved**    | Supabase PostgREST only; no raw `query()`/`execute()` in `src/`                                                                        |
| **XSS**              | Unescaped user content           | **Mitigated**   | `sanitizeHtml`, `safeJsonLdStringify`, strict CSP with nonces (`src/lib/middleware/security-headers.ts`)                               |
| **CSRF**             | No CSRF tokens                   | **Resolved**    | `src/lib/middleware/csrf.ts` enforces Origin header on all mutation methods, explicit exempt list                                      |
| **SSRF**             | `fetch(userUrl)`                 | **Resolved**    | No `fetch(req.query.url)` / `fetch(req.body.url)` in `src/`; outbound fetches use fixed endpoints                                      |
| **Uploads**          | Unfiltered uploads               | **Resolved**    | `src/app/api/upload/route.ts`: MIME allow-list, magic-byte validation, AV scan hook, per-category size limits, R2 key prefix isolation |
| **Sessions/cookies** | Insecure cookies                 | **Resolved**    | Supabase Auth + `HttpOnly`/`Secure`/`SameSite` via server clients                                                                      |
| **Architecture**     | Front/back mixed                 | **Intentional** | Next.js 16 App Router monolith with clear `src/app/api`, `src/lib`, `src/components` separation                                        |
| **Tests**            | No tests                         | **Partial**     | 210 test files, 2,282 passing, but coverage floor is `18/14/18/14` vs targets `80/70/70/60`                                            |
| **CI/CD**            | Missing pipeline                 | **Resolved**    | `.github/workflows/ci.yml` runs lint, typecheck, audit, cron-auth, KV isolation, i18n, tests                                           |
| **Monitoring**       | No logs / Sentry                 | **Partial**     | `Sentry` configured, `logger` used, but SLOs and alert rules are runtime-unverified                                                    |
| **Performance**      | Missing indexes / cache          | **Partial**     | 766 `CREATE INDEX` refs, CDN cache headers in `next.config.ts`, but N+1/load behavior needs runtime verification                       |
| **Dependencies**     | Vulnerable deps                  | **Partial**     | `npm audit` = 7 moderate, 0 high/critical                                                                                              |

## Prioritized roadmap

Each phase is modular. You can stop after any phase, re-order, or hand individual items to different owners. The work is scoped to avoid rewrites.

### Phase 1 — Security & operational guardrails (P0, do first)

Goal: prevent the most expensive failures (data leaks, bad deploys, dependency drift) before adding features.

1. **Close or triage the 7 `npm audit` moderate findings**
   - File: `package.json` overrides + `package-lock.json`
   - Runtime-relevant: `hono` ReDoS in `workers/ai`; `@hono/node-server` path traversal (Windows only, low impact on Workers). Dev-only: `storybook`/`shadcn`/`valibot`.
   - Deliverable: a `docs/dependency-triage-2026-08.md` with per-package impact, patch/bump decision, and CI gate (`npm audit --audit-level=moderate`) if appropriate.

2. **Add a tenant-scoping regression guard in CI**
   - File: new `scripts/check-tenant-scoping.ts` (or semgrep rule)
   - Block any new `src/app/api/**/route.ts` `.from(...).select/insert/update/delete` that does not include `.eq("clinic_id", ...)` (with documented exceptions for system/super-admin tables).
   - Deliverable: a PR that adds the script to `.github/workflows/ci.yml` and fixes any current violations.

3. **Harden mass-assignment at the source**
   - File: `src/lib/validations/` and route handlers
   - Add a CI script (or `eslint` rule) that rejects `.insert({ ...body })`, `.insert(body)`, or `.update(body)` in `src/app/api/**`.
   - Current scan found **zero** occurrences in production routes, but the guard prevents regressions.

4. **Document and test the OpenNext/Workers deployment path**
   - File: `wrangler.toml`, `worker-cron-handler.ts`, `docs/deployment.md`
   - Align with remediation tracker `RT-01`: add a pre-deploy smoke test that exercises `/api/health` after `build:cf`, and a documented rollback trigger.
   - Deliverable: one PR with tests + doc update; no architecture rewrite.

### Phase 2 — Quality, coverage, and dead-code cleanup (P1)

Goal: make the codebase cheaper and safer to change, which is where the "cheap now, expensive later" trap lives.

5. **Raise Vitest coverage on critical paths**
   - Files: `src/lib/with-auth.ts`, `src/lib/tenant.ts`, `src/app/api/upload/route.ts`, `src/lib/encryption.ts`, webhook handlers
   - Current floors: statements 18%, branches 14%, lines 18%, functions 14% (targets: 80/70/70/60).
   - Deliverable: a PR per domain (auth, tenant, upload, webhooks) that adds unit/integration tests and ratchets `.vitest-coverage-floor.json` upward.

6. **Enable the real-Postgres RLS integration suite in CI**
   - File: `src/lib/__tests__/integration/rls-real-postgres.test.ts`
   - The most critical security boundary (RLS) needs to run automatically, not be skipped behind `SUPABASE_LOCAL`.
   - Deliverable: a nightly or CI job that spins up `supabase start` and runs the RLS suite.

7. **Clean up `knip` findings**
   - Files: `package.json` (add `glob` to devDeps), `src/lib/data/client/*.ts`, `src/lib/templates.ts`, etc.
   - 13 unused exports, 22 unused exported types, 1 unlisted dependency.
   - Deliverable: PR that either removes dead code or marks intentional exports in `knip` config.

8. **Standardize error taxonomy and kill-switch posture**
   - Files: `src/lib/api-response.ts`, `src/lib/features.ts`, `src/lib/audit-log.ts`
   - Add per-feature kill switches and route all feature-flag state changes through `logAuditEvent()`.
   - Deliverable: one PR with no UI changes; add tests for new guards.

### Phase 3 — Performance, observability, and production readiness (P2)

Goal: make the system fast and operable at scale without adding new services.

9. **DB query performance review**
   - Files: `supabase/migrations/`, `src/lib/data/`
   - Run `EXPLAIN ANALYZE` on top 10 queries (appointments list, patient search, booking slots, clinic metrics) and add missing composite indexes (e.g. `(clinic_id, start_time)` on `appointments`).
   - Deliverable: `docs/query-performance-2026-08.md` + migration PR.

10. **Edge caching for public pages**
    - File: `next.config.ts`
    - Extend the existing 5-minute `s-maxage` + `stale-while-revalidate` pattern to other public routes (`/services`, `/about`, `/blog`, etc.) and tenant branding queries.
    - Deliverable: PR with cache headers and a Playwright/cache-bust test.

11. **Bundle and image optimization pass**
    - Files: `next.config.ts`, `src/components/`, `src/app/`
    - Use `next/image` for user-uploaded images (only 42 current usages), add responsive sizes, run `ANALYZE=true next build`, and trim unused heavy deps flagged by knip.
    - Deliverable: PR with `ANALYZE` report and before/after bundle numbers.

12. **Operational evidence pack**
    - Files: `docs/oncall.md`, `docs/slo.md`, `docs/disaster-recovery.md`
    - Capture Sentry project URLs, alert rules, Cloudflare WAF rules, backup/restore drill dates, and required environment variables in a single `docs/operational-evidence-2026-08.md`.
    - Deliverable: doc-only PR; contents are filled by the operator, but the skeleton is in the repo.

## What to avoid ("not cheap now, expensive later")

- **Do not rewrite authentication** — Supabase Auth + `withAuth` + RLS is already working; only add regression guards.
- **Do not split the monolith yet** — the Next.js App Router + API routes pattern is correct for this stage and is cheaper to operate than a separate service.
- **Do not add new third-party SaaS** until the built-in controls (RLS, CSP, AV scan hook, Sentry, Plausible) are fully exercised and documented.
- **Do not lower the lint/typecheck/test bar** — keep all gates green and ratchet coverage upward.

## Immediate next step

Pick **Phase 1, item 1** (dependency audit/triage) or **Phase 1, item 2** (tenant-scoping CI guard) as the first PR. Both are small, safe, and prevent high-cost failures. I can implement either once you confirm the priority.

---

_Generated from `deep-research-report.md` and current repo evidence. All line/file references are against commit `01cffc6c`._
