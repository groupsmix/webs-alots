# Deployment

> **Authentication model:** OAuth-based (no Cloudflare API tokens in GitHub
> Secrets). Production and staging deploys are triggered by Cloudflare
> Workers Builds, which watches the GitHub repo via the official GitHub
> integration. Migrations are handled by the Supabase GitHub integration.

---

## How a Deploy Happens

```
┌─────────────┐        ┌─────────────────────┐        ┌──────────────────┐
│  PR opened  │  ───▶  │  ci.yml + pr-       │  ───▶  │  Reviewer merges │
│             │        │  preview.yml run    │        │  to main         │
└─────────────┘        │  (tests + build)    │        └─────────┬────────┘
                       └─────────────────────┘                  │
                                                                 ▼
                       ┌─────────────────────┐        ┌──────────────────┐
                       │  Supabase GitHub    │  ◀───  │  GitHub fires    │
                       │  integration applies│        │  push event      │
                       │  pending migrations │        └─────────┬────────┘
                       └─────────────────────┘                  │
                                                                 ▼
                       ┌─────────────────────┐
                       │  Cloudflare Workers │
                       │  Builds runs        │
                       │  `npm run build:cf` │
                       │  → `wrangler deploy`│
                       └─────────────────────┘
```

| Stage | Trigger | Where it runs | Credentials |
| --- | --- | --- | --- |
| PR validation | `pull_request` | GitHub Actions (`ci.yml`, `pr-preview.yml`) | None Cloudflare-related |
| Migrations | `push` to `main` / `staging` | Supabase GitHub integration | OAuth (Supabase ↔ GitHub) |
| Worker build & deploy | `push` to `main` / `staging` | Cloudflare Workers Builds | OAuth (Cloudflare ↔ GitHub) |

---

## One-Time Setup

### 1. Cloudflare Workers Builds (OAuth)

1. Cloudflare dashboard → **Workers & Pages** → select the `webs-alots` Worker
2. **Settings** → **Build** section → **Connect**
3. Authorize the Cloudflare Workers & Pages GitHub App for `groupsmix/webs-alots`
4. Configure:
   - **Production branch:** `main`
   - **Preview branches:** `staging` (or "All non-Production branches" if you want one preview per PR)
   - **Build command:** `npm run build:cf`
   - **Deploy command (production):** `npx wrangler deploy`
   - **Deploy command (staging preview):** `npx wrangler deploy --env staging`
   - **Root directory:** `/`
   - **Node.js version:** `22`

### 2. Build-Time Environment Variables

In **Workers & Pages → webs-alots → Settings → Build → Variables and Secrets**:

| Variable | Type | Where it's used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | Inlined into client bundle at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret | Inlined into client bundle at build time |
| `NODE_VERSION` | Plaintext (`22`) | Selects the Node toolchain for the build |

Set these for both **Production** and **Preview** environments (different
Supabase URLs per env).

### 3. Runtime Worker Secrets

These are different from build-time vars — they're read by the running
Worker. Set them in **Workers & Pages → webs-alots → Settings → Variables
and Secrets** (the same screen, but under "Worker" not "Build"):

