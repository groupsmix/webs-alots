# API Security Updates - Phase 1 Critical Fixes

## Overview

This document describes the security updates deployed in Phase 1 Critical Security Fixes, including breaking changes, new error codes, and updated API behaviors.

**Deployment Date:** 2026-05-01  
**Version:** 1.0.0  
**Breaking Changes:** Yes (booking token format)

---

## Summary of Changes

| Vulnerability | Fix | Breaking Change | Impact |
|---------------|-----|-----------------|--------|
| A1-01 | AI input validation + token budget | No | 400/429 errors for invalid/excessive requests |
| A6-13 | Booking token tenant binding | **YES** | Old tokens invalidated |
| A7-01 | File download authorization | No | 403 errors for unauthorized access |
| A8-01 | PII logging redaction | No | No user-facing impact |
| A2-02 | Timing-safe compare DoS protection | No | 401 errors for oversized signatures |

---

## 1. AI Input Validation & Token Budget (A1-01)

### Changes

**Input Validation:**
- Chat messages: Max 4,000 characters per message
- Message arrays: Max 20 messages
- AI prompts: Max 2,000 characters
- All inputs: Unicode normalization (NFC) + null byte stripping

**Token Budget:**
- Monthly token limits enforced per role
- Budget checked before AI API calls
- Usage tracked and incremented after successful responses

### Affected Endpoints

1. `POST /api/chat`
2. `POST /api/ai/auto-suggest`
3. `POST /api/ai/manager`
4. `POST /api/ai/whatsapp-receptionist`
5. `POST /api/v1/ai/prescription`
6. `POST /api/v1/ai/patient-summary`
7. `POST /api/v1/ai/drug-check`

### New Error Responses

#### Validation Error (400)

```json
{
  "ok": false,
  "error": "Validation error: messages[0].content must be at most 4000 characters",
  "code": "VALIDATION_ERROR"
}
```

**Causes:**
- Message content > 4,000 characters
- Messages array > 20 items
- Prompt > 2,000 characters

**Resolution:**
- Reduce message length
- Send fewer messages
- Split large requests into multiple calls

#### Budget Exceeded (429)

```json
{
  "ok": false,
  "error": "AI token budget exceeded. 1,234 tokens remaining this month.",
  "code": "AI_BUDGET_EXCEEDED"
}
```

**Causes:**
- Monthly token limit reached for user's role
- Estimated request would exceed remaining budget

**Resolution:**
- Wait until next month (budget resets monthly)
- Contact support to increase limit
- Upgrade to higher tier

### Token Limits by Role

| Role | Monthly Limit | Typical Usage |
|------|---------------|---------------|
| Patient | 10,000 tokens | ~25 chat sessions |
| Receptionist | 20,000 tokens | ~50 auto-suggestions |
| Doctor | 50,000 tokens | ~125 prescriptions |
| Clinic Admin | 100,000 tokens | ~250 manager queries |
| Super Admin | 1,000,000 tokens | Platform management |

### Example Requests

**Valid Request:**

```bash
curl -X POST https://oltigo.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What are the symptoms of diabetes?"
      }
    ]
  }'
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "response": "Common symptoms of diabetes include...",
    "tokensUsed": 125,
    "tokensRemaining": 9875
  }
}
```

**Invalid Request (Too Long):**

```bash
curl -X POST https://oltigo.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"$(python3 -c 'print("A"*5000)')\"
    }]
  }"
```

**Response:**

```json
{
  "ok": false,
  "error": "Validation error: messages[0].content must be at most 4000 characters",
  "code": "VALIDATION_ERROR"
}
```

---

## 2. Booking Token Tenant Binding (A6-13)

### ⚠️ BREAKING CHANGE

**Old Token Format (DEPRECATED):**
```
phone:expiry:signature
+212600000000:1735689600:abc123def456...
```

**New Token Format (REQUIRED):**
```
clinicId:phone:expiry:signature
550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123def456...
```

### Changes

1. **Token Generation:** Includes `clinicId` in signature
2. **Token Verification:** Validates `clinicId` matches expected clinic
3. **Cross-Tenant Protection:** Tokens cannot be replayed across clinics
4. **Old Token Handling:** Returns user-friendly error message

### Affected Endpoints

1. `POST /api/booking/verify` - Token generation
2. `POST /api/booking` - Token verification and booking creation

### Migration Guide

**For Clinic Admins:**

1. **Delete old booking links** from your website, emails, SMS templates
2. **Generate new booking links:**
   - Go to Booking Management
   - Click "Generate Booking Link"
   - Copy and share new link
3. **Update saved links** in all communication channels

**For Developers:**

