# Production Deployment Checklist

> **Audience:** Platform operators, release managers
> **Last updated:** May 2026
> **Use:** Run through this checklist before every production deployment and before launch.

---

## Pre-Deployment Verification

### CI / Build Gate

- [ ] All CI checks pass on the PR (lint, typecheck, tests, coverage, E2E, bundle budget, security scans)
- [ ] PR has been reviewed and approved
- [ ] No `npm audit` high/critical vulnerabilities (`npm audit --omit=dev`)
- [ ] Branch is up to date with `main` (no merge conflicts)

### Environment Secrets (see `docs/production-env-matrix.md`)

- [ ] **Core:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Cloudflare Workers
- [ ] **Service role:** `SUPABASE_SERVICE_ROLE_KEY` set in Cloudflare Workers
- [ ] **Tenant routing:** `ROOT_DOMAIN`, `NEXT_PUBLIC_SITE_URL` set
- [ ] **Auth secrets:** `BOOKING_TOKEN_SECRET`, `PROFILE_HEADER_HMAC_KEY`, `CRON_SECRET` set
- [ ] **PHI encryption:** `PHI_ENCRYPTION_KEY` set (64 hex chars)
- [ ] **R2 storage:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_SIGNED_URL_SECRET` set
- [ ] **Observability:** `NEXT_PUBLIC_SENTRY_DSN` set
- [ ] **CI secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` set in GitHub environment secrets (deploy will hard-fail without these)

### Database

- [ ] All pending migrations in `supabase/migrations/` are backward-compatible with the current Worker (expand-only)
- [ ] New tables have RLS enabled with `clinic_id` scoping
- [ ] New RLS policies have been reviewed for cross-tenant isolation
- [ ] Migration has been tested against staging Supabase project

### Cloudflare Infrastructure (`wrangler.toml`)

- [ ] Routes configured: `oltigo.com/*` and `*.oltigo.com/*`
- [ ] KV namespace binding `RATE_LIMIT_KV` has a valid production namespace ID (not placeholder)
- [ ] R2 bucket binding `UPLOADS_BUCKET` points to correct production bucket
- [ ] Cron triggers defined: `0 2 * * *`, `0 8 * * *`, `*/15 * * * *`
- [ ] `cpu_ms = 50` matches production Workers plan
- [ ] Production environment variables in `[env.production.vars]` are correct

### DNS & SSL

- [ ] Wildcard DNS `*.oltigo.com` points to Cloudflare (proxied)
- [ ] Root `oltigo.com` points to Cloudflare (proxied)
- [ ] HSTS is enabled (verified via `curl -I`)
- [ ] SSL certificate covers `*.oltigo.com`

---

## Deployment Steps

1. **Merge PR to `main`** — triggers deploy workflow
2. **Monitor deploy workflow** — verify all jobs pass:
   - `preflight` (secret validation — fails if migration secrets missing)
   - `migrate` (Supabase migrations)
   - `build-and-deploy` (Cloudflare Workers deploy)
   - `health-check` (post-deploy verification)
3. **Verify health endpoint** — `curl https://oltigo.com/api/health`
4. **Verify Sentry** — confirm no new error spike in Sentry dashboard
5. **Verify cron execution** — check Sentry Crons dashboard for next scheduled run

---

## Post-Deployment Verification

- [ ] Health check returns 200: `curl -s https://oltigo.com/api/health | jq .`
- [ ] Login flow works (test with a non-seed user)
- [ ] Public booking page loads correctly on a clinic subdomain
- [ ] Admin dashboard loads for a `clinic_admin` user
- [ ] Patient dashboard loads for a `patient` user
- [ ] File upload/download works (R2 binding verified)
- [ ] No new Sentry errors in first 15 minutes
- [ ] Cron jobs execute on schedule (check Sentry Crons)

---

## Rollback Procedure

If the health check fails or post-deploy verification shows critical issues:

1. **Automatic:** The deploy workflow triggers `wrangler rollback` to revert the Worker code
2. **Database:** Migrations are NOT rolled back (see `docs/db-rollback-constraints.md`)
3. **Manual rollback:** If automatic rollback fails:
   ```bash
   npx wrangler rollback --name webs-alots
   ```
4. **If migration caused the issue:** Follow `docs/db-rollback-constraints.md` for manual schema remediation

---

## First Launch Additional Items

These are one-time verification items for initial production launch:

- [ ] CNDP registration filed (`docs/compliance/cndp.md`)
- [ ] DPA signed with all data processors (Supabase, Cloudflare, Stripe, Meta, Twilio, Resend, Sentry)
- [ ] Backup workflow tested end-to-end: backup → encrypt → upload → download → decrypt → restore
- [ ] Restore drill completed with evidence logged (`docs/restore-drill-evidence.md`)
- [ ] DNS email auth configured (SPF, DKIM, DMARC) per `docs/dns-email-auth-runbook.md`
- [ ] Branch protection enabled on `main`: require PR reviews, require CI, block force push
- [ ] Sentry alert rules configured for SEV-1/SEV-2 conditions
- [ ] robots.txt serves correct content
- [ ] 404 page renders correctly
- [ ] Rate limiting backend verified (KV or Supabase) — test with rapid requests