- `SUPABASE_SERVICE_ROLE_KEY`
- `PHI_ENCRYPTION_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `BOOKING_TOKEN_SECRET`
- `PROFILE_HEADER_HMAC_KEY`
- `R2_SIGNED_URL_SECRET`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `WHATSAPP_*` keys
- `SENTRY_AUTH_TOKEN` (for source map upload)
- `STRIPE_*` keys
- `CMI_*` keys
- `RESEND_API_KEY`
- ... and any other server-side secrets your app needs

> If you previously managed these via `update-secrets.yml`, you can either
> keep using that workflow (it still works — see "Optional Ops Workflows"
> below) or set them through the dashboard.

### 4. Supabase GitHub Integration

1. Supabase dashboard → your project → **Integrations** → **GitHub**
2. Connect `groupsmix/webs-alots`
3. Enable **Automatic migrations** for the production branch (`main`)
4. Configure preview branches per PR if desired

### 5. Disable Cloudflare Pages

A Pages project for this repo was previously connected. It cannot build
this code (OpenNext targets Workers, not Pages) and serializes per-account.

1. Cloudflare dashboard → **Workers & Pages** → find the Pages project
2. Remove any custom domains
3. Settings → **Delete project**

Alternatively, set Pages → **Preview deployments** → **Branch control** →
**None** to stop builds without deleting.

### 6. Custom Domain

1. **Workers & Pages → webs-alots → Settings → Triggers → Custom Domains**
2. Add `oltigo.com` (or your domain) + `www.` + any subdomains
3. Routes declared in `wrangler.toml` will bind on the next deploy

---

## GitHub Secrets — What Stays, What Goes

After this conversion, you can **delete** these from GitHub repo Secrets:

- ~~`CLOUDFLARE_API_TOKEN`~~ — no longer used by any deploy workflow
- ~~`CLOUDFLARE_ACCOUNT_ID`~~ — no longer used by any deploy workflow
- ~~`SUPABASE_ACCESS_TOKEN`~~ — Supabase integration handles this
- ~~`SUPABASE_DB_PASSWORD`~~ — Supabase integration handles this
- ~~`SUPABASE_PROJECT_REF`~~ — Supabase integration handles this
- ~~`STAGING_SUPABASE_DB_PASSWORD`~~ — same
- ~~`STAGING_SUPABASE_PROJECT_REF`~~ — same

> ⚠️ **Keep these GitHub Secrets** if you still want the optional ops
> workflows (manual key rotation, secret push, monthly restore drill):
> - `CLOUDFLARE_API_TOKEN`
> - `CLOUDFLARE_ACCOUNT_ID`
> - `SUPABASE_DB_URL` (for `backup.yml`)
> - `SUPABASE_SERVICE_ROLE_KEY` (for `rotate-phi-key.yml`)
>
> If you want **zero Cloudflare API tokens anywhere**, delete the
> `update-secrets.yml`, `rotate-phi-key.yml`, and the Cloudflare step in
> `restore-test.yml` workflows, and perform those operations via the
> Cloudflare dashboard or local `wrangler login` instead.

---

## Optional Ops Workflows

These remain in `.github/workflows/` and still require Cloudflare API
access **for the specific privileged operations they perform**. They are
manual (`workflow_dispatch`) or scheduled — never triggered by code
pushes — so they don't run on every deploy:

| Workflow | Trigger | Purpose | CF token needed? |
| --- | --- | --- | --- |
| `update-secrets.yml` | Manual | Push Worker runtime secrets from GH Secrets | Yes |
| `rotate-phi-key.yml` | Manual | Rotate PHI encryption key | Yes |
| `restore-test.yml` | Monthly cron | Restore-drill the latest Supabase backup | Yes (CF account ID) |
| `backup.yml` | Daily cron | Pull encrypted Supabase backup to R2 | No (Supabase URL only) |

All four can be removed if you prefer to do their operations manually in
the Cloudflare and Supabase dashboards.

---

## Rollback

Workers Builds keeps the previous deployment. To roll back:

1. **Workers & Pages → webs-alots → Deployments** tab
2. Find the previous green deployment
3. Click **⋯ → Rollback to this deployment**

This is the OAuth-only equivalent of the auto-rollback that used to live
in `deploy.yml`. It's a manual click, not automatic — if you need an
auto-rollback on failed post-deploy health check, you'd need a small
follow-up workflow that uses a Cloudflare API token to call
`wrangler rollback`.

---

## Verifying a Deploy Succeeded

After merge to `main`:

1. **Cloudflare dashboard → Workers & Pages → webs-alots → Deployments** —
   confirm the latest build is "Active" and matches the merge commit SHA
2. `curl -s https://oltigo.com/api/health` — should return `{\"ok\":true}`
3. Check Sentry for any new errors tagged with the new release

---

## Updating Worker Runtime Secrets

Worker runtime secrets (things the running Worker needs to read from
`env.SECRET_NAME`) are managed **per-environment** in the Cloudflare
dashboard. Unlike build-time vars, these are not injected into the bundle
— they're retrieved at runtime.

### Procedure (No GitHub Token Needed)

1. **Cloudflare dashboard → Workers & Pages → webs-alots → Settings →
   Variables and Secrets**
2. Pick the environment tab (e.g. "Production", "Preview/Staging")
3. Under **Worker** (not Build), add / edit the secret:
   - **Variable name:** exactly as it appears in your code (e.g.
     `SUPABASE_SERVICE_ROLE_KEY`)
   - **Value:** paste the secret (Cloudflare encrypts it at rest)
   - **Encryption:** enabled by default (recommended — leave it on)
4. Click **Save and deploy** — the Worker redeploys with the new secret
5. Repeat for each environment if they have different values (e.g. prod
   vs staging Supabase keys)

### What Goes Here

- `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase access
- `PHI_ENCRYPTION_KEY` — patient data encryption
- `BACKUP_ENCRYPTION_KEY` — backup vault key
- `BOOKING_TOKEN_SECRET` — appointment booking JWT secret
- `PROFILE_HEADER_HMAC_KEY` — profile header signing
- `R2_SIGNED_URL_SECRET` — signed URL generation
- `CRON_SECRET` — cron trigger authentication
- `OPENAI_API_KEY` — LLM API
- `WHATSAPP_ACCOUNT_ID`, `WHATSAPP_AUTH_TOKEN`, `WHATSAPP_PHONE_ID` —
  WhatsApp integration
- `SENTRY_AUTH_TOKEN` — source map upload (if enabled)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe payments
- `CMI_API_KEY`, `CMI_MERCHANT_ID` — payment gateway
- `RESEND_API_KEY` — email delivery

### Verification

After saving, tail the Worker logs to confirm it's reading the secret:

```bash
wrangler tail --env production --format json | grep -i "using key"
```

Or check that the feature using that secret works (e.g. send an email if
you just updated `RESEND_API_KEY`).

### Emergency Secret Rotation

If a secret is compromised, rotate it immediately:

1. Generate a new value (random 32+ chars, or from the service's
   dashboard)
2. Update it in Cloudflare dashboard (Worker redeploys in ~5 seconds)
3. Update the secret at the source (Supabase, Stripe, etc.) so old tokens
   are invalidated
4. Monitor logs for any auth failures during the transition

For automated monthly key rotation (e.g. PHI key or booking token), see
`rotate-phi-key.yml` in `.github/workflows/` — it's a manual-dispatch
workflow that does the rotation and pushes an encrypted snapshot to R2.
