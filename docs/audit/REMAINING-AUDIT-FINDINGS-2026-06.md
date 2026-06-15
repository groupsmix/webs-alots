# REMAINING AUDIT FINDINGS — UNRESOLVED RISKS

# Oltigo Health Platform

**Audit Date:** June 14, 2026 (Post-Fix Verification)  
**Status:** 23 of 25 risks remain unresolved  
**Priority:** Immediate action required on P0 risks

---

## EXECUTIVE SUMMARY

**What's Fixed:**

- ✅ RISK-001: Database connection pooling enforcement (P0)
- ✅ RISK-010: Pre-commit secrets scanning (P1)
- ⚠️ RISK-006: Load testing (P1) — **Partially implemented**

**What's Broken:**

- 🔥 **4 Critical (P0) risks** will cause production outages
- 🟠 **6 High (P1) risks** will cause security/compliance failures
- 🟡 **12 Medium (P2) risks** will cause operational pain
- ⚪ **1 Low (P3) risk** will cause test gaps

**Time to Next Incident:** Unknown — but P0 risks are production-blocking

---

## 🔥 CRITICAL (P0) — WILL CAUSE OUTAGES

### RISK-002: No Infrastructure-as-Code

**Severity:** Critical  
**Status:** ⚠️ IN PROGRESS  
**Evidence:** `infra/` now exists with Terraform scaffolding for Cloudflare KV, R2, Queues, and Workers routes; production import/apply and broader coverage (WAF/DNS/secrets strategy) still remain

**Why This Will Break Production:**

- Manual configuration drift between staging/production is inevitable
- No rollback capability for infrastructure changes
- Disaster recovery requires manual recreation (tribal knowledge)
- Onboarding new environments is error-prone

**Production Failure Scenario:**

- Operator manually updates Cloudflare KV namespace binding in production
- Typo in namespace ID breaks subdomain routing for all tenants
- No git history, no rollback, no documented state
- MTTR: 2-4 hours while team recreates config from memory

**Fix:**

- Import existing production/staging resources into Terraform state before first apply
- Extend `infra/` beyond the current scaffold to cover WAF, DNS, and other Cloudflare control-plane resources
- Keep Worker artifact deployment in GitHub Actions unless/until a Terraform-managed Worker version strategy is explicitly adopted

**Priority:** P0  
**Effort:** L (3-5 days)  
**Start:** Immediately

---

### RISK-003: Missing Disaster Recovery Plan

**Severity:** Critical  
**Status:** ⚠️ IN PROGRESS  
**Evidence:** `docs/disaster-recovery.md` now exists and ties together `docs/backup-recovery-runbook.md`, `docs/multi-region-failover.md`, `.github/workflows/restore-test.yml`, and `docs/restore-drill-evidence.md`; recurring successful drill evidence is still incomplete

**Why This Will Break Production:**

- Single Supabase region (no failover)
- Database backups exist but restore procedure never tested
- PHI encryption keys stored... somewhere? (recovery process undocumented)
- RTO/RPO undefined (contractual vs actual capability unknown)

**Production Failure Scenario:**

- Supabase regional outage or accidental `DROP TABLE patients`
- Team attempts restore from R2 backup
- Backup is encrypted with `BACKUP_ENCRYPTION_KEY`
- Key is stored in... wrangler secrets? AWS Secrets Manager? Physical safe?
- 2 hours wasted searching for key while service is down
- Restore fails because procedure was never tested (wrong port, wrong credentials)
- RTO target: <4 hours. Actual: 8+ hours.

**Fix:**

- Run and record the first successful restore drill in `docs/restore-drill-evidence.md`
- Maintain the out-of-band secret and access inventory required by `docs/disaster-recovery.md`
- Keep `LAST_RESTORE_TEST_AT` current so `/api/health/internal` reflects drill age accurately
- Continue toward a stronger regional failover posture beyond backup-and-restore

**Priority:** P0  
**Effort:** M (2-3 days for docs + first drill)  
**Start:** Immediately

---

### RISK-004: AI Worker Cross-Worker Coupling

**Severity:** High (P0 impact when AI is down)  
**Status:** ❌ NOT STARTED  
**Evidence:** No circuit breaker in main worker → AI worker calls

