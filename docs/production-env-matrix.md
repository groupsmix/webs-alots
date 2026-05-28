# Production Environment Variable Matrix

> **Audience:** Platform operators, on-call engineers, security reviewers
> **Last updated:** May 2026
> **Source of truth:** `src/lib/env.ts` (runtime validation), this document (operational reference)

---

## Legend

| Symbol | Meaning                                               |
| ------ | ----------------------------------------------------- |
| **R**  | Required — server refuses to start without it         |
| **P**  | Required in production only (`NODE_ENV=production`)   |
| **O**  | Optional — feature degrades gracefully without it     |
| **C**  | Conditional — required when a feature flag is enabled |

---

## Core Platform

| Variable                        | Req   | Where to Set              | Description                                                  | Generation                          |
| ------------------------------- | ----- | ------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | **R** | Cloudflare Workers env    | Supabase project URL                                         | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **R** | Cloudflare Workers env    | Supabase anonymous/public key                                | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY`     | **P** | Cloudflare Workers secret | Service role key for admin operations                        | Supabase dashboard → Settings → API |
| `ROOT_DOMAIN`                   | **P** | Cloudflare Workers env    | Root domain for subdomain tenant routing (e.g. `oltigo.com`) | Manual                              |
| `NEXT_PUBLIC_SITE_URL`          | **P** | Cloudflare Workers env    | Public site URL for CSRF origin checks                       | Manual (e.g. `https://oltigo.com`)  |

## Authentication & Security

| Variable                         | Req   | Where to Set              | Description                                                    | Generation                       |
| -------------------------------- | ----- | ------------------------- | -------------------------------------------------------------- | -------------------------------- |
| `BOOKING_TOKEN_SECRET`           | **P** | Cloudflare Workers secret | HMAC-SHA256 secret for booking verification tokens             | `openssl rand -hex 32`           |
| `PROFILE_HEADER_HMAC_KEY`        | **P** | Cloudflare Workers secret | HMAC key for signed profile headers (middleware ↔ withAuth)    | `openssl rand -hex 32`           |
| `CRON_SECRET`                    | **P** | Cloudflare Workers secret | Bearer token for authenticating cron endpoint calls            | `openssl rand -hex 32`           |
| `PHI_ENCRYPTION_KEY`             | **P** | Cloudflare Workers secret | AES-256-GCM key for PHI file encryption (64 hex chars)         | `openssl rand -hex 32`           |
| `R2_SIGNED_URL_SECRET`           | **P** | Cloudflare Workers secret | HMAC secret for R2 signed URLs and upload filename hashing     | `openssl rand -hex 32`           |
| `TURNSTILE_SECRET_KEY`           | **O** | Cloudflare Workers secret | Cloudflare Turnstile secret for bot protection on registration | Cloudflare dashboard → Turnstile |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **O** | Cloudflare Workers env    | Turnstile site key (client-side)                               | Cloudflare dashboard → Turnstile |

## Cloudflare R2 Storage

| Variable                         | Req   | Where to Set              | Description                                                           | Generation                             |
| -------------------------------- | ----- | ------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `R2_ACCOUNT_ID`                  | **O** | Cloudflare Workers env    | Cloudflare account ID                                                 | Cloudflare dashboard → Overview        |
| `R2_ACCESS_KEY_ID`               | **O** | Cloudflare Workers secret | R2 API access key                                                     | Cloudflare dashboard → R2 → API Tokens |
| `R2_SECRET_ACCESS_KEY`           | **O** | Cloudflare Workers secret | R2 API secret key                                                     | Cloudflare dashboard → R2 → API Tokens |
| `R2_BUCKET_NAME`                 | **O** | Cloudflare Workers env    | R2 bucket name for PHI uploads                                        | Manual                                 |
| `R2_ORPHAN_RATE_ALERT_THRESHOLD` | **O** | Cloudflare Workers env    | Orphan-rate threshold (0..1) for R2 cleanup cron alerts. Default: 0.1 | Manual                                 |

## Payments

| Variable                | Req   | Where to Set              | Description                   | Generation                  |
| ----------------------- | ----- | ------------------------- | ----------------------------- | --------------------------- |
| `STRIPE_SECRET_KEY`     | **O** | Cloudflare Workers secret | Stripe secret key             | Stripe dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | **O** | Cloudflare Workers secret | Stripe webhook signing secret | Stripe dashboard → Webhooks |
| `CMI_MERCHANT_ID`       | **O** | Cloudflare Workers env    | CMI (Morocco) merchant ID     | CMI merchant portal         |
| `CMI_SECRET_KEY`        | **O** | Cloudflare Workers secret | CMI HMAC signing secret       | CMI merchant portal         |

## WhatsApp / Messaging

| Variable                | Req   | Where to Set              | Description                                   | Generation              |
| ----------------------- | ----- | ------------------------- | --------------------------------------------- | ----------------------- |
| `META_APP_SECRET`       | **O** | Cloudflare Workers secret | Meta app secret for webhook HMAC verification | Meta Business dashboard |
| `WHATSAPP_VERIFY_TOKEN` | **O** | Cloudflare Workers secret | WhatsApp webhook subscription verify token    | Manual                  |

## Email

| Variable         | Req   | Where to Set              | Description                            | Generation                  |
| ---------------- | ----- | ------------------------- | -------------------------------------- | --------------------------- |
| `RESEND_API_KEY` | **O** | Cloudflare Workers secret | Resend API key for transactional email | Resend dashboard → API Keys |

