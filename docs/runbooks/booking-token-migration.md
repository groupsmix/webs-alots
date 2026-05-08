# Runbook: Booking Token Migration Troubleshooting

## Overview

This runbook provides procedures for troubleshooting issues related to the booking token format migration deployed in Phase 1 Critical Security Fixes.

**Related Vulnerability:** A6-13 (Cross-Tenant Booking Token Replay)  
**Fix Deployed:** Phase 1 Critical Security Fixes  
**Breaking Change:** Yes - invalidates all existing booking tokens  
**Alert:** `booking_token_rejection_spike`

---

## Background

### What Changed?

**Old Token Format (INSECURE):**
```
phone:expiry:signature
+212600000000:1735689600:abc123def456...
```

**New Token Format (SECURE):**
```
clinicId:phone:expiry:signature
550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123def456...
```

### Why the Change?

The old format allowed **cross-tenant token replay attacks**:
1. Attacker captures token from Clinic A
2. Replays same token to Clinic B with same phone number
3. Token validates successfully → unauthorized booking created

The new format includes `clinicId` in the signature, preventing cross-tenant replay.

### Impact

- ✅ **Security:** Cross-tenant replay attacks prevented
- ⚠️ **Breaking Change:** All existing tokens invalidated
- 📱 **User Impact:** Users must request new booking links
- ⏱️ **Duration:** Expected high rejection rate for 48 hours post-deployment

---

## Alert Triggers

### Alert 1: Booking Token Rejection Spike

