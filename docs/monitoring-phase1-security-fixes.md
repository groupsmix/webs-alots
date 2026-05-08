# Phase 1 Security Fixes - Monitoring & Alerting Guide

## Overview

This document specifies monitoring dashboards, metrics, alerts, and operational procedures for the Phase 1 Critical Security Fixes deployment.

**Monitoring Objectives:**
1. Detect security incidents (PII leaks, cross-tenant access)
2. Track fix effectiveness (budget enforcement, authorization failures)
3. Identify performance impacts (latency, error rates)
4. Support operational troubleshooting

---

## Monitoring Architecture

### Data Sources

1. **Cloudflare Workers Logs**
   - Request/response logs
   - Error logs
   - Performance metrics

2. **Supabase Database**
   - AI token usage (`clinics.ai_monthly_tokens`)
   - File ownership (`patient_files`)
   - Audit logs (`audit_log`)

3. **Sentry**
   - Error tracking
   - Performance monitoring
   - Release tracking

4. **Application Logs**
   - Structured JSON logs
   - Trace IDs for correlation
   - Context-aware logging

### Metrics Collection

```typescript
// src/lib/metrics.ts (NEW FILE - to be created)

export interface SecurityMetrics {
  ai_budget_exceeded_count: number;
  booking_token_cross_tenant_rejection_count: number;
  file_download_authorization_failure_count: number;
  pii_redaction_count: number;
  timing_safe_equal_oversized_rejection_count: number;
}

export function recordMetric(metric: keyof SecurityMetrics, value: number, labels?: Record<string, string>): void {
  // Send to Cloudflare Workers Analytics
  // Or custom metrics endpoint
}
```

---

## Dashboard 1: AI Token Budget

### Metrics

| Metric | Description | Query | Alert Threshold |
|--------|-------------|-------|-----------------|
| `ai_budget_exceeded_count` | Number of requests rejected due to budget | `COUNT(*) WHERE error_code = 'AI_BUDGET_EXCEEDED'` | > 10% of clinics |
| `ai_token_usage_by_clinic` | Token consumption per clinic | `SELECT clinic_id, ai_monthly_tokens FROM clinics ORDER BY ai_monthly_tokens DESC LIMIT 10` | Top consumer > 90% of limit |
| `ai_endpoint_request_count` | Requests per AI endpoint | `COUNT(*) GROUP BY endpoint WHERE endpoint LIKE '/api/ai/%'` | Spike > 2x baseline |
| `ai_request_latency_p95` | 95th percentile latency | `PERCENTILE(latency, 0.95) WHERE endpoint LIKE '/api/ai/%'` | > 5 seconds |

### Visualization

```
┌─────────────────────────────────────────────────────────┐
│ AI Token Budget Dashboard                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Budget Exhaustion Rate (Last 24h)                      │
│  ┌────────────────────────────────────────────┐         │
│  │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ 8.2%    │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Top Token Consumers                                     │
│  ┌────────────────────────────────────────────┐         │
│  │ Clinic A: ████████████████████░░░░░░ 85k   │         │
│  │ Clinic B: ███████████████░░░░░░░░░░ 65k   │         │
│  │ Clinic C: ██████████░░░░░░░░░░░░░░░ 45k   │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Requests by Endpoint (Last 1h)                         │
│  ┌────────────────────────────────────────────┐         │
│  │ /api/chat:              1,234 requests     │         │
│  │ /api/ai/prescription:     456 requests     │         │
│  │ /api/ai/manager:          234 requests     │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### SQL Queries

```sql
-- Budget exhaustion rate (last 24h)
SELECT 
  COUNT(DISTINCT clinic_id) FILTER (WHERE ai_monthly_tokens >= 
    CASE 
      WHEN role = 'patient' THEN 10000
      WHEN role = 'doctor' THEN 50000
      WHEN role = 'receptionist' THEN 20000
      WHEN role = 'clinic_admin' THEN 100000
      ELSE 1000000
    END
  ) * 100.0 / COUNT(DISTINCT clinic_id) as exhaustion_rate
FROM clinics c
JOIN users u ON u.clinic_id = c.id
WHERE c.ai_tokens_reset_at >= date_trunc('month', NOW());

-- Top token consumers
SELECT 
  c.id as clinic_id,
  c.name as clinic_name,
  c.ai_monthly_tokens,
  c.ai_tokens_reset_at
FROM clinics c
WHERE c.ai_tokens_reset_at >= date_trunc('month', NOW())
ORDER BY c.ai_monthly_tokens DESC
LIMIT 10;

