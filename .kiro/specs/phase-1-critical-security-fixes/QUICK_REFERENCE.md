# Phase 1 Security Fixes - Quick Reference Guide

## For Developers

### AI Endpoints - Token Budget Enforcement

**Before making AI calls, always check budget:**

```typescript
import { checkAiTokenBudget } from "@/lib/ai-budget";

// Check budget before AI call
const budgetCheck = await checkAiTokenBudget(clinicId, userRole);
if (!budgetCheck.allowed) {
  return apiRateLimited(
    `AI token budget exceeded. ${budgetCheck.remainingTokens} tokens remaining.`,
    "AI_BUDGET_EXCEEDED"
  );
}

// Make AI call...
const response = await openai.chat.completions.create({...});

// Increment token usage after successful call
await incrementAiTokenUsage(clinicId, response.usage.total_tokens);
```

**Token Limits by Role:**
- Patient: 10,000 tokens/month
- Doctor: 50,000 tokens/month
- Receptionist: 30,000 tokens/month
- Clinic Admin: 100,000 tokens/month

---

### Booking Tokens - New Format

**Old Format (DEPRECATED):**
```
phone:expiry:signature
```

**New Format (REQUIRED):**
```
clinicId:phone:expiry:signature
```

**Token Generation:**
```typescript
import { hmacSha256Hex } from "@/lib/crypto-utils";

const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
const payload = `${clinicId}:${phone}:${expiry}`;
const signature = await hmacSha256Hex(secret, payload);
const token = `${payload}:${signature}`;
```

**Token Verification:**
```typescript
const parts = token.split(":");
if (parts.length !== 4) {
  return apiError("Invalid or expired booking link. Please request a new one.");
}

const [tokenClinicId, phone, expiry, signature] = parts;

// CRITICAL: Check clinicId BEFORE signature verification
if (tokenClinicId !== expectedClinicId) {
  logger.warn("Cross-tenant booking token attempt", {
    context: "booking/verify",
    tokenClinicId,
    expectedClinicId,
  });
  return apiForbidden("Invalid booking token");
}

// Then verify signature...
```

---

### File Uploads - Ownership Tracking

**After successful upload, track ownership:**

```typescript
import { createClient } from "@/lib/supabase-server";

// After R2 upload succeeds...
const supabase = await createClient();

// Extract patient_id from R2 key if present
const patientIdMatch = r2Key.match(/\/patients\/([0-9a-fA-F-]{36})\//);
const patientId = patientIdMatch ? patientIdMatch[1] : null;

if (patientId) {
  try {
    await supabase.from("patient_files").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      r2_key: r2Key,
      content_type: file.type,
      uploaded_by: profile.id,
    });
  } catch (error) {
    // Log but don't fail upload
    logger.warn("Failed to track file ownership", {
      context: "upload/track-ownership",
      clinicId,
      patientId,
      error,
    });
  }
}
```

**File Download Authorization:**
```typescript
// Query patient_files table for authorization
const { data: fileRecord } = await supabase
  .from("patient_files")
  .select("*")
  .eq("clinic_id", clinicId)
  .eq("r2_key", r2Key)
  .single();

if (!fileRecord) {
  return apiNotFound("File not found");
}

// Patients can only download own files
if (profile.role === "patient" && fileRecord.patient_id !== profile.id) {
  return apiForbidden("Access denied");
}

// Staff can download all clinic files (already verified by clinic_id match)
```

---

### Logging - PII Redaction

**NEVER log PII directly:**

```typescript
// ❌ BAD - Logs PII
logger.info("User registered", {
  email: user.email,
  phone: user.phone,
  name: user.name,
});

// ✅ GOOD - Logs only UUIDs
logger.info("User registered", {
  context: "registration",
  userId: user.id,
  clinicId: user.clinic_id,
});
```

**Automatic Redaction:**
The logger automatically redacts these fields:
- email, phone, name, full_name, first_name, last_name
- doctor_name, clinic_name, owner_name, patient_name
- emergency_contact, next_of_kin, patient_address, address

**Audit Logs:**
Run weekly to check for PII leaks:
```bash
npm run audit:pii-logs --days 7 --format json --output audit-report.json
```

---

### Webhook Signatures - Timing-Safe Comparison

**Always use `timingSafeEqual()` for signature verification:**

```typescript
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";

// ❌ BAD - Vulnerable to timing attacks
if (computedSignature === receivedSignature) {
  // ...
}

// ✅ GOOD - Timing-safe comparison
if (timingSafeEqual(computedSignature, receivedSignature)) {
  // ...
}
```

