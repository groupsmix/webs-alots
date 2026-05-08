# IAM Policy & Token Scoping — Oltigo Health

**Document Status**: Active  
**Last Updated**: 2026-05-05  
**Owner**: Security Team  
**Compliance**: Moroccan Law 09-08, GDPR Article 32

## Overview

This document defines Identity and Access Management (IAM) policies for Oltigo Health infrastructure. All credentials, API tokens, and service accounts must follow the principle of least privilege with resource scoping, IP restrictions, time-bound expiry, and MFA enforcement where applicable.

## 1. Cloudflare API Tokens

### 1.1 Production Worker Deployment Token

**Purpose**: Deploy Workers and manage R2 buckets in production environment

**Scoping**:
- **Resources**: Workers Scripts (Edit), R2 (Edit), Workers KV (Edit)
- **Zone**: `oltigo.health` only
- **Account**: Production account ID only
- **IP Restrictions**: GitHub Actions runner IP ranges + on-call engineer IPs
- **Expiry**: 90 days (auto-rotation via GitHub Actions secret rotation workflow)

**Secret Name**: `CLOUDFLARE_API_TOKEN_PROD`

**Rotation Cadence**: Every 90 days (automated via `.github/workflows/rotate-cloudflare-tokens.yml`)

**MFA Requirement**: Yes (Cloudflare account must have MFA enabled)

### 1.2 Staging Worker Deployment Token

**Purpose**: Deploy Workers and manage R2 buckets in staging environment

**Scoping**:
- **Resources**: Workers Scripts (Edit), R2 (Edit), Workers KV (Edit)
- **Zone**: `staging.oltigo.health` only
- **Account**: Staging account ID only
- **IP Restrictions**: GitHub Actions runner IP ranges + engineering team IPs
- **Expiry**: 90 days

**Secret Name**: `CLOUDFLARE_API_TOKEN_STAGING`

**Rotation Cadence**: Every 90 days

**MFA Requirement**: Yes

### 1.3 R2 Access Tokens (Legacy - Deprecated)

**Status**: ⚠️ **DEPRECATED** — Migrate to OIDC-vended ephemeral credentials

**Purpose**: Direct R2 bucket access for backup scripts and replication

**Migration Path**:
1. Update `.github/workflows/r2-replication.yml` to use OIDC federation
2. Update `scripts/backup.sh` to use OIDC-vended credentials
3. Revoke long-lived R2 access keys after migration complete
4. Document OIDC setup in `docs/r2-oidc-setup.md`

**Target Completion**: 2026-06-01

## 2. Supabase Service Role Key

### 2.1 Production Service Role Key

**Purpose**: Bypass Row Level Security (RLS) for server-side operations (rate limiting, cron jobs, admin impersonation)

**Scoping**:
- **Database**: Production Supabase project only
- **Operations**: Full database access (bypasses RLS)
- **IP Restrictions**: Cloudflare Workers egress IPs only
- **Expiry**: 90 days (manual rotation via Supabase dashboard)

**Secret Name**: `SUPABASE_SERVICE_ROLE_KEY`

**MFA Requirement**: ✅ **YES** — Required for sensitive operations:
- Super-admin impersonation (`/api/admin/impersonate`)
- Bulk data exports
- Schema migrations
- Seed user management

**MFA Implementation**:
- Add `requireMfa()` check before granting service role access
- Use Supabase Auth MFA API to verify TOTP/SMS code
- Log all service role key usage to audit log

**Rotation Cadence**: Every 90 days (manual via `docs/SOP-SECRET-ROTATION.md`)

### 2.2 Staging Service Role Key

**Purpose**: Same as production but for staging environment

**Scoping**:
- **Database**: Staging Supabase project only
- **Operations**: Full database access
- **IP Restrictions**: Cloudflare Workers egress IPs + engineering team IPs
- **Expiry**: 90 days

**Secret Name**: `STAGING_SUPABASE_SERVICE_ROLE_KEY`

**MFA Requirement**: No (staging environment)

## 3. Bearer API Keys (Public REST API)

### 3.1 Clinic API Keys

**Purpose**: Authenticate external integrations (EMR systems, lab equipment, pharmacy POS)

**Scoping**:
- **Clinic**: Single clinic ID only (embedded in key)
- **Endpoints**: `/api/v1/*` only (no admin endpoints)
- **Rate Limit**: 1000 requests/hour per key
- **IP Restrictions**: Clinic's static IP ranges only
- **Expiry**: 365 days