1. **Token generation** - No changes needed (automatic)
2. **Token verification** - No changes needed (automatic)
3. **Token storage** - Do NOT store tokens long-term (15-minute TTL)

### New Error Responses

#### Old Token Format (400)

```json
{
  "ok": false,
  "error": "Your booking link has expired due to a security update. Please request a new link from your clinic.",
  "code": "OLD_TOKEN_FORMAT"
}
```

**Causes:**
- Using token generated before 2026-05-01
- Token has 3 parts instead of 4

**Resolution:**
- Request new booking link from clinic
- Use newly generated token

#### Cross-Tenant Token (403)

```json
{
  "ok": false,
  "error": "This booking link is not valid for this clinic. Please request a new link.",
  "code": "CROSS_TENANT_TOKEN"
}
```

**Causes:**
- Token generated for Clinic A used on Clinic B subdomain
- Potential security attack

**Resolution:**
- Verify correct clinic subdomain
- Request new token from correct clinic

### Example Requests

**Token Generation:**

```bash
curl -X POST https://clinic-a.oltigo.com/api/booking/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+212600000000"
  }'
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "token": "550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123def456...",
    "expiresAt": "2026-05-01T10:30:00Z"
  }
}
```

**Token Verification (Valid):**

```bash
curl -X POST https://clinic-a.oltigo.com/api/booking \
  -H "Content-Type: application/json" \
  -d '{
    "token": "550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123...",
    "appointmentTime": "2026-05-02T10:00:00Z",
    "patientName": "Ahmed Hassan",
    "reason": "Consultation"
  }'
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "appointmentId": "123e4567-e89b-12d3-a456-426614174000",
    "appointmentTime": "2026-05-02T10:00:00Z",
    "status": "confirmed"
  }
}
```

**Token Verification (Cross-Tenant - Rejected):**

```bash
# Token from clinic-a used on clinic-b
curl -X POST https://clinic-b.oltigo.com/api/booking \
  -H "Content-Type: application/json" \
  -d '{
    "token": "550e8400-e29b-41d4-a716-446655440000:+212600000000:1735689600:abc123...",
    "appointmentTime": "2026-05-02T10:00:00Z",
    "patientName": "Ahmed Hassan",
    "reason": "Consultation"
  }'
```

**Response:**

```json
{
  "ok": false,
  "error": "This booking link is not valid for this clinic. Please request a new link.",
  "code": "CROSS_TENANT_TOKEN"
}
```

---

## 3. File Download Authorization (A7-01)

### Changes

1. **Ownership Tracking:** All files tracked in `patient_files` table
2. **Patient Authorization:** Can only download own files
3. **Staff Authorization:** Can download all clinic files
4. **Database Enforcement:** RLS policies enforce authorization

### Affected Endpoints

1. `GET /api/files/download` - File download
2. `POST /api/files/upload-confirm` - Upload confirmation (creates ownership record)

### New Error Responses

#### Unauthorized (403)

```json
{
  "ok": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Causes:**
- Patient attempting to download another patient's file
- File not found in `patient_files` table
- User not authenticated

**Resolution:**
- Verify file belongs to requesting user
- Contact clinic admin if file should be accessible
- Ensure file upload was confirmed successfully

#### File Not Found (404)

```json
{
  "ok": false,
  "error": "File not found",
  "code": "FILE_NOT_FOUND"
}
```

**Causes:**
- File doesn't exist in R2
- No ownership record in `patient_files` table
- Invalid R2 key

**Resolution:**
- Verify R2 key is correct
- Check if file was uploaded successfully
- Run backfill script if file exists but no ownership record

### Authorization Matrix

| User Role | Own Files | Other Patient Files (Same Clinic) | Other Clinic Files |
|-----------|-----------|-----------------------------------|-------------------|
| Patient | ✅ Yes | ❌ No | ❌ No |
| Doctor | ✅ Yes | ✅ Yes | ❌ No |
| Receptionist | ✅ Yes | ✅ Yes | ❌ No |
| Clinic Admin | ✅ Yes | ✅ Yes | ❌ No |
| Super Admin | ✅ Yes | ✅ Yes | ✅ Yes |

### Example Requests

**Patient Downloading Own File (Allowed):**

```bash
curl -X GET "https://oltigo.com/api/files/download?key=clinics/clinic-a-id/patients/patient-a-id/lab-report.pdf" \
  -H "Authorization: Bearer $PATIENT_A_TOKEN"
```

**Response:**

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="lab-report.pdf"

[PDF binary data]
```

**Patient Downloading Other Patient's File (Denied):**

```bash
curl -X GET "https://oltigo.com/api/files/download?key=clinics/clinic-a-id/patients/patient-b-id/lab-report.pdf" \
  -H "Authorization: Bearer $PATIENT_A_TOKEN"
```