-- Budget exhaustion events (from logs)
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as exhaustion_count
FROM logs
WHERE message LIKE '%AI token budget exceeded%'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

---

## Dashboard 2: Booking Token Security

### Metrics

| Metric | Description | Query | Alert Threshold |
|--------|-------------|-------|-----------------|
| `booking_token_cross_tenant_rejection_count` | Cross-tenant tokens rejected | `COUNT(*) WHERE message LIKE '%Cross-tenant booking token rejected%'` | > 10 per hour |
| `booking_token_generation_count` | Tokens generated | `COUNT(*) WHERE endpoint = '/api/booking/verify'` | Spike > 2x baseline |
| `booking_token_verification_success_rate` | Successful verifications | `(successful / total) * 100` | < 95% |
| `booking_token_old_format_count` | Old format tokens rejected | `COUNT(*) WHERE message LIKE '%old token format%'` | > 100 per hour (first 48h) |

### Visualization

```
┌─────────────────────────────────────────────────────────┐
│ Booking Token Security Dashboard                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Cross-Tenant Rejection Rate (Last 24h)                 │
│  ┌────────────────────────────────────────────┐         │
│  │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ 1.2%    │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Token Verification Success Rate                        │
│  ┌────────────────────────────────────────────┐         │
│  │ ████████████████████████████████████████ │ 98.5%   │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Old Format Token Rejections (Last 48h)                 │
│  ┌────────────────────────────────────────────┐         │
│  │ Day 1: ████████████████████████░░░░░░ 245  │         │
│  │ Day 2: ████████░░░░░░░░░░░░░░░░░░░░░░ 87   │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### SQL Queries

```sql
-- Cross-tenant rejection rate
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as rejection_count
FROM logs
WHERE message LIKE '%Cross-tenant booking token rejected%'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;

-- Token verification success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 200) * 100.0 / COUNT(*) as success_rate
FROM request_logs
WHERE endpoint = '/api/booking'
  AND method = 'POST'
  AND timestamp >= NOW() - INTERVAL '1 hour';

-- Old format token rejections
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(*) as old_format_count
FROM logs
WHERE message LIKE '%old token format%'
  AND timestamp >= NOW() - INTERVAL '48 hours'
GROUP BY day
ORDER BY day;
```

---

## Dashboard 3: File Download Authorization

### Metrics

| Metric | Description | Query | Alert Threshold |
|--------|-------------|-------|-----------------|
| `file_download_authorization_failure_count` | Unauthorized download attempts | `COUNT(*) WHERE action = 'file_download' AND status = 'denied'` | Spike > 2x baseline |
| `file_download_success_count` | Successful downloads | `COUNT(*) WHERE action = 'file_download' AND status = 'success'` | Drop > 20% |
| `patient_files_table_size` | Number of ownership records | `SELECT COUNT(*) FROM patient_files` | - |
| `orphaned_files_count` | Files without ownership | `SELECT COUNT(*) FROM r2_objects WHERE r2_key NOT IN (SELECT r2_key FROM patient_files)` | > 100 |

### Visualization

```
┌─────────────────────────────────────────────────────────┐
│ File Authorization Dashboard                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Authorization Failure Rate (Last 24h)                  │
│  ┌────────────────────────────────────────────┐         │
│  │ ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ 2.1%    │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Failures by Role                                       │
│  ┌────────────────────────────────────────────┐         │
│  │ Patient:      ████████████████████ 45      │         │
│  │ Doctor:       ██░░░░░░░░░░░░░░░░░░ 3       │         │
│  │ Receptionist: █░░░░░░░░░░░░░░░░░░░ 2       │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Patient Files Table                                    │
│  ┌────────────────────────────────────────────┐         │
│  │ Total Records:     12,345                  │         │
│  │ Orphaned Files:    23                      │         │
│  │ Coverage:          99.8%                   │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### SQL Queries

```sql
-- Authorization failure rate by role
SELECT 
  u.role,
  COUNT(*) as failure_count
FROM audit_log al
JOIN users u ON u.id = al.user_id
WHERE al.action = 'file_download'
  AND al.status = 'denied'
  AND al.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY u.role
ORDER BY failure_count DESC;

-- Orphaned files check
SELECT COUNT(*) as orphaned_count
FROM (
  -- This is a conceptual query; actual implementation depends on R2 listing
  SELECT r2_key FROM r2_objects
  EXCEPT
  SELECT r2_key FROM patient_files
) AS orphaned;

-- Patient files table stats
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT clinic_id) as clinics_with_files,
  COUNT(DISTINCT patient_id) as patients_with_files,
  MIN(uploaded_at) as oldest_file,
  MAX(uploaded_at) as newest_file
FROM patient_files;
```

