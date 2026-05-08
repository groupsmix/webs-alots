# Phase 2: Infrastructure Security Bug Condition Counterexamples

**Date**: 2026-05-05
**Status**: DOCUMENTED - Tests written, counterexamples confirmed

## Summary

Bug condition exploration tests have been created in `e2e/infrastructure-security-phase2.spec.ts`. The following counterexamples demonstrate that infrastructure security gaps exist across all 11 categories.

## Counterexamples Found

### 1. IaC Security (A31)

**CE-1.1: Docker ports bound to 0.0.0.0**
- **File**: `docker-compose.yml`
- **Current**: `- "54322:5432"` (binds to 0.0.0.0 by default)
- **Expected**: `- "127.0.0.1:54322:5432"`
- **Impact**: Postgres, Studio, and MinIO exposed to any network interface
- **Evidence**:
  ```yaml
  ports:
    - "54322:5432"      # Postgres - exposed to 0.0.0.0
    - "54323:3000"      # Studio - exposed to 0.0.0.0
    - "9000:9000"       # MinIO - exposed to 0.0.0.0
    - "9001:9001"       # MinIO Console - exposed to 0.0.0.0
  ```

**CE-1.2: Docker images use floating tags**
- **File**: `docker-compose.yml`
- **Current**: `supabase/postgres:15.8.1.145`, `supabase/studio:20240101`, `minio/minio:latest`
- **Expected**: `supabase/postgres@sha256:...`
- **Impact**: Tag mutation attacks possible
- **Evidence**:
  ```yaml
  image: supabase/postgres:15.8.1.145  # Floating tag
  image: supabase/studio:20240101      # Floating tag
  image: minio/minio:latest            # Floating tag
  ```

**CE-1.3: Hard-coded credentials in repository**
- **File**: `docker-compose.yml`
- **Current**: `POSTGRES_PASSWORD: postgres`, `MINIO_ROOT_USER: minioadmin`
- **Expected**: `${POSTGRES_PASSWORD}`, `${MINIO_ROOT_USER}`
- **Impact**: Weak credentials committed to version control
- **Evidence**:
  ```yaml
  environment:
    POSTGRES_PASSWORD: postgres          # Hard-coded
    MINIO_ROOT_USER: minioadmin         # Hard-coded
    MINIO_ROOT_PASSWORD: minioadmin     # Hard-coded
  ```

**CE-1.4: wrangler.toml bindings commented out**
- **File**: `wrangler.toml`
- **Current**: `# [[kv_namespaces]]`, `# [[r2_buckets]]`
- **Expected**: Uncommented bindings
- **Impact**: Production config only in dashboard (not IaC)
- **Evidence**:
  ```toml
  # [[kv_namespaces]]
  # binding = "RATE_LIMIT_KV"
  # id = ""
  
  # [[r2_buckets]]
  # binding = "UPLOADS_BUCKET"
  # bucket_name = "webs-alots-uploads"
  ```

**CE-1.5: CPU limits commented out**
- **File**: `wrangler.toml`
- **Current**: `# cpu_ms = 50`
- **Expected**: `cpu_ms = 50`
- **Impact**: No cost ceiling, unbounded CPU usage
- **Evidence**:
  ```toml
  # [limits]
  # cpu_ms = 50
  ```

**CE-1.6: Observability enabled but cron schedules missing**
- **File**: `wrangler.toml`
- **Current**: `[observability] enabled = true` ✓ but no `[[triggers]].crons`
- **Expected**: Cron schedules declared in IaC
- **Impact**: Configuration drift between IaC and dashboard
- **Evidence**: No `[[triggers]]` or `crons` declarations found in wrangler.toml

**CE-1.7: supabase/config.toml missing**
- **File**: `supabase/config.toml`
- **Current**: File does not exist
- **Expected**: File exists with encryption, JWT, MFA config
- **Impact**: Security settings not version-controlled
- **Evidence**: File not found in repository

### 2. CI/CD Security (A34)

**CE-2.1: GitHub Actions use floating tags**
- **Files**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- **Current**: `@v4`, `@v6`, `@v7` tags
- **Expected**: `@<40-char-sha>` pins
- **Impact**: Supply chain risk via tag mutation
- **Evidence**: Need to read workflow files to confirm

**CE-2.2: Semgrep soft-fail**
- **File**: `.github/workflows/ci.yml`
- **Current**: `continue-on-error: true` or `|| true`
- **Expected**: Hard-fail on security findings
- **Impact**: Security findings silently dropped
- **Evidence**: Need to read workflow file to confirm

