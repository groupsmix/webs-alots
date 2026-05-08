# Phase 1 Critical Security Fixes - Deployment Guide

## Overview

This document provides step-by-step deployment procedures for the Phase 1 Critical Security Fixes addressing vulnerabilities A1-01, A6-13, A7-01, A8-01, and A2-02.

**Deployment Window:** Low-traffic period recommended (Task 2 is a BREAKING CHANGE)  
**Estimated Downtime:** Zero (rolling deployment)  
**Rollback Time:** < 5 minutes

---

## Pre-Deployment Checklist

### Code Verification
- [ ] All unit tests passing (`npm run test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] ESLint checks passing (`npm run lint`)
- [ ] Bundle size within limits (`npm run check:bundle`)

### Database Verification
- [ ] Migration 00073 (AI token budget) reviewed
- [ ] Migration 00074 (patient_files) reviewed
- [ ] Migrations tested in local environment
- [ ] Backup of production database completed

### Environment Verification
- [ ] `BOOKING_TOKEN_SECRET` environment variable set
- [ ] Supabase connection verified
- [ ] R2 storage accessible
- [ ] Cloudflare Workers deployment configured

---

## Deployment Steps

### Phase 1: Staging Database Migrations (Day 1)

#### Step 1.1: Deploy AI Token Budget Migration

```bash
# Connect to staging Supabase instance
cd supabase

# Apply migration 00073
supabase db push --db-url $STAGING_DATABASE_URL

# Verify migration applied
psql $STAGING_DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'clinics' AND column_name IN ('ai_monthly_tokens', 'ai_tokens_reset_at');"

# Expected output: 2 rows (ai_monthly_tokens, ai_tokens_reset_at)
```

**Verification:**
```sql
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'increment_ai_tokens';

-- Test function execution
SELECT increment_ai_tokens(
  (SELECT id FROM clinics LIMIT 1),
  100
);

-- Verify token increment
SELECT id, ai_monthly_tokens FROM clinics LIMIT 1;
```

**Success Criteria:**
- ✅ Columns `ai_monthly_tokens` and `ai_tokens_reset_at` exist
- ✅ Function `increment_ai_tokens` exists and executes
- ✅ No errors in migration logs

#### Step 1.2: Deploy Patient Files Ownership Migration

```bash
# Apply migration 00074
supabase db push --db-url $STAGING_DATABASE_URL

# Verify table created
psql $STAGING_DATABASE_URL -c "\d patient_files"

# Verify indexes created
psql $STAGING_DATABASE_URL -c "\di patient_files*"

# Verify RLS enabled
psql $STAGING_DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'patient_files';"
```

**Verification:**
```sql
-- Check RLS policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'patient_files';

-- Expected policies:
-- patient_files_select_own (SELECT)
-- patient_files_insert_staff (INSERT)

-- Test policy (as patient user)
SET ROLE authenticated;
SET request.jwt.claims.sub = '<patient-user-id>';
SELECT * FROM patient_files WHERE patient_id = '<patient-user-id>';
```

**Success Criteria:**
- ✅ Table `patient_files` exists with correct schema
- ✅ Indexes created on `patient_id` and `r2_key`
- ✅ RLS enabled with 2 policies
- ✅ No errors in migration logs

#### Step 1.3: Backfill Patient Files (Optional)

If there are existing files in R2 that need ownership tracking:

```bash
# Run backfill script
npm run backfill:patient-files -- --env staging --dry-run

# Review output, then run actual backfill
npm run backfill:patient-files -- --env staging

# Verify records created
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files;"
```

**Success Criteria:**
- ✅ All existing R2 files have corresponding `patient_files` records
- ✅ No orphaned files (files without ownership records)

---

### Phase 2: Staging Code Deployment (Day 1-2)

#### Step 2.1: Deploy Code Changes

```bash
# Build application
npm run build

# Deploy to Cloudflare Workers (staging)
npm run deploy:staging

# Wait for deployment to complete
# Monitor deployment logs
```

**Verification:**
```bash
# Check deployment status
curl https://staging.oltigo.com/api/health

# Expected: { "status": "ok", "version": "<new-version>" }
```

#### Step 2.2: Smoke Tests

Run critical path smoke tests:

```bash
# Test AI endpoints
curl -X POST https://staging.oltigo.com/api/chat \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test message"}]}'

# Expected: 200 OK with AI response

# Test booking verification
curl -X POST https://staging.oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+212600000000"}'

# Expected: 200 OK with token

# Test file download
curl https://staging.oltigo.com/api/files/download?key=<test-key> \
  -H "Authorization: Bearer $STAGING_TOKEN"

# Expected: 200 OK with file content or 403 if unauthorized
```

**Success Criteria:**
- ✅ All smoke tests pass
- ✅ No 500 errors in logs
- ✅ Response times within normal range

---

### Phase 3: Staging Verification Tests (Day 2)

#### Test 3.1: AI Input Validation

```bash
# Test oversized message rejection
curl -X POST https://staging.oltigo.com/api/chat \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$(python3 -c 'print("A"*5000)')\"}]}"

# Expected: 400 Bad Request with validation error
```

#### Test 3.2: AI Token Budget Enforcement

```bash
# Create test clinic with low budget
# Make multiple AI requests until budget exhausted
# Verify 429 response

# Run E2E test
npm run test:e2e -- e2e/security-fixes-phase1.spec.ts -g "AI token budget"
```

#### Test 3.3: Booking Token Tenant Isolation

```bash
# Generate token for clinic A
TOKEN_A=$(curl -X POST https://clinic-a.staging.oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+212600000000"}' | jq -r '.data.token')

# Try to use token in clinic B
curl -X POST https://clinic-b.staging.oltigo.com/api/booking \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN_A\",\"appointmentTime\":\"2026-05-01T10:00:00Z\"}"

# Expected: 403 Forbidden with tenant mismatch error
```

#### Test 3.4: File Download Authorization

```bash
# Login as patient A, upload file
# Login as patient B (same clinic), attempt download
# Verify 403 response

# Run E2E test
npm run test:e2e -- e2e/security-fixes-phase1.spec.ts -g "file authorization"
```

#### Test 3.5: PII Redaction in Logs

```bash
# Trigger registration flow
curl -X POST https://staging.oltigo.com/api/v1/register-clinic \
  -H "Content-Type: application/json" \
  -d '{"clinic_name":"Test Clinic","doctor_name":"Dr. Test","email":"test@example.com","phone":"+212600000000"}'

# Check logs for PII
# Logs should contain only UUIDs, no email/phone/name

# Run log audit script
npm run audit:pii-logs -- --env staging --sample 1000
```

**Success Criteria:**
- ✅ All validation tests pass
- ✅ Token budget enforcement working
- ✅ Cross-tenant tokens rejected
- ✅ File authorization enforced
- ✅ No PII in logs

---

### Phase 4: Production Deployment (Day 2-3)

**⚠️ BREAKING CHANGE WARNING:** Task 2 (booking token format) will invalidate existing tokens. Users will need to request new tokens.

#### Step 4.1: Production Database Migrations

```bash
# Backup production database
npm run backup:database -- --env production

# Apply migrations
supabase db push --db-url $PRODUCTION_DATABASE_URL

# Verify migrations
psql $PRODUCTION_DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'clinics' AND column_name IN ('ai_monthly_tokens', 'ai_tokens_reset_at');"

psql $PRODUCTION_DATABASE_URL -c "\d patient_files"
```

#### Step 4.2: Production Code Deployment

```bash
# Deploy to production
npm run deploy:production

# Monitor deployment
# Watch error rates in Cloudflare dashboard
```

#### Step 4.3: Post-Deployment Monitoring (1 hour)

Monitor the following metrics:

```bash
# Error rate
# Should remain < 1%

# AI budget exhaustion events
# Expected: Some clinics may hit limits

# Booking token rejection rate
# Expected: Spike initially (old tokens), then normalize

# File authorization failures
# Expected: Minimal (only unauthorized attempts)

# PII redaction count
# Expected: > 0 (redaction working)
```

**Alert Thresholds:**
- 🔴 CRITICAL: Error rate > 5%
- 🟡 WARNING: Booking token rejection > 10%
- 🟢 INFO: AI budget exhaustion > 5 clinics

#### Step 4.4: User Communication

Send notification to all clinics:

**Subject:** Security Update - Booking Links Refreshed

**Body:**
```
Dear Oltigo Health User,

We've deployed important security updates to protect your clinic data. 

**What's Changed:**
- Enhanced AI input validation
- Improved booking security
- Stronger file access controls

**Action Required:**
If you have any saved booking links, please request new ones. Old links will no longer work.

**No Impact:**
- Your existing appointments are safe
- All patient data is secure
- No changes to your workflow

Questions? Contact support@oltigo.com

Thank you,
Oltigo Health Team
```

---

### Phase 5: Monitoring Setup (Day 3)

#### Dashboard 5.1: AI Budget Metrics

Create Cloudflare Workers Analytics dashboard:

**Metrics:**
- `ai_budget_exceeded_count` (by clinic_id, role)
- `ai_token_usage_by_clinic` (top 10 consumers)
- `ai_endpoint_request_count` (by endpoint)
- `ai_request_latency_p95` (performance)

**Queries:**
```sql
-- Top AI consumers
SELECT clinic_id, SUM(ai_monthly_tokens) as total_tokens
FROM clinics
WHERE ai_tokens_reset_at >= date_trunc('month', NOW())
GROUP BY clinic_id
ORDER BY total_tokens DESC
LIMIT 10;

-- Budget exhaustion events (from logs)
SELECT COUNT(*) as exhaustion_count, clinic_id
FROM logs
WHERE message LIKE '%AI token budget exceeded%'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY clinic_id;
```

#### Dashboard 5.2: Booking Token Security

**Metrics:**
- `booking_token_cross_tenant_rejection_count`
- `booking_token_generation_count`
- `booking_token_verification_success_rate`
- `booking_token_old_format_count`

**Queries:**
```sql
-- Cross-tenant rejection rate
SELECT COUNT(*) as rejection_count
FROM logs
WHERE message LIKE '%Cross-tenant booking token rejected%'
  AND timestamp >= NOW() - INTERVAL '1 hour';
```

#### Dashboard 5.3: File Authorization

**Metrics:**
- `file_download_authorization_failure_count` (by role)
- `file_download_success_count`
- `patient_files_table_size`
- `orphaned_files_count` (files without ownership)

**Queries:**
```sql
-- Authorization failure rate
SELECT role, COUNT(*) as failure_count
FROM audit_log
WHERE action = 'file_download'
  AND status = 'denied'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY role;

-- Orphaned files check
SELECT COUNT(*) as orphaned_count
FROM (
  SELECT r2_key FROM r2_objects
  EXCEPT
  SELECT r2_key FROM patient_files
) AS orphaned;
```

#### Dashboard 5.4: PII Redaction

**Metrics:**
- `pii_redaction_count` (should be > 0)
- `log_volume_by_level`
- `sentry_error_count`

**Verification:**
```bash
# Sample logs and check for PII
npm run audit:pii-logs -- --env production --sample 1000

# Expected: 0 PII matches
```

---

### Phase 6: Alert Configuration (Day 3)

#### Alert 6.1: PII Detected in Logs (CRITICAL)

```yaml
# docs/alerting-config.yml

- name: pii_detected_in_logs
  severity: CRITICAL
  condition: |
    logs.content MATCHES /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    OR logs.content MATCHES /\+?[0-9]{10,}/
  threshold: 1 occurrence
  window: 5 minutes
  notification:
    - email: security@oltigo.com
    - pagerduty: security-team
  action: |
    1. Immediately investigate log source
    2. Purge PII from log aggregation
    3. Notify DPO for GDPR compliance
    4. Review code for logger misuse
```

#### Alert 6.2: AI Budget Exceeded (HIGH)

```yaml
- name: ai_budget_exceeded_widespread
  severity: HIGH
  condition: |
    COUNT(DISTINCT clinic_id) WHERE ai_budget_exceeded = true
  threshold: > 10% of active clinics
  window: 1 hour
  notification:
    - slack: #ops-alerts
    - email: ops@oltigo.com
  action: |
    1. Review token limits per role
    2. Check for abuse patterns
    3. Consider increasing limits for legitimate users
    4. Communicate with affected clinics
```

#### Alert 6.3: Booking Token Rejection Rate (MEDIUM)

```yaml
- name: booking_token_rejection_spike
  severity: MEDIUM
  condition: |
    (booking_token_rejections / booking_token_verifications) > 0.05
  threshold: > 5% rejection rate
  window: 15 minutes
  notification:
    - slack: #ops-alerts
  action: |
    1. Check for old token format usage
    2. Verify token generation working
    3. Review cross-tenant rejection logs
    4. Communicate with users if needed
```

#### Alert 6.4: File Authorization Failure Spike (MEDIUM)

```yaml
- name: file_authorization_failure_spike
  severity: MEDIUM
  condition: |
    file_download_authorization_failures > BASELINE * 2
  threshold: 2x baseline
  window: 10 minutes
  notification:
    - slack: #ops-alerts
  action: |
    1. Check patient_files table integrity
    2. Review RLS policies
    3. Investigate potential attack
    4. Verify backfill completed
```

---

## Rollback Procedures

### Rollback Scenario 1: Code Issues

**Symptoms:**
- Error rate > 5%
- Critical functionality broken
- Performance degradation

**Procedure:**
```bash
# Rollback to previous deployment
npm run deploy:rollback -- --env production

# Verify rollback successful
curl https://oltigo.com/api/health

# Monitor error rate (should decrease)
```

**Impact:**
- Database migrations remain (safe, additive)
- Booking tokens: Old format will work again
- File downloads: RLS policies still enforce authorization
- AI budget: Not enforced until code redeployed

### Rollback Scenario 2: Database Migration Issues

**Symptoms:**
- Database errors in logs
- Data corruption
- Performance issues

**Procedure:**
```bash
# Restore from backup
npm run restore:database -- --env production --backup <backup-id>

# Verify data integrity
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM clinics;"
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files;"

# Rollback code to match database state
npm run deploy:rollback -- --env production
```

**Impact:**
- All changes reverted
- Booking tokens: Old format works
- File downloads: Prefix-based authorization (less secure)
- AI budget: Not enforced

### Rollback Scenario 3: Booking Token Issues

**Symptoms:**
- High rejection rate (> 20%)
- User complaints about booking links
- Cross-tenant tokens accepted (security issue)

**Procedure:**
```bash
# If old tokens need to work temporarily:
# Revert booking token changes only
git revert <commit-hash-for-task-2>
npm run build
npm run deploy:production

# Communicate with users
# Fix issues in code
# Redeploy with fix
```

**Impact:**
- Temporary security vulnerability (cross-tenant replay)
- Should only be used as last resort
- Fix and redeploy ASAP

---

## Post-Deployment Verification

### Day 1 Post-Deployment

- [ ] Error rate < 1%
- [ ] AI endpoints responding normally
- [ ] Booking flow working
- [ ] File downloads working
- [ ] No PII in logs (sample check)

### Day 3 Post-Deployment

- [ ] AI budget enforcement working (check exhaustion events)
- [ ] Booking token rejection rate normalized (< 2%)
- [ ] File authorization failures minimal
- [ ] No security incidents reported

### Week 1 Post-Deployment

- [ ] Run full security audit
- [ ] Review all monitoring dashboards
- [ ] Analyze user feedback
- [ ] Document lessons learned

---

## Success Metrics

### A1-01 (AI Input Validation)
- ✅ 0 requests with content > 4000 chars processed
- ✅ AI budget exhaustion events logged
- ✅ No unbounded AI requests in logs

### A6-13 (Booking Token Tenant Binding)
- ✅ 0 cross-tenant tokens accepted
- ✅ Same-tenant tokens work correctly
- ✅ Old token format rejected with friendly error

### A7-01 (File Download Authorization)
- ✅ 0 unauthorized file downloads by patients
- ✅ Staff can access all clinic files
- ✅ patient_files table populated

### A8-01 (PII Logging)
- ✅ 0 PII matches in log sample (1000 entries)
- ✅ Only UUIDs logged for identifiers
- ✅ Redaction function working

### A2-02 (Timing-Safe Compare)
- ✅ 0 oversized signatures processed
- ✅ No CPU exhaustion incidents
- ✅ Legitimate webhooks working

---

## Contact Information

**Deployment Lead:** [Name]  
**Database Admin:** [Name]  
**Security Team:** security@oltigo.com  
**On-Call Engineer:** [PagerDuty rotation]

**Escalation Path:**
1. On-call engineer (immediate)
2. Engineering manager (< 30 min)
3. CTO (critical issues)

---

## Appendix: Environment Variables

Required environment variables for deployment:

```bash
# Booking token secret
BOOKING_TOKEN_SECRET=<secret>

# Database
DATABASE_URL=<supabase-url>
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

# R2 Storage
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=<bucket>

# Monitoring
SENTRY_DSN=<dsn>
SENTRY_AUTH_TOKEN=<token>
```

Verify all variables set:
```bash
npm run check:env -- --env production
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Next Review:** After deployment completion