**Why This Will Break Production:**

- Main worker depends on AI worker for `/api/ai/*` routes
- AI worker deployment failure cascades to main worker
- Anthropic API timeout (30s) blocks main worker thread
- Shared KV state creates race conditions on feature flags

**Production Failure Scenario:**

- Deploy AI worker with breaking change
- AI worker crashes on boot
- Main worker `/api/ai/chat` route times out after 30s
- User dashboard hangs (AI chat widget polling `/api/ai/status`)
- Main worker exhausts CPU budget handling timeouts
- **Entire platform goes down because optional AI feature is broken**

**Fix:**

```typescript
// src/lib/ai-circuit-breaker.ts
import { CircuitBreaker } from "opossum";

const breaker = new CircuitBreaker(callAiWorker, {
  timeout: 5000, // 5s timeout (not 30s)
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // Try again after 30s
});

breaker.fallback(() => ({
  ok: false,
  error: "AI service temporarily unavailable",
  fallback: true,
}));

// src/app/api/ai/chat/route.ts
export async function POST(req: Request) {
  const result = await breaker.fire(req.body);

  if (result.fallback) {
    // Graceful degradation: show cached response or disable AI
    return apiError("AI temporarily unavailable", 503, "AI_DEGRADED");
  }

  return apiSuccess(result);
}
```

**Priority:** P0 (prevents cascading failures)  
**Effort:** M (2 days)  
**Start:** Within 2 weeks

---

### RISK-005: Incomplete SLO/Alerting

**Severity:** High (P1 → P0 when incident happens)  
**Status:** ❌ NOT STARTED  
**Evidence:** No `docs/slo.md`, no dashboards/, no alert thresholds

**Why This Will Break Production:**

- Incidents detected by users, not monitoring
- On-call engineer has no dashboard to diagnose root cause
- No objective definition of "service degraded"
- SLA commitments to customers are unmonitored

**Production Failure Scenario:**

- Supabase connection pool slowly leaks connections
- 800/1000 slots consumed but no alert fires
- Performance degrades: p95 latency climbs from 200ms → 2s
- Customers complain on Twitter before team notices
- Post-incident review: "We had no visibility into connection pool usage"

**Fix:**

```yaml
# docs/slo.md

## Service Level Objectives (SLOs)

### Availability
- **Target:** 99.9% uptime (43 minutes downtime/month)
- **Measurement:** Synthetic checks every 60s (UptimeRobot)
- **Alert:** <99.5% over 1 hour window

### Latency
- **Target:** p95 < 500ms, p99 < 1000ms
- **Measurement:** Sentry performance monitoring
- **Alert:** p95 > 1000ms over 5 minutes

### Error Rate
- **Target:** <0.1% of requests
- **Measurement:** Sentry error tracking
- **Alert:** >1% errors over 5 minutes

### Database Connections
- **Target:** <80% of connection pool used
- **Measurement:** Supabase metrics API
- **Alert:** >90% for 10 minutes
```

**Priority:** P1 (upgrade to P0 after first incident)  
**Effort:** M (2 days)  
**Start:** Within 4 weeks

---

## 🟠 HIGH (P1) — WILL CAUSE SECURITY/COMPLIANCE FAILURES

### RISK-006: No Load Testing (Partially Implemented)

**Severity:** High  
**Status:** ⚠️ IN PROGRESS  
**Evidence:** `k6/smoke.js` exists, but no full booking flow

**What's Missing:**

- Full booking flow load test (login → create appointment → upload file → cancel)
- Target metrics not defined (100 VUs, p95 <500ms, error rate <0.1%)
- Not integrated into CI/CD pipeline
- No monthly load test schedule

**Why This Will Break Production:**

- Unknown capacity limits (how many concurrent users can the system handle?)
- First production traffic spike reveals bottlenecks under fire
- No baseline to detect performance regressions

**Fix:**