## AI / Chat

| Variable                  | Req   | Where to Set              | Description                               | Generation                        |
| ------------------------- | ----- | ------------------------- | ----------------------------------------- | --------------------------------- |
| `OPENAI_API_KEY`          | **O** | Cloudflare Workers secret | OpenAI API key for advanced chat features | OpenAI platform → API Keys        |
| `CLOUDFLARE_ACCOUNT_ID`   | **O** | Cloudflare Workers env    | Cloudflare account ID for Workers AI      | Cloudflare dashboard → Overview   |
| `CLOUDFLARE_AI_API_TOKEN` | **O** | Cloudflare Workers secret | Cloudflare AI API token                   | Cloudflare dashboard → API Tokens |

## Observability

| Variable                 | Req   | Where to Set           | Description                     | Generation                          |
| ------------------------ | ----- | ---------------------- | ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | **P** | Cloudflare Workers env | Sentry DSN for error monitoring | Sentry dashboard → Project Settings |

## Custom Domains (Conditional)

| Variable                            | Req   | Where to Set              | Description                                                                    | Generation                           |
| ----------------------------------- | ----- | ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS` | **O** | Cloudflare Workers env    | Feature flag to enable custom domain management                                | `true` or omit                       |
| `CLOUDFLARE_API_TOKEN`              | **C** | Cloudflare Workers secret | Cloudflare API token for DNS management (required when custom domains enabled) | Cloudflare dashboard → API Tokens    |
| `CLOUDFLARE_ZONE_ID`                | **C** | Cloudflare Workers env    | Cloudflare zone ID (required when custom domains enabled)                      | Cloudflare dashboard → Zone overview |
| `CLOUDFLARE_ZONE_NAME`              | **C** | Cloudflare Workers env    | Cloudflare zone root domain (required when custom domains enabled)             | Manual                               |

## Self-Service Registration (Conditional)

| Variable                                | Req   | Where to Set              | Description                                     | Generation                       |
| --------------------------------------- | ----- | ------------------------- | ----------------------------------------------- | -------------------------------- |
| `SELF_SERVICE_REGISTRATION_ENABLED`     | **O** | Cloudflare Workers env    | Enable public clinic registration (`true`/omit) | Manual                           |
| `SLACK_REGISTRATION_ALERTS_WEBHOOK_URL` | **O** | Cloudflare Workers secret | Slack incoming webhook for registration alerts  | Slack → Apps → Incoming Webhooks |

## GitHub Actions / CI Secrets

These are NOT application runtime variables — they live in GitHub repository or environment secrets.

| Variable                 | Used By                          | Description                                                |
| ------------------------ | -------------------------------- | ---------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`  | `deploy.yml` (migrate job)       | Supabase CLI auth token for running migrations             |
| `SUPABASE_DB_PASSWORD`   | `deploy.yml` (migrate job)       | Supabase database password for migration connection        |
| `SUPABASE_PROJECT_REF`   | `deploy.yml` (migrate job)       | Supabase project reference ID                              |
| `CLOUDFLARE_API_TOKEN`   | `deploy.yml` (deploy job)        | Cloudflare API token for Wrangler deploy                   |
| `CLOUDFLARE_ACCOUNT_ID`  | `deploy.yml`, `backup.yml`       | Cloudflare account ID                                      |
| `R2_ACCOUNT_ID`          | `backup.yml`                     | R2 account ID for backup uploads                           |
| `R2_ACCESS_KEY_ID`       | `backup.yml`                     | R2 API access key for backup uploads                       |
| `R2_SECRET_ACCESS_KEY`   | `backup.yml`                     | R2 API secret key for backup uploads                       |
| `R2_BACKUP_BUCKET`       | `backup.yml`, `restore-test.yml` | R2 bucket name for database backups                        |
| `BACKUP_GPG_PRIVATE_KEY` | `backup.yml` (verify job)        | GPG private key for decrypting backups during verification |
| `BACKUP_GPG_PASSPHRASE`  | `backup.yml`                     | GPG key passphrase (if key is passphrase-protected)        |
| `SUPABASE_DB_URL`        | `backup.yml`                     | Direct Supabase PostgreSQL connection string for `pg_dump` |

---

## Rotation Schedule

| Secret                      | Rotation Frequency                 | Procedure                                                   |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | On compromise only                 | Supabase dashboard → regenerate → update Cloudflare Workers |
| `BOOKING_TOKEN_SECRET`      | Quarterly                          | See `docs/SOP-SECRET-ROTATION.md`                           |
| `PROFILE_HEADER_HMAC_KEY`   | Quarterly                          | See `docs/SOP-SECRET-ROTATION.md`                           |
| `PHI_ENCRYPTION_KEY`        | See `docs/SOP-PHI-KEY-ROTATION.md` | Re-encrypt all PHI files on rotation                        |
| `R2_SIGNED_URL_SECRET`      | Quarterly                          | See `docs/SOP-SECRET-ROTATION.md`                           |
| `CRON_SECRET`               | Quarterly                          | See `docs/SOP-SECRET-ROTATION.md`                           |
| R2 API keys                 | Annually                           | Cloudflare dashboard → R2 → Rotate                          |
| Stripe keys                 | Annually                           | Stripe dashboard → Roll keys                                |
