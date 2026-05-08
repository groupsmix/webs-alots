# Phase 2 Infrastructure & Security Hardening Bugfix Design

## Overview

This bugfix addresses ~100+ infrastructure, network, API, and frontend security issues identified in audit sections A31-A60. The platform currently has critical security gaps including Docker services exposed on 0.0.0.0, configuration drift between IaC and dashboards, plaintext secrets, missing WAF rules, PII/PHI leaking to logs and Sentry, and no cost controls.

The fix strategy follows a defense-in-depth approach across 11 categories:
1. **IaC Security** - Lock down Docker, pin images, version-control all config
2. **CI/CD Security** - Pin actions to SHAs, fail on security findings, scope tokens
3. **Cloud IAM** - Add MFA, scoping, expiry, and rotation to all credentials
4. **Public Endpoints** - Add WAF, geo-fencing, IP allowlisting, rate limiting
5. **Storage Security** - Enable versioning, object-lock, access logging, AV scanning
6. **Secret Management** - Migrate to dynamic vending, enforce rotation
7. **Network Segmentation** - Add egress filtering, IP allowlists, DNS sanitization
8. **Monitoring** - Enable observability, add alerting, enhance health checks
9. **Observability Privacy** - Redact PII from logs and Sentry
10. **Cost Control** - Set CPU limits, add billing alarms, enforce per-clinic quotas
11. **Cron Jobs** - Declare schedules in IaC, add DLQ, enforce idempotency

This is a healthcare platform handling PHI under Moroccan Law 09-08 and GDPR, so security and compliance are paramount.

## Glossary

- **Bug_Condition (C)**: Infrastructure configuration has security hardening gaps (exposed ports, floating tags, plaintext secrets, missing WAF, no PII redaction, no cost controls)
- **Property (P)**: Infrastructure SHALL follow security best practices (localhost binding, SHA pinning, secret vending, WAF rules, PII redaction, cost ceilings)
- **Preservation**: Existing functionality (local dev, CI/CD, deployments, rate limiting, storage, monitoring, cron jobs) must continue working
- **IaC (Infrastructure-as-Code)**: Version-controlled configuration files (wrangler.toml, docker-compose.yml, supabase/config.toml) that define infrastructure
- **Configuration Drift**: When dashboard-configured settings diverge from version-controlled IaC, making audits impossible
- **PHI (Protected Health Information)**: Patient names, emails, phones, medical records protected under Moroccan Law 09-08
- **PII (Personally Identifiable Information)**: User emails, phones, names that must be redacted from logs
- **WAF (Web Application Firewall)**: Cloudflare Ruleset Engine rules that block malicious requests
- **Object-Lock/WORM**: Write-Once-Read-Many storage that prevents backup deletion
- **Egress Filtering**: Allowlist of external hosts that Workers can fetch() to prevent SSRF
- **Dynamic Secret Vending**: Short-lived credentials issued on-demand instead of long-lived static tokens
- **MFA Step-Up**: Requiring multi-factor authentication before sensitive operations like impersonation
- **DLQ (Dead Letter Queue)**: Queue for failed cron job runs to enable retry
- **Idempotency Lock**: Distributed lock preventing duplicate cron execution across isolates

## Bug Details

### Bug Condition

