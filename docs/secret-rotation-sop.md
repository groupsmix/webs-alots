# M-01: Secret Rotation — Standard Operating Procedure

## Overview

All secrets used by Oltigo Health must be rotated on a regular cadence.
This document defines the rotation schedule, procedure, and automation
for each secret category.

## Rotation Schedule

| Secret                                      | Cadence            | Method                              | Zero-Downtime                      |
| ------------------------------------------- | ------------------ | ----------------------------------- | ---------------------------------- |
| `BOOKING_TOKEN_SECRET`                      | 90 days            | Dual-secret overlap                 | Yes (via `_OLD` fallback)          |
| `R2_SIGNED_URL_SECRET`                      | 90 days            | Manual rotate + re-sign             | No (brief signed-URL invalidation) |
| `PROFILE_HEADER_HMAC_KEY`                   | 90 days            | Dual-secret overlap                 | Yes (verify old then new)          |
| `CRON_SECRET`                               | 90 days            | Rotate in Cloudflare + cron callers | Instant (single value)             |
| `PHI_ENCRYPTION_KEY`                        | Annual             | Re-encrypt at rest                  | Requires migration script          |
| `SUPABASE_SERVICE_ROLE_KEY`                 | On compromise only | Regenerate in Supabase dashboard    | Brief outage                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | On compromise only | Regenerate in Supabase dashboard    | Brief outage                       |
| `STRIPE_SECRET_KEY`                         | Annual             | Roll in Stripe dashboard            | Yes (Stripe supports key rolling)  |
| `STRIPE_WEBHOOK_SECRET`                     | Annual             | Rotate webhook endpoint             | Yes (Stripe sends to both)         |
| `CMI_SECRET_KEY`                            | Annual             | Coordinate with CMI                 | No (bank-side change)              |
| `META_APP_SECRET`                           | Annual             | Regenerate in Meta Business         | Brief webhook gap                  |
| `WHATSAPP_VERIFY_TOKEN`                     | Annual             | Update in Meta + env                | Brief webhook gap                  |
| `RESEND_API_KEY`                            | Annual             | Roll in Resend dashboard            | Yes (create new key first)         |
| `OPENAI_API_KEY`                            | Annual             | Roll in OpenAI dashboard            | Yes (create new key first)         |
| `CLOUDFLARE_AI_API_TOKEN`                   | Annual             | Roll in Cloudflare dashboard        | Yes                                |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Annual             | Roll in Cloudflare dashboard        | Yes                                |

## Procedures

### 1. BOOKING_TOKEN_SECRET (Zero-Downtime)

The app already supports dual-secret verification via `BOOKING_TOKEN_SECRET_OLD`
(defined in `src/lib/env.ts`).

```bash
# Step 1: Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Step 2: Set the OLD secret to the current value
wrangler secret put BOOKING_TOKEN_SECRET_OLD
# Paste the CURRENT value of BOOKING_TOKEN_SECRET

# Step 3: Set the new secret
wrangler secret put BOOKING_TOKEN_SECRET
# Paste the NEW_SECRET value

# Step 4: Deploy
wrangler deploy

# Step 5: Wait for overlap window (>= 15 min, the booking token TTL)
# Step 6: Remove the old secret
wrangler secret delete BOOKING_TOKEN_SECRET_OLD
wrangler deploy
```

### 2. R2_SIGNED_URL_SECRET

```bash
# Step 1: Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Step 2: Update in Cloudflare
wrangler secret put R2_SIGNED_URL_SECRET
# Paste NEW_SECRET

# Step 3: Deploy
wrangler deploy

# Note: Existing signed URLs become invalid immediately.
# The upload key hashing (buildUploadKey) uses this secret for
# filename derivation — existing files remain accessible because
# the stored paths don't change, only new uploads use the new hash.
```

### 3. PROFILE_HEADER_HMAC_KEY

```bash
# Step 1: Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Step 2: Update in Cloudflare
wrangler secret put PROFILE_HEADER_HMAC_KEY
# Paste NEW_SECRET

# Step 3: Deploy
wrangler deploy

# Note: HMAC verification in src/lib/hmac.ts tries the current key.
# Active sessions with old HMAC headers will fail verification
# and require re-authentication (acceptable tradeoff).
```

### 4. CRON_SECRET

```bash
# Step 1: Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Step 2: Update in Cloudflare Workers
wrangler secret put CRON_SECRET
# Paste NEW_SECRET

# Step 3: Deploy
wrangler deploy

# Cron triggers are internal (Cloudflare → Worker), so the secret
# is only validated within the same deployment. No external callers.
```

### 5. PHI_ENCRYPTION_KEY (Annual — Requires Migration)

**WARNING:** This requires re-encrypting all stored PHI files.

```bash
# Step 1: Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Step 2: Run re-encryption migration (offline, during maintenance window)
# This script must:
#   a) List all encrypted files in R2
#   b) For each file: decrypt with old key → re-encrypt with new key → upload
#   c) Verify integrity checksums
#   d) Log results

# Step 3: Update the secret
wrangler secret put PHI_ENCRYPTION_KEY
# Paste NEW_KEY

# Step 4: Deploy
wrangler deploy
```

### 6. Third-Party API Keys (Stripe, Resend, OpenAI, etc.)

All follow the same pattern:

```bash
# Step 1: Create new key in the provider's dashboard
#   - Stripe: https://dashboard.stripe.com/apikeys
#   - Resend: https://resend.com/api-keys
#   - OpenAI: https://platform.openai.com/api-keys
#   - Cloudflare: https://dash.cloudflare.com/profile/api-tokens

# Step 2: Update in Cloudflare Workers
wrangler secret put <SECRET_NAME>
# Paste the new key

# Step 3: Deploy
wrangler deploy

# Step 4: Revoke the old key in the provider's dashboard
# Step 5: Verify: check health endpoint, trigger a test operation
```

## Rotation Tracking Script

The script `scripts/check-secret-rotation.sh` can be run as a scheduled
reminder. It outputs which secrets are due for rotation based on the
last-rotated dates stored in `docs/secret-rotation-log.md`.

## Rotation Log

Track each rotation in `docs/secret-rotation-log.md`:

```markdown
| Date       | Secret        | Rotated By | Notes                                     |
| ---------- | ------------- | ---------- | ----------------------------------------- |
| 2026-05-28 | Initial setup | —          | All secrets set during initial deployment |
```

## Emergency Rotation (Compromise Response)

If a secret is compromised:

1. **Immediately** generate and deploy a new secret (steps above)
2. **Audit** Cloudflare Workers logs for unauthorized access
3. **Notify** via the security incident channel
4. **Revoke** the old key in the provider's dashboard
5. **Document** in the rotation log with incident reference