```javascript
// k6/booking-flow.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Ramp up
    { duration: "5m", target: 100 }, // Steady state
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // 1. Login
  const loginRes = http.post("https://staging.oltigo.com/api/auth/login", {
    email: "test@example.com",
    password: "test123",
  });
  check(loginRes, { "login successful": (r) => r.status === 200 });

  const token = loginRes.json("token");

  // 2. Create appointment
  const appointmentRes = http.post(
    "https://staging.oltigo.com/api/appointments",
    JSON.stringify({ patientId: "xxx", date: "2026-06-15" }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  check(appointmentRes, { "appointment created": (r) => r.status === 201 });

  // 3. Upload file (10 KB PDF)
  const file = http.file(http.get("https://example.com/sample.pdf").body, "sample.pdf");
  const uploadRes = http.post(
    "https://staging.oltigo.com/api/upload",
    { file },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  check(uploadRes, { "file uploaded": (r) => r.status === 200 });

  sleep(1);
}
```

**Priority:** P1  
**Effort:** M (2 days remaining)  
**Start:** Complete within 2 weeks

---

### RISK-007: No Rate Limit on File Upload Size

**Severity:** High  
**Status:** ✅ FIXED  
**Evidence:** Explicit file-size enforcement now exists in `src/app/api/upload/route.ts`, `src/app/api/branding/route.ts`, `src/app/api/lab/results/route.ts`, `src/app/api/radiology/upload/route.ts`, `src/app/api/v1/ai/transcribe/route.ts`, and `src/app/api/admin/onboarding/extract/route.ts`

**Why This Will Break Production:**

- Attacker uploads 10 GB file via multipart upload
- Workers 128 MB memory limit exceeded, but R2 allows continuation
- DoS vector: exhaust R2 bandwidth and storage quota

**Fix:**

- Main upload route enforces category-aware byte caps with a 25 MB platform ceiling
- Branding, lab-result, radiology, and AI transcription routes enforce route-specific size limits
- Admin onboarding document extraction now rejects empty files and payloads above 10 MB before processing

**Priority:** P1  
**Effort:** S (completed)  
**Start:** Shipped

---

### RISK-008: PHI Encryption Key Rotation Untested

**Severity:** High  
**Status:** ❌ NOT STARTED  
**Evidence:** `docs/SOP-SECRET-ROTATION.md` mentions `PHI_ENCRYPTION_KEY_OLD`, but no automation

**Why This Will Break Production:**

- Key rotation is manual and error-prone
- Old key must remain valid during migration window (dual-key decryption)
- No CI test validates dual-key decryption path
- First key rotation (after compliance audit or key leak) will fail

**Fix:**

```bash
#!/bin/bash
# scripts/rotate-phi-key.sh

set -e

echo "Generating new PHI encryption key..."
NEW_KEY=$(openssl rand -hex 32)

echo "Setting old key..."
wrangler secret put PHI_ENCRYPTION_KEY_OLD --env production
# Paste current PHI_ENCRYPTION_KEY value

echo "Setting new key..."
wrangler secret put PHI_ENCRYPTION_KEY --env production
# Paste $NEW_KEY value

echo "Key rotation complete. Old key valid for 30 days."
echo "Schedule background job to re-encrypt all R2 files with new key."
echo "After 30 days, remove PHI_ENCRYPTION_KEY_OLD."
```

**Add to CI:**

```typescript
// src/lib/__tests__/encryption-dual-key.test.ts
import { encryptData, decryptData } from "@/lib/encryption";

describe("dual-key decryption", () => {
  it("decrypts with old key during rotation window", () => {
    const oldKey = "aaaa..."; // 64 hex chars
    const newKey = "bbbb...";

    // Encrypt with new key
    const encrypted = encryptData("patient data", newKey);

    // Decrypt with old key should work during overlap
    expect(() => decryptData(encrypted, oldKey)).not.toThrow();
  });
});
```

**Priority:** P1  
**Effort:** M (2 days)  
**Start:** Within 4 weeks

---

### RISK-009: Seed User Blocking Relies on Hardcoded UUIDs

**Severity:** High  
**Status:** ✅ FIXED  
**Evidence:** `supabase/migrations/00183_seed_user_blocklist.sql` adds a DB-backed blocklist, and `src/lib/seed-guard.ts` now checks that table instead of hardcoded UUIDs in application code

**Why This Will Break Production:**

