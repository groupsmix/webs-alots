# Environments — Start Here

This is the single entry point for running Oltigo in each of its three
environments. It links to the deeper docs where they exist.

| Environment    | Where it runs                    | Data            | How you ship to it             |
| -------------- | -------------------------------- | --------------- | ------------------------------ |
| **Dev**        | Your machine (`localhost:3000`)  | Local fake/seed | `npm run dev`                  |
| **Staging**    | `staging.oltigo.com` (CF Worker) | Fake / test     | `git push` to `staging` branch |
| **Production** | `oltigo.com` (CF Worker)         | Real customers  | `git push` to `main` branch    |

Deployment is **branch-based and automated** by GitHub Actions:
`push → staging` deploys staging, `push → main` deploys production
(`.github/workflows/deploy.yml` builds + deploys both the main Worker and the
AI Worker; `.github/workflows/db-migrate.yml` applies Supabase migrations when
files under `supabase/migrations/**` change). See `docs/deployment.md` for the
authoritative details.

---

## 1. Dev (localhost)

One command sets up everything (prereqs check, deps, local Supabase, `.env.local`):

```bash
git clone https://github.com/groupsmix/webs-alots.git
cd webs-alots
bash scripts/dev-bootstrap.sh
npm run dev
```

Then open <http://localhost:3000> (demo clinic: <http://demo.localhost:3000>).

**Requirements:** Node 22.13+, Docker Desktop, the Supabase CLI.
Local Supabase runs `supabase start`, which applies all migrations **and**
`seed.sql` (the demo clinic `demo.localhost`). Reset anytime with
`supabase db reset`. The generated `.env.local` is git-ignored.

---

## 2. Staging & Production — one-time provisioning

These steps use **your own Cloudflare and Supabase accounts**, so they can only
be done by an operator with those credentials. Do them once per environment.

### A. Accounts & projects

1. Create a **Cloudflare account** and add the `oltigo.com` zone.
2. Create **two Supabase projects**: one for production, one for staging.

### B. Account resources (Terraform)

Cloudflare KV / R2 / Queues / routes are managed as code in `infra/`
(not the Worker bundle, not secrets). See `infra/README.md`:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in account/zone IDs
terraform init && terraform apply
```

If the resources already exist (their IDs are in `wrangler.toml`), Terraform
will reconcile rather than recreate.

### C. GitHub repository secrets (used by CI to deploy + migrate)

Set these in **GitHub → Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production)
- `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_PROD`, `SUPABASE_DB_PASSWORD_STAGING`

### D. Cloudflare Worker runtime secrets (NOT set by CI)

Run the guided helper once per environment (`wrangler login` first):

```bash
bash scripts/setup-worker-secrets.sh staging
bash scripts/setup-worker-secrets.sh production
```

It auto-generates the HMAC/encryption keys and prompts you to paste the
external ones (Supabase service-role key, pooler URL, Stripe, etc.). The AI
Worker has its own secrets — set them with the companion helper:

```bash
bash scripts/setup-ai-worker-secrets.sh staging      # GROQ_API_KEY + Supabase + optional providers
bash scripts/setup-ai-worker-secrets.sh production
```

Full reference: `docs/production-env-matrix.md`.

> **Production only:** also set `SEED_PASSWORDS_ROTATED=true` — the app refuses
> to start in production without it (a safety guard).

### E. (Recommended) Require approval before production deploys

`deploy.yml` records each deploy under a GitHub **Environment** (`production`
on `main`, `staging` otherwise). To make production deploys pause for a manual
approval click:

1. GitHub → **Settings → Environments → `production`**.
2. Add a **Required reviewers** rule (yourself / your team).

Until you add the rule it is a no-op. Once added, every push to `main` waits
for an approval in the Actions run before it ships to `oltigo.com`.

---

## 3. Shipping changes

Day-to-day, you do **not** run deploy commands manually:

```
feature branch → PR → merge to `staging`  → auto-deploys to staging.oltigo.com
                       merge to `main`     → auto-deploys to oltigo.com
```

Always promote through **dev → staging → production**. Verify on staging
(especially anything touching the database, payments, or the AI Worker) before
it reaches `main`.

### Manual deploy (fallback only)

```bash
npm ci && npm run build:cf && npx wrangler deploy --env staging      # or --env production
```

### After any deploy

- `curl https://staging.oltigo.com/api/health` (or the prod URL)
- confirm `deploy.yml` and (if migrations changed) `db-migrate.yml` succeeded
- check Sentry for new errors

---

## Reference docs

- `docs/deployment.md` — how CI deploy + migrations actually work (source of truth)
- `docs/production-env-matrix.md` — every env var/secret, where to set it, how to generate it
- `docs/production-deployment-checklist.md` — pre-launch go/no-go checklist
- `infra/README.md` — Terraform-managed Cloudflare resources
- `docs/SOP-SECRET-ROTATION.md`, `docs/SOP-PHI-KEY-ROTATION.md` — rotation procedures
