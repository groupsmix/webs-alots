# Bugfix Requirements Document: Phase 2 Infrastructure & Security Hardening (A31-A60)

## Introduction

This bugfix addresses ~100+ infrastructure, network, API, and frontend security issues identified in audit sections A31-A60 of the Oltigo Health platform. These issues span Infrastructure-as-Code (IaC) security, Docker configuration, CI/CD pipeline hardening, cloud IAM controls, public endpoint protection, storage security, secret management, network segmentation, monitoring/observability, autoscaling controls, and cron job management.

The platform currently has critical security gaps including:
- Docker services exposed on 0.0.0.0 with weak credentials
- Critical configuration only in dashboards (not version-controlled IaC)
- Secrets stored as plaintext without rotation enforcement
- No egress filtering or WAF rules
- PII/PHI leaking to logs and Sentry
- No cost controls or billing anomaly alarms
- Cron schedules drifting from code

These issues create significant security, compliance, reliability, and auditability risks for a healthcare platform handling Protected Health Information (PHI) under Moroccan Law 09-08 and GDPR.

## Bug Analysis

### Current Behavior (Defect)

#### 1. IaC Security Issues (A31)

1.1 WHEN Docker Compose services are configured THEN Postgres (port 54322), Studio (port 54323), and MinIO (ports 9000/9001) are bound to 0.0.0.0, exposing them to any network interface

1.2 WHEN Docker images are specified THEN they use floating tags (`:15.8.1.145`, `:20240101`, `:latest`) instead of immutable digest pinning, allowing tag mutation attacks

1.3 WHEN Docker Compose is deployed THEN hard-coded weak credentials are committed to the repository (POSTGRES_PASSWORD: postgres, MINIO_ROOT_USER: minioadmin/minioadmin)

1.4 WHEN Supabase Studio is exposed THEN it has no authentication layer and provides full database admin UI access to anyone reaching port 54323

1.5 WHEN wrangler.toml is configured THEN KV namespace and R2 bucket bindings are commented out, forcing production bindings to live exclusively in the Cloudflare dashboard

1.6 WHEN wrangler.toml is configured THEN CPU limits are commented out, allowing unbounded cost from runaway requests

1.7 WHEN wrangler.toml is configured THEN observability is disabled (commented out), preventing Workers Logs from being collected

1.8 WHEN cron schedules are needed THEN they are configured only in the Cloudflare dashboard with no `[[triggers].crons]` block in wrangler.toml, causing configuration drift

1.9 WHEN supabase/config.toml is needed THEN it is absent from the repository, leaving encryption-at-rest, JWT expiry, MFA enforcement, and email rate-limits unconfigured in version control

1.10 WHEN Docker Compose services run THEN they share the default bridge network with no segmentation, no read_only filesystem, no capability dropping, no security_opt, no user specification, and no resource limits

#### 2. CI/CD Security Issues (A34)

2.1 WHEN GitHub Actions workflows execute THEN actions are pinned to floating major tags (v4, v6, v7) instead of full commit SHAs, creating supply chain risk

2.2 WHEN Semgrep security scanning runs THEN it uses `continue-on-error: true` and `|| true`, causing security findings to be silently dropped

2.3 WHEN deployment occurs THEN a single CLOUDFLARE_API_TOKEN is used for both production and staging with no environment-scoped tokens

2.4 WHEN Worker bundles are built THEN only the SBOM is signed with cosign, not the deployed Worker bundle itself

2.5 WHEN R2 credentials are needed THEN long-lived access keys are written to ~/.aws/credentials on the runner filesystem

2.6 WHEN branch protection is configured THEN required reviewers, signed commits, and status checks are not declared in-repo and cannot be audited

#### 3. Cloud IAM Issues (A35)

3.1 WHEN R2 and Cloudflare API tokens are used THEN they have no resource scoping, IP restrictions, or time-bound expiry verifiable in the repository

3.2 WHEN SUPABASE_SERVICE_ROLE_KEY is used THEN it bypasses Row Level Security (RLS) with no MFA, time-bound, or IP restriction

3.3 WHEN Bearer API keys are used for public API access THEN they have no MFA gate, no scope, no expiry, and no rotation enforcement

3.4 WHEN super-admin impersonation occurs THEN there is no MFA step-up before impersonation is granted

#### 4. Public Endpoint Issues (A36)

