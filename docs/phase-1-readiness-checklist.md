# Phase 1 — Production / Staging Safety Readiness Checklist

> **Audience:** Platform operators, release managers, security reviewers
> **Last updated:** June 2026
> **Context:** Phase 1 of the Oltigo Health security hardening roadmap

---

## Seed User Safety

- [ ] All seed user passwords have been rotated or seed users have been deleted
      from `auth.users` and `public.users` in production Supabase.
- [ ] `SEED_PASSWORDS_ROTATED=true` is set as a Cloudflare Workers secret
      (via `wrangler secret put SEED_PASSWORDS_ROTATED`).
- [ ] `SEED_USERS_DELETED=true` is set after confirming seed accounts are removed.
- [ ] Verified the application boots successfully with the above env vars
      (no `[STARTUP HEALTH CHECK FAILED]` errors in logs).

## Cloudflare API Credentials

- [ ] `CLOUDFLARE_API_TOKEN` is set with a scoped token (DNS:Edit, Custom Hostnames:Edit).
- [ ] Legacy `CLOUDFLARE_API_KEY` and `CLOUDFLARE_EMAIL` are **not** set in any
      production or staging environment — these have been removed from the codebase.
- [ ] Custom domain provisioning has been tested after the credential migration
      (if `NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS=true`).

## Demo Mode

- [ ] In **production**: `DEMO_ENABLED` is only set to `"true"` if an active
      demo tenant is intentionally served. Otherwise it is unset or `"false"`.
- [ ] In **staging**: `NEXT_PUBLIC_FEATURE_DEMO_MODE=true` and `DEMO_ENABLED=true`
      are set if demo testing is needed (see `docs/demo-mode-guide.md`).
- [ ] `TURNSTILE_SECRET_KEY` is set in production if demo login is enabled
      (demo login hard-fails without it in production).

## Core Boot Guards (enforced by `src/lib/env.ts`)

These guards block server startup if misconfigured. Verify each passes:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL is set.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key is set.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Service role key is set (production).
- [ ] `ROOT_DOMAIN` — Root domain for subdomain routing is set (production).
- [ ] `NEXT_PUBLIC_SITE_URL` — Public site URL for CSRF checks is set (production).
- [ ] `BOOKING_TOKEN_SECRET` — ≥ 32 chars (production).
- [ ] `PROFILE_HEADER_HMAC_KEY` — ≥ 32 chars, distinct from `CRON_SECRET` (production).
- [ ] `CRON_SECRET` — ≥ 32 chars (production).
- [ ] `PHI_ENCRYPTION_KEY` — Exactly 64 hex chars (production).
- [ ] `BACKUP_ENCRYPTION_KEY` — Exactly 64 hex chars (production).
- [ ] `R2_SIGNED_URL_SECRET` — Set in production and staging.
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — Sentry DSN is set (production).
- [ ] `AV_SCAN_URL` — ClamAV endpoint is set (production).
- [ ] `AV_SCAN_REQUIRED` — Explicit fail-open/closed choice (production).
- [ ] `SEED_PASSWORDS_ROTATED=true` — Seed password rotation acknowledged.

## Security Posture Flags

- [ ] If `SELF_SERVICE_REGISTRATION_ENABLED=true`, then `SELF_SERVICE_REGISTRATION_ACK=true` is also set.
- [ ] If `NEXT_PUBLIC_PHONE_AUTH_ENABLED=true`, then `PHONE_AUTH_ACK=true` is also set.
- [ ] `NEXT_PUBLIC_DATA_MASKING` is set to `"partial"` (production default).
      If `"none"`, `ALLOW_UNMASKED_PHI=true` must be set with DPO approval.

## Email Provider

- [ ] Exactly **one** email provider is configured (Resend _or_ SMTP relay, not both).

## Rate Limiting

- [ ] `RATE_LIMIT_BACKEND` is set to `"kv"` or `"supabase"` in production
      (never `"memory"` in a multi-isolate deployment).

## Staging-Specific

- [ ] Staging uses a **separate** Supabase project (enforced by `instrumentation.ts` F-12).
- [ ] `WORKER_ENV=staging` is set in `wrangler.toml [env.staging.vars]`.
- [ ] Destructive crons are blocked unless `ALLOW_STAGING_DESTRUCTIVE_CRONS=true` is explicitly set.

---

## Verification Command

After deploying, run the health check to confirm the application started:

```bash
curl -s https://your-domain.com/api/health | jq .
```

If the application failed to boot, check Cloudflare Workers logs or Sentry
for `[STARTUP HEALTH CHECK FAILED]` messages.