**Condition:** Rejection rate > 5%  
**Severity:** MEDIUM  
**Notification:** Slack (#ops-alerts)

**Expected Behavior:**
- **First 24 hours:** Rejection rate 10-20% (old tokens in circulation)
- **24-48 hours:** Rejection rate 5-10% (users requesting new tokens)
- **After 48 hours:** Rejection rate < 2% (normalized)

### Alert 2: Cross-Tenant Token Attempt

**Condition:** Cross-tenant token detected  
**Severity:** HIGH  
**Notification:** Slack (#security-alerts), Email (security@oltigo.com)

**Expected Behavior:**
- Should be rare (< 10 per day)
- May indicate attack or misconfiguration

---

## Diagnosis Procedures

### Step 1: Identify Rejection Reasons

```bash
# Fetch recent booking token errors
cloudflare-logs fetch --filter "booking token" --limit 500 | \
  jq -r 'select(.level == "warn" or .level == "error") | [.timestamp, .message, .context.clinicId] | @tsv' | \
  sort | uniq -c | sort -rn

# Expected output:
# 245 2026-05-01T10:15:23Z  Your booking link has expired  clinic-a-id
#  87 2026-05-01T10:20:45Z  Your booking link has expired  clinic-b-id
#   3 2026-05-01T10:25:12Z  Cross-tenant booking token rejected  clinic-c-id
```

### Step 2: Analyze Rejection Rate

```sql
-- Calculate rejection rate by hour
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) FILTER (WHERE status = 200) as successful,
  COUNT(*) FILTER (WHERE status IN (400, 403)) as rejected,
  ROUND(
    COUNT(*) FILTER (WHERE status IN (400, 403)) * 100.0 / COUNT(*),
    2
  ) as rejection_rate_percent
FROM request_logs
WHERE endpoint = '/api/booking'
  AND method = 'POST'
  AND timestamp >= NOW() - INTERVAL '48 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Step 3: Check Token Generation

```bash
# Test token generation endpoint
curl -X POST https://oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -H "Host: clinic-a.oltigo.com" \
  -d '{"phone":"+212600000000"}' | jq

# Expected response:
# {
#   "ok": true,
#   "data": {
#     "token": "550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123...",
#     "expiresAt": "2026-05-01T10:30:00Z"
#   }
# }

# Verify token format (4 parts separated by colons)
TOKEN=$(curl -s -X POST https://oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -H "Host: clinic-a.oltigo.com" \
  -d '{"phone":"+212600000000"}' | jq -r '.data.token')

echo "$TOKEN" | awk -F: '{print "Parts:", NF}'
# Expected: Parts: 4
```

### Step 4: Check Cross-Tenant Rejections

```sql
-- Get cross-tenant rejection details
SELECT 
  timestamp,
  clinic_id as expected_clinic,
  metadata->>'tokenClinicId' as token_clinic,
  metadata->>'phone' as phone,
  metadata->>'userAgent' as user_agent,
  metadata->>'ip' as ip_address
FROM logs
WHERE message LIKE '%Cross-tenant booking token rejected%'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 50;
```

---

## Resolution Procedures

### Scenario 1: High Old Token Format Rejections (Expected)

**Symptoms:**
- Rejection rate 10-20% in first 24 hours
- Error message: "Your booking link has expired. Please request a new one."
- Users complaining about booking links not working

**Resolution:**

1. **Verify this is expected behavior:**
   ```bash
   # Check if rejections are due to old format
   cloudflare-logs fetch --filter "old token format" --limit 100 | wc -l
   
   # If count is high (> 100), this is expected
   ```

2. **Communicate with users (if not already done):**
   
   **Email Template:**
   ```
   Subject: Action Required: Request New Booking Link

   Dear Oltigo Health User,

   We've deployed important security updates to protect your clinic data.

   **What This Means for You:**
   - Existing booking links will no longer work
   - Please request new booking links for your patients
   - New links are more secure and prevent unauthorized access

   **How to Get New Links:**
   1. Go to Booking Management
   2. Click "Generate Booking Link"
   3. Share the new link with your patients

   **Why This Change:**
   This update prevents security vulnerabilities and ensures only 
   authorized bookings are created for your clinic.

   Questions? Contact support@oltigo.com

   Thank you for your understanding,
   Oltigo Health Team
   ```

3. **Monitor rejection rate:**
   ```bash
   # Run every hour to track normalization
   watch -n 3600 'psql $DATABASE_URL -c "
     SELECT 
       COUNT(*) FILTER (WHERE status IN (400, 403)) * 100.0 / COUNT(*) as rejection_rate
     FROM request_logs
     WHERE endpoint = '/api/booking'
       AND timestamp >= NOW() - INTERVAL '1 hour'
   "'
   ```

4. **No action needed if:**
   - Rejection rate decreasing over time
   - No cross-tenant rejections
   - Token generation working correctly

---

### Scenario 2: Cross-Tenant Token Attempts (Security Incident)

**Symptoms:**
- Alert: "Cross-tenant booking token rejected"
- Same token used across multiple clinics
- Potential attack pattern

**Resolution:**

1. **Investigate immediately:**
   ```sql
   -- Get details of cross-tenant attempts
   SELECT 
     timestamp,
     clinic_id as target_clinic,
     metadata->>'tokenClinicId' as source_clinic,
     metadata->>'phone' as phone,
     metadata->>'ip' as ip_address,
     metadata->>'userAgent' as user_agent
   FROM logs
   WHERE message LIKE '%Cross-tenant booking token rejected%'
     AND timestamp >= NOW() - INTERVAL '24 hours'
   ORDER BY timestamp DESC;
   ```

2. **Determine if attack or misconfiguration:**
   
   **Attack Indicators:**
   - Multiple different clinics targeted
   - Same IP address across attempts
   - Automated user agent
   - High frequency (> 10 attempts per minute)

   **Misconfiguration Indicators:**
   - Single clinic pair (A → B)
   - Human user agent
   - Low frequency
   - Legitimate phone numbers

3. **If attack detected:**
   ```bash
   # Block IP address at Cloudflare level
   cloudflare-firewall block --ip <ip-address> --reason "Cross-tenant token replay attack"

   # Alert security team
   slack-notify --channel security-alerts \
     --message "🚨 Cross-tenant booking token attack detected from IP: <ip-address>"
   ```

4. **If misconfiguration:**
   ```bash
   # Contact clinic admin
   # Explain the issue
   # Verify they're using correct subdomain
   ```

5. **Document incident:**
   ```markdown
   ## Security Incident: Cross-Tenant Token Attempt

   **Date:** 2026-05-01 10:30 UTC
   **Severity:** HIGH
   **Status:** RESOLVED

   **Details:**
   - Source Clinic: clinic-a-id
   - Target Clinic: clinic-b-id
   - IP Address: 192.0.2.1
   - Attempts: 15

   **Root Cause:**
   [Attack / Misconfiguration / User Error]

   **Resolution:**
   [IP blocked / User educated / Configuration fixed]

   **Preventive Measures:**
   [Rate limiting / Better error messages / User education]
   ```

---

### Scenario 3: Token Generation Failing

**Symptoms:**
- Users cannot generate new tokens
- 500 errors from `/api/booking/verify`
- No tokens in database

**Resolution:**

1. **Check environment variables:**
   ```bash
   # Verify BOOKING_TOKEN_SECRET is set
   cloudflare-workers env get BOOKING_TOKEN_SECRET --env production

   # If not set or incorrect:
   cloudflare-workers env set BOOKING_TOKEN_SECRET <secret> --env production
   ```

2. **Check token generation code:**
   ```bash
   # Review recent deployments
   git log --oneline --since="24 hours ago" -- src/app/api/booking/verify/route.ts

   # Check for errors in logs
   cloudflare-logs fetch --filter "booking/verify" --level error --limit 50
   ```

3. **Test token generation locally:**
   ```bash
   # Run local test
   npm run test -- src/app/api/booking/__tests__/verify.test.ts

   # If tests fail, investigate and fix
   ```

4. **Deploy hotfix if needed:**
   ```bash
   # Fix the issue
   git commit -m "Fix booking token generation"
   git push

   # Deploy to production
   npm run deploy:production

   # Verify fix
   curl -X POST https://oltigo.com/api/booking/verify \
     -H "Content-Type: application/json" \
     -d '{"phone":"+212600000000"}'
   ```

---

### Scenario 4: Token Verification Failing

**Symptoms:**
- Valid tokens being rejected
- 403 errors from `/api/booking`
- Users complaining about new links not working

**Resolution:**

1. **Verify token format:**
   ```bash
   # Generate a token
   TOKEN=$(curl -s -X POST https://oltigo.com/api/booking/verify \
     -H "Content-Type: application/json" \
     -H "Host: clinic-a.oltigo.com" \
     -d '{"phone":"+212600000000"}' | jq -r '.data.token')

   # Check format
   echo "$TOKEN" | awk -F: '{print "Parts:", NF, "\nClinicId:", $1, "\nPhone:", $2, "\nExpiry:", $3}'
   ```

2. **Test token verification:**
   ```bash
   # Try to use the token
   curl -X POST https://oltigo.com/api/booking \
     -H "Content-Type: application/json" \
     -H "Host: clinic-a.oltigo.com" \
     -d "{
       \"token\": \"$TOKEN\",
       \"appointmentTime\": \"2026-05-02T10:00:00Z\",
       \"patientName\": \"Test Patient\",
       \"reason\": \"Consultation\"
     }" | jq
   ```

3. **Check for clock skew:**
   ```bash
   # Verify server time
   date -u

   # Check token expiry
   echo "$TOKEN" | awk -F: '{print $3}' | xargs -I {} date -d @{} -u

   # If expiry is in the past, token generation has clock skew issue
   ```

4. **Review verification logic:**
   ```bash
   # Check recent changes to verification code
   git log --oneline --since="7 days ago" -- src/app/api/booking/route.ts

   # Review verification function
   git show HEAD:src/app/api/booking/route.ts | grep -A 50 "verifyBookingToken"
   ```

---

## Preventive Measures

### 1. Improve Error Messages

Add more specific error messages to help users:

```typescript
// src/app/api/booking/route.ts

if (parts.length !== 4) {
  if (parts.length === 3) {
    // Old format detected
    return apiError(
      "Your booking link has expired due to a security update. Please request a new link from your clinic.",
      400,
      "OLD_TOKEN_FORMAT"
    );
  }
  return apiError("Invalid booking token format", 400, "INVALID_TOKEN");
}

if (tokenClinicId !== expectedClinicId) {
  logger.warn("Cross-tenant booking token rejected", {
    context: "booking/verify",
    tokenClinicId,
    expectedClinicId,
    phone,
  });
  return apiError(
    "This booking link is not valid for this clinic. Please request a new link.",
    403,
    "CROSS_TENANT_TOKEN"
  );
}
```

### 2. Add User-Facing Documentation

Create help article explaining the change:

**Title:** "Why do I need to request a new booking link?"

**Content:**
```markdown
# Booking Link Security Update

We've updated our booking system to enhance security and protect your clinic data.

## What Changed?

Booking links now include additional security measures to prevent unauthorized access.

## What You Need to Do

1. **Request new booking links** for your patients
2. **Delete old links** from your website or communications
3. **Share new links** with patients who need to book appointments

## How to Get New Links

1. Log in to your Oltigo Health dashboard
2. Go to **Booking Management**
3. Click **Generate Booking Link**
4. Copy and share the new link

## Why This Matters

This update prevents security vulnerabilities where booking links could be 
misused across different clinics. Your patient data is now more secure.

## Questions?

Contact our support team at support@oltigo.com
```

### 3. Add In-App Notifications

Show notification to clinic admins:

```typescript
// src/app/(admin)/admin/dashboard/page.tsx

{hasOldBookingLinks && (
  <Alert variant="warning">
    <AlertTitle>Action Required: Update Booking Links</AlertTitle>
    <AlertDescription>
      We've deployed a security update. Please generate new booking links 
      and update any links shared with patients.
      <Button onClick={generateNewLinks}>Generate New Links</Button>
    </AlertDescription>
  </Alert>
)}
```

### 4. Monitor Rejection Rate

Set up dashboard to track normalization:

```sql
-- Daily rejection rate trend
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(*) FILTER (WHERE status = 200) as successful,
  COUNT(*) FILTER (WHERE status IN (400, 403)) as rejected,
  ROUND(
    COUNT(*) FILTER (WHERE status IN (400, 403)) * 100.0 / COUNT(*),
    2
  ) as rejection_rate_percent
FROM request_logs
WHERE endpoint = '/api/booking'
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

---

## Escalation Path

### Level 1: On-Call Engineer (Immediate)
- Review alert
- Run diagnosis queries
- Verify expected behavior (old token rejections)
- Document findings

### Level 2: Engineering Manager (< 30 min)
- Review for security incidents
- Approve hotfixes if needed
- Coordinate with security team

### Level 3: Security Team (Security Incidents)
- Investigate cross-tenant attempts
- Block malicious IPs
- Document security incidents
- Recommend preventive measures

### Level 4: CTO (Critical Issues)
- Approve rollback if needed
- Review security implications
- Make policy decisions

---

## Rollback Procedure

**⚠️ WARNING:** Rollback temporarily reintroduces cross-tenant replay vulnerability. Only use as last resort.

### When to Rollback

- Token generation completely broken (> 50% failure rate)
- Token verification completely broken (> 50% rejection rate)
- Critical business impact (clinics cannot accept bookings)

### Rollback Steps

1. **Revert booking token changes:**
   ```bash
   # Identify commit to revert
   git log --oneline --grep "booking token" --since="7 days ago"

   # Revert the commit
   git revert <commit-hash>

   # Deploy immediately
   npm run deploy:production --emergency
   ```

2. **Verify rollback:**
   ```bash
   # Test token generation (should return 3-part token)
   curl -X POST https://oltigo.com/api/booking/verify \
     -H "Content-Type: application/json" \
     -d '{"phone":"+212600000000"}' | jq -r '.data.token' | awk -F: '{print NF}'

   # Expected: 3 (old format)
   ```

3. **Alert security team:**
   ```
   Subject: URGENT: Booking Token Rollback - Security Vulnerability Active

   We've rolled back the booking token security fix due to [reason].

   **Security Impact:**
   - Cross-tenant token replay vulnerability is ACTIVE
   - Tokens can be reused across clinics
   - Monitor for abuse

   **Action Items:**
   - Fix root cause ASAP
   - Redeploy security fix within 24 hours
   - Monitor for cross-tenant booking attempts

   **Monitoring:**
   - Watch for unusual booking patterns
   - Alert on cross-clinic bookings with same phone
   ```

4. **Fix and redeploy ASAP:**
   - Identify root cause
   - Fix the issue
   - Test thoroughly
   - Redeploy within 24 hours

---

## Post-Migration Review

After 7 days post-deployment:

1. **Analyze rejection rate trend:**
   - Should be < 2% by day 7
   - Document any anomalies

2. **Review security incidents:**
   - Count cross-tenant attempts
   - Identify patterns
   - Improve detection

3. **User feedback:**
   - Review support tickets
   - Identify pain points
   - Improve documentation

4. **Update runbook:**
   - Add lessons learned
   - Improve procedures
   - Update escalation paths

---

## Related Documentation

- [Deployment Guide](../deployment-phase1-security-fixes.md)
- [Monitoring Guide](../monitoring-phase1-security-fixes.md)
- [Design Document](.kiro/specs/phase-1-critical-security-fixes/design.md)
- [Bugfix Requirements](.kiro/specs/phase-1-critical-security-fixes/bugfix.md)

---

**Runbook Version:** 1.0  
**Last Updated:** 2026-05-01  
**Owner:** Engineering Team  
**Next Review:** 7 days post-deployment