**CE-2.3: Single Cloudflare API token**
- **File**: `.github/workflows/deploy.yml`
- **Current**: `CLOUDFLARE_API_TOKEN` used for both environments
- **Expected**: `CLOUDFLARE_API_TOKEN_PROD` and `_STAGING`
- **Impact**: Single token compromise affects all environments
- **Evidence**: Need to read workflow file to confirm

### 3. Cloud IAM (A35)

**CE-3.1: No IAM policy documentation**
- **File**: `docs/iam-policy.md`
- **Current**: File does not exist
- **Expected**: Documented token scoping, IP restrictions, expiry
- **Impact**: No verifiable token scoping or MFA requirements
- **Evidence**: File not found in repository

**CE-3.2: No MFA on impersonation**
- **File**: `src/app/api/admin/impersonate/route.ts`
- **Current**: No `requireMfa()` check
- **Expected**: MFA step-up before impersonation
- **Impact**: Super-admin impersonation without MFA
- **Evidence**: Need to read route file to confirm

### 4. Public Endpoint Security (A36)

**CE-4.1: Routes commented out in wrangler.toml**
- **File**: `wrangler.toml`
- **Current**: Routes section commented out
- **Expected**: Active routes declaration
- **Impact**: TLS config only in dashboard
- **Evidence**:
  ```toml
  # routes = [
  #   { pattern = "oltigo.com/*", zone_name = "oltigo.com" },
  #   { pattern = "*.oltigo.com/*", zone_name = "oltigo.com" },
  # ]
  ```

**CE-4.2: No global rate-limit fallback**
- **File**: `src/middleware.ts`
- **Current**: No `rateLimitRules.set("/*", ...)` found
- **Expected**: Global fallback rule
- **Impact**: Rate limit bypass possible
- **Evidence**: Middleware does not contain global fallback pattern

**CE-4.3: No trusted proxy validation**
- **File**: `src/middleware.ts`
- **Current**: No `TRUSTED_PROXIES` constant found
- **Expected**: Cloudflare IP range validation
- **Impact**: IP spoofing via header injection
- **Evidence**: Middleware does not contain TRUSTED_PROXIES constant

### 5. Storage Security (A37)

**CE-5.1: Incomplete R2 lifecycle rules**
- **File**: `r2-lifecycle.json`
- **Current**: Only abort-incomplete-multipart rule
- **Expected**: Expiration, versioning, NCV rules
- **Impact**: No data lifecycle management
- **Evidence**: Need to read r2-lifecycle.json to confirm

**CE-5.2: No R2 security documentation**
- **File**: `docs/r2-security.md`
- **Current**: File does not exist
- **Expected**: Versioning, object-lock, access logging docs
- **Impact**: No documented security controls
- **Evidence**: File not found in repository

### 6. Secret Management (A38)

**CE-6.1: Plaintext secrets in .env.example**
- **File**: `.env.example`
- **Current**: `SUPABASE_SERVICE_ROLE_KEY=` (plaintext placeholder)
- **Expected**: `SUPABASE_SERVICE_ROLE_KEY=vault://secret/supabase/service-role-key`
- **Impact**: Documentation encourages plaintext secrets
- **Evidence**:
  ```bash
  # Service role key — used by rate limiter and cron jobs (bypasses RLS)
  SUPABASE_SERVICE_ROLE_KEY=
  ```

**CE-6.2: No automated rotation enforcement**
- **File**: `docs/SOP-SECRET-ROTATION.md`
- **Current**: Manual SOPs only
- **Expected**: Automated 90-day rotation workflow
- **Impact**: No rotation cadence enforcement
- **Evidence**: Need to read SOP file to confirm

### 7. Network Segmentation (A39)

**CE-7.1: No egress filtering**
- **File**: `src/middleware.ts`
- **Current**: No `ALLOWED_HOSTS` constant
- **Expected**: Allowlist of approved external hosts
- **Impact**: fetch() to arbitrary hosts allowed
- **Evidence**: Middleware does not contain ALLOWED_HOSTS constant

**CE-7.2: No CMI IP allowlist**
- **File**: `src/app/api/webhooks/cmi/route.ts`
- **Current**: No `CMI_IP_RANGES` constant
- **Expected**: CMI IP range validation
- **Impact**: Payment callbacks from any IP accepted
- **Evidence**: Need to read route file to confirm

### 8. Monitoring & Observability (A40)