4.1 WHEN TLS and routing are configured THEN routes are commented out in wrangler.toml, forcing TLS termination configuration to live in the Cloudflare dashboard

4.2 WHEN rate limiting is applied THEN the global catch-all rule can silently disappear if `/api/` is not in rateLimitRules

4.3 WHEN client IP is extracted THEN X-Forwarded-For and X-Real-IP headers are trusted without upstream proxy allowlisting, enabling IP-spoof rate-limit bypass

4.4 WHEN WAF protection is needed THEN no WAF rules exist in IaC (no Cloudflare Ruleset Engine config)

4.5 WHEN geo-restrictions are needed THEN no geo-fencing logic exists for admin endpoints handling Moroccan PHI

#### 5. Storage Security Issues (A37)

5.1 WHEN R2 lifecycle is configured THEN only one rule exists (abort incomplete multipart), with no expiration, versioning, or NCV expiration

5.2 WHEN R2 buckets are configured THEN versioning is not enabled in IaC

5.3 WHEN backups are stored THEN no object-lock/WORM is declared, allowing an attacker with R2 token to delete backups

5.4 WHEN R2 access occurs THEN no access logging configuration exists (no Cloudflare R2 SQL log push or Logpush job)

5.5 WHEN R2 replication runs THEN it is implemented as a 6-hour cron job instead of native cross-region replication, creating up to 6-hour RPO

5.6 WHEN file uploads occur THEN no antivirus scan is performed before persisting to R2

5.7 WHEN R2 public access is configured THEN no public-access block is declared as IaC

#### 6. Secret Management Issues (A38)

6.1 WHEN secrets are stored THEN SUPABASE_SERVICE_ROLE_KEY is a long-lived static bearer token with no dynamic vending

6.2 WHEN environment variables are documented THEN all secrets are listed as plain strings in .env.example with no Vault/KMS reference syntax

6.3 WHEN R2 credentials are materialized THEN they are written as plaintext to ~/.aws/credentials on the runner filesystem

6.4 WHEN secret rotation is needed THEN no rotation cadence is enforced as code (only SOPs exist)

6.5 WHEN break-glass procedures are needed THEN no automated break-glass account or kill-switch is wired to a single endpoint

#### 7. Network Segmentation Issues (A39)

7.1 WHEN Workers make outbound requests THEN no egress filtering or allowlist exists, allowing fetch() to arbitrary external hosts

7.2 WHEN CMI payment callbacks are received THEN no source-IP allowlist exists (CMI publishes a known set)

7.3 WHEN DNS lookups occur THEN hostname parameters constructed from caller input are not sanitized to disallow control characters

#### 8. Monitoring & Observability Issues (A40)

8.1 WHEN Workers Logs are needed THEN observability is disabled in wrangler.toml (commented out)

8.2 WHEN alerting is needed THEN no alerting code exists in the repository (no Cloudflare Alerts API, no Sentry alert YAML)

8.3 WHEN chaos testing is needed THEN no chaos test artifacts exist (no chaos-monkey, Litmus, or Toxiproxy)

8.4 WHEN health checks run post-deploy THEN they only verify `/api/health` returns ok:true without checking Supabase, R2, or per-tenant routing

#### 9. Observability Privacy Issues (A41)

9.1 WHEN logging occurs THEN the logger does not apply PII redaction, allowing user-supplied hostnames, emails, phones, and names to go straight to logs

9.2 WHEN file download attempts are logged THEN the attempted R2 key (containing patient identifiers) is logged

9.3 WHEN Sentry captures errors THEN no beforeSend filter strips PHI, causing request bodies with patient names, phones, and IDs to be captured

9.4 WHEN log retention is needed THEN no log retention policy exists in code (Sentry retention is dashboard-configured)

#### 10. Autoscaling & Cost Control Issues (A42)

10.1 WHEN CPU limits are needed THEN cpu_ms is commented out in wrangler.toml, relying on platform defaults

10.2 WHEN billing anomalies occur THEN no billing anomaly alarm is wired in the repository

10.3 WHEN LLM calls are made THEN concurrent in-flight requests per clinic are only limited by IP-based middleware rate-limit, allowing botnet abuse

10.4 WHEN rate limiting is applied THEN per-user/per-API-key limits are not enforced at the edge for unauthenticated public endpoints

#### 11. Cron Job Issues (A43)

11.1 WHEN cron schedules are defined THEN they are listed in worker-cron-handler.ts but not declared in wrangler.toml, causing configuration drift

