# Implementation Tasks: Phase 1 Critical Security Fixes

## Task 1: AI Input Validation & Token Budget Enforcement (A1-01)

**Priority:** CRITICAL  
**Estimated Time:** 4 hours  
**Dependencies:** None

### Subtasks:

- [x] 1.1 Update validation schemas in `src/lib/validations.ts`
  - Add `CHAT_MESSAGE_CONTENT_MAX = 4000` constant
  - Add `CHAT_MESSAGES_ARRAY_MAX = 20` constant
  - Update `chatRequestSchema` with `.max()` constraints
  - Update `aiPrescriptionRequestSchema` with `.max(2000)` on diagnosis/symptoms
  - Update `aiManagerRequestSchema` with `.max(2000)` on question/history
  - Update `aiAutoSuggestRequestSchema` with `.max(2000)` on diagnosis
  - Update `aiPatientSummaryRequestSchema` (verify no unbounded fields)
  - Update `aiDrugCheckRequestSchema` with `.max(200)` on medication names

- [x] 1.2 Create AI token budget module `src/lib/ai-budget.ts`
  - Define `AI_TOKEN_LIMITS` constant (patient: 10k, doctor: 50k, etc.)
  - Implement `checkAiTokenBudget()` function
  - Implement `incrementAiTokenUsage()` function
  - Add proper error handling and logging

- [x] 1.3 Create database migration `supabase/migrations/00073_ai_token_budget.sql`
  - Add `ai_monthly_tokens` column to `clinics` table
  - Add `ai_tokens_reset_at` column to `clinics` table
  - Create `increment_ai_tokens()` RPC function (SECURITY DEFINER)
  - Grant execute permission to authenticated role

- [x] 1.4 Update AI route handlers (6 files)
  - `src/app/api/chat/route.ts`: Add budget check before AI call
  - `src/app/api/ai/auto-suggest/route.ts`: Add budget check
  - `src/app/api/ai/manager/route.ts`: Add budget check
  - `src/app/api/ai/whatsapp-receptionist/route.ts`: Add budget check
  - `src/app/api/v1/ai/prescription/route.ts`: Add budget check
  - `src/app/api/v1/ai/patient-summary/route.ts`: Add budget check
  - `src/app/api/v1/ai/drug-check/route.ts`: Add budget check
  - Increment token usage after successful AI response

- [x] 1.5 Write unit tests for AI budget enforcement
  - Test budget check with usage under limit
  - Test budget check with usage over limit
  - Test monthly reset logic
  - Test role-based limits
  - Property-based test: any request > role limit is rejected

- [x] 1.6 Write integration tests for validation
  - Test chat endpoint rejects content > 4000 chars
  - Test chat endpoint rejects messages array > 20 items
  - Test all AI endpoints reject oversized input
  - Test budget exceeded returns 429 with remaining tokens

---

## Task 2: Booking Token Tenant Binding (A6-13)

**Priority:** CRITICAL  
**Estimated Time:** 2 hours  
**Dependencies:** None  
**⚠️ BREAKING CHANGE:** Invalidates existing booking tokens

### Subtasks:

- [x] 2.1 Update token generation in `src/app/api/booking/verify/route.ts`
  - Change signature computation to include `clinicId`
  - Change token format to `clinicId:phone:expiry:signature`
  - Update response to include new token format
  - Add logging for token generation

- [x] 2.2 Update token verification logic
  - Locate token verification function (likely in `src/app/api/booking/route.ts` or `src/lib/booking-utils.ts`)
  - Parse 4-part token format
  - Verify `tokenClinicId === expectedClinicId` BEFORE signature check
  - Log cross-tenant rejection attempts
  - Return 403 for tenant mismatch

- [x] 2.3 Add backward compatibility handling
  - Detect old 3-part token format
  - Return user-friendly error: "Your booking link has expired. Please request a new one."
  - Log old token format usage for monitoring

- [x] 2.4 Write unit tests for token generation
  - Test token includes clinicId
  - Test token signature is valid
  - Test token expiry is set correctly

- [x] 2.5 Write integration tests for tenant isolation
  - Test token from clinic A rejected by clinic B
  - Test token from clinic A accepted by clinic A
  - Test old format tokens rejected with friendly error
  - Test expired tokens rejected

- [x] 2.6 Update user-facing error messages
  - Add clear messaging for expired/invalid tokens
  - Add instructions to request new token

---

## Task 3: File Download Authorization (A7-01)

**Priority:** CRITICAL  
**Estimated Time:** 3 hours  
**Dependencies:** None

### Subtasks:

- [x] 3.1 Create database migration `supabase/migrations/00074_patient_files_ownership.sql`
  - Create `patient_files` table with columns: id, clinic_id, patient_id, r2_key, content_type, uploaded_at, uploaded_by
  - Add foreign key constraints
  - Add unique constraint on (clinic_id, r2_key)
  - Create indexes on patient_id and r2_key
  - Enable RLS
  - Create RLS policy for SELECT (patient sees own, staff sees all in clinic)
  - Create RLS policy for INSERT (staff only)