---

## Dashboard 4: PII Redaction

### Metrics

| Metric | Description | Query | Alert Threshold |
|--------|-------------|-------|-----------------|
| `pii_redaction_count` | Fields redacted | `COUNT(*) WHERE message LIKE '%[REDACTED]%'` | = 0 (redaction not working) |
| `log_volume_by_level` | Logs by severity | `COUNT(*) GROUP BY level` | Error spike > 2x |
| `sentry_error_count` | Errors sent to Sentry | Sentry API | Spike > 2x baseline |
| `pii_leak_detection_count` | PII patterns detected | Regex scan of logs | > 0 (CRITICAL) |

### Visualization

```
┌─────────────────────────────────────────────────────────┐
│ PII Redaction Dashboard                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Redaction Activity (Last 24h)                          │
│  ┌────────────────────────────────────────────┐         │
│  │ Fields Redacted: 1,234                     │         │
│  │ Status: ✅ ACTIVE                          │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Log Volume by Level                                    │
│  ┌────────────────────────────────────────────┐         │
│  │ INFO:  ████████████████████████ 12,345     │         │
│  │ WARN:  ████████░░░░░░░░░░░░░░░░ 1,234      │         │
│  │ ERROR: ███░░░░░░░░░░░░░░░░░░░░░ 234        │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  PII Leak Detection (Last 7 days)                       │
│  ┌────────────────────────────────────────────┐         │
│  │ Email Patterns:  0 ✅                      │         │
│  │ Phone Patterns:  0 ✅                      │         │
│  │ Name Patterns:   0 ✅                      │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Log Audit Script

```bash
#!/bin/bash
# scripts/audit-pii-logs.sh

ENV=${1:-production}
SAMPLE_SIZE=${2:-1000}

echo "Auditing logs for PII in $ENV environment..."

# Fetch recent logs
LOGS=$(cloudflare-logs fetch --env $ENV --limit $SAMPLE_SIZE)

# Check for email patterns
EMAIL_COUNT=$(echo "$LOGS" | grep -oE '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' | wc -l)

# Check for phone patterns
PHONE_COUNT=$(echo "$LOGS" | grep -oE '\+?[0-9]{10,}' | wc -l)

# Check for name patterns (heuristic: capitalized words not in common list)
NAME_COUNT=$(echo "$LOGS" | grep -oE '\b[A-Z][a-z]+ [A-Z][a-z]+\b' | grep -v -E '(User|Admin|Doctor|Patient|Clinic)' | wc -l)

echo "Results:"
echo "  Email patterns found: $EMAIL_COUNT"
echo "  Phone patterns found: $PHONE_COUNT"
echo "  Name patterns found: $NAME_COUNT"

if [ $EMAIL_COUNT -gt 0 ] || [ $PHONE_COUNT -gt 0 ] || [ $NAME_COUNT -gt 10 ]; then
  echo "⚠️  WARNING: Potential PII detected in logs!"
  exit 1
else
  echo "✅ No PII detected in sample"
  exit 0
fi
```

---

## Alert Configuration

### Alert 1: PII Detected in Logs (CRITICAL)

**Severity:** CRITICAL  
**Condition:** PII patterns detected in logs  
**Threshold:** 1 occurrence  
**Window:** 5 minutes  
**Notification:** Email (security@oltigo.com), PagerDuty (security-team)

**Alert Definition:**
```yaml
name: pii_detected_in_logs
severity: CRITICAL
condition: |
  logs.content MATCHES /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  OR logs.content MATCHES /\+?[0-9]{10,}/
  OR logs.content MATCHES /\b[A-Z][a-z]+ [A-Z][a-z]+\b/ (excluding common terms)
threshold: 1
window: 5m
notifications:
  - type: email
    to: security@oltigo.com
  - type: pagerduty
    service: security-team
runbook: docs/runbooks/pii-logging-incident-response.md
```

**Response Procedure:**
1. Immediately investigate log source (which API route, which logger call)
2. Purge PII from log aggregation systems (Cloudflare, Sentry)
3. Notify Data Protection Officer (DPO)
4. Review code for logger misuse
5. Deploy hotfix if needed
6. Document incident for GDPR compliance

---

### Alert 2: AI Budget Exceeded (HIGH)

**Severity:** HIGH  
**Condition:** > 10% of active clinics exceeded budget  
**Threshold:** > 10% of clinics  
**Window:** 1 hour  
**Notification:** Slack (#ops-alerts), Email (ops@oltigo.com)

**Alert Definition:**
```yaml
name: ai_budget_exceeded_widespread
severity: HIGH
condition: |
  (COUNT(DISTINCT clinic_id) WHERE ai_budget_exceeded = true) / 
  (COUNT(DISTINCT clinic_id) WHERE active = true) > 0.10