- Seed users recreated with different UUIDs bypass the block list
- 3-layer defense helps, but single point of failure
- UUID collision (unlikely but possible) would allow access

**Fix:**

- `public.seed_user_blocklist` is now the source of truth for blocked seed accounts
- the runtime guard checks the table by `auth_id` or `email`, so recreated accounts cannot bypass the block through a new UUID
- the startup instrumentation warning now checks for surviving blocked emails via the DB-backed blocklist instead of a hardcoded ID array

**Priority:** P1  
**Effort:** S (completed)  
**Start:** Shipped

---

### RISK-011: Missing CSP Report Aggregation

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** CSP violations logged to Sentry, but never analyzed

**Why This Will Cause Security Issues:**

- CSP blocks XSS attempts silently
- Team never investigates blocked scripts
- Unknown if violations are false positives or real attacks

**Fix:**

```markdown
# docs/runbooks/csp-reports.md

## Weekly CSP Report Review

1. Open Sentry → Issues → Filter by "CSP Violation"
2. Group by `blocked-uri` to find patterns
3. Investigate spikes:
   - False positive: Add to CSP allowlist
   - Real attack: Alert security team
4. Document findings in `docs/security-incidents/`

## Automated Alerting

- Sentry alert: >100 CSP violations/hour for same URI
- Action: Auto-create Slack alert in #security channel
```

**Priority:** P1  
**Effort:** S (1 hour setup)  
**Start:** Within 4 weeks

---

### RISK-012: No Multi-Region Failover

**Severity:** High  
**Status:** ✅ DOCUMENTED  
**Evidence:** `docs/multi-region-failover.md` documents the interim manual failover path and is cross-linked from `docs/disaster-recovery.md` and `docs/backup-recovery-runbook.md`

**Why This Will Break Production:**

- Regional AWS outage = complete service outage
- Moroccan users: 300ms+ latency to US East
- No failover path when Supabase has issues

**Fix (Document Only — Supabase Read Replicas Not Yet GA):**

```markdown
# docs/multi-region-failover.md

## Current State

- Single Supabase region: us-east-1
- Cloudflare Workers: multi-region (global anycast)
- R2: multi-region

## Interim Failover Plan (Manual)

1. Create new Supabase project in eu-west-1
2. Restore latest backup from R2
3. Update `SUPABASE_POOLER_URL` secret
4. Re-deploy Workers
5. Verify with smoke tests

## Future: Supabase Read Replicas

- When GA: Add read replica in eu-west-1
- Route reads to nearest replica
- Writes always go to primary (us-east-1)
```

**Priority:** P1  
**Effort:** S for documentation, L for future automation  
**Start:** Documentation shipped; revisit implementation when read replicas GA or another failover topology is adopted

---

### RISK-013: No GDPR Right-to-Delete Automation

**Severity:** High  
**Status:** ❌ NOT STARTED  
**Evidence:** Manual deletion process documented

**Why This Will Cause Compliance Failures:**

- Moroccan Law 09-08 requires deletion within 30 days
- Manual process is error-prone (incomplete cascade deletion)
- No audit trail of GDPR requests

**Fix:**

```typescript
// src/app/api/gdpr/delete-patient/route.ts
import { withAuth } from "@/lib/with-auth";
import { logAuditEvent } from "@/lib/audit-log";

export const POST = withAuth(
  async (req, { user }) => {
    const { patientId, reason } = await req.json();

    // Only super_admin can delete
    if (user.role !== "super_admin") {
      return apiForbidden();
    }

    // Cascade delete (order matters for FK constraints)
    await supabase.from("appointments").delete().eq("patient_id", patientId);
    await supabase.from("prescriptions").delete().eq("patient_id", patientId);
    await supabase.from("patient_files").delete().eq("patient_id", patientId);
    await supabase.from("patients").delete().eq("id", patientId);

    // Delete R2 files
    const files = await listR2Files(`patients/${patientId}/`);
    for (const file of files) {
      await deleteR2File(file.key);
    }

    // Audit log
    await logAuditEvent({
      action: "gdpr_delete_patient",
      userId: user.id,
      patientId,
      reason,
    });

    return apiSuccess({ deleted: true });
  },
  ["super_admin"],
);
```

