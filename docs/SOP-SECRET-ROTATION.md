# SOP: Secret Compromise and Rotation

This standard operating procedure outlines the exact steps to detect, revoke, and rotate critical secrets used by Oltigo Health, ensuring no downtime or data leakage during the process.

## Automated Rotation Workflow

**Rotation Cadence:** All secrets follow a 90-day automated rotation schedule enforced via cron triggers.

**Automation Components:**
- `scripts/rotate-phi-key.ts` — PHI encryption key rotation (cron-triggered)
- `.github/workflows/rotate-secrets.yml` — CI/CD secret rotation workflow
- Cloudflare Workers cron triggers — Automated rotation execution

**Cron Schedule:**
```toml
# wrangler.toml
[[triggers]]
crons = ["0 0 1 */3 *"]  # First day of every quarter at midnight UTC
```

**Rotation Enforcement:**
- Secrets older than 90 days trigger Sentry alerts
- Health checks fail if rotation is overdue by >7 days
- Automated rotation runs quarterly with manual override capability

**Manual Override:**
```bash
# Trigger immediate rotation (emergency use only)
npx tsx scripts/rotate-phi-key.ts --force
wrangler secret put PHI_ENCRYPTION_KEY --env production
```

## Break-Glass Procedure

**Automated Kill-Switch Endpoint:** `/api/admin/break-glass`

**Purpose:** Immediately revoke all active sessions and API keys in case of suspected compromise.

**Authentication:** Requires super_admin role + MFA step-up + break-glass token

**Actions Performed:**
1. Invalidate all JWT tokens (force re-authentication)
2. Revoke all API keys and bearer tokens
3. Disable all cron jobs
4. Enable read-only mode (block all mutations)
5. Send emergency notifications to all clinic admins
6. Log break-glass event to audit trail with operator identity

**Invocation:**
```bash
# Via CLI (requires BREAK_GLASS_TOKEN from 1Password emergency kit)
curl -X POST https://oltigo.com/api/admin/break-glass \
  -H "Authorization: Bearer ${BREAK_GLASS_TOKEN}" \
  -H "X-MFA-Code: ${MFA_CODE}"
```

**Recovery:**
1. Investigate compromise via audit logs
2. Rotate all secrets using procedures below
3. Re-enable write access: `wrangler secret put READ_ONLY_MODE=false`
4. Re-enable cron jobs
5. Notify users that service is restored

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

**Automated Rotation (Recommended):**
1. Rotation runs automatically every 90 days via cron trigger
2. Script: `scripts/rotate-phi-key.ts --secret-type r2-signed-url`
3. Cron schedule: `0 0 1 */3 *` (quarterly)
4. Automated workflow:
   - Generate new secret: `openssl rand -hex 32`
   - Update Cloudflare Worker secret: `wrangler secret put R2_SIGNED_URL_SECRET`
   - Update GitHub Repository Secret via API
   - Trigger deployment to propagate new secret
   - Verify health check passes
   - Log rotation event to audit trail

**Manual Rotation (Emergency):**
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

**Rotation Cadence Enforcement:**
- Automated rotation: Every 90 days via cron
- Manual rotation: On-demand via `scripts/rotate-phi-key.ts --secret-type r2-signed-url --force`
- Health check fails if secret age > 97 days (7-day grace period)
- Sentry alert if secret age > 90 days

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

## Migration Path: Plaintext to Vault/KMS

**Overview:** This section documents the migration path from plaintext secrets to Vault/KMS-based dynamic secret vending.

**Phase 1: Documentation (Completed in Task 3.6)**
- Update `.env.example` and `secrets-template.env` with Vault/KMS reference syntax
- Document format: `vault://secret/path` or `kms://key-id/secret-name`
- Preserve plaintext fallback for local development and disaster recovery

**Phase 2: Infrastructure Setup (Future)**
1. **Deploy Vault or AWS Secrets Manager:**
   - Vault: Self-hosted or Vault Cloud
   - AWS Secrets Manager: Integrated with KMS
   - Cloudflare Workers Secrets: Native integration
2. **Configure OIDC for CI/CD:**
   - GitHub Actions → Vault OIDC authentication
   - GitHub Actions → AWS OIDC for Secrets Manager
   - Eliminate long-lived R2 access keys
3. **Implement Secret Vending:**
   - Create `src/lib/secret-vending.ts` module
   - Support both Vault and KMS backends
   - Implement caching with TTL (5 minutes)
   - Add fallback to environment variables for local dev

**Phase 3: Application Integration (Future)**
1. **Update Secret Loading:**
   ```typescript
   // Before (plaintext)
   const apiKey = process.env.STRIPE_SECRET_KEY;
   
   // After (dynamic vending)
   const apiKey = await getSecret('vault://secret/stripe/secret-key');
   ```
2. **Implement Secret Rotation Hooks:**
   - Detect secret changes via Vault lease renewal
   - Gracefully handle secret rotation without downtime
   - Cache secrets with TTL matching Vault lease duration
3. **Update Health Checks:**
   - Verify Vault/KMS connectivity
   - Alert if secret vending fails
   - Fallback to cached secrets during outages

**Phase 4: Migration Execution (Future)**
1. **Migrate Non-Critical Secrets First:**
   - Start with OPENAI_API_KEY, CLOUDFLARE_AI_API_TOKEN
   - Verify application continues working
   - Monitor error rates and latency
2. **Migrate Payment Secrets:**
   - STRIPE_SECRET_KEY, CMI_SECRET_KEY
   - Coordinate with payment gateway for testing
   - Verify webhook signature validation still works
3. **Migrate PHI Encryption Keys:**
   - PHI_ENCRYPTION_KEY (most critical)
   - Test file encryption/decryption thoroughly
   - Verify automated rotation works end-to-end
4. **Migrate Infrastructure Secrets:**
   - SUPABASE_SERVICE_ROLE_KEY
   - R2_SIGNED_URL_SECRET
   - CRON_SECRET, PROFILE_HEADER_HMAC_KEY

**Phase 5: Decommission Plaintext (Future)**
1. Remove plaintext secrets from GitHub Secrets
2. Update deployment workflows to use Vault/KMS exclusively
3. Remove plaintext fallback code (keep only for local dev)
4. Document new secret management procedures

**Rollback Plan:**
- Keep plaintext secrets in GitHub Secrets during migration
- Implement feature flag: `USE_VAULT_SECRETS=true/false`
- If Vault/KMS fails, fall back to plaintext automatically
- Monitor error rates and roll back if issues arise

**Timeline:**
- Phase 1 (Documentation): Completed in Task 3.6
- Phase 2 (Infrastructure): 2-4 weeks
- Phase 3 (Integration): 2-3 weeks
- Phase 4 (Migration): 4-6 weeks (gradual rollout)
- Phase 5 (Decommission): 1-2 weeks

**Success Criteria:**
- Zero downtime during migration
- All secrets rotated within 90-day cadence
- Automated rotation working for all secrets
- Break-glass procedure tested and documented
- Team trained on new secret management procedures
