# Cloudflare Audit Remediation — Dashboard Actions

**Date:** 2026-04-20
**Account:** `0dadac330461be7f3e6fce8cb6611ba4` (professional.inbox.simo@gmail.com)
**Zone:** `wristnerd.xyz` (`a3fc8a7a314e9b6ab61362f7aacee29c`)

This document tracks the **dashboard-level** remediation steps from the Cloudflare audit. Code-level fixes are in the accompanying PR.

---

## W2. API Token Sprawl

**Problem:** 12+ active API tokens with no expiry, several never used, broad permissions, no rotation schedule.

### Remediation Steps

1. **Audit tokens** — Go to [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. **Delete unused tokens:**
   - Any "NEXUS CI/CD Token (auto-created …)" entries that show "Never used" in the Last Used column.
   - "Agent Lee (auto-generated)" — if not actively consumed by a service.
   - Duplicate "Edit Cloudflare Workers" tokens — keep only the one used by CI/CD.
   - "EVD", "NicheHub Deploy Token" — if no longer deployed.
3. **Scope down survivors:**
   - Each token should use the minimum required permissions (e.g. `Workers Scripts:Edit` + `Zone:Cache Purge` for the deploy token, not `Zone:Edit` or `Account:Edit`).
   - Restrict tokens to the specific zone(s) they need (e.g. `wristnerd.xyz` only).
4. **Set expiry on every token** — 90 days is a reasonable default. Add a calendar reminder or use the secrets rotation runbook (`docs/secrets-rotation-runbook.md`).
5. **Rotate the surviving deploy token** used in GitHub Actions — update the `CLOUDFLARE_API_TOKEN` secret in GitHub after regeneration.

### Verification

```bash
# List all tokens (requires a token with Account:Read)
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens" \
  | jq '.result[] | {id, name, status, last_used_on, expires_on}'
```

---

## W3. Weak Security on Sibling Zones

**Problem:** `cryptoranked.xyz` and `groupsmix.com` have SSL=Full (not Strict), Always HTTPS=OFF, min TLS=1.0, HSTS=OFF.

### Remediation Steps (per zone)

For **each** of `cryptoranked.xyz` and `groupsmix.com`:

1. **SSL/TLS → Overview** — Change encryption mode from **Full** to **Full (Strict)**.
   - Requires a valid origin certificate. If using Cloudflare origin certs this is already satisfied.
2. **SSL/TLS → Edge Certificates:**
   - Enable **Always Use HTTPS** → ON.
   - Set **Minimum TLS Version** → **1.2** (TLS 1.0 and 1.1 are deprecated per [RFC 8996](https://datatracker.ietf.org/doc/html/rfc8996)).
   - Enable **HSTS** with:
     - `max-age`: 12 months (31536000)
     - `includeSubDomains`: ON
     - `preload`: ON (only after confirming all subdomains serve HTTPS)
3. **Repeat** for any other zones in the account.

### Verification

```bash
ZONE_ID="<zone_id>"
# Check SSL mode
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/ssl" | jq '.result.value'
# Check minimum TLS version
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version" | jq '.result.value'
# Check Always HTTPS
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" | jq '.result.value'
```

---

## W4. `wristnerd.site` in Moved Status

**Problem:** Zone is in "moved" status — not active, not deleted. Maintenance smell.

### Remediation Steps

1. Go to [Cloudflare Dashboard → Websites](https://dash.cloudflare.com/).
2. Find `wristnerd.site`.
3. **Option A (recommended):** Delete the zone if you no longer use it — click the zone → **Advanced** → **Remove Site from Cloudflare**.
4. **Option B:** Re-add the zone if you still need it — follow the nameserver update instructions Cloudflare provides.

---

## W6. R2 Image Upload Secrets Not Set

**Problem:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` are not set as Worker secrets. Admin image uploads will fail with a 503.

> **Note:** The code already guards against this gracefully — `isR2Configured()` returns false and the upload endpoint returns a clear 503 error. This is a deployment configuration issue, not a code bug.

### Remediation Steps

1. **Create an R2 bucket** (if not already done):

   ```bash
   wrangler r2 bucket create affilite-mix-images
   ```

2. **Create R2 API credentials:**
   - Go to [Cloudflare Dashboard → R2 → Manage R2 API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
   - Create a token with **Object Read & Write** permission scoped to the `affilite-mix-images` bucket.

3. **Set Worker secrets:**

   ```bash
   wrangler secret put R2_ACCOUNT_ID --name affilite-mix
   wrangler secret put R2_ACCESS_KEY_ID --name affilite-mix
   wrangler secret put R2_SECRET_ACCESS_KEY --name affilite-mix
   wrangler secret put R2_BUCKET_NAME --name affilite-mix
   wrangler secret put R2_PUBLIC_URL --name affilite-mix
   ```

4. **Configure public access** for the R2 bucket (for serving uploaded images):
   - Dashboard → R2 → `affilite-mix-images` → Settings → Public Access → Enable.
   - Note the public URL and use it for `R2_PUBLIC_URL`.

### Verification

```bash
# Test the upload endpoint (requires admin auth)
curl -s -X POST https://wristnerd.xyz/api/admin/upload \
  -H "Cookie: nh_admin_token=<your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg","fileSize":1024}'
# Should return { uploadUrl, publicUrl } instead of 503
```

---

## W7. Missing Optional Production Secrets

**Problem:** `SENTRY_DSN`, `RESEND_API_KEY`, and `TURNSTILE_SECRET_KEY` are documented as recommended for production but not set on the Worker.

### Remediation Steps

```bash
# Sentry — get DSN from https://sentry.io → Project Settings → Client Keys (DSN)
wrangler secret put SENTRY_DSN --name affilite-mix

# Resend — get API key from https://resend.com/api-keys
wrangler secret put RESEND_API_KEY --name affilite-mix

# Turnstile — get secret key from Cloudflare Dashboard → Turnstile → Site → Settings
wrangler secret put TURNSTILE_SECRET_KEY --name affilite-mix
```

**Impact of each missing secret:**

| Secret                 | Impact When Missing                                                              |
| ---------------------- | -------------------------------------------------------------------------------- |
| `SENTRY_DSN`           | Server errors are not reported to Sentry — silent failures in prod               |
| `RESEND_API_KEY`       | Newsletter confirmation and password reset emails are logged, not sent           |
| `TURNSTILE_SECRET_KEY` | Captcha verification fails in prod — newsletter/contact forms reject submissions |

> **Code change in this PR:** `TURNSTILE_SECRET_KEY` has been added to `RECOMMENDED_SERVER_ENV` in `lib/server-env.ts` so the boot-time validator now warns when it is missing.

---

## W8. Tail Consumers / Log Shipping Empty

**Problem:** No `tail_consumers` configured — Workers Observability provides dashboard logs but no long-term retention or external alerting.

### Remediation Steps

1. **Choose a log destination:** Datadog, Grafana Loki, Axiom, Logflare, or a custom S3/R2 sink.
2. **Create a tail worker** that ships logs to the destination:
   ```bash
   wrangler generate affilite-mix-log-shipper
   # Implement the tail handler — see https://developers.cloudflare.com/workers/observability/tail-workers/
   wrangler deploy --name affilite-mix-log-shipper
   ```
3. **Wire it up** in `wrangler.jsonc` — replace the empty `tail_consumers` array:
   ```jsonc
   "tail_consumers": [
     { "service": "affilite-mix-log-shipper" }
   ]
   ```
4. **Redeploy** the main worker so the binding takes effect.

> **Code change in this PR:** `wrangler.jsonc` now includes a documented `tail_consumers: []` placeholder with setup instructions.

---

## Summary Checklist

| Finding | Type          | Status                                                  |
| ------- | ------------- | ------------------------------------------------------- |
| W2      | Dashboard     | Manual action                                           |
| W3      | Dashboard     | Manual action                                           |
| W4      | Dashboard     | Manual action                                           |
| W5      | Code          | Fixed in PR                                             |
| W6      | Deployment    | Manual action                                           |
| W7      | Code + Deploy | Partial — code warning added, secrets need manual setup |
| W8      | Code + Deploy | Partial — placeholder added, tail worker needs creation |