**Signature Length Limit:**
`timingSafeEqual()` automatically rejects signatures >1024 bytes to prevent DoS attacks.

---

## For DevOps

### Database Migrations

**Run in order:**
```bash
# 1. AI Token Budget
psql -f supabase/migrations/00073_ai_token_budget.sql

# 2. Patient Files Ownership
psql -f supabase/migrations/00074_patient_files_ownership.sql
```

### Backfill Scripts

**Patient Files Ownership:**
```bash
# Run BEFORE deploying code changes
npm run backfill:patient-files

# Options:
# --dry-run: Preview changes without applying
# --batch-size: Number of files to process per batch (default: 100)
```

### Monitoring Setup

**Required Alerts:**
1. PII detected in logs (CRITICAL)
2. AI budget exceeded >10% clinics (HIGH)
3. Booking token rejection rate >5% (MEDIUM)
4. File authorization failure spike (MEDIUM)

**Dashboards:**
- AI token usage by clinic
- Booking token metrics
- File authorization metrics
- PII redaction counts

---

## For QA

### Test Scenarios

**AI Token Budget:**
- [ ] Request with usage under limit succeeds
- [ ] Request with usage over limit returns 429
- [ ] Monthly reset works correctly
- [ ] Role-based limits enforced

**Booking Tokens:**
- [ ] Token from clinic A rejected by clinic B
- [ ] Token from clinic A accepted by clinic A
- [ ] Old 3-part tokens rejected with friendly error
- [ ] Expired tokens rejected

**File Authorization:**
- [ ] Patient can download own file
- [ ] Patient cannot download other patient's file
- [ ] Doctor can download any file in clinic
- [ ] Receptionist can download any file in clinic
- [ ] Super admin can download any file

**PII Logging:**
- [ ] Registration logs contain no email/phone/name
- [ ] Only UUIDs present in logs
- [ ] Audit script detects PII if present

**Webhook Signatures:**
- [ ] Oversized signature rejected
- [ ] Valid signature accepted
- [ ] Invalid signature rejected
- [ ] Timing attack resistant

---

## For Security Team

### Vulnerability Status

| ID | Vulnerability | Status | Fix |
|----|--------------|--------|-----|
| A1-01 | AI Input Validation | ✅ Fixed | Token budget + input limits |
| A6-13 | Booking Token Tenant Binding | ✅ Fixed | 4-part token format |
| A7-01 | File Download Authorization | ✅ Fixed | Ownership tracking + RLS |
| A8-01 | PII Logging Redaction | ✅ Fixed | Auto-redaction + audit script |
| A2-02 | Timing-Safe Compare DoS | ✅ Fixed | Length limits + constant-time |

### Compliance Checklist

**GDPR / Law 09-08:**
- [x] PII redaction implemented
- [x] Audit logging in place
- [x] File access controls enforced
- [x] Weekly PII audit available

**Security Best Practices:**
- [x] Input validation on all endpoints
- [x] Rate limiting via token budgets
- [x] Timing-safe cryptographic comparisons
- [x] Defense-in-depth (application + RLS)
- [x] Comprehensive test coverage

### Penetration Testing Recommendations

**Test Vectors:**
1. AI token exhaustion via large prompts
2. Cross-tenant booking token reuse
3. Unauthorized file access attempts
4. PII extraction from logs
5. Timing attacks on webhook signatures
6. DoS via oversized webhook signatures

---

## Rollback Procedure

### If Issues Arise

**Code Rollback:**
```bash
# Revert to previous deployment
git revert <commit-hash>
npm run deploy
```

**Database Rollback:**
```sql
-- Rollback AI token budget (if needed)
ALTER TABLE clinics DROP COLUMN ai_monthly_tokens;
ALTER TABLE clinics DROP COLUMN ai_tokens_reset_at;
DROP FUNCTION increment_ai_tokens;

-- Rollback patient files (if needed)
DROP TABLE patient_files;
```

**⚠️ Warning**: Database rollback will lose tracking data. Only rollback if critical issues arise.

---

## Support Contacts

**For Questions:**
- Security Team: security@oltigo.health
- DevOps Team: devops@oltigo.health
- Development Team: dev@oltigo.health

**For Incidents:**
- PII Leak: Immediate escalation to Security Team
- Service Outage: DevOps Team
- Bug Reports: Development Team

---

**Last Updated**: 2026-05-05  
**Version**: 1.0  
**Status**: Ready for Deployment