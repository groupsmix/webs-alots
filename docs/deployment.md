# Deployment

> **Current repo-grounded deploy model:** GitHub Actions drives both Worker deploys and DB migrations. This repository does **not** currently deploy via Cloudflare Workers Builds OAuth-only automation.
>
> **IaC status:** Cloudflare account-resource scaffolding now lives under `infra/`, but live Worker artifact deployment still flows through `.github/workflows/deploy.yml` and `wrangler deploy`.

---

## How deployment works today

```text
PR opened
  ├─ ci.yml
  └─ pr-preview.yml

Merge to main/staging
  ├─ deploy.yml      -> builds + deploys Cloudflare Workers
  └─ db-migrate.yml  -> applies Supabase migrations when supabase/migrations/** changed
```

| Stage | Trigger | Workflow | Notes |
| --- | --- | --- | --- |
| PR validation | `pull_request` | `ci.yml` | Lint, typecheck, tests, security checks, E2E |
| Cloudflare build validation | `pull_request` | `pr-preview.yml` | Compile-only `npm run build:cf` smoke check |
| Worker deploy | `push` to `main` / `staging` | `.github/workflows/deploy.yml` | Deploys both `webs-alots` and `webs-alots-ai` |
| DB migrations | `push` to `main` / `staging` and migration file changes | `.github/workflows/db-migrate.yml` | Pushes Supabase migrations remotely |

---

## Worker architecture

### Main Worker
- Name: `webs-alots` / `webs-alots-staging`
- Wrangler entrypoint: `worker-cron-handler.ts`
- Generated OpenNext fetch bundle: `.open-next/worker.js`
- Static assets: `.open-next/assets/`

`worker-cron-handler.ts` is the real Worker entry. It:
- forwards normal HTTP traffic to the generated OpenNext bundle
- exports `scheduled()` for cron triggers
- exports `queue()` for Cloudflare Queue consumption

### AI Worker
- Name: `webs-alots-ai`
- Source: `workers/ai/`
- Deployed separately by the same `deploy.yml` workflow

---

## Required GitHub secrets

### For Worker deploys
Used by `.github/workflows/deploy.yml`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`

### For database migrations
Used by `.github/workflows/db-migrate.yml`:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD_PROD`
- `SUPABASE_DB_PASSWORD_STAGING`

---

## Required Cloudflare Worker runtime secrets

These are **not** supplied by GitHub Actions during deploy. They must already exist on the Worker in Cloudflare.

Typical required secrets include:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_POOLER_URL`
- `PHI_ENCRYPTION_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `BOOKING_TOKEN_SECRET`
- `PROFILE_HEADER_HMAC_KEY`
- `R2_SIGNED_URL_SECRET`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `WHATSAPP_*`
- `STRIPE_*`
- `CMI_*`
- `RESEND_API_KEY`
- `SENTRY_AUTH_TOKEN`

Set or rotate them either:

### Option A — Cloudflare dashboard
**Workers & Pages → Worker → Settings → Variables and Secrets**

### Option B — Wrangler locally
```bash
npx wrangler secret put SECRET_NAME
npx wrangler secret put SECRET_NAME --env staging
```

---

## What `deploy.yml` actually does

On push to `main` or `staging`:

1. checks out the repo
2. installs dependencies with CI-safe settings
3. runs `npm run build:cf`
4. verifies `.open-next/worker.js` exists
5. deploys the main Worker with `wrangler deploy --env production|staging`
6. runs a post-deploy smoke test against the live URL
7. installs `workers/ai` dependencies
8. deploys the separate AI Worker

### Environment selection
- `main` -> production
- `staging` -> staging

### Build-time public env handling
`NEXT_PUBLIC_*` values are injected during the GitHub Actions build step, not read from runtime Worker secrets.

---

## What `db-migrate.yml` actually does

When files under `supabase/migrations/` change on `main` or `staging`:

1. checks out the repo
2. installs the Supabase CLI
3. links the target project
4. runs `supabase db push --include-all`
5. verifies linked migration state

This workflow is separate from Worker deploys.

---

## Cloudflare Pages status

This repo still contains evidence that a Cloudflare Pages integration may exist for previews, but the application itself targets **Workers**, not Pages.

Operational recommendation:
- disable or disconnect Pages preview builds unless they are intentionally retained
- keep `pr-preview.yml` as the authoritative PR build signal for the Workers target

---

## Manual deploy

If you need to deploy locally instead of via GitHub Actions:

```bash
npm ci
npm run build:cf
npx wrangler deploy --env production
```

For staging:

```bash
npm ci
npm run build:cf
npx wrangler deploy --env staging
```

To deploy the AI Worker locally:

```bash
cd workers/ai
npm ci
npx wrangler deploy --env production
```

---

## Rollback

### Worker rollback
Use either:

```bash
npx wrangler rollback --name webs-alots
```

or the Cloudflare dashboard deployment history.

### Database rollback
There is no automatic DB rollback in the deploy workflow. Treat schema changes as forward-only unless you have an explicit remediation migration.

---

## Verification after deploy

- `curl https://oltigo.com/api/health`
- verify `/api/health/internal` with the cron auth header
- confirm the main Worker and AI Worker both deployed successfully in Actions
- confirm `db-migrate.yml` succeeded if the release included SQL migrations
- check Sentry for new errors
- check queue/cron health if the release touched notifications or scheduled jobs

---

## Known drift that was fixed

This document previously described:
- Cloudflare Workers Builds OAuth-only deploys
- `deploy.yml` as deleted
- Supabase GitHub integration as the active migration path

That was stale relative to the repository. The current source of truth is:
- `.github/workflows/deploy.yml`
- `.github/workflows/db-migrate.yml`
- `wrangler.toml`
- `worker-cron-handler.ts`