11.2 WHEN cron handlers fail THEN no DLQ/retry queue is configured for missed runs

11.3 WHEN cron jobs run THEN no idempotency locks prevent duplicate execution across isolates

### Expected Behavior (Correct)

#### 1. IaC Security (A31)

2.1 WHEN Docker Compose services are configured THEN Postgres, Studio, and MinIO SHALL be bound to 127.0.0.1 only, preventing external network access

2.2 WHEN Docker images are specified THEN they SHALL use immutable digest pinning (@sha256:...) to prevent tag mutation attacks

2.3 WHEN Docker Compose is deployed THEN credentials SHALL be injected from environment variables or secrets management, never hard-coded

2.4 WHEN Supabase Studio is exposed THEN it SHALL require authentication or be disabled in non-development environments

2.5 WHEN wrangler.toml is configured THEN KV namespace and R2 bucket bindings SHALL be uncommented and version-controlled as IaC

2.6 WHEN wrangler.toml is configured THEN CPU limits SHALL be set to prevent unbounded cost

2.7 WHEN wrangler.toml is configured THEN observability SHALL be enabled to collect Workers Logs

2.8 WHEN cron schedules are needed THEN they SHALL be declared in wrangler.toml `[[triggers].crons]` blocks to prevent drift

2.9 WHEN Supabase configuration is needed THEN supabase/config.toml SHALL exist in the repository with encryption-at-rest, JWT expiry, MFA enforcement, and email rate-limits configured

2.10 WHEN Docker Compose services run THEN they SHALL use network segmentation, read_only filesystems, capability dropping, security_opt, non-root users, and resource limits

#### 2. CI/CD Security (A34)

2.11 WHEN GitHub Actions workflows execute THEN actions SHALL be pinned to full commit SHAs to prevent supply chain attacks

2.12 WHEN Semgrep security scanning runs THEN it SHALL fail the build on security findings (no continue-on-error)

2.13 WHEN deployment occurs THEN environment-scoped Cloudflare API tokens SHALL be used (separate for production and staging)

2.14 WHEN Worker bundles are built THEN the deployed Worker bundle SHALL be signed with cosign, not just the SBOM

2.15 WHEN R2 credentials are needed THEN ephemeral credentials SHALL be vended via OIDC, not long-lived keys

2.16 WHEN branch protection is configured THEN required reviewers, signed commits, and status checks SHALL be declared in-repo for auditability

#### 3. Cloud IAM (A35)

2.17 WHEN R2 and Cloudflare API tokens are created THEN they SHALL have resource scoping, IP restrictions, and time-bound expiry documented in the repository

2.18 WHEN SUPABASE_SERVICE_ROLE_KEY is used THEN it SHALL require MFA for sensitive operations and have time-bound expiry

2.19 WHEN Bearer API keys are used THEN they SHALL have MFA gates, scoping, expiry, and rotation enforcement

2.20 WHEN super-admin impersonation occurs THEN it SHALL require MFA step-up before granting impersonation

#### 4. Public Endpoint (A36)

2.21 WHEN TLS and routing are configured THEN routes SHALL be uncommented in wrangler.toml and version-controlled

2.22 WHEN rate limiting is applied THEN the global catch-all rule SHALL be guaranteed to exist with a default fallback

2.23 WHEN client IP is extracted THEN upstream proxy allowlisting SHALL be enforced to prevent IP-spoof bypass

2.24 WHEN WAF protection is needed THEN WAF rules SHALL exist in IaC (Cloudflare Ruleset Engine config)

2.25 WHEN geo-restrictions are needed THEN geo-fencing logic SHALL exist for admin endpoints handling PHI

#### 5. Storage Security (A37)

2.26 WHEN R2 lifecycle is configured THEN rules SHALL include expiration, versioning, and NCV expiration policies

2.27 WHEN R2 buckets are configured THEN versioning SHALL be enabled in IaC

2.28 WHEN backups are stored THEN object-lock/WORM SHALL be enabled to prevent deletion

2.29 WHEN R2 access occurs THEN access logging SHALL be configured (Cloudflare R2 SQL log push or Logpush job)

2.30 WHEN R2 replication runs THEN it SHALL use native cross-region replication instead of cron jobs

2.31 WHEN file uploads occur THEN antivirus scanning SHALL be performed before persisting to R2