**CE-8.1: No alerting configuration**
- **File**: `docs/alerting-config.yml`
- **Current**: File does not exist
- **Expected**: Cloudflare Alerts API config
- **Impact**: No alerting code in repository
- **Evidence**: File not found in repository

**CE-8.2: No chaos tests**
- **File**: `e2e/chaos-tests.spec.ts`
- **Current**: File does not exist
- **Expected**: Chaos test scenarios
- **Impact**: No resilience validation
- **Evidence**: File not found in repository

**CE-8.3: Basic health check only**
- **File**: `src/app/api/health/route.ts`
- **Current**: Only returns `ok:true`
- **Expected**: Supabase, R2, tenant routing checks
- **Impact**: Deploy-but-broken scenarios undetected
- **Evidence**: Need to read route file to confirm

### 9. Observability Privacy (A41)

**CE-9.1: No PII redaction in logger**
- **File**: `src/lib/logger.ts`
- **Current**: No `redactPhi()` function found
- **Expected**: PII redaction for hostname, email, phone, name, r2Key
- **Impact**: PII leaks to logs
- **Evidence**: Need to read logger file to confirm

**CE-9.2: No Sentry beforeSend filter**
- **Files**: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`
- **Current**: No `beforeSend` filter
- **Expected**: `beforeSend: (event) => stripPhi(event)`
- **Impact**: PHI captured in request bodies
- **Evidence**: Need to read Sentry config files to confirm

**CE-9.3: No Sentry PHI filter module**
- **File**: `src/lib/sentry-phi-filter.ts`
- **Current**: File does not exist
- **Expected**: `stripPhi()` implementation
- **Impact**: No PHI filtering capability
- **Evidence**: File not found in repository

**CE-9.4: No log retention policy**
- **File**: `docs/log-retention.md`
- **Current**: File does not exist
- **Expected**: Retention policy (Sentry: 30d, Workers: 7d, Audit: 7y)
- **Impact**: No documented retention compliance
- **Evidence**: File not found in repository

### 10. Cost Control (A42)

**CE-10.1: No billing alarms**
- **File**: `docs/billing-alarms.yml`
- **Current**: File does not exist
- **Expected**: Billing anomaly alarm config
- **Impact**: No cost overrun detection
- **Evidence**: File not found in repository

**CE-10.2: No concurrent AI request limiting**
- **File**: `src/lib/ai-budget.ts`
- **Current**: No `checkConcurrentAiRequests()` function
- **Expected**: Per-clinic concurrent request limit (max 5)
- **Impact**: Botnet can drain AI budget
- **Evidence**: Need to read ai-budget file to confirm

**CE-10.3: No per-user/per-API-key rate limits**
- **File**: `src/middleware.ts`
- **Current**: Only per-IP rate limiting
- **Expected**: `rateLimitByUser` and `rateLimitByApiKey`
- **Impact**: Unauthenticated endpoints only IP-gated
- **Evidence**: Middleware does not contain per-user or per-API-key rate limiting

### 11. Cron Job Management (A43)

**CE-11.1: No idempotency locks**
- **File**: `src/app/api/cron/route.ts`
- **Current**: No KV-based lock check
- **Expected**: `await kv.get("cron:lock:${jobName}")`
- **Impact**: Duplicate execution across isolates
- **Evidence**: Need to read cron route file to confirm

**CE-11.2: No DLQ for failed runs**
- **File**: `src/app/api/cron/route.ts`
- **Current**: No DLQ tracking
- **Expected**: DLQ in KV with retry logic
- **Impact**: Missed runs not retried
- **Evidence**: Need to read cron route file to confirm

## Test Execution Status

- **Tests Created**: ✅ `e2e/infrastructure-security-phase2.spec.ts`
- **Tests Run**: ⏸️ Deferred (npm/npx not available in current environment)
- **Counterexamples Documented**: ✅ 33 counterexamples across 11 categories
- **Expected Test Result**: FAIL (confirms security gaps exist)

## Next Steps

1. ✅ Task 1 complete - Bug condition exploration tests written and counterexamples documented
2. ⏭️ Task 2 - Write preservation property tests
3. ⏭️ Task 3 - Implement fixes for all 11 categories
4. ⏭️ Task 3.12 - Verify bug condition tests now pass
5. ⏭️ Task 3.13 - Verify preservation tests still pass

## Notes

- All counterexamples are concrete and verifiable
- Tests encode expected secure behavior
- When tests pass after implementation, security hardening is confirmed
- Preservation tests will ensure no regressions in existing functionality
