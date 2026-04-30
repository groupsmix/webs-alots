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

## 8. `R2_SIGNED_URL_SECRET`
**Detection:** Unauthorized access to PHI files served via `/r2?b=…&k=…&s=…` URLs, signatures validating for unexpected keys, or the finding that the value has leaked (e.g. committed to a public repo, appeared in a log dump). Any evidence that the pre-fix `"default-salt"` fallback was ever used in production (see audit finding #8) also qualifies.
**Revoke & Rotate:**
1. Generate a new high-entropy secret: `openssl rand -hex 32`.
**Propagate:**
1. Update `R2_SIGNED_URL_SECRET` in GitHub Repository Secrets.
2. Also set it as a Cloudflare Worker secret directly: `wrangler secret put R2_SIGNED_URL_SECRET` (so the R2 proxy worker that runs `validateSignedR2Url()` uses the same value as the Next.js app).
3. Run `.github/workflows/update-secrets.yml` to push the new secret to all deployed Workers.
**Verify:**
1. Confirm the app boots — startup env validation in `src/lib/env.ts` hard-fails when the variable is missing in production.
2. Hit `/api/files/download` (or any route that returns a signed R2 URL) as an authenticated clinic user and confirm the returned URL resolves to a 200 through the R2 proxy.
3. Confirm a previously generated URL (signed with the old secret) now 403s — this is the desired invalidation behavior.
**Impact:**
- Every outstanding signed URL is instantly invalidated. Patients and staff with open-tab downloads must re-request the file.
- Existing R2 object keys are unaffected; only future `buildUploadKey()` calls use the new secret for filename hashing, so old and new uploads coexist safely.
- PHI files remain accessible through the R2 proxy because authorization re-signs on each request — rotation does **not** require re-uploading files.
**Backfill:** Query `audit_logs` for `action = 'file.download'` entries during the suspected compromise window. If the old secret was "default-salt" or the R2 access key, treat every signed URL issued before the rotation as potentially predictable and review download patterns per-clinic for anomalies.

## 9. Signing Identity Compromise (Sigstore / GitHub OIDC)

**Context:** The CI pipeline uses `actions/attest-build-provenance` for SLSA in-toto attestation, which relies on Sigstore (Fulcio + Rekor) and GitHub's OIDC identity.

**Detection:** Unexpected attestations appearing in Rekor transparency log for the `groupsmix/webs-alots` subject, or GitHub audit log showing OIDC token issuance for unrecognized workflows.

**Revoke & Contain:**
1. **Disable the compromised GitHub Actions workflow** immediately by pushing a commit that removes or disables it, or use the GitHub API to disable the workflow.
2. **Revoke GitHub OIDC trust** if the identity was issued to an unauthorized workflow:
   - Review `gh api /repos/groupsmix/webs-alots/actions/oidc/customization/sub` to check the subject claim template.
   - If the attacker used a forked repo or injected workflow, restrict OIDC to specific branches: set the subject claim to include `ref:refs/heads/main`.
3. **Check Rekor transparency log** for unauthorized attestations:
   ```bash
   rekor-cli search --email "github-actions[bot]@users.noreply.github.com" \
     --rekor_server https://rekor.sigstore.dev
   ```
4. **Rotate any deploy secrets** that the compromised workflow had access to (Cloudflare API token, Supabase keys, etc.) using the procedures in sections 1-8 above.

**Propagate:**
1. Update GitHub branch protection rules to require attestation from the new, trusted workflow only.
2. If using Workload Identity Federation (e.g., for cloud deploys), rotate the identity pool and restrict the subject claim.
3. Notify downstream consumers that attestations before timestamp X should be treated as untrusted.

**Verify:**
1. Trigger a deploy from `main` and confirm the new attestation appears in Rekor.
2. Verify `cosign verify-attestation` succeeds for the new artifact.
3. Confirm the old compromised identity no longer has access to produce trusted attestations.

**Postmortem:**
1. Determine how the identity was compromised (workflow injection, branch protection bypass, stolen PAT, etc.).
2. Add the incident to the tabletop exercise library for future drills.
3. Review all attestations produced during the compromise window and flag any suspicious artifacts.