The bug manifests when infrastructure configuration has security hardening gaps across 11 categories. The platform is either missing security controls entirely (no WAF, no PII redaction, no cost alarms), has insecure defaults (0.0.0.0 binding, floating tags, plaintext secrets), or has configuration drift (cron schedules only in dashboard, bindings commented out).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type InfrastructureConfiguration
  OUTPUT: boolean
  
  RETURN (
    // IaC Security Issues
    input.dockerPortsBindTo = "0.0.0.0" OR
    input.dockerImagesUseTags = true OR
    input.hardCodedCredentials = true OR
    input.studioNoAuth = true OR
    input.iacBindingsCommentedOut = true OR
    input.cpuLimitsCommentedOut = true OR
    input.observabilityDisabled = true OR
    input.cronSchedulesNotInIaC = true OR
    input.supabaseConfigMissing = true OR
    input.dockerNoNetworkSegmentation = true OR
    
    // CI/CD Security Issues
    input.githubActionsUseFloatingTags = true OR
    input.semgrepSoftFail = true OR
    input.singleApiTokenForAllEnvs = true OR
    input.sbomSignedButNotBundle = true OR
    input.r2LongLivedKeys = true OR
    input.branchProtectionNotInRepo = true OR
    
    // Cloud IAM Issues
    input.tokensNoScoping = true OR
    input.serviceRoleKeyNoMFA = true OR
    input.bearerKeysNoMFA = true OR
    input.impersonationNoMFA = true OR
    
    // Public Endpoint Issues
    input.routesCommentedOut = true OR
    input.rateLimitNoGlobalFallback = true OR
    input.ipExtractionTrustsHeaders = true OR
    input.noWafRules = true OR
    input.noGeoFencing = true OR
    
    // Storage Security Issues
    input.r2LifecycleIncomplete = true OR
    input.r2VersioningNotEnabled = true OR
    input.noObjectLock = true OR
    input.noAccessLogging = true OR
    input.replicationViaCron = true OR
    input.noAntivirusScan = true OR
    input.noPublicAccessBlock = true OR
    
    // Secret Management Issues
    input.secretsLongLived = true OR
    input.secretsPlaintext = true OR
    input.r2CredsPlaintext = true OR
    input.noRotationEnforcement = true OR
    input.noBreakGlass = true OR
    
    // Network Segmentation Issues
    input.noEgressFiltering = true OR
    input.cmiNoIpAllowlist = true OR
    input.dnsNoSanitization = true OR
    
    // Monitoring Issues
    input.observabilityDisabled = true OR
    input.noAlertingCode = true OR
    input.noChaosTests = true OR
    input.healthCheckBasicOnly = true OR
    
    // Observability Privacy Issues
    input.loggerNoPiiRedaction = true OR
    input.r2KeyLogged = true OR
    input.sentryNoBeforeSend = true OR
    input.noLogRetentionPolicy = true OR
    
    // Cost Control Issues
    input.cpuLimitsCommentedOut = true OR
    input.noBillingAlarms = true OR
    input.llmNoPerClinicLimit = true OR
    input.noPerUserRateLimit = true OR
    
    // Cron Job Issues
    input.cronSchedulesNotInIaC = true OR
    input.cronNoDlq = true OR
    input.cronNoIdempotency = true
  )
END FUNCTION
```

### Examples

**Example 1: Docker 0.0.0.0 Binding**
- **Current**: `ports: - "54322:5432"` binds to 0.0.0.0, exposing Postgres to any network interface
- **Expected**: `ports: - "127.0.0.1:54322:5432"` binds to localhost only

**Example 2: Floating GitHub Actions Tags**
- **Current**: `uses: github/codeql-action/init@v4` uses floating major tag
- **Expected**: `uses: github/codeql-action/init@48b55a01...` pins to full commit SHA

**Example 3: Plaintext Secrets**
- **Current**: `.env.example` lists `SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...` as plaintext
- **Expected**: `.env.example` uses `SUPABASE_SERVICE_ROLE_KEY=vault://secret/supabase/service-role-key`

**Example 4: No PII Redaction**
- **Current**: `logger.info("DNS verification failed", { hostname, email, phone })` logs PII
- **Expected**: `logger.info("DNS verification failed", { clinicId })` strips PII, logs only UUIDs

**Example 5: Sentry No beforeSend**
- **Current**: `Sentry.init({ dsn: ... })` has no beforeSend filter
- **Expected**: `Sentry.init({ dsn: ..., beforeSend: stripPhi })` filters PHI from request bodies

**Example 6: Cron Drift**
- **Current**: Cron schedules only in Cloudflare dashboard, not in wrangler.toml
- **Expected**: `[[triggers]].crons = ["0 */6 * * *"]` in wrangler.toml for version control

**Example 7: No WAF Rules**
- **Current**: No Cloudflare Ruleset Engine config in repository
- **Expected**: WAF rules blocking SQL injection, XSS, path traversal in IaC

**Example 8: No Cost Ceiling**
- **Current**: `cpu_ms = 50` commented out in wrangler.toml
- **Expected**: `cpu_ms = 50` uncommented to prevent runaway costs

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Docker Compose SHALL CONTINUE TO provide a working local development stack with Postgres, Studio, and MinIO
- GitHub Actions workflows SHALL CONTINUE TO execute linting, testing, building, and deployment successfully
- Cloudflare Workers SHALL CONTINUE TO serve production traffic without downtime
- Rate limiting SHALL CONTINUE TO allow legitimate users without false-positive blocks
- R2 storage SHALL CONTINUE TO support existing file upload and download functionality
- Secret rotation SHALL CONTINUE TO operate without service interruption
- Monitoring SHALL CONTINUE TO capture errors and metrics without performance degradation
- Cron jobs SHALL CONTINUE TO execute scheduled tasks (reminders, cleanups, billing) on time
- Sentry SHALL CONTINUE TO provide stack traces and debugging information
- Health checks SHALL CONTINUE TO validate service availability
- Docker image pinning SHALL CONTINUE TO provide the same functionality as floating tags
- Network segmentation SHALL CONTINUE TO allow legitimate service-to-service communication
- Egress filtering SHALL CONTINUE TO allow legitimate external API calls (OpenAI, Stripe, CMI, WhatsApp, Resend)
- PII redaction SHALL CONTINUE TO provide sufficient debugging capability with UUIDs
- Cost controls SHALL CONTINUE TO allow legitimate usage within budget