threshold: 0.10
window: 1h
notifications:
  - type: slack
    channel: "#ops-alerts"
  - type: email
    to: ops@oltigo.com
runbook: docs/runbooks/ai-budget-exhaustion.md
```

**Response Procedure:**
1. Review token limits per role (are they too low?)
2. Check for abuse patterns (single user making excessive requests)
3. Analyze top consumers (legitimate high usage vs. abuse)
4. Consider increasing limits for legitimate users
5. Communicate with affected clinics
6. Monitor for continued exhaustion

---

### Alert 3: Booking Token Rejection Spike (MEDIUM)

**Severity:** MEDIUM  
**Condition:** Rejection rate > 5%  
**Threshold:** > 5% rejection rate  
**Window:** 15 minutes  
**Notification:** Slack (#ops-alerts)

**Alert Definition:**
```yaml
name: booking_token_rejection_spike
severity: MEDIUM
condition: |
  (booking_token_rejections / booking_token_verifications) > 0.05
threshold: 0.05
window: 15m
notifications:
  - type: slack
    channel: "#ops-alerts"
runbook: docs/runbooks/booking-token-troubleshooting.md
```

**Response Procedure:**
1. Check for old token format usage (expected in first 48h post-deployment)
2. Verify token generation working correctly
3. Review cross-tenant rejection logs (potential attack?)
4. Check for clock skew issues (expiry validation)
5. Communicate with users if needed
6. Monitor for continued rejections

---

### Alert 4: File Authorization Failure Spike (MEDIUM)

**Severity:** MEDIUM  
**Condition:** Authorization failures > 2x baseline  
**Threshold:** 2x baseline  
**Window:** 10 minutes  
**Notification:** Slack (#ops-alerts)

**Alert Definition:**
```yaml
name: file_authorization_failure_spike
severity: MEDIUM
condition: |
  file_download_authorization_failures > (baseline * 2)
threshold: 2.0
window: 10m
notifications:
  - type: slack
    channel: "#ops-alerts"
runbook: docs/runbooks/file-authorization-debugging.md
```

**Response Procedure:**
1. Check patient_files table integrity (missing records?)
2. Review RLS policies (correctly configured?)
3. Investigate potential attack (enumeration attempt?)
4. Verify backfill completed successfully
5. Check for legitimate access issues (staff unable to download)
6. Monitor for continued failures

---

## Operational Procedures

### Daily Checks

**Morning Checklist (9:00 AM):**
- [ ] Review overnight error rates (should be < 1%)
- [ ] Check AI budget exhaustion events (any new clinics?)
- [ ] Review booking token rejection rate (normalizing?)
- [ ] Check file authorization failures (any spikes?)
- [ ] Run PII log audit (`npm run audit:pii-logs`)

**Evening Checklist (6:00 PM):**
- [ ] Review daily metrics summary
- [ ] Check alert history (any critical alerts?)
- [ ] Verify monitoring dashboards loading
- [ ] Review Sentry error trends

### Weekly Checks

**Monday Morning:**
- [ ] Run comprehensive PII log audit (sample 10,000 logs)
- [ ] Review AI token usage trends (week-over-week)
- [ ] Analyze booking token rejection patterns
- [ ] Check patient_files table growth
- [ ] Review security incident log

**Friday Afternoon:**
- [ ] Generate weekly security metrics report
- [ ] Review alert effectiveness (false positives?)
- [ ] Update runbooks based on incidents
- [ ] Plan monitoring improvements

### Monthly Checks

**First Monday of Month:**
- [ ] Comprehensive security audit
- [ ] Review all monitoring dashboards
- [ ] Analyze month-over-month trends
- [ ] Update alert thresholds based on data
- [ ] Review and update runbooks
- [ ] Conduct tabletop exercise for incident response

---

## Metrics Export

### Prometheus Format

```
# HELP ai_budget_exceeded_total Total number of AI budget exhaustion events
# TYPE ai_budget_exceeded_total counter
ai_budget_exceeded_total{clinic_id="...",role="patient"} 5

# HELP booking_token_cross_tenant_rejection_total Total cross-tenant token rejections
# TYPE booking_token_cross_tenant_rejection_total counter
booking_token_cross_tenant_rejection_total{clinic_id="..."} 2

