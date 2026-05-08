# Runbook: PII Logging Incident Response

## Overview

This runbook provides procedures for responding to Personally Identifiable Information (PII) detected in application logs, which constitutes a GDPR Article 5(1)(f) and Morocco Law 09-08 Article 24 violation.

**Related Vulnerability:** A8-01 (PII in Logs)  
**Fix Deployed:** Phase 1 Critical Security Fixes  
**Alert:** `pii_detected_in_logs` (CRITICAL)  
**Regulatory Impact:** GDPR fines up to 4% of annual revenue

---

## Background

### What is PII?

Personally Identifiable Information (PII) includes any data that can identify an individual:

**Direct Identifiers:**
- Full name
- Email address
- Phone number
- National ID (CIN in Morocco)
- Social Security Number
- Medical record number

**Sensitive Health Information (PHI):**
- Diagnosis
- Prescription
- Medical history
- Lab results
- Insurance information

### Why is PII in Logs a Problem?

1. **Regulatory Violations:**
   - GDPR Article 5(1)(f): Storage limitation principle
   - GDPR Article 32: Security of processing
   - Morocco Law 09-08 Article 24: Data protection requirements

2. **Security Risks:**
   - Logs accessible to ops team, third-party processors
   - Logs retained longer than necessary
   - Logs may be transmitted to external systems (Sentry, Cloudflare)

3. **Compliance Consequences:**
   - GDPR fines: Up to €20M or 4% of annual revenue
   - Morocco CNDP sanctions
   - Mandatory breach notification to affected individuals
   - Reputational damage

### What Should Be Logged?

**✅ ALLOWED:**
- UUIDs: `clinicId`, `userId`, `patientId`, `appointmentId`
- Timestamps
- Error codes
- Request IDs / Trace IDs
- HTTP status codes
- Aggregated metrics

**❌ FORBIDDEN:**
- Names (patient, doctor, clinic)
- Email addresses
- Phone numbers
- Addresses
- Medical information
- Any field that can identify an individual

---

## Alert Triggers

### Alert 1: PII Pattern Detected (CRITICAL)

**Condition:** Email, phone, or name pattern found in logs  
**Severity:** CRITICAL  
**Notification:** Email (security@oltigo.com), PagerDuty (security-team)

**Detection Patterns:**
```regex
# Email
\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b

# Phone (international format)
\+?[0-9]{10,}

# Name (heuristic: capitalized words)
\b[A-Z][a-z]+ [A-Z][a-z]+\b
```

### Alert 2: Redaction Function Not Working