**Scope:**
All infrastructure configurations that do NOT have security hardening gaps should be completely unaffected by this fix. This includes:
- Existing application code (Next.js routes, React components, API handlers)
- Database schema and RLS policies
- Tenant isolation logic
- Authentication and authorization flows
- Payment processing and webhook handling
- WhatsApp notification delivery
- File encryption and upload logic

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Insecure Defaults**: Docker Compose defaults to 0.0.0.0 binding, GitHub Actions use floating tags by convention, secrets are documented as plaintext for developer convenience

2. **Configuration Drift**: Critical settings (cron schedules, KV bindings, R2 buckets, routes) are configured in Cloudflare dashboard instead of version-controlled IaC, making audits impossible

3. **Missing Security Controls**: No WAF rules, no PII redaction, no cost alarms, no egress filtering, no object-lock were implemented because they weren't in the initial MVP scope

4. **Incomplete Observability**: Workers Logs disabled, no alerting code, basic health checks only because observability was added incrementally

5. **Legacy Secret Management**: Long-lived static tokens (SUPABASE_SERVICE_ROLE_KEY, R2 access keys) were used because dynamic vending requires additional infrastructure

6. **Soft-Fail Security Scanning**: Semgrep uses `continue-on-error: true` to prevent blocking deployments during initial rollout, but was never hardened

7. **No MFA Enforcement**: MFA step-up for impersonation and sensitive operations wasn't implemented because it requires additional UI flows

8. **Cron Job Gaps**: No DLQ, no idempotency locks because cron jobs were initially simple and infrequent

## Correctness Properties

Property 1: Bug Condition - Infrastructure Security Hardening

_For any_ infrastructure configuration where the bug condition holds (isBugCondition returns true), the fixed configuration SHALL implement all security hardening controls: localhost binding, SHA pinning, secret vending, WAF rules, PII redaction, cost ceilings, MFA enforcement, egress filtering, access logging, and IaC version control for all settings.

**Validates: Requirements 2.1-2.55**

Property 2: Preservation - Existing Functionality

_For any_ infrastructure configuration where the bug condition does NOT hold (isBugCondition returns false), the fixed configuration SHALL produce exactly the same behavior as the original configuration, preserving all existing functionality for local development, CI/CD, deployments, rate limiting, storage, monitoring, and cron jobs.

**Validates: Requirements 3.1-3.15**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `docker-compose.yml`

**Changes**:
1. **Localhost Binding**: Change all port bindings from `"54322:5432"` to `"127.0.0.1:54322:5432"` for Postgres, Studio, MinIO
2. **Image Pinning**: Replace floating tags with SHA256 digests (e.g., `supabase/postgres:15.8.1.145` → `supabase/postgres@sha256:abc123...`)
3. **Credential Injection**: Replace hard-coded `POSTGRES_PASSWORD: postgres` with `${POSTGRES_PASSWORD}` environment variable
4. **Studio Auth**: Add `STUDIO_AUTH_ENABLED: true` and `STUDIO_PASSWORD: ${STUDIO_PASSWORD}` to Studio service
5. **Network Segmentation**: Create separate networks for db, storage, and studio; add `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `user: "1000:1000"`, and resource limits

**File**: `wrangler.toml`

**Changes**:
1. **Uncomment Bindings**: Uncomment `[[kv_namespaces]]` and `[[r2_buckets]]` blocks to version-control bindings
2. **Uncomment CPU Limits**: Uncomment `cpu_ms = 50` to prevent runaway costs
3. **Enable Observability**: Uncomment `observability` block to collect Workers Logs
4. **Add Cron Schedules**: Add `[[triggers]].crons = ["0 */6 * * *"]` for r2-sync, `["0 9 * * *"]` for reminders, `["0 0 * * *"]` for billing
5. **Uncomment Routes**: Uncomment `routes = [{ pattern = "*.oltigo.health", custom_domain = true }]` to version-control TLS termination

**File**: `supabase/config.toml`

**Changes**:
1. **Create File**: Add new file with encryption-at-rest, JWT expiry (1 hour), MFA enforcement, email rate-limits (10/hour), and password policy

**File**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Changes**:
1. **Pin Actions to SHAs**: Replace all `@v4`, `@v6`, `@v7` with full commit SHAs (e.g., `@48b55a01b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8`)
2. **Fail on Semgrep Findings**: Remove `continue-on-error: true` and `|| true` from Semgrep step
3. **Scope API Tokens**: Use separate `CLOUDFLARE_API_TOKEN_PROD` and `CLOUDFLARE_API_TOKEN_STAGING` secrets
4. **Sign Worker Bundle**: Add cosign step to sign deployed Worker bundle, not just SBOM
5. **OIDC for R2**: Replace long-lived R2 keys with OIDC-vended ephemeral credentials
6. **Branch Protection**: Add `.github/branch-protection.yml` declaring required reviewers, signed commits, status checks

**File**: `src/lib/logger.ts`

**Changes**:
1. **PII Redaction**: Enhance `redactPhi()` to strip `hostname`, `email`, `phone`, `name`, `r2Key` from all log entries
2. **R2 Key Hashing**: Hash R2 keys before logging: `r2KeyHash: sha256(r2Key).slice(0, 8)`

**File**: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`