**Response:**

```json
{
  "ok": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Doctor Downloading Any Clinic File (Allowed):**

```bash
curl -X GET "https://oltigo.com/api/files/download?key=clinics/clinic-a-id/patients/patient-b-id/lab-report.pdf" \
  -H "Authorization: Bearer $DOCTOR_TOKEN"
```

**Response:**

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="lab-report.pdf"

[PDF binary data]
```

---

## 4. PII Logging Redaction (A8-01)

### Changes

1. **Automatic Redaction:** Logger redacts PII fields automatically
2. **UUID-Only Logging:** Only UUIDs logged for identifiers
3. **Compliance:** GDPR Article 5(1)(f) and Morocco Law 09-08 compliant

### Redacted Fields

The following fields are automatically redacted in logs:

- `email`, `patient_email`, `doctor_email`
- `phone`, `patient_phone`, `emergency_contact`
- `name`, `patient_name`, `doctor_name`, `clinic_name`, `full_name`
- `cin`, `ssn`, `insurance_number`
- `date_of_birth`, `dob`
- `address`, `patient_address`, `billing_address`
- `medical_record`, `prescription`, `diagnosis`

### Allowed Fields

The following identifiers are allowed in logs:

- `clinicId` (UUID)
- `userId` (UUID)
- `patientId` (UUID)
- `appointmentId` (UUID)
- `traceId` (UUID)
- Timestamps
- Error codes
- HTTP status codes

### No User-Facing Changes

This change is internal only. Users will not see any difference in API behavior.

### Developer Guidelines

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

---

## 5. Timing-Safe Compare DoS Protection (A2-02)

### Changes

1. **Signature Length Limit:** Max 1,024 bytes
2. **Early Rejection:** Oversized signatures rejected before comparison
3. **No Padding:** Different-length inputs rejected immediately

### Affected Endpoints

1. `POST /api/webhooks/whatsapp` - WhatsApp webhook signature verification
2. `POST /api/payments/webhook` - Stripe webhook signature verification
3. `POST /api/payments/cmi` - CMI callback signature verification

### New Error Responses

#### Unauthorized (401)

```json
{
  "ok": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Causes:**
- Signature exceeds 1,024 bytes
- Signature verification failed
- Missing signature header

**Resolution:**
- Verify webhook signature is correct
- Check signature header format
- Contact support if legitimate webhook rejected

### No User-Facing Changes

This change only affects webhook handlers. Legitimate webhooks with normal-sized signatures (64-128 hex characters) are unaffected.

---

## Error Code Reference

### New Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `AI_BUDGET_EXCEEDED` | 429 | Monthly AI token limit reached | Wait for monthly reset or upgrade |
| `OLD_TOKEN_FORMAT` | 400 | Booking token uses deprecated format | Request new booking link |
| `CROSS_TENANT_TOKEN` | 403 | Booking token from different clinic | Use correct clinic subdomain |
| `FILE_NOT_FOUND` | 404 | File ownership record not found | Verify file exists and upload confirmed |
| `UNAUTHORIZED` | 403 | File access denied | Verify file ownership |

### Existing Error Codes (Unchanged)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Migration Checklist

### For Clinic Admins

- [ ] Generate new booking links
- [ ] Update website with new links
- [ ] Update email templates
- [ ] Update SMS templates
- [ ] Delete old booking links
- [ ] Test new booking flow

### For Developers

- [ ] Update API client libraries (if any)
- [ ] Handle new error codes (`AI_BUDGET_EXCEEDED`, `OLD_TOKEN_FORMAT`, `CROSS_TENANT_TOKEN`)
- [ ] Test AI endpoints with validation
- [ ] Test booking flow with new tokens
- [ ] Test file download authorization
- [ ] Update error handling logic

### For Operations

- [ ] Monitor AI budget exhaustion events
- [ ] Monitor booking token rejection rate
- [ ] Monitor file authorization failures
- [ ] Run PII log audit weekly
- [ ] Review security dashboards daily

---

## Support

### Documentation

- [Deployment Guide](./deployment-phase1-security-fixes.md)
- [Monitoring Guide](./monitoring-phase1-security-fixes.md)
- [AI Budget Runbook](./runbooks/ai-budget-exhaustion.md)
- [Booking Token Runbook](./runbooks/booking-token-migration.md)
- [File Authorization Runbook](./runbooks/file-authorization-debugging.md)
- [PII Logging Runbook](./runbooks/pii-logging-incident-response.md)

### Contact

- **Technical Support:** support@oltigo.com
- **Security Issues:** security@oltigo.com
- **API Questions:** api@oltigo.com

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Next Review:** After 1 month of production use