# HELP file_download_authorization_failure_total Total file authorization failures
# TYPE file_download_authorization_failure_total counter
file_download_authorization_failure_total{role="patient"} 12

# HELP pii_redaction_total Total PII fields redacted
# TYPE pii_redaction_total counter
pii_redaction_total{field="email"} 234
pii_redaction_total{field="phone"} 123

# HELP timing_safe_equal_oversized_rejection_total Total oversized signature rejections
# TYPE timing_safe_equal_oversized_rejection_total counter
timing_safe_equal_oversized_rejection_total{webhook="whatsapp"} 1
```

### JSON Export

```json
{
  "timestamp": "2026-05-01T10:00:00Z",
  "metrics": {
    "ai_budget_exceeded_count": 15,
    "booking_token_cross_tenant_rejection_count": 3,
    "file_download_authorization_failure_count": 45,
    "pii_redaction_count": 1234,
    "timing_safe_equal_oversized_rejection_count": 2
  },
  "by_clinic": {
    "clinic-a-id": {
      "ai_budget_exceeded": true,
      "ai_tokens_used": 95000,
      "ai_tokens_limit": 100000
    }
  }
}
```

---

## Troubleshooting Guide

### Issue: PII Detected in Logs

**Symptoms:**
- Alert triggered: "PII detected in logs"
- Email/phone/name patterns found in log sample

**Diagnosis:**
```bash
# Find the source of PII leak
grep -r "logger\.(info|warn|error)" src/app/api/ | grep -E "(email|phone|name)"

# Check recent deployments
git log --oneline --since="24 hours ago"

# Review specific log entries
cloudflare-logs fetch --filter "content MATCHES email" --limit 10
```

**Resolution:**
1. Identify the API route logging PII
2. Update logger call to remove PII fields
3. Deploy hotfix immediately
4. Purge PII from log systems
5. Notify DPO if required by GDPR

---

### Issue: AI Budget Exhaustion

**Symptoms:**
- Multiple clinics hitting token limits
- 429 responses from AI endpoints
- User complaints about AI features not working

**Diagnosis:**
```sql
-- Check which clinics are affected
SELECT 
  c.id,
  c.name,
  c.ai_monthly_tokens,
  u.role,
  CASE 
    WHEN u.role = 'patient' THEN 10000
    WHEN u.role = 'doctor' THEN 50000
    WHEN u.role = 'receptionist' THEN 20000
    WHEN u.role = 'clinic_admin' THEN 100000
    ELSE 1000000
  END as limit
FROM clinics c
JOIN users u ON u.clinic_id = c.id
WHERE c.ai_monthly_tokens >= (
  CASE 
    WHEN u.role = 'patient' THEN 10000
    WHEN u.role = 'doctor' THEN 50000
    WHEN u.role = 'receptionist' THEN 20000
    WHEN u.role = 'clinic_admin' THEN 100000
    ELSE 1000000
  END
);
```

**Resolution:**
1. Review if limits are too restrictive
2. Check for abuse (single user making excessive requests)
3. Temporarily increase limit for legitimate users:
   ```sql
   -- Reset token counter for specific clinic
   UPDATE clinics
   SET ai_monthly_tokens = 0,
       ai_tokens_reset_at = NOW()
   WHERE id = '<clinic-id>';
   ```
4. Communicate with affected clinics
5. Consider adjusting role-based limits

---

### Issue: Booking Token Rejection Spike

**Symptoms:**
- High rejection rate (> 5%)
- User complaints about booking links not working
- Logs show "Cross-tenant booking token rejected" or "old token format"

**Diagnosis:**
```bash
# Check rejection reasons
cloudflare-logs fetch --filter "booking token" --limit 100 | \
  grep -E "(Cross-tenant|old token format|expired)" | \
  sort | uniq -c

# Check token generation
curl -X POST https://oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+212600000000"}'
```

**Resolution:**
1. If old format: Expected in first 48h, communicate with users
2. If cross-tenant: Investigate potential attack, verify tenant resolution
3. If expired: Check clock skew, verify TTL (15 minutes)
4. If generation failing: Check `BOOKING_TOKEN_SECRET` environment variable

---

## Contact Information

**Monitoring Team:** ops@oltigo.com  
**Security Team:** security@oltigo.com  
**On-Call Engineer:** [PagerDuty rotation]  
**DPO (Data Protection Officer):** dpo@oltigo.com

**Escalation Path:**
1. On-call engineer (immediate)
2. Engineering manager (< 30 min)
3. CTO (critical security issues)
4. DPO (GDPR compliance issues)

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Next Review:** After 1 week of production monitoring