**Priority:** P1  
**Effort:** M (2-3 days for cascade logic + verification)  
**Start:** Within 8 weeks

---

## 🟡 MEDIUM (P2) — OPERATIONAL PAIN POINTS

### RISK-014: Missing Monitoring for Cron Jobs

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** Cron routes exist, no dead-letter queue or missed-execution alerts

**Fix:**

```typescript
// src/lib/sentry-cron.ts already exists — wire it up
import { withCronMonitor } from "@/lib/sentry-cron";

export const POST = withCronMonitor("database-backup", async (req) => {
  // Backup logic...
});
```

**Priority:** P2 | **Effort:** S (30 min) | **Start:** Within 8 weeks

---

### RISK-015: No Feature Flag UI

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** Feature flags toggled via wrangler CLI only

**Fix:** Build super-admin UI (components/super-admin/ already exists)

**Priority:** P2 | **Effort:** M (2 days) | **Start:** Within 8 weeks

---

### RISK-016: Insufficient Test Coverage for Multi-Tenant Isolation

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** No dedicated E2E test that creates 2 clinics + asserts isolation

**Fix:**

```typescript
// e2e/multi-tenant-isolation.spec.ts
test("patient A cannot see patient B data across clinics", async ({ page }) => {
  // Create clinic A, patient A
  const clinicA = await createClinic({ subdomain: "clinic-a" });
  const patientA = await createPatient({ clinicId: clinicA.id });

  // Create clinic B, patient B
  const clinicB = await createClinic({ subdomain: "clinic-b" });
  const patientB = await createPatient({ clinicId: clinicB.id });

  // Login as clinic A admin
  await page.goto("https://clinic-a.oltigo.local:3000");
  await login(page, clinicA.adminEmail);

  // Attempt to access clinic B patient (should fail)
  await page.goto(`https://clinic-a.oltigo.local:3000/patients/${patientB.id}`);
  await expect(page.getByText("Not found")).toBeVisible();
});
```

**Priority:** P2 | **Effort:** M (3 days) | **Start:** Within 8 weeks

---

### RISK-017: Bundle Size Budget Will Be Exceeded by Recharts

**Severity:** Medium  
**Status:** ❌ NOT STARTED (CI already guards it)  
**Evidence:** CI enforces limit, but no CONTRIBUTING.md warning

**Fix:** Document in CONTRIBUTING.md: "Never import recharts outside /admin routes"

**Priority:** P2 | **Effort:** S (5 min) | **Start:** This week

---

### RISK-018: No Egress Allowlist Enforcement

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** `EGRESS_ALLOWLIST_ENFORCE=false` by default

**Fix:**

```typescript
// src/lib/fetch-wrapper.ts
const ALLOWED_HOSTS = [
  "supabase.co",
  "stripe.com",
  "anthropic.com",
  "api.twilio.com",
  "graph.facebook.com",
];