2.32 WHEN R2 public access is configured THEN public-access block SHALL be declared as IaC

#### 6. Secret Management (A38)

2.33 WHEN secrets are stored THEN dynamic secret vending SHALL be used instead of long-lived static tokens

2.34 WHEN environment variables are documented THEN Vault/KMS reference syntax SHALL be used instead of plaintext

2.35 WHEN R2 credentials are materialized THEN ephemeral credentials SHALL be used via OIDC

2.36 WHEN secret rotation is needed THEN rotation cadence SHALL be enforced as code with automated workflows

2.37 WHEN break-glass procedures are needed THEN automated break-glass accounts SHALL be wired to a single endpoint

#### 7. Network Segmentation (A39)

2.38 WHEN Workers make outbound requests THEN egress filtering with allowlists SHALL be enforced

2.39 WHEN CMI payment callbacks are received THEN source-IP allowlisting SHALL be enforced

2.40 WHEN DNS lookups occur THEN hostname parameters SHALL be sanitized to disallow control characters

#### 8. Monitoring & Observability (A40)

2.41 WHEN Workers Logs are needed THEN observability SHALL be enabled in wrangler.toml

2.42 WHEN alerting is needed THEN alerting code SHALL exist in the repository (Cloudflare Alerts API or Sentry alert YAML)

2.43 WHEN chaos testing is needed THEN chaos test artifacts SHALL exist for resilience validation

2.44 WHEN health checks run post-deploy THEN they SHALL verify Supabase, R2, and per-tenant routing in addition to basic health

#### 9. Observability Privacy (A41)

2.45 WHEN logging occurs THEN the logger SHALL apply PII redaction to strip emails, phones, names, and other identifiers

2.46 WHEN file download attempts are logged THEN R2 keys SHALL be redacted or hashed to prevent patient identifier leakage

2.47 WHEN Sentry captures errors THEN a beforeSend filter SHALL strip PHI from request bodies and headers

2.48 WHEN log retention is needed THEN log retention policy SHALL be defined in code

#### 10. Autoscaling & Cost Control (A42)

2.49 WHEN CPU limits are needed THEN cpu_ms SHALL be set in wrangler.toml to prevent runaway costs

2.50 WHEN billing anomalies occur THEN billing anomaly alarms SHALL be wired in the repository

2.51 WHEN LLM calls are made THEN per-clinic concurrent request limits SHALL be enforced

2.52 WHEN rate limiting is applied THEN per-user/per-API-key limits SHALL be enforced at the edge

#### 11. Cron Job (A43)

2.53 WHEN cron schedules are defined THEN they SHALL be declared in wrangler.toml to prevent drift

2.54 WHEN cron handlers fail THEN DLQ/retry queues SHALL be configured for missed runs

2.55 WHEN cron jobs run THEN idempotency locks SHALL prevent duplicate execution

### Unchanged Behavior (Regression Prevention)

#### 3. Existing Functionality Preservation

3.1 WHEN Docker Compose is used for local development THEN it SHALL CONTINUE TO provide a working local stack with Postgres, Studio, and MinIO

3.2 WHEN GitHub Actions workflows run THEN they SHALL CONTINUE TO execute linting, testing, building, and deployment successfully

3.3 WHEN Cloudflare Workers are deployed THEN they SHALL CONTINUE TO serve production traffic without downtime

3.4 WHEN rate limiting is applied THEN legitimate users SHALL CONTINUE TO access the platform without false-positive blocks

3.5 WHEN R2 storage is accessed THEN existing file upload and download functionality SHALL CONTINUE TO work

3.6 WHEN secrets are rotated THEN the platform SHALL CONTINUE TO operate without service interruption

3.7 WHEN monitoring is enabled THEN it SHALL CONTINUE TO capture errors and metrics without performance degradation

3.8 WHEN cron jobs run THEN they SHALL CONTINUE TO execute scheduled tasks (reminders, cleanups, billing) on time

3.9 WHEN Sentry captures errors THEN it SHALL CONTINUE TO provide stack traces and debugging information

3.10 WHEN health checks run THEN they SHALL CONTINUE TO validate service availability

3.11 WHEN Docker images are pinned THEN they SHALL CONTINUE TO provide the same functionality as floating tags

3.12 WHEN network segmentation is applied THEN legitimate service-to-service communication SHALL CONTINUE TO work

