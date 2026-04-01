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

### Changed

- `deploy.yml`: Worker secrets now use `wrangler secret put` with stdin piping instead of `echo` + `wrangler secret bulk` to prevent secret leakage in CI logs

### Security

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