**Format**: `oltigo_live_<clinic_id>_<random_32_bytes>`

**MFA Requirement**: ✅ **YES** — Required for key generation and revocation

**Rotation Cadence**: Annually or on-demand (breach, employee departure)

**Storage**: Hashed with bcrypt in `api_keys` table, never stored plaintext

### 3.2 Partner API Keys

**Purpose**: Authenticate trusted partners (insurance providers, government health systems)

**Scoping**:
- **Partner**: Single partner ID only
- **Endpoints**: `/api/v1/partner/*` only
- **Rate Limit**: 10,000 requests/hour per key
- **IP Restrictions**: Partner's static IP ranges only
- **Expiry**: 180 days

**Format**: `oltigo_partner_<partner_id>_<random_32_bytes>`

**MFA Requirement**: ✅ **YES**

**Rotation Cadence**: Every 180 days

## 4. Encryption Keys

### 4.1 PHI Encryption Key

**Purpose**: AES-256-GCM encryption for patient files (prescriptions, lab results, x-rays)

**Scoping**:
- **Algorithm**: AES-256-GCM
- **Key Length**: 256 bits (64 hex characters)
- **Storage**: Cloudflare Workers secrets (encrypted at rest)
- **Rotation**: Every 90 days via `scripts/rotate-phi-key.ts`

**Secret Name**: `PHI_ENCRYPTION_KEY`

**Rotation Cadence**: Every 90 days (automated via `.github/workflows/rotate-phi-key.yml`)

**Backward Compatibility**: Old keys retained for 7 years (compliance requirement) in `phi_encryption_keys` table

### 4.2 R2 Signed URL Secret

**Purpose**: HMAC-SHA256 signing for time-bound R2 download URLs

**Scoping**:
- **Algorithm**: HMAC-SHA256
- **Key Length**: 256 bits (64 hex characters)
- **Storage**: Cloudflare Workers secrets
- **Rotation**: Every 90 days

**Secret Name**: `R2_SIGNED_URL_SECRET`

**Rotation Cadence**: Every 90 days (automated via `docs/SOP-SECRET-ROTATION.md`)

## 5. MFA Enforcement

### 5.1 Operations Requiring MFA

The following operations MUST require MFA step-up before execution:

1. **Super-admin impersonation** (`/api/admin/impersonate`)
2. **Service role key usage** (when bypassing RLS)
3. **API key generation** (clinic and partner keys)
4. **API key revocation** (clinic and partner keys)
5. **Bulk data exports** (patient data, audit logs)
6. **Schema migrations** (production database)
7. **Secret rotation** (PHI key, R2 secret, service role key)
8. **Cloudflare token generation** (production deployment tokens)

### 5.2 MFA Implementation

**Supported Methods**:
- TOTP (Time-based One-Time Password) via authenticator apps
- SMS (fallback, not recommended for high-privilege operations)
- WebAuthn (hardware security keys, recommended for super-admins)

**Session Duration**: 15 minutes after successful MFA verification

**Re-authentication**: Required after session expiry or when switching to higher-privilege operation

**Audit Logging**: All MFA challenges and verifications logged to `audit_log` table

## 6. IP Allowlisting

### 6.1 GitHub Actions Runner IPs

**Purpose**: Restrict Cloudflare API token usage to GitHub-hosted runners only

**IP Ranges** (as of 2026-05-05):
```
192.30.252.0/22
185.199.108.0/22
140.82.112.0/20
143.55.64.0/20
```