export async function safeFetch(url: string, options?: RequestInit) {
  const hostname = new URL(url).hostname;

  if (process.env.EGRESS_ALLOWLIST_ENFORCE === "true") {
    if (!ALLOWED_HOSTS.some((host) => hostname.endsWith(host))) {
      throw new Error(`Egress blocked: ${hostname} not in allowlist`);
    }
  }

  return fetch(url, options);
}
```

**Priority:** P2 | **Effort:** M (test all external API calls) | **Start:** Within 8 weeks

---

### RISK-019: Missing Smoke Tests for AI Features

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** Post-deploy smoke test only tests signup

**Fix:**

```javascript
// scripts/smoke-post-deploy.mjs (add AI test)
async function testAI() {
  const res = await fetch(`${DEPLOY_URL}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: "Hello" }),
  });

  if (!res.ok || !res.json().content) {
    throw new Error("AI smoke test failed");
  }
}
```

**Priority:** P2 | **Effort:** S (30 min) | **Start:** Within 8 weeks

---

### RISK-020: No Chaos Engineering

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** No chaos experiments scheduled

**Fix:** Quarterly chaos day — inject latency, kill dependencies, verify graceful degradation

**Priority:** P2 | **Effort:** M (2 days per quarter) | **Start:** Within 12 weeks

---

### RISK-021: No Budget Alerts for Third-Party APIs

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** No cost tracking for Anthropic/OpenAI/E2B

**Fix:**

```typescript
// src/lib/ai-usage-tracker.ts
export async function trackAiUsage(userId: string, tokens: number, cost: number) {
  await supabase.from("ai_usage").insert({ userId, tokens, cost, date: new Date() });

  // Check daily total
  const { data } = await supabase
    .from("ai_usage")
    .select("cost")
    .gte("date", startOfDay(new Date()));

  const dailyTotal = data.reduce((sum, row) => sum + row.cost, 0);

  if (dailyTotal > 100) {
    // $100/day threshold
    Sentry.captureMessage("AI daily budget exceeded", { extra: { dailyTotal } });
  }
}
```

**Priority:** P2 | **Effort:** S (1 day) | **Start:** Within 8 weeks

---

### RISK-022: No Database Index Monitoring

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** No automated slow-query log review

**Fix:** Weekly review of `pg_stat_statements` — add missing indexes

**Priority:** P2 | **Effort:** S (30 min/week) | **Start:** Within 8 weeks

---

### RISK-023: No Dependency Update Policy

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** No SLA for security updates

**Fix:** Document SLA: P0 CVEs patched within 24 hours, P1 within 1 week

**Priority:** P2 | **Effort:** S (30 min) | **Start:** This week

---

### RISK-024: Missing Rate Limit for Webhook Endpoints

**Severity:** Medium  
**Status:** ❌ NOT STARTED  
**Evidence:** Webhook signature verified, but no rate limit

**Fix:**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");

  // Rate limit by signature (100 req/min per webhook secret)
  await rateLimit({
    key: `webhook:stripe:${signature}`,
    limit: 100,
    window: 60,
  });

  // Verify signature + process...
}
```

**Priority:** P2 | **Effort:** S (30 min) | **Start:** Within 8 weeks

---

## ⚪ LOW (P3) — TEST GAPS

### RISK-025: No Security Headers Test in E2E Suite

**Severity:** Low  
**Status:** ❌ NOT STARTED  
**Evidence:** E2E tests exist, but no header assertions

**Fix:**

```typescript
// e2e/security-headers.spec.ts
test("all security headers present", async ({ page }) => {
  const response = await page.goto("https://localhost:3000");

  expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response.headers()["strict-transport-security"]).toBeTruthy();
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});
```

**Priority:** P3 | **Effort:** S (30 min) | **Start:** Within 12 weeks

---

## 📊 SUMMARY METRICS

### By Priority

- 🔥 **P0 (Critical):** 4 risks — **MUST FIX IMMEDIATELY**
- 🟠 **P1 (High):** 6 risks — Start within 2-4 weeks
- 🟡 **P2 (Medium):** 12 risks — Start within 8 weeks
- ⚪ **P3 (Low):** 1 risk — Start within 12 weeks

### By Effort

- **S (Small):** 9 risks — 30 min to 1 day each
- **M (Medium):** 11 risks — 2-3 days each
- **L (Large):** 3 risks — 3-5 days each

### Time to Resolve All Risks

- **Minimum:** 45 days (1 engineer, all parallel)
- **Realistic:** 90 days (1 engineer, accounting for context switching)
- **Recommended:** 60 days (2 engineers, paired on P0/P1 risks)

---

## 🎯 RECOMMENDED SPRINT PLAN

### Sprint 1 (Week 1-2) — P0 Critical Path

**Goal:** Eliminate production-blocking risks

1. ✅ ~~RISK-001: Connection pooling~~ **DONE**
2. RISK-002: Terraform IaC (5 days)
3. RISK-003: Disaster recovery docs + first drill (3 days)
4. RISK-007: File upload size limit (30 min) **QUICK WIN**
5. RISK-017: Document recharts import rule (5 min) **QUICK WIN**
6. RISK-023: Document dependency update SLA (30 min) **QUICK WIN**

**Deliverables:**

- `infra/` directory with Terraform configs deployed to staging
- `docs/disaster-recovery.md` with restore test log
- Upload handler rejects files >25 MB
- `CONTRIBUTING.md` updated with bundle size rules

---

### Sprint 2 (Week 3-4) — P1 High Priority

**Goal:** Eliminate security/compliance failures

1. RISK-004: AI circuit breaker (2 days)
2. RISK-006: Complete booking flow load test (2 days)
3. RISK-008: PHI key rotation automation (2 days)
4. RISK-009: Seed user blocklist migration (1 hour) **QUICK WIN**
5. RISK-011: CSP report review process (1 hour) **QUICK WIN**

**Deliverables:**

- Circuit breaker prevents AI outages from cascading
- `k6/booking-flow.js` runs in CI with defined SLOs
- `scripts/rotate-phi-key.sh` + CI test for dual-key decryption
- Seed users blocked via database query, not hardcoded UUIDs

---

### Sprint 3 (Week 5-8) — P2 Medium Priority

**Goal:** Operational excellence + observability

1. RISK-005: Define SLOs + create Sentry dashboards (2 days)
2. RISK-014: Wire up Sentry cron monitoring (30 min)
3. RISK-016: Multi-tenant isolation E2E test (3 days)
4. RISK-018: Egress allowlist enforcement (2 days)
5. RISK-019: AI smoke tests (30 min)
6. RISK-021: AI usage cost tracking (1 day)
7. RISK-024: Webhook rate limits (30 min)

**Deliverables:**

- SLO dashboard shows p95 latency, error rate, uptime
- Sentry alerts fire when cron jobs miss execution
- E2E test verifies tenant isolation across 2 clinics
- Production egress limited to approved domains

---

### Sprint 4 (Week 9-12) — Long-Tail Cleanup

**Goal:** Complete remaining P1/P2 risks

1. RISK-012: Multi-region failover plan (document only)
2. RISK-013: GDPR deletion automation (3 days)
3. RISK-015: Feature flag UI (2 days)
4. RISK-020: First chaos experiment (2 days)
5. RISK-022: Database index monitoring process (weekly review)
6. RISK-025: Security headers E2E test (30 min)

**Deliverables:**

- `docs/multi-region-failover.md` with manual steps
- `/api/gdpr/delete-patient` endpoint with cascade deletion
- Super-admin can toggle feature flags via UI
- Chaos experiment log: Supabase 5s latency injection

---

## 🚨 SHOWSTOPPERS (Do These First)

If you can only fix **3 things** this month:

1. **RISK-002: Infrastructure-as-Code** (P0) — 5 days
   - Prevents configuration drift disasters
   - Enables rollback capability
   - Documents current state before it's forgotten

2. **RISK-003: Disaster Recovery Plan** (P0) — 3 days
   - First restore drill reveals gaps before real incident
   - Documents RTO/RPO commitments
   - Key recovery tested and documented

3. **RISK-007: File Upload Size Limit** (P1) — 30 min
   - Easiest DoS vector to close
   - **30 minutes to fix, eliminates entire attack class**

---

## 📈 SUCCESS METRICS

**30-Day Goal:**

- ✅ All P0 risks resolved
- ⚠️ 50% of P1 risks resolved
- 📄 IaC deployed to staging
- 🔥 One successful DR drill completed

**60-Day Goal:**

- ✅ All P0 + P1 risks resolved
- ⚠️ 50% of P2 risks resolved
- 📊 SLO dashboard live
- 🧪 Load tests running monthly

**90-Day Goal:**

- ✅ All risks resolved except long-term (multi-region)
- 📈 Zero incidents caused by items in this audit
- 🎯 Team confident in production readiness

---

## 📞 NEED HELP?

**Blocked by:**

- Terraform expertise? → Hire contractor for initial setup
- DR testing access? → Request staging Supabase project
- Load testing infrastructure? → Use k6 Cloud (free tier)

**Questions:**

- "Which risk should I fix first?" → Start with RISK-002 (IaC)
- "Can I skip RISK-003?" → No — untested DR is fiction
- "Why isn't X on the list?" → Either already fixed or not in original audit scope

---

**Last Updated:** June 14, 2026  
**Next Re-Audit:** July 14, 2026 (30 days)
