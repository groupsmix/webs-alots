# SOP: Secret Compromise and Rotation

This standard operating procedure outlines the exact steps to detect, revoke, and rotate critical secrets used by Oltigo Health, ensuring no downtime or data leakage during the process.

## 1. `SUPABASE_SERVICE_ROLE_KEY`
**Detection:** Unexplained massive spikes in Supabase API usage, data exfiltration alerts, or unauthorized changes to user metadata/passwords.
**Revoke & Rotate:**
1. Go to Supabase Dashboard > Project Settings > API.
2. Click "Roll" next to the `service_role` key. (This immediately revokes the old key).
**Propagate:**
1. Update `SUPABASE_SERVICE_ROLE_KEY` in the GitHub Repository Secrets.
2. Trigger the `.github/workflows/update-secrets.yml` action to push the new key to Cloudflare Workers.
**Verify:** Ensure background queues (notifications) and `/api/health/internal` recover and function correctly.
**Backfill:** Query the `audit_logs` and Supabase Dashboard logs to determine the extent of unauthorized access.

## 2. `CLOUDFLARE_API_TOKEN`
**Detection:** Unexpected DNS changes, WAF rule modifications, or Worker deployments not originating from GitHub Actions.
**Revoke & Rotate:**
1. Go to Cloudflare Dashboard > My Profile > API Tokens.
2. Click "Roll" on the token used for GitHub Actions.
**Propagate:**
1. Update `CLOUDFLARE_API_TOKEN` in GitHub Repository Secrets.
**Verify:** Manually trigger a staging deployment via GitHub Actions to ensure the new token works.

## 3. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
**Detection:** Unauthorized refunds, unexplained customer creations, or webhook signature validation failures in the logs.
**Revoke & Rotate:**
1. Go to Stripe Dashboard > Developers > API Keys.
2. Roll the Secret key. Set the expiration of the old key to 1 hour to allow inflight requests to complete.
3. Under Webhooks, roll the webhook signing secret.
**Propagate:**
1. Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in GitHub Secrets.
2. Run `update-secrets.yml`.
**Verify:** Attempt a test checkout in the staging environment.

## 4. `META_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN`
**Detection:** Spam messages sent from the clinic's WhatsApp number or rate limit alerts from Meta.
**Revoke & Rotate:**
1. Go to Meta App Dashboard > App Settings > Basic to reset the App Secret.
2. Go to WhatsApp > API Setup and generate a new permanent Access Token.
**Propagate:**
1. Update `WHATSAPP_ACCESS_TOKEN` in GitHub Secrets.
2. Run `update-secrets.yml`.
**Verify:** Send a test appointment reminder via the admin dashboard.

## 5. `OPENAI_API_KEY` / `CLOUDFLARE_AI_API_TOKEN`
**Detection:** Massive spike in AI token usage or billing limits reached unexpectedly.
**Revoke & Rotate:**
1. Go to OpenAI Platform > API Keys and delete the compromised key. Create a new one.
2. Go to Cloudflare > AI > API Tokens and roll the token.
**Propagate:**
1. Update `OPENAI_API_KEY` and `CLOUDFLARE_AI_API_TOKEN` in GitHub Secrets.
2. Run `update-secrets.yml`.
**Verify:** Use the AI Drug Checker or Prescription generator to ensure AI routes are functioning.

## 6. `CRON_SECRET`
**Detection:** Unauthorized executions of `/api/cron/*` endpoints in logs.
**Revoke & Rotate:**
1. Generate a new high-entropy string: `openssl rand -hex 32`.
**Propagate:**
1. Update `CRON_SECRET` in GitHub Secrets.
2. Run `update-secrets.yml`.
**Verify:** Check the next scheduled cron execution in the Cloudflare Dashboard to ensure it returns 200 OK.

## 7. `BOOKING_TOKEN_SECRET`
**Detection:** Invalid or forged booking confirmation links appearing in the system.
**Revoke & Rotate:**
1. Generate a new secret: `openssl rand -hex 32`.
**Propagate:**
1. Update `BOOKING_TOKEN_SECRET` in GitHub Secrets.
2. Run `update-secrets.yml`.
**Impact:** Existing unconfirmed booking links sent to patients will instantly become invalid. Support staff must be ready to manually confirm these bookings if patients call.