**Changes**:
1. **Add beforeSend**: Add `beforeSend: (event) => stripPhi(event)` to strip PHI from request bodies, headers, and breadcrumbs
2. **Log Retention**: Add `maxBreadcrumbs: 50`, `maxValueLength: 250` to limit data capture

**File**: `src/middleware.ts`

**Changes**:
1. **IP Allowlisting**: Add `TRUSTED_PROXIES = ["103.21.244.0/22", ...]` (Cloudflare IP ranges) and validate `CF-Connecting-IP` header
2. **Egress Filtering**: Add `ALLOWED_HOSTS = ["api.openai.com", "api.stripe.com", ...]` and validate `fetch()` URLs
3. **DNS Sanitization**: Add `sanitizeHostname()` to strip control characters from DNS lookups

**File**: `src/app/api/webhooks/cmi/route.ts`

**Changes**:
1. **CMI IP Allowlist**: Add `CMI_IP_RANGES = ["196.200.0.0/16", ...]` and reject requests from other IPs

**File**: `src/app/api/admin/impersonate/route.ts`

**Changes**:
1. **MFA Step-Up**: Add `requireMfa()` check before granting impersonation token

**File**: `src/app/api/health/route.ts`

**Changes**:
1. **Enhanced Health Check**: Add Supabase connectivity check, R2 bucket access check, per-tenant routing check

**File**: `r2-lifecycle.json`

**Changes**:
1. **Add Expiration**: Add rule to expire objects in `backups/` after 90 days
2. **Add Versioning**: Add rule to expire non-current versions after 30 days
3. **Add NCV Expiration**: Add rule to delete non-current versions after 7 days

**File**: `.env.example`, `secrets-template.env`

**Changes**:
1. **Vault Syntax**: Replace plaintext secrets with `vault://secret/path` or `kms://key-id` references

**File**: `scripts/rotate-phi-key.ts`, `docs/SOP-SECRET-ROTATION.md`

**Changes**:
1. **Automated Rotation**: Add cron trigger to rotate secrets every 90 days with automated workflow

**File**: `wrangler.toml` (WAF rules)

**Changes**:
1. **Add WAF Config**: Add Cloudflare Ruleset Engine rules blocking SQL injection, XSS, path traversal, rate-limit bypass

**File**: `wrangler.toml` (geo-fencing)

**Changes**:
1. **Add Geo Rules**: Add rule to block non-Moroccan IPs from accessing `/admin/*` endpoints

**File**: `wrangler.toml` (alerting)

**Changes**:
1. **Add Alert Config**: Add Cloudflare Alerts API config for error rate, latency, billing anomalies

**File**: `src/lib/ai-budget.ts`

**Changes**:
1. **Per-Clinic Concurrency**: Add `checkConcurrentAiRequests()` to limit in-flight LLM calls per clinic

**File**: `src/app/api/cron/route.ts`

**Changes**:
1. **Idempotency Lock**: Add distributed lock using KV to prevent duplicate execution
2. **DLQ**: Add failed run tracking to KV with retry logic

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the security gaps on unfixed infrastructure, then verify the fixes work correctly and preserve existing functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the security gaps BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that attempt to exploit each security gap (connect to 0.0.0.0 ports, supply chain attack via floating tags, extract secrets from logs, bypass rate limits, delete backups, trigger cost overruns). Run these tests on the UNFIXED infrastructure to observe failures and understand the root cause.