3.13 WHEN egress filtering is applied THEN legitimate external API calls (OpenAI, Stripe, CMI, WhatsApp, Resend) SHALL CONTINUE TO work

3.14 WHEN PII redaction is applied THEN debugging capability SHALL CONTINUE TO be sufficient with UUIDs

3.15 WHEN cost controls are applied THEN legitimate usage SHALL CONTINUE TO be allowed within budget

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type InfrastructureConfiguration
  OUTPUT: boolean
  
  // Returns true when infrastructure has security hardening gaps
  RETURN (
    X.dockerPortsBindTo = "0.0.0.0" OR
    X.dockerImagesUseTags = true OR
    X.hardCodedCredentials = true OR
    X.iacBindingsCommentedOut = true OR
    X.observabilityDisabled = true OR
    X.cronSchedulesNotInIaC = true OR
    X.supabaseConfigMissing = true OR
    X.githubActionsUseFloatingTags = true OR
    X.semgrepSoftFail = true OR
    X.singleApiTokenForAllEnvs = true OR
    X.serviceRoleKeyNoMFA = true OR
    X.noWafRules = true OR
    X.noObjectLock = true OR
    X.noAccessLogging = true OR
    X.secretsPlaintext = true OR
    X.noEgressFiltering = true OR
    X.noPiiRedaction = true OR
    X.sentryNoBeforeSend = true OR
    X.noBillingAlarms = true OR
    X.noCostCeilings = true
  )
END FUNCTION
```

### Property Specification: Fix Checking

```pascal
// Property: Fix Checking - Infrastructure Security Hardening
FOR ALL X WHERE isBugCondition(X) DO
  result ← applyInfrastructureHardening'(X)
  ASSERT (
    result.dockerPortsBindTo = "127.0.0.1" AND
    result.dockerImagesUseSha256 = true AND
    result.hardCodedCredentials = false AND
    result.iacBindingsInVersionControl = true AND
    result.observabilityEnabled = true AND
    result.cronSchedulesInIaC = true AND
    result.supabaseConfigExists = true AND
    result.githubActionsPinnedToSha = true AND
    result.semgrepFailsOnFindings = true AND
    result.environmentScopedTokens = true AND
    result.serviceRoleKeyHasMFA = true AND
    result.wafRulesExist = true AND
    result.objectLockEnabled = true AND
    result.accessLoggingEnabled = true AND
    result.secretsUseVaultKms = true AND
    result.egressFilteringEnabled = true AND
    result.piiRedactionEnabled = true AND
    result.sentryHasBeforeSend = true AND
    result.billingAlarmsExist = true AND
    result.costCeilingsSet = true
  )
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT applyInfrastructureHardening(X) = applyInfrastructureHardening'(X)
END FOR
```

This ensures that infrastructure configurations that already follow security best practices remain unchanged after applying the fixes.

### Counterexamples

**Counterexample 1: Docker 0.0.0.0 Binding**
```yaml
# docker-compose.yml (current)
services:
  db:
    ports:
      - "54322:5432"  # Binds to 0.0.0.0 by default
```
**Bug Condition**: `X.dockerPortsBindTo = "0.0.0.0"` → true
**Expected**: Bind to `127.0.0.1:54322:5432` to prevent external access

**Counterexample 2: Floating GitHub Actions Tags**
```yaml
# .github/workflows/ci.yml (current)
- uses: github/codeql-action/init@v4  # Floating tag
```
**Bug Condition**: `X.githubActionsUseFloatingTags = true` → true
**Expected**: Pin to full SHA like `@48b55a01...` to prevent supply chain attacks

**Counterexample 3: Plaintext Secrets**
```bash
# .env.example (current)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Bug Condition**: `X.secretsPlaintext = true` → true
**Expected**: Use `vault://secret/supabase/service-role-key` or KMS reference

**Counterexample 4: No PII Redaction**
```typescript
// src/lib/logger.ts (current)
logger.info("DNS verification failed", { hostname, email, phone })
```
**Bug Condition**: `X.noPiiRedaction = true` → true
**Expected**: `logger.info("DNS verification failed", { clinicId })` with PII stripped

**Counterexample 5: Sentry No beforeSend**
```typescript
// sentry.server.config.ts (current)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // No beforeSend filter
})
```
**Bug Condition**: `X.sentryNoBeforeSend = true` → true
**Expected**: Add `beforeSend` to strip PHI from request bodies and headers