- [x] 3.2 Update file upload confirmation `src/app/api/files/upload-confirm/route.ts`
  - After successful upload, insert record into `patient_files`
  - For patient uploads: use profile.id as patient_id
  - For staff uploads: extract patient_id from R2 key path
  - Handle errors gracefully (log but don't fail upload)

- [x] 3.3 Verify file download authorization (already implemented)
  - Review `src/app/api/files/download/route.ts` lines 95-120
  - Confirm patient_files table query is correct
  - Confirm staff bypass logic works
  - Confirm audit logging includes ownership check

- [x] 3.4 Create backfill script for existing files (optional)
  - Script to populate `patient_files` for existing R2 objects
  - Parse R2 keys to extract patient_id
  - Insert records with uploaded_by = NULL (legacy)
  - Run in staging first

- [x] 3.5 Write unit tests for ownership tracking
  - Test patient upload creates patient_files record
  - Test staff upload creates patient_files record with extracted patient_id
  - Test staff upload without patient_id in key (no record created)

- [x] 3.6 Write integration tests for authorization
  - Test patient can download own file
  - Test patient cannot download other patient file (403)
  - Test doctor can download any file in clinic
  - Test receptionist can download any file in clinic
  - Test super_admin can download any file

---

## Task 4: PII Logging Redaction (A8-01)

**Priority:** CRITICAL  
**Estimated Time:** 2 hours  
**Dependencies:** None

### Subtasks:

- [x] 4.1 Enhance PII field patterns in `src/lib/logger.ts`
  - Add missing patterns: "full_name", "doctor_name", "clinic_name", "owner_name"
  - Add "emergency_contact", "next_of_kin", "patient_address"
  - Verify `redactPhi()` function handles nested objects
  - Verify `redactPhi()` function handles arrays

- [x] 4.2 Audit all logger calls for PII
  - Run: `grep -rn "logger\.(info|warn|error)" src/app/api/ | grep -E "(email|phone|name|patient)"`
  - Review each match and remove PII from metadata
  - Replace with UUIDs: clinicId, userId, patientId, appointmentId
  - Document pattern in AGENTS.md

- [x] 4.3 Fix high-priority PII logging violations
  - `src/app/api/v1/register-clinic/route.ts`: Remove clinicName, doctorName, email, phone
  - Any other routes identified in audit
  - Replace with: `{ clinicId, userId }` only

- [x] 4.4 Write unit tests for PII redaction
  - Test email field is redacted
  - Test phone field is redacted
  - Test name field is redacted
  - Test nested objects are redacted
  - Test arrays of objects are redacted
  - Test non-PII fields pass through unchanged

- [x] 4.5 Write log output verification test
  - Capture logger output in test
  - Assert no email regex matches: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/`
  - Assert no phone regex matches: `/\+?[0-9]{6,}/`
  - Assert UUIDs are present

- [x] 4.6 Create log audit script
  - Script to scan production logs for PII patterns
  - Run weekly as compliance check
  - Alert if PII detected

---

## Task 5: Timing-Safe Compare DoS Protection (A2-02)

**Priority:** HIGH  
**Estimated Time:** 1 hour  
**Dependencies:** None  
**Status:** Already implemented, needs verification

### Subtasks:

- [x] 5.1 Verify `timingSafeEqual()` implementation in `src/lib/crypto-utils.ts`
  - Confirm `TIMING_SAFE_EQUAL_MAX_LENGTH = 1024` is defined
  - Confirm length check happens before any processing
  - Confirm no padding allocations occur
  - Confirm constant-time comparison loop

- [x] 5.2 Audit all webhook signature verification calls
  - `src/app/api/webhooks/route.ts` (WhatsApp)
  - `src/app/api/payments/webhook/route.ts` (Stripe)
  - `src/app/api/payments/cmi/route.ts` (CMI)
  - Confirm all use `timingSafeEqual()`
  - Confirm no direct string comparison (`===`)

- [x] 5.3 Write unit tests for length validation
  - Test inputs under 1024 bytes accepted
  - Test inputs over 1024 bytes rejected
  - Test different length inputs rejected
  - Test equal length inputs compared correctly

- [x] 5.4 Write performance tests
  - Benchmark comparison time for various input sizes
  - Verify time is linear in input length
  - Verify no exponential blowup

- [x] 5.5 Write integration tests for webhook handlers
  - Test WhatsApp webhook with oversized signature (rejected)
  - Test Stripe webhook with oversized signature (rejected)
  - Test CMI callback with oversized hash (rejected)
  - Test legitimate webhooks still work

---

## Task 6: Integration Testing & E2E Verification

**Priority:** HIGH  
**Estimated Time:** 3 hours  
**Dependencies:** Tasks 1-5 complete

### Subtasks:

- [x] 6.1 Write E2E test for AI input validation
  - Test chat endpoint rejects 5000 char message
  - Test AI prescription endpoint rejects 3000 char diagnosis
  - Test AI manager endpoint rejects 2500 char question

- [x] 6.2 Write E2E test for AI token budget
  - Create test clinic with low budget
  - Make AI requests until budget exhausted
  - Verify 429 response with remaining tokens
  - Verify subsequent requests rejected

- [x] 6.3 Write E2E test for booking token isolation
  - Generate token for clinic A
  - Attempt to use in clinic B
  - Verify 403 response
  - Verify audit log entry

- [x] 6.4 Write E2E test for file authorization
  - Login as patient A
  - Upload file
  - Login as patient B (same clinic)
  - Attempt to download patient A's file
  - Verify 403 response

- [x] 6.5 Write E2E test for PII logging
  - Trigger registration flow
  - Capture logs
  - Assert no email/phone/name in logs
  - Assert only UUIDs present

- [x] 6.6 Run full E2E test suite
  - Verify no regressions in existing tests
  - Verify all new tests pass
  - Document any failures

---

## Task 7: Deployment & Monitoring

**Priority:** HIGH  
**Estimated Time:** 2 hours  
**Dependencies:** Tasks 1-6 complete

### Subtasks:

- [ ] 7.1 Deploy database migrations to staging
  - Run migration 00073 (AI token budget)
  - Run migration 00074 (patient_files)
  - Verify migrations applied successfully
  - Verify no data loss

- [ ] 7.2 Deploy code to staging
  - Deploy all code changes
  - Run smoke tests
  - Verify AI endpoints work
  - Verify booking flow works
  - Verify file downloads work

- [ ] 7.3 Run staging verification tests
  - Test AI input validation
  - Test AI token budget enforcement
  - Test booking token tenant isolation
  - Test file download authorization
  - Test PII redaction in logs

- [ ] 7.4 Deploy to production
  - Deploy database migrations
  - Deploy code changes
  - Monitor error rates for 1 hour
  - Monitor AI budget exhaustion events
  - Monitor booking token rejection rate

- [ ] 7.5 Set up monitoring dashboards
  - Create dashboard for AI budget metrics
  - Create dashboard for booking token rejections
  - Create dashboard for file authorization failures
  - Create dashboard for PII redaction counts

- [ ] 7.6 Set up alerts
  - Alert on PII detected in logs (CRITICAL)
  - Alert on AI budget exceeded > 10% clinics (HIGH)
  - Alert on booking token rejection rate > 5% (MEDIUM)
  - Alert on file authorization failure spike (MEDIUM)

---

## Task 8: Documentation & Runbooks

**Priority:** MEDIUM  
**Estimated Time:** 2 hours  
**Dependencies:** Tasks 1-7 complete

### Subtasks:

- [ ] 8.1 Update AGENTS.md
  - Document AI token limits per role
  - Document booking token format change
  - Document file ownership tracking
  - Document PII logging patterns

- [ ] 8.2 Create AI budget runbook
  - How to check clinic token usage
  - How to increase clinic budget (if needed)
  - How to reset monthly counter
  - Troubleshooting budget exhaustion

- [ ] 8.3 Create booking token migration runbook
  - How to identify old token format errors
  - How to communicate with users
  - How to monitor rejection rate
  - Rollback procedure

- [ ] 8.4 Create file authorization runbook
  - How to debug authorization failures
  - How to backfill patient_files table
  - How to verify ownership records
  - Troubleshooting RLS policies

- [ ] 8.5 Create PII logging incident response runbook
  - How to detect PII in logs
  - How to purge PII from log systems
  - How to notify affected users (GDPR)
  - How to prevent recurrence

- [ ] 8.6 Update API documentation
  - Document AI token limits in API docs
  - Document booking token format
  - Document file download authorization
  - Document error codes and messages

---

## Summary

**Total Tasks:** 8  
**Total Subtasks:** 60  
**Estimated Total Time:** 19 hours  
**Critical Path:** Tasks 1-5 (core fixes) → Task 6 (testing) → Task 7 (deployment)

**Deployment Order:**
1. Database migrations (Tasks 1.3, 3.1)
2. Code deployment (Tasks 1.1-1.4, 2.1-2.2, 3.2, 4.1-4.3)
3. Verification (Task 6)
4. Monitoring setup (Task 7.5-7.6)
5. Documentation (Task 8)

**Risk Mitigation:**
- Task 2 is BREAKING CHANGE → deploy during low-traffic window
- Task 3 requires backfill → run script before code deployment
- Task 4 requires audit → complete before deployment
- All tasks have rollback procedures documented