**Test Cases**:
1. **Docker 0.0.0.0 Test**: Attempt to connect to Postgres from external network interface (will succeed on unfixed config)
2. **Floating Tag Test**: Check if GitHub Actions use `@v4` instead of SHA (will find floating tags on unfixed config)
3. **Plaintext Secret Test**: Check if `.env.example` contains plaintext secrets (will find plaintext on unfixed config)
4. **PII Leak Test**: Trigger DNS verification error and check if email/phone appear in logs (will find PII on unfixed config)
5. **Sentry PHI Test**: Trigger error with patient data in request body and check if Sentry captures it (will find PHI on unfixed config)
6. **WAF Bypass Test**: Send SQL injection payload and check if it reaches the application (will succeed on unfixed config)
7. **Cost Overrun Test**: Send CPU-intensive request and check if it exceeds budget (will succeed on unfixed config)
8. **Cron Drift Test**: Compare wrangler.toml cron schedules with dashboard config (will find drift on unfixed config)
9. **Backup Deletion Test**: Attempt to delete backup from R2 (will succeed on unfixed config without object-lock)
10. **IP Spoof Test**: Send request with spoofed `X-Forwarded-For` header and check if rate limit is bypassed (will succeed on unfixed config)

**Expected Counterexamples**:
- Docker services are accessible from external network interfaces
- GitHub Actions use floating tags vulnerable to supply chain attacks
- Secrets are documented as plaintext in `.env.example`
- PII (email, phone, name) appears in logs and Sentry
- No WAF rules block malicious payloads
- No cost ceilings prevent runaway requests
- Cron schedules drift between IaC and dashboard
- Backups can be deleted without object-lock
- Rate limits can be bypassed with IP spoofing

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed infrastructure produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyInfrastructureHardening_fixed(input)
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

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed infrastructure produces the same result as the original infrastructure.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT applyInfrastructureHardening_original(input) = applyInfrastructureHardening_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED infrastructure first for legitimate operations (local dev, CI/CD, deployments, API calls), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Local Dev Preservation**: Verify Docker Compose stack starts successfully and all services are accessible from localhost after localhost binding
2. **CI/CD Preservation**: Verify GitHub Actions workflows complete successfully after SHA pinning
3. **Deployment Preservation**: Verify Cloudflare Workers deploy successfully and serve traffic after IaC changes
4. **Rate Limit Preservation**: Verify legitimate users can access the platform without false-positive blocks after IP allowlisting
5. **Storage Preservation**: Verify file upload and download continue working after R2 lifecycle changes
6. **Secret Rotation Preservation**: Verify platform operates without interruption during secret rotation
7. **Monitoring Preservation**: Verify Sentry captures errors and provides debugging info after beforeSend filter
8. **Cron Preservation**: Verify scheduled tasks execute on time after IaC declaration
9. **External API Preservation**: Verify OpenAI, Stripe, CMI, WhatsApp, Resend calls continue working after egress filtering
10. **Debugging Preservation**: Verify UUIDs provide sufficient debugging capability after PII redaction

### Unit Tests

- Test Docker Compose localhost binding prevents external access
- Test GitHub Actions SHA pinning prevents floating tag usage
- Test PII redaction strips email, phone, name from logs
- Test Sentry beforeSend strips PHI from request bodies
- Test WAF rules block SQL injection, XSS, path traversal
- Test cost ceilings prevent runaway requests
- Test cron idempotency locks prevent duplicate execution
- Test egress filtering blocks unauthorized external hosts
- Test IP allowlisting prevents spoofing
- Test MFA step-up gates impersonation

### Property-Based Tests

- Generate random infrastructure configurations and verify security controls are applied correctly
- Generate random API requests and verify rate limiting, WAF, and geo-fencing work correctly
- Generate random file uploads and verify antivirus scanning, encryption, and access logging work correctly
- Generate random cron schedules and verify IaC declaration, DLQ, and idempotency work correctly
- Generate random secret rotation scenarios and verify platform operates without interruption

### Integration Tests

- Test full Docker Compose stack with localhost binding, SHA pinning, and network segmentation
- Test full CI/CD pipeline with SHA-pinned actions, Semgrep hard-fail, and scoped tokens
- Test full deployment flow with IaC-declared bindings, routes, and cron schedules
- Test full request flow with WAF, rate limiting, geo-fencing, and egress filtering
- Test full storage flow with R2 lifecycle, versioning, object-lock, and access logging
- Test full observability flow with Workers Logs, alerting, and enhanced health checks
- Test full secret rotation flow with dynamic vending and automated workflows
- Test full cron flow with IaC schedules, DLQ, and idempotency locks
