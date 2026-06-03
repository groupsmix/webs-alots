# Demo Mode Configuration Guide

> **Audience:** Platform operators, staging/QA engineers
> **Last updated:** June 2026

---

## Overview

Demo mode is controlled **entirely via environment variables** — there is no database flag, admin UI toggle, or feature-flag KV key. Enabling or disabling demo mode requires setting the correct env vars and redeploying.

Demo mode provides:

- A demo banner in the UI
- One-click login as a pre-seeded patient user
- Blocking of destructive (mutating) API requests on the demo tenant

## Demo Credentials (from seed.ts)

When running the local `demo:seed` flow (which uses `scripts/seed.ts`), the following demo clinic (`demo.localhost:3000`) accounts are created:

- **Clinic Admin:** `admin@demo-clinic.com` / `ClinicAdmin123!`
- **Doctor:** `doctor@demo-clinic.com` / `Doctor123!`
- **Receptionist:** `reception@demo-clinic.com` / `Reception123!`

---

## Environment Variables

| Variable                         | Default                                | Description                                                                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FEATURE_DEMO_MODE`  | `"false"`                              | Client-side flag. When `"true"`, the UI renders the demo banner and one-click login buttons. Set to `"false"` to hide all demo UI.                                                                                                                          |
| `DEMO_ENABLED`                   | _(unset)_                              | Server-side gate for `POST /api/auth/demo-login`. In production (`NODE_ENV=production`), the endpoint returns 403 unless `DEMO_ENABLED=true`. In non-production environments the endpoint is always reachable (subject to `NEXT_PUBLIC_FEATURE_DEMO_MODE`). |
| `DEMO_CLINIC_ID`                 | `c0000000-de00-0000-0000-000000000001` | Override the well-known demo clinic UUID (seeded in migration 00046). Only set this if your staging database uses a different demo clinic.                                                                                                                  |
| `TURNSTILE_SECRET_KEY`           | _(unset)_                              | Cloudflare Turnstile secret. **Mandatory in production** for demo login — the endpoint hard-fails without it. Optional in dev/staging.                                                                                                                      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | _(unset)_                              | Client-side Turnstile widget key. Required when `TURNSTILE_SECRET_KEY` is set.                                                                                                                                                                              |

---

## How to Enable Demo Mode in Staging

1. **Set the environment variables** in your staging Cloudflare Workers environment
   (via `wrangler.toml` `[env.staging.vars]` or `wrangler secret put`):

   ```toml
   # wrangler.toml — [env.staging.vars]
   NEXT_PUBLIC_FEATURE_DEMO_MODE = "true"
   DEMO_ENABLED = "true"
   ```

2. **Ensure the demo clinic exists** in the staging Supabase database.
   The demo clinic is seeded by migration `00046`. If you are using a fresh
   staging database, run all migrations:

   ```bash
   supabase db push --linked
   ```

3. **Verify the demo subdomain resolves.** The demo tenant uses the subdomain
   `demo` (e.g., `demo.staging.oltigo.com`). Ensure your wildcard DNS covers
   the staging domain.

4. **Deploy:**

   ```bash
   wrangler deploy --env staging
   ```

5. **Test:** Navigate to `https://demo.staging.oltigo.com` and confirm:
   - The demo banner appears
   - One-click login works for the patient role
   - Destructive API requests (POST/PUT/PATCH/DELETE) on the demo tenant return 403

---

## How to Disable Demo Mode

Set `NEXT_PUBLIC_FEATURE_DEMO_MODE=false` (or remove it) and redeploy.
The demo login endpoint will also refuse requests when `DEMO_ENABLED` is not `"true"` in production.

---

## Security Notes

- **Production:** `DEMO_ENABLED` must be explicitly set to `"true"` for the demo
  login endpoint to function. This is an intentional safety gate — demo login
  should never be accidentally available in production.
- **Role restriction:** Only the `patient` role can be minted via demo login (R-10 hardening).
- **Turnstile required in production:** The endpoint hard-fails if `TURNSTILE_SECRET_KEY`
  is missing when `NODE_ENV=production`, preventing bot abuse.
- **Destructive request blocking:** The middleware blocks POST/PUT/PATCH/DELETE
  on the demo tenant (except for auth, webhook, and cron paths) to prevent
  demo users from polluting storage (SEED-02).

---

## Key Source Files

| File                                                                                                      | Purpose                                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`src/lib/demo.ts`](file:///c:/webs-alots-main/src/lib/demo.ts)                                           | Demo tenant helpers, demo user definitions, destructive request blocking |
| [`src/app/api/auth/demo-login/route.ts`](file:///c:/webs-alots-main/src/app/api/auth/demo-login/route.ts) | Demo login API endpoint (Turnstile, role gate, magic-link generation)    |
| [`src/middleware.ts`](file:///c:/webs-alots-main/src/middleware.ts)                                       | Demo tenant guard in middleware (blocks destructive requests)            |
| [`.env.example`](file:///c:/webs-alots-main/.env.example)                                                 | Template listing all demo-related variables                              |
