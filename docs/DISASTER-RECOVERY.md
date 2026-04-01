# One-Click Disaster Recovery

Rebuild the **entire** webs-alots infrastructure from scratch with a single button click in GitHub Actions. No code changes needed.

## What Gets Recovered

| Service | What is created |
|---|---|
| **Supabase** | New project, all 59 database migrations, seed data, auth, RLS policies |
| **Cloudflare R2** | Upload bucket (`webs-alots-uploads`) + backup bucket |
| **Cloudflare KV** | Rate limiting namespace + feature flags namespace |
| **Cloudflare Workers** | Full app build + deploy with all secrets wired |
| **Data** | Optionally restores from latest R2 backup (daily/weekly/monthly) |

## Setup (One-Time, ~10 Minutes)

You only need to do this **once**. After setup, recovery is always one click.

### Step 1: Get Your API Tokens

| Token | Where to get it |
|---|---|
| **Supabase Access Token** | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) > "Generate new token" |
| **Supabase Org ID** | Look at your Supabase dashboard URL: `supabase.com/dashboard/org/YOUR_ORG_ID` |
| **Cloudflare API Token** | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) > "Create Token" > Use "Edit Cloudflare Workers" template, also add R2 and KV permissions |
| **Cloudflare Account ID** | [dash.cloudflare.com](https://dash.cloudflare.com) > click your domain > right sidebar "Account ID" |
| **Cloudflare Zone ID** | Same page as Account ID > "Zone ID" |

### Step 2: Add Secrets to GitHub

Go to your repo: **Settings > Secrets and variables > Actions > New repository secret**

Add these **required** secrets:

| Secret Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Your Supabase personal access token |
| `SUPABASE_ORG_ID` | Your Supabase organization ID |
| `SUPABASE_DB_PASSWORD` | A strong password for the database (save this somewhere safe!) |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_ZONE_ID` | Your Cloudflare zone ID for oltigo.com |

Add these **optional** secrets (for full feature recovery):

| Secret Name | What it enables |
|---|---|
| `RESEND_API_KEY` | Email notifications |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp patient notifications |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number |
| `META_APP_SECRET` | WhatsApp webhook security |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook security |
| `BOOKING_TOKEN_SECRET` | Booking link security (auto-generated if missing) |
| `CRON_SECRET` | Cron job authentication (auto-generated if missing) |
| `PHI_ENCRYPTION_KEY` | Patient data encryption (auto-generated if missing) |
| `R2_ACCESS_KEY_ID` | R2 storage access (for backup restore) |
| `R2_SECRET_ACCESS_KEY` | R2 storage secret (for backup restore) |

## How to Run Recovery

1. Go to **Actions** tab in your GitHub repo
2. Click **"One-Click Disaster Recovery"** in the left sidebar
3. Click **"Run workflow"**
4. Choose your options:
   - **Environment**: `production` or `staging`
   - **Supabase region**: Pick the closest to your users (default: `eu-central-1`)
   - **Supabase plan**: `free` or `pro`
   - **Type RECOVER**: Type the word `RECOVER` to confirm
   - **Restore from backup**: Check this if you have R2 backups to restore
5. Click the green **"Run workflow"** button
6. Wait ~10-15 minutes for everything to complete

## After Recovery

The workflow summary will show you:
- New Supabase project URL and dashboard link
- Cloudflare resource IDs
- Whether the health check passed

**Important**: After recovery, update these GitHub secrets with the new values shown in the workflow summary so that future CI/CD deploys work correctly:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## Recovery Scenarios

| Scenario | What to do |
|---|---|
| Lost Supabase project | Run recovery with "Restore from backup" checked |
| Lost Cloudflare Worker | Run recovery (Supabase will be re-created but data comes from backup) |
| Lost everything | Run recovery with "Restore from backup" checked |
| Just need fresh staging | Run recovery with Environment = "staging" |
| Want to test recovery | Run recovery with Environment = "staging" first |

## Backup Schedule

The `backup.yml` workflow runs automatically:
- **Daily** at 2:00 AM UTC (keeps last 7)
- **Weekly** on Sundays (keeps last 4)
- **Monthly** on the 1st (keeps last 3)

Backups are stored in Cloudflare R2, so even if Supabase goes down, your data is safe in a separate provider.

## Architecture

```
GitHub (source code + workflows)
    |
    |-- disaster-recovery.yml (one-click rebuild)
    |-- backup.yml (nightly backups to R2)
    |-- deploy.yml (auto-deploy on push)
    |
    +-- Creates:
        |
        +-- Supabase (database + auth + RLS)
        |     |-- 59 migrations (schema)
        |     +-- Seed data
        |
        +-- Cloudflare
              |-- Worker (app runtime)
              |-- R2 bucket (file storage)
              |-- KV namespaces (rate limits + feature flags)
              +-- DNS routes (oltigo.com + *.oltigo.com)
```
