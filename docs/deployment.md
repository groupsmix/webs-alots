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

| Stage                 | Trigger                      | Where it runs                               | Credentials                  |
| --------------------- | ---------------------------- | ------------------------------------------- | ---------------------------- |
| PR validation         | `pull_request`               | GitHub Actions (`ci.yml`, `pr-preview.yml`) | None Cloudflare-related      |
| Migrations            | `push` to `main` / `staging` | Supabase GitHub integration                 | OAuth (Supabase ↔ GitHub)   |
| Worker build & deploy | `push` to `main` / `staging` | Cloudflare Workers Builds                   | OAuth (Cloudflare ↔ GitHub) |

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

| Variable                        | Type             | Where it's used                          |
| ------------------------------- | ---------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Plaintext        | Inlined into client bundle at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret           | Inlined into client bundle at build time |
| `NODE_VERSION`                  | Plaintext (`22`) | Selects the Node toolchain for the build |

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

After this conversion, you can safely **delete** these from GitHub repo
Secrets — nothing references them anymore:

| Secret                         | Why it can go                                                        |
| ------------------------------ | -------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | `update-secrets.yml` is gone; the deploy is OAuth via Workers Builds |
| `SUPABASE_ACCESS_TOKEN`        | Supabase ↔ GitHub integration handles migrations                    |
| `SUPABASE_DB_PASSWORD`         | Same                                                                 |
| `SUPABASE_PROJECT_REF`         | Same                                                                 |
| `STAGING_SUPABASE_DB_PASSWORD` | Same                                                                 |
| `STAGING_SUPABASE_PROJECT_REF` | Same                                                                 |

### Secrets You Should Keep

These are not Cloudflare account API tokens — they're scoped to specific
resources and required by a few remaining manual / scheduled workflows:

| Secret                      | Used by                                                | What it actually is                                                                                                                             |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`     | `rotate-phi-key.yml`, `restore-test.yml`               | Just a URL component for `https://<id>.r2.cloudflarestorage.com`. Not a secret in the traditional sense — leaking it grants nothing on its own. |
| `R2_ACCESS_KEY_ID`          | `backup.yml`, `restore-test.yml`, `rotate-phi-key.yml` | S3-compatible R2 access key, scoped to a single bucket. Different from the global CF API token — much smaller blast radius.                     |
| `R2_SECRET_ACCESS_KEY`      | Same                                                   | Companion to the above.                                                                                                                         |
| `R2_BACKUP_BUCKET`          | `backup.yml`, `restore-test.yml`                       | Bucket name.                                                                                                                                    |
| `BACKUP_GPG_PRIVATE_KEY`    | `restore-test.yml`                                     | GPG private key to decrypt backups in the restore drill.                                                                                        |
| `SUPABASE_DB_URL`           | `backup.yml`                                           | Direct DB URL for `pg_dump`.                                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | `rotate-phi-key.yml`                                   | Required to update PHI rows during key rotation.                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`  | `rotate-phi-key.yml`                                   | Read by the rotation script.                                                                                                                    |

### Why Not Also Delete the R2 Keys?

R2 access keys are S3-compatible credentials scoped to a single bucket,
not Cloudflare account API tokens. They:

- Cannot manage Workers, DNS, KV, or any non-R2 resource
- Can be rotated independently in **R2 → Manage R2 API Tokens**
- Have a tiny blast radius if leaked (one bucket)

Removing them would require rewriting `backup.yml` and `restore-test.yml`
to run as Cloudflare Workers cron triggers using the R2 binding. Doable
but a sizable rewrite; not worth doing for marginal security gain.

---

## Remaining Ops Workflows

These are manual (`workflow_dispatch`) or scheduled — never triggered by
code pushes — so they don't run on every deploy. **None of them use a
Cloudflare account API token.** They use R2 S3 access keys (bucket-scoped)
or Supabase credentials only.

| Workflow              | Trigger                        | Purpose                                      | Credentials                        |
| --------------------- | ------------------------------ | -------------------------------------------- | ---------------------------------- |
| `backup.yml`          | Daily cron (02:00 UTC)         | Pull encrypted Supabase backup to R2         | R2 S3 keys + Supabase DB URL       |
| `restore-test.yml`    | Monthly cron (1st @ 04:00 UTC) | Restore-drill the latest backup              | R2 S3 keys + GPG key               |
| `rotate-phi-key.yml`  | Manual                         | Rotate PHI encryption key, re-encrypt R2 PHI | R2 S3 keys + Supabase service role |
| `access-review.yml`   | Quarterly cron                 | Snapshot team/access for SOC 2 evidence      | GitHub token only                  |
| `asm.yml`             | Daily cron                     | Attack-surface monitor                       | None Cloudflare-related            |
| `migration-check.yml` | PR                             | Validate migrations are forward-only         | None                               |

### What Was Removed

| Workflow             | Status     | Reason                                                                                            |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `deploy.yml`         | ❌ Deleted | Replaced by Cloudflare Workers Builds (OAuth)                                                     |
| `update-secrets.yml` | ❌ Deleted | Replaced by Cloudflare dashboard / `wrangler login` (see "Updating Worker Runtime Secrets" above) |

---

## Updating Worker Runtime Secrets

> Replaces the deprecated `.github/workflows/update-secrets.yml`.

Worker secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`STRIPE_SECRET_KEY`, `WHATSAPP_TOKEN`) used to be synced via a manual
GitHub Actions workflow. That workflow needed `CLOUDFLARE_API_TOKEN` and
has been removed.

### Option A — Cloudflare Dashboard (Recommended)

1. **Workers & Pages → `webs-alots` → Settings → Variables and Secrets**
2. Select **Worker** tab (not "Build")
3. **Add Variable** → set Type: **Secret** → enter name + value
4. Click **Deploy** at the top — Cloudflare creates a new Worker version
   with the updated secret immediately, no code rebuild required

This is the OAuth-equivalent path. No tokens needed.

### Option B — Local `wrangler` (also OAuth)

```bash
# One-time OAuth login (opens browser)
npx wrangler login

# Production
echo "your-secret-value" | npx wrangler secret put OPENAI_API_KEY

# Staging
echo "your-secret-value" | npx wrangler secret put OPENAI_API_KEY --env staging
```

`wrangler login` uses OAuth — no API token. The credentials persist in
`~/.wrangler/config/default.toml` locally.

### Which to Use?

- **Routine secret updates / new variables:** Dashboard (Option A)
- **Scripted bulk rotations across many secrets:** Local `wrangler` (Option B)
- **Don't do this anymore:** Round-tripping secrets through GitHub Actions

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