**Update Cadence**: Monthly (check GitHub's published IP ranges)

**Documentation**: https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#ip-addresses

### 6.2 CMI Payment Gateway IPs

**Purpose**: Restrict CMI webhook endpoint to known CMI server IPs only

**IP Ranges** (provided by CMI Morocco):
```
196.200.0.0/16
41.140.0.0/16
```

**Update Cadence**: Quarterly (verify with CMI support)

**Implementation**: `src/app/api/webhooks/cmi/route.ts` — reject requests from non-CMI IPs

### 6.3 On-Call Engineer IPs

**Purpose**: Allow emergency access to production Cloudflare dashboard and Supabase

**IP Ranges**: Maintained in `docs/oncall.md` (updated when on-call rotation changes)

**Update Cadence**: Weekly (on-call rotation)

## 7. Dynamic Secret Vending (Future)

### 7.1 Migration to HashiCorp Vault

**Status**: 🚧 **PLANNED** — Target completion 2026-Q3

**Benefits**:
- Short-lived credentials (1-hour TTL)
- Automatic rotation
- Centralized audit logging
- Break-glass procedures

**Migration Path**:
1. Deploy Vault cluster (self-hosted or Vault Cloud)
2. Configure Vault database secrets engine for Supabase
3. Configure Vault AWS secrets engine for R2 (via S3-compatible API)
4. Update `.env.example` to use `vault://` reference syntax
5. Update application code to fetch secrets from Vault at runtime
6. Revoke long-lived static credentials after migration

**Documentation**: `docs/vault-migration-plan.md` (to be created)

### 7.2 OIDC Federation for R2

**Status**: 🚧 **IN PROGRESS** — Target completion 2026-06-01

**Benefits**:
- No long-lived R2 access keys
- Ephemeral credentials vended per-request
- Automatic expiry (1-hour TTL)

**Implementation**:
1. Configure Cloudflare OIDC provider in GitHub Actions
2. Update `.github/workflows/r2-replication.yml` to use OIDC
3. Update `scripts/backup.sh` to use OIDC-vended credentials
4. Revoke long-lived R2 access keys

**Documentation**: `docs/r2-oidc-setup.md` (to be created)

## 8. Break-Glass Procedures

### 8.1 Emergency Access

**Scenario**: Production outage requiring immediate access without MFA

**Procedure**:
1. On-call engineer triggers break-glass endpoint: `POST /api/admin/break-glass`
2. Endpoint sends alert to security team Slack channel
3. Endpoint generates time-bound (15-minute) emergency access token
4. Token bypasses MFA but logs all actions to audit log
5. Security team reviews audit log within 24 hours
6. Post-incident review required for all break-glass usage

**Audit Trail**: All break-glass access logged to `audit_log` table with `action: "break_glass_access"`

**Automated Kill-Switch**: Break-glass tokens auto-revoke after 15 minutes or when incident is resolved

### 8.2 Compromised Credential Response

**Scenario**: API token, service role key, or encryption key suspected compromised

**Procedure**:
1. Immediately revoke compromised credential via Cloudflare/Supabase dashboard
2. Generate new credential with different value
3. Update GitHub Actions secrets / Cloudflare Workers secrets
4. Rotate all related credentials (defense-in-depth)
5. Review audit logs for unauthorized access
6. File incident report per `docs/incident-response.md`

**Automated Response**: `docs/SOP-SECRET-ROTATION.md` includes automated kill-switch script

## 9. Compliance Requirements

### 9.1 Moroccan Law 09-08

**Article 24**: Personal data must be protected by appropriate technical measures

**Compliance**:
- ✅ All credentials time-bound with expiry
- ✅ MFA enforced for sensitive operations
- ✅ IP restrictions on all external access
- ✅ Audit logging for all credential usage

### 9.2 GDPR Article 32

**Requirement**: Implement appropriate technical measures to ensure security of processing

**Compliance**:
- ✅ Encryption keys rotated every 90 days
- ✅ Service role key requires MFA
- ✅ API keys scoped to single clinic/partner
- ✅ Break-glass procedures with audit trail

## 10. Audit & Review

### 10.1 Quarterly Access Review

**Frequency**: Every 90 days

**Scope**:
- Review all active API keys (clinic and partner)
- Review all Cloudflare API tokens
- Review all Supabase service role keys
- Revoke unused or expired credentials

**Owner**: Security Team

**Documentation**: Results logged to `docs/audit/access-review-YYYY-QN.md`

### 10.2 Annual Penetration Testing

**Frequency**: Annually

**Scope**:
- Attempt to bypass IP restrictions
- Attempt to use expired credentials
- Attempt to escalate privileges without MFA
- Attempt to extract secrets from Workers

**Owner**: External security firm

**Documentation**: Results logged to `docs/audit/pentest-YYYY.md`

## 11. References

- [Cloudflare API Token Best Practices](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Supabase Service Role Key Security](https://supabase.com/docs/guides/api/api-keys)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST SP 800-63B: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Moroccan Law 09-08 (Data Protection)](https://www.cndp.ma/fr/loi-09-08.html)
