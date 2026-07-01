# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- SECURITY.md with responsible disclosure process and security architecture overview
- CONTRIBUTING.md with branching strategy, code conventions, and testing guide
- CHANGELOG.md (this file) to track release history
- Expanded AGENTS.md with tenant scoping rules, test conventions, security requirements, and domain-specific guidance
- API documentation expanded from 2 to 15+ resource types (auth, booking, payments, webhooks, cron, branding, notifications, health, impersonate, onboarding, uploads, CSP reporting)
- API route handler tests for booking/cancel and impersonate endpoints (testing actual handlers, not just schemas)
- Integration tests for prescription-to-notification and clinic onboarding flows
- "How to obtain" links in `.env.example` for third-party service credentials
- CI-11: Auto-rollback to the previous Cloudflare Worker version when the post-deploy health check fails. The deploy workflow runs `wrangler rollback`, verifies the previous version is healthy, and still fails the run so on-call gets a red signal.
- `docs/db-rollback-constraints.md` documenting why database migrations are forward-only, what the auto-rollback does and does not revert, the expand-migrate-contract pattern required for schema changes, and the manual recovery procedures when a Worker rollback is insufficient.

### Changed

- `deploy.yml`: Worker secrets now use `wrangler secret put` with stdin piping instead of `echo` + `wrangler secret bulk` to prevent secret leakage in CI logs

### Fixed (2026-06-30 Config/Type-Safety Audit)

- **B-1**: Booking-token single-use enforcement is now durable across Cloudflare Worker isolates via KV (`src/lib/booking-token-replay.ts`), replacing a per-isolate in-memory `Map` that allowed a used token to be replayed on a different isolate. Degrades to in-memory dedup when KV is unavailable (dev/tests).
- **R-1/R-4**: Removed the `global.d.ts` ambient `declare module` shims for `ai` and `lucide-react`, which forced both packages to `any` and hid the `ai` v6→v7 major-bump surface from `tsc` (`next.config.ts` sets `ignoreBuildErrors`). Real types now apply and typecheck stays green.
- **R-5**: Reconciled `SUPABASE_POOLER_URL` — the enforcement message in `src/lib/env.ts` now accurately scopes the pooler to direct Postgres driver paths (migrations/backups), and the stale/contradictory "update supabase-server.ts" TODO was removed from `wrangler.toml` (supabase-js intentionally uses HTTPS/Supavisor).
- **R-6**: `worker-env.d.ts` `CloudflareEnv` now matches the real `wrangler.toml` bindings (`UPLOADS_BUCKET` instead of the non-existent `PHI_BUCKET`; `TENANT_CACHE` optional; added `FEATURE_FLAGS_KV`, `NOTIFICATION_QUEUE`, `NEXT_INC_CACHE_R2_BUCKET`).
- **R-7**: Cron `scheduled()` in `worker-cron-handler.ts` no longer reads or logs the response body on error (potential PHI from `gdpr-purge`/`billing`/`data-retention`); it logs the status code only, matching the `queue()` L-08 policy.
- **R-8**: Wired the OpenNext R2 incremental cache (with regional cache) in `open-next.config.ts` so `experimental.useCache` persists across isolates instead of being a no-op. `NEXT_INC_CACHE_R2_BUCKET` is documented in `wrangler.toml` and the adapter degrades gracefully until the bucket is provisioned.
- **R-9**: Removed contradictory stale "A-09 LAUNCH BLOCKER / DELIBERATELY INVALID" comments from `wrangler.toml`; the staging `RATE_LIMIT_KV` namespace is already dedicated and distinct from production (guarded by `scripts/check-kv-namespace-collision.mjs`).
- **R-2**: `components.json` hooks alias corrected from `@/hooks` to `@/lib/hooks` (the actual hooks directory).
- **R-3**: `docker-compose.yml` dropped the obsolete top-level `version` key and added `cap_drop: [ALL]` to the `uptime-kuma` service for parity with the other services.
- Fixed two `react-hooks/set-state-in-effect` warnings (`use-clinic-features`, `use-patient-search`) by deriving initial state and moving state updates out of the synchronous effect body.

### Removed (2026-06-30 Audit)

- Dead code: unused `src/components/dental/lab-orders-panel.tsx`, `src/lib/types/patient-metadata.ts`, and `src/lib/video/client.ts`, plus the unused `@ai-sdk/react` dependency (lockfile synced).

### Security (2026-05-27 Audit)

- **HIGH-1**: Fixed RLS policies on `ai_usage` and `cmi_callbacks_seen` — replaced non-existent `app.clinic_id` session variable with `get_request_clinic_id()` (migration 00091)
- **HIGH-2**: Wired `cmi_callbacks_seen` table into CMI callback handler for replay protection
- **HIGH-3**: Enabled KV rate-limit namespace in `wrangler.toml` (RATE_LIMIT_BACKEND=kv)
- **HIGH-4**: Added positive assertion in CI that RLS integration tests actually run (not silently skipped)
- **MEDIUM-1**: Consent route now requires tenant context (400 if missing)
- **MEDIUM-2**: Added Stripe webhook event dedup (`processed_stripe_events` table, migration 00092) and `Idempotency-Key` headers on all Stripe POST calls
- **MEDIUM-4**: Added coverage floor regression check in CI
- **MEDIUM-5**: super_admin now requires MFA enrolled + verified (AAL2) in middleware
- **MEDIUM-6**: Created `/api/cron/audit-log-flush` to drain `pending_audit_logs` (runs every 15 min)
- **MEDIUM-8**: Added DB types freshness check in deploy pipeline
- **MEDIUM-9**: Added `poweredByHeader: false` to `next.config.ts`
- **MEDIUM-10**: Self-service clinic registration defaults to `pending_review` status
- **LOW-1**: Bumped `compatibility_date` from `2025-04-01` to `2026-05-01`
- Fixed insecure secret handling in deploy pipeline where secret values could appear in CI logs if the `echo` command failed

## [0.1.0] — 2026-03-15

### Added

- Initial release of Oltigo Health SaaS platform
- Multi-tenant architecture with RLS and subdomain routing
- 5 user roles: Super Admin, Clinic Admin, Receptionist, Doctor, Patient
- Booking system with cancellation, rescheduling, emergency slots, and recurring appointments
- WhatsApp Business API integration (Meta Cloud API + Twilio fallback)
- Email notifications (Resend + SMTP fallback)
- CMI and Stripe payment gateway integration
- PHI encryption at rest (AES-256-GCM)
- Cloudflare R2 file storage with path traversal prevention
- Comprehensive test suite (27 lib, 7 component, 9 API, 17 E2E test files)
- WCAG AA accessibility testing with jest-axe and color contrast validation
- Cloudflare Workers deployment via OpenNext
- Sentry error monitoring and session replay
- Plausible analytics integration