**Condition:** `pii_redaction_count` = 0 for extended period  
**Severity:** HIGH  
**Notification:** Slack (#ops-alerts)

**Indicates:**
- Logger redaction function broken
- No PII fields being passed (unlikely)
- Monitoring issue

---

## Immediate Response (< 15 minutes)

### Step 1: Confirm PII Leak

```bash
# Fetch recent logs and check for PII
cloudflare-logs fetch --limit 1000 --since "15 minutes ago" > recent_logs.json

# Check for email patterns
grep -oE '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' recent_logs.json | head -10

# Check for phone patterns
grep -oE '\+?[0-9]{10,}' recent_logs.json | head -10

# Check for name patterns (excluding common terms)
grep -oE '\b[A-Z][a-z]+ [A-Z][a-z]+\b' recent_logs.json | \
  grep -v -E '(User|Admin|Doctor|Patient|Clinic|Test|Demo)' | head -10
```

**If PII confirmed, proceed immediately to Step 2.**

### Step 2: Identify Source

```bash
# Find which API route is logging PII
jq -r 'select(.message | test("email|phone|name"; "i")) | [.timestamp, .context, .message] | @tsv' recent_logs.json | \
  sort | uniq -c | sort -rn

# Example output:
# 45 2026-05-01T10:15:23Z  registration  Registration received
# 12 2026-05-01T10:20:45Z  booking       Booking created
#  3 2026-05-01T10:25:12Z  patient       Patient updated
```

**Identify the specific file and line:**
```bash
# Search codebase for the logging statement
grep -rn "Registration received" src/app/api/

# Example output:
# src/app/api/v1/register-clinic/route.ts:45:  logger.info("Registration received", {
```

### Step 3: Stop the Leak

**Option A: Emergency Hotfix (Preferred)**

```bash
# 1. Identify the problematic logger call
git show HEAD:src/app/api/v1/register-clinic/route.ts | grep -A 10 "Registration received"

# 2. Create hotfix branch
git checkout -b hotfix/pii-logging-leak

# 3. Remove PII from logger call
# BEFORE:
# logger.info("Registration received", {
#   clinicName: data.clinic_name,
#   doctorName: data.doctor_name,
#   email: data.email,
#   phone: data.phone,
# });

# AFTER:
# logger.info("Registration received", {
#   clinicId: clinicId,  // UUID only
# });

# 4. Commit and deploy immediately
git add src/app/api/v1/register-clinic/route.ts
git commit -m "HOTFIX: Remove PII from registration logs"
git push origin hotfix/pii-logging-leak

# 5. Deploy to production (emergency)
npm run deploy:production --emergency

# 6. Verify fix
sleep 60  # Wait for deployment
cloudflare-logs fetch --limit 100 --since "1 minute ago" | \
  grep -E "email|phone|name" | wc -l
# Expected: 0
```

**Option B: Temporary Logging Disable (If hotfix not immediately possible)**

```bash
# Disable logging for affected endpoint temporarily
# This is a last resort - only use if hotfix will take > 30 minutes

# Add environment variable to disable logging
cloudflare-workers env set DISABLE_REGISTRATION_LOGGING=true --env production

# Update code to check this flag (requires prior implementation)
```

---

## Data Breach Assessment (< 1 hour)

### Step 4: Determine Scope

```bash
# How long has PII been leaking?
git log --oneline --all --grep "Registration received" -- src/app/api/v1/register-clinic/route.ts

# Example output:
# abc123 2026-04-15 Add registration logging
# def456 2026-03-01 Initial registration endpoint

# PII has been leaking since 2026-04-15 (16 days)
```

```sql
-- How many individuals affected?
SELECT COUNT(DISTINCT email) as affected_count
FROM (
  -- This is conceptual; actual query depends on log storage
  SELECT metadata->>'email' as email
  FROM logs
  WHERE message LIKE '%Registration received%'
    AND timestamp >= '2026-04-15'
    AND metadata->>'email' IS NOT NULL
) AS leaked_emails;
```

### Step 5: Assess Regulatory Obligations

**GDPR Article 33: Breach Notification to Supervisory Authority**

Notification required if breach likely to result in risk to rights and freedoms of individuals.

**Criteria:**
- ✅ **YES** if: PII exposed to unauthorized parties (third-party log processors, ops team without need-to-know)
- ✅ **YES** if: > 100 individuals affected
- ✅ **YES** if: Sensitive data (health information) exposed
- ❌ **NO** if: PII only in internal logs, not transmitted externally, < 100 individuals

**GDPR Article 34: Notification to Data Subjects**

Required if breach likely to result in high risk to individuals.

**Criteria:**
- ✅ **YES** if: Sensitive health information exposed
- ✅ **YES** if: PII transmitted to third parties
- ❌ **NO** if: Low risk (internal logs only, no external transmission)

**Morocco Law 09-08: CNDP Notification**

Required within 72 hours of becoming aware of breach.

### Step 6: Notify Data Protection Officer (DPO)

```
To: dpo@oltigo.com
Cc: legal@oltigo.com, cto@oltigo.com
Subject: URGENT: PII Data Breach - Immediate Action Required

DPO,

We've detected PII in application logs, constituting a potential GDPR breach.

**Incident Summary:**
- Date Detected: 2026-05-01 10:30 UTC
- PII Types: [Email / Phone / Name / Health Info]
- Affected Individuals: [Estimated count]
- Leak Duration: [Start date] to [End date]
- External Transmission: [Yes/No - Sentry, Cloudflare, etc.]

**Immediate Actions Taken:**
- Hotfix deployed to stop leak
- Log purge initiated
- Incident investigation ongoing

**Regulatory Assessment:**
- GDPR Art. 33 Notification Required: [YES/NO]
- GDPR Art. 34 Notification Required: [YES/NO]
- Morocco CNDP Notification Required: [YES/NO]

**Next Steps:**
- DPO to assess regulatory obligations
- Legal to review notification requirements
- Engineering to complete log purge

**Incident Commander:** [Your Name]
**Incident ID:** INC-2026-05-01-001

Regards,
[Your Name]
```

---

## Log Purge (< 2 hours)

### Step 7: Purge PII from Log Systems

**Cloudflare Workers Logs:**

```bash
# Cloudflare doesn't support selective log deletion
# Options:
# 1. Contact Cloudflare support for log purge (slow)
# 2. Wait for log retention period (30 days)
# 3. Implement log filtering at ingestion (future prevention)

# Document that logs contain PII and will be purged at retention boundary
echo "Cloudflare logs contain PII from 2026-04-15 to 2026-05-01" >> incident_log.txt
echo "Logs will be purged automatically after 30-day retention" >> incident_log.txt
```

**Sentry:**

```bash
# Sentry allows event deletion via API
# Get affected event IDs
curl -X GET "https://sentry.io/api/0/projects/oltigo/health/events/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -d "query=Registration received" \
  | jq -r '.[] | .id' > sentry_event_ids.txt

# Delete events
while read event_id; do
  curl -X DELETE "https://sentry.io/api/0/projects/oltigo/health/events/$event_id/" \
    -H "Authorization: Bearer $SENTRY_AUTH_TOKEN"
done < sentry_event_ids.txt

# Verify deletion
curl -X GET "https://sentry.io/api/0/projects/oltigo/health/events/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -d "query=Registration received" | jq '. | length'
# Expected: 0
```

**Local/Database Logs (if applicable):**

```sql
-- If logs stored in database, delete affected entries
DELETE FROM logs
WHERE message LIKE '%Registration received%'
  AND timestamp >= '2026-04-15'
  AND timestamp <= '2026-05-01';

-- Verify deletion
SELECT COUNT(*) FROM logs
WHERE message LIKE '%Registration received%'
  AND timestamp >= '2026-04-15';
-- Expected: 0
```

### Step 8: Document Purge Actions

```markdown
## Log Purge Summary

**Date:** 2026-05-01
**Incident:** INC-2026-05-01-001

**Systems Purged:**
- [x] Sentry: 245 events deleted
- [x] Database logs: 123 entries deleted
- [ ] Cloudflare Workers: Awaiting 30-day retention purge

**PII Types Purged:**
- Email addresses: ~245
- Phone numbers: ~245
- Names: ~245

**Verification:**
- [x] No PII patterns found in recent logs
- [x] Redaction function verified working
- [x] Monitoring alerts configured

**Responsible:** [Your Name]
**Verified By:** [Manager Name]
```

---

## Regulatory Notification (< 72 hours)

### Step 9: GDPR Article 33 Notification (If Required)

**To:** Supervisory Authority (CNIL in France, CNDP in Morocco)  
**Deadline:** 72 hours from becoming aware of breach

**Template:**

```
Subject: Personal Data Breach Notification - Oltigo Health

Dear [Supervisory Authority],

We are writing to notify you of a personal data breach in accordance with 
GDPR Article 33.

**1. Nature of the Breach:**
Personal data was inadvertently logged in application logs, including:
- Email addresses
- Phone numbers
- [Other PII types]

**2. Categories and Number of Data Subjects:**
- Approximately [X] individuals affected
- Categories: Clinic administrators, doctors, patients

**3. Likely Consequences:**
- Low risk: PII exposed only to internal operations team
- No evidence of unauthorized external access
- No sensitive health information exposed

**4. Measures Taken:**
- Immediate hotfix deployed to stop leak (2026-05-01 10:45 UTC)
- PII purged from log systems (2026-05-01 12:00 UTC)
- Enhanced monitoring implemented
- Code review process updated

**5. Contact Point:**
Data Protection Officer: dpo@oltigo.com

**6. Timeline:**
- Breach occurred: 2026-04-15
- Breach detected: 2026-05-01 10:30 UTC
- Breach contained: 2026-05-01 10:45 UTC
- Notification sent: 2026-05-01 14:00 UTC (within 72 hours)

Regards,
[DPO Name]
Data Protection Officer
Oltigo Health
```

### Step 10: GDPR Article 34 Notification (If Required)

**To:** Affected individuals  
**Condition:** Only if high risk to rights and freedoms

**Template:**

```
Subject: Important Security Notice - Oltigo Health

Dear [Name],

We are writing to inform you of a security incident that may have affected 
your personal information.

**What Happened:**
Between April 15 and May 1, 2026, your email address and phone number were 
inadvertently included in our application logs.

**What Information Was Involved:**
- Email address
- Phone number
- [Other PII if applicable]

**What We Are Doing:**
- We immediately fixed the issue on May 1, 2026
- We have purged your information from our log systems
- We have implemented additional safeguards to prevent recurrence

**What You Can Do:**
- No action is required on your part
- Your account security has not been compromised
- Your medical information was not affected

**What Was NOT Affected:**
- Your password
- Your medical records
- Your payment information

**Questions:**
If you have any questions or concerns, please contact our Data Protection 
Officer at dpo@oltigo.com or call [phone number].

We sincerely apologize for this incident and are committed to protecting 
your privacy.

Regards,
[Name]
CEO, Oltigo Health
```

---

## Root Cause Analysis (< 1 week)

### Step 11: Conduct RCA

**5 Whys Analysis:**

1. **Why did PII appear in logs?**
   - Developer passed PII fields to logger without redaction

2. **Why did developer pass PII to logger?**
   - Unaware of PII logging policy / Forgot to use UUIDs only

3. **Why was developer unaware?**
   - Insufficient training / Documentation not prominent

4. **Why was documentation not prominent?**
   - Not included in onboarding / Not enforced in code review

5. **Why was it not enforced in code review?**
   - No automated checks / Reviewers missed it

**Root Causes:**
1. Lack of automated PII detection in logs
2. Insufficient developer training on PII handling
3. No pre-commit hooks to catch PII in logger calls
4. Code review process didn't catch the issue

### Step 12: Implement Preventive Measures

**1. Automated PII Detection:**

```bash
# Add pre-commit hook to detect PII in logger calls
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for potential PII in logger calls
if git diff --cached | grep -E 'logger\.(info|warn|error)' | grep -E '(email|phone|name|patient)'; then
  echo "❌ ERROR: Potential PII detected in logger call"
  echo "Only log UUIDs (clinicId, userId, patientId, appointmentId)"
  echo "See AGENTS.md for logging guidelines"
  exit 1
fi
EOF

chmod +x .husky/pre-commit
```

**2. ESLint Rule:**

```javascript
// eslint.config.mjs

export default [
  {
    rules: {
      "no-pii-in-logs": {
        create(context) {
          return {
            CallExpression(node) {
              if (
                node.callee.object?.name === "logger" &&
                ["info", "warn", "error"].includes(node.callee.property?.name)
              ) {
                // Check if arguments contain PII field names
                const code = context.getSourceCode().getText(node);
                if (/\b(email|phone|name|patient_name|address)\b/.test(code)) {
                  context.report({
                    node,
                    message: "Do not log PII. Use UUIDs only (clinicId, userId, patientId).",
                  });
                }
              }
            },
          };
        },
      },
    },
  },
];
```

**3. Enhanced Logger Redaction:**

```typescript
// src/lib/logger.ts

const PHI_FIELD_PATTERNS = new Set([
  "email", "phone", "name", "patient_name", "patient_email", "patient_phone",
  "cin", "date_of_birth", "dob", "address", "ssn", "insurance_number",
  "medical_record", "prescription", "diagnosis",
  // ADD MORE:
  "full_name", "doctor_name", "clinic_name", "owner_name",
  "emergency_contact", "next_of_kin", "patient_address",
  "billing_address", "insurance_id", "medical_history",
]);

// Add runtime warning if PII detected
function redactPhi(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;

  const redacted: any = Array.isArray(obj) ? [] : {};
  let piiDetected = false;

  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELD_PATTERNS.has(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
      piiDetected = true;
    } else if (typeof value === "object") {
      redacted[key] = redactPhi(value);
    } else {
      redacted[key] = value;
    }
  }

  if (piiDetected && process.env.NODE_ENV === "development") {
    console.warn("⚠️  PII field detected in logger call. Use UUIDs only.");
  }

  return redacted;
}
```

**4. Developer Training:**

```markdown
# PII Logging Training Module

## What is PII?
[Definition and examples]

## Why is PII in Logs Dangerous?
[Regulatory and security risks]

## What to Log
✅ UUIDs: clinicId, userId, patientId, appointmentId
✅ Timestamps, error codes, trace IDs
✅ Aggregated metrics

❌ Names, emails, phones, addresses
❌ Medical information
❌ Any identifiable data

## Examples

**WRONG:**
```typescript
logger.info("User registered", {
  email: user.email,
  name: user.name,
  phone: user.phone,
});
```

**CORRECT:**
```typescript
logger.info("User registered", {
  userId: user.id,
  clinicId: user.clinic_id,
});
```

## Quiz
[Interactive quiz to test understanding]
```

**5. Code Review Checklist:**

```markdown
# Code Review Checklist

## Security
- [ ] No PII in logger calls (only UUIDs)
- [ ] No secrets in code
- [ ] Input validation present
- [ ] Authorization checks correct

## Logging
- [ ] Logger calls use UUIDs only
- [ ] No email, phone, name in logs
- [ ] Trace IDs propagated
- [ ] Error context sufficient for debugging
```

---

## Post-Incident Review (< 2 weeks)

### Step 13: Document Lessons Learned

```markdown
## Incident Post-Mortem: PII in Logs

**Date:** 2026-05-01
**Incident ID:** INC-2026-05-01-001
**Severity:** CRITICAL

### Timeline
- 2026-04-15: PII logging introduced in registration endpoint
- 2026-05-01 10:30: PII detected by automated scan
- 2026-05-01 10:45: Hotfix deployed
- 2026-05-01 12:00: Log purge completed
- 2026-05-01 14:00: Regulatory notification sent

### Impact
- **Individuals Affected:** ~245
- **PII Types:** Email, phone, name
- **Duration:** 16 days
- **Regulatory:** GDPR notification required
- **Financial:** Potential fine (mitigated by swift response)

### Root Causes
1. Developer unaware of PII logging policy
2. No automated detection in CI/CD
3. Code review missed the issue
4. Logger redaction not comprehensive enough

### What Went Well
- Automated PII detection caught the issue
- Hotfix deployed within 15 minutes
- Log purge completed within 2 hours
- Regulatory notification within 72 hours

### What Went Wrong
- Issue not caught in code review
- No pre-commit hooks to prevent
- Developer training insufficient

### Action Items
- [x] Deploy hotfix (Owner: Engineering, Due: 2026-05-01)
- [x] Purge logs (Owner: Engineering, Due: 2026-05-01)
- [x] Notify DPO (Owner: Engineering, Due: 2026-05-01)
- [ ] Implement pre-commit hooks (Owner: Engineering, Due: 2026-05-08)
- [ ] Add ESLint rule (Owner: Engineering, Due: 2026-05-08)
- [ ] Conduct developer training (Owner: Engineering Manager, Due: 2026-05-15)
- [ ] Update code review checklist (Owner: Engineering Manager, Due: 2026-05-08)
```

---

## Escalation Path

### Level 1: On-Call Engineer (Immediate)
- Confirm PII leak
- Identify source
- Deploy hotfix

### Level 2: Engineering Manager (< 15 min)
- Approve emergency deployment
- Coordinate log purge
- Notify DPO

### Level 3: DPO (< 30 min)
- Assess regulatory obligations
- Prepare breach notifications
- Coordinate with legal

### Level 4: Legal Team (< 1 hour)
- Review notification requirements
- Draft regulatory notifications
- Advise on liability

### Level 5: Executive Team (< 2 hours)
- Approve external communications
- Coordinate with PR team
- Make strategic decisions

---

## Related Documentation

- [Deployment Guide](../deployment-phase1-security-fixes.md)
- [Monitoring Guide](../monitoring-phase1-security-fixes.md)
- [AGENTS.md](../../AGENTS.md) - PII logging section
- [GDPR Compliance](../compliance/dpia.md)
- [Morocco Law 09-08](../compliance/cndp.md)

---

**Runbook Version:** 1.0  
**Last Updated:** 2026-05-01  
**Owner:** Security Team & DPO  
**Next Review:** Quarterly
