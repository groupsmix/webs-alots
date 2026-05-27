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
