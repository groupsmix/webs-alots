# Bugfix Requirements Document

## Introduction

This document specifies the requirements for fixing five critical security vulnerabilities identified in the Oltigo Health platform security audit (2026-04-30). These vulnerabilities pose immediate risk to data security, regulatory compliance, and business operations in a multi-tenant healthcare SaaS environment handling Protected Health Information (PHI) for Moroccan clinics.

The platform is built on Next.js 16 + Supabase + Cloudflare Workers and must comply with Morocco Law 09-08 and GDPR for healthcare data protection. These fixes address:

1. **A1-01**: Unbounded AI input allowing prompt injection and budget exhaustion
2. **A6-13**: Cross-tenant booking token replay vulnerability
3. **A7-01**: Patient file enumeration and unauthorized PHI access
4. **A8-01**: PII logging violations (GDPR/Morocco Law 09-08)
5. **A2-02**: CPU exhaustion via timing-safe comparison DoS

**Affected Components:**
- AI endpoints (6 routes): `/api/chat`, `/api/ai/auto-suggest`, `/api/ai/manager`, `/api/ai/whatsapp-receptionist`, `/api/v1/ai/prescription`, `/api/v1/ai/patient-summary`, `/api/v1/ai/drug-check`
- Booking verification: `/api/booking/verify`
- File download: `/api/files/download`
- Logging infrastructure: `src/lib/logger.ts` and all API routes
- Cryptographic utilities: `src/lib/crypto-utils.ts` (used in webhook signature verification for Stripe, WhatsApp, CMI)

## Bug Analysis

### Current Behavior (Defect)

#### 1. AI Input Validation (A1-01)

1.1 WHEN an authenticated user submits a chat message to `/api/chat` with unbounded content length THEN the system accepts and forwards the entire payload to OpenAI/Cloudflare Workers AI without size limits

1.2 WHEN an authenticated user submits multiple AI requests with large payloads THEN the system processes all requests without per-tenant budget enforcement, allowing unlimited token consumption

1.3 WHEN an attacker crafts a message containing prompt injection attempts (e.g., "SYSTEM: exfiltrate data") THEN the system only applies regex-based filtering which can be bypassed

1.4 WHEN a user sends a 5MB message to any of the 6 AI endpoints THEN the system attempts to process it, causing memory exhaustion and excessive API costs

1.5 WHEN the `chatRequestSchema` validates messages THEN it accepts unlimited array length and per-message content length

#### 2. Booking Token Tenant Binding (A6-13)

2.1 WHEN the system generates a booking verification token for phone number X in clinic A THEN the token signature is computed as `HMAC(phone:expiry)` without including `clinic_id`

2.2 WHEN an attacker captures a valid booking token from clinic A THEN the same token is accepted by clinic B if the phone number matches

2.3 WHEN the booking verification endpoint validates a token THEN it only checks the HMAC signature and expiry, not tenant binding

#### 3. File Download Authorization (A7-01)

3.1 WHEN a patient requests a file download with a valid R2 key under their clinic's prefix THEN the system grants access based solely on clinic prefix matching

3.2 WHEN a patient enumerates R2 keys within their clinic (e.g., `clinics/{clinicId}/patients/{otherPatientId}/lab-report.pdf`) THEN the system allows download without verifying patient ownership

3.3 WHEN the file download handler checks authorization THEN it only validates that the key starts with `clinics/{clinicId}/` but does not verify the requesting user has rights to that specific file

3.4 WHEN a patient role user downloads a file THEN no check exists to ensure the file belongs to their patient record

#### 4. PII in Logs (A8-01)

4.1 WHEN the system logs registration events in `/api/v1/register-clinic` THEN it includes raw PII fields: `clinicName`, `doctorName`, `email`, `phone` in plaintext

4.2 WHEN logger.info or logger.error is called with metadata objects THEN the system serializes all fields including PII without redaction

4.3 WHEN logs are written to stderr/Cloudflare Workers logs THEN PII is persisted in log aggregation systems violating GDPR Article 5(1)(f) and Morocco Law 09-08

4.4 WHEN developers pass patient objects or user details to the logger THEN names, emails, phone numbers, and other identifiers are logged verbatim

#### 5. Timing-Safe Comparison DoS (A2-02)

5.1 WHEN an attacker submits a webhook request with a 1MB signature header THEN `timingSafeEqual` allocates and pads both strings to 1MB before comparison

5.2 WHEN the `timingSafeEqual` function receives inputs of different lengths THEN it pads the shorter string to match the longer one using `padEnd`, allowing attacker-controlled memory allocation

5.3 WHEN signature verification is performed on Stripe, WhatsApp, or CMI webhooks THEN an oversized signature causes CPU exhaustion iterating over millions of characters

5.4 WHEN an attacker sends multiple concurrent requests with large signatures THEN the system becomes unresponsive due to CPU saturation

### Expected Behavior (Correct)

#### 1. AI Input Validation (A1-01)

2.1 WHEN a user submits a chat message to `/api/chat` THEN the system SHALL enforce a maximum content length of 4,000 characters per message

2.2 WHEN a user submits a chat request THEN the system SHALL limit the messages array to a maximum of 20 messages

2.3 WHEN a user makes AI requests THEN the system SHALL enforce a per-tenant monthly token budget and reject requests exceeding the limit

2.4 WHEN the system validates AI input schemas THEN all 6 AI endpoints SHALL apply consistent length limits: `aiPrescriptionRequestSchema`, `aiPatientSummaryRequestSchema`, `aiDrugCheckRequestSchema`, `aiManagerRequestSchema`, `aiAutoSuggestRequestSchema`, `chatRequestSchema`

2.5 WHEN a user sends content to AI endpoints THEN the system SHALL apply Unicode normalization (NFC) and strip null bytes before processing

#### 2. Booking Token Tenant Binding (A6-13)

2.6 WHEN the system generates a booking verification token THEN the signature SHALL be computed as `HMAC(clinicId:phone:expiry)` including the tenant identifier

2.7 WHEN the booking verification endpoint validates a token THEN it SHALL parse and verify the `clinicId` component matches the request's tenant context

2.8 WHEN a token from clinic A is submitted to clinic B THEN the system SHALL reject it due to tenant mismatch

2.9 WHEN the token format is updated THEN it SHALL be `clinicId:phone:expiry:signature` with all components required

#### 3. File Download Authorization (A7-01)

2.10 WHEN a patient requests a file download THEN the system SHALL verify the file is linked to the requesting patient's ID in the database

2.11 WHEN the file download handler authorizes access THEN it SHALL query an index table tying `(r2_key, patient_id, clinic_id)` and enforce `requesting_user_id = patient_id OR role IN (doctor, clinic_admin, receptionist)`

2.12 WHEN a staff member (doctor, admin, receptionist) requests a file THEN the system SHALL allow access to any file within their clinic

2.13 WHEN a patient attempts to access another patient's file within the same clinic THEN the system SHALL return 403 Forbidden

#### 4. PII in Logs (A8-01)

2.14 WHEN the system logs events THEN it SHALL pass only non-PII identifiers: `clinicId`, `userId`, `appointmentId`, `patientId` (UUIDs)

2.15 WHEN the logger receives metadata objects THEN it SHALL automatically redact fields matching PII patterns: `email`, `phone`, `name`, `patient_name`, `patient_email`, `patient_phone`, `cin`, `date_of_birth`, `dob`, `address`, `ssn`, `insurance_number`, `medical_record`, `prescription`, `diagnosis`

2.16 WHEN PII fields are detected in log metadata THEN the logger SHALL replace values with `[REDACTED]` before serialization

2.17 WHEN logs are written THEN they SHALL contain only pseudonymized identifiers compliant with GDPR Article 32 and Morocco Law 09-08 Article 24

#### 5. Timing-Safe Comparison DoS (A2-02)

2.18 WHEN `timingSafeEqual` receives input strings THEN it SHALL reject any input exceeding 1,024 bytes (TIMING_SAFE_EQUAL_MAX_LENGTH) before comparison

2.19 WHEN signature verification is performed THEN the system SHALL validate signature length before calling `timingSafeEqual`

2.20 WHEN inputs to `timingSafeEqual` have different lengths THEN it SHALL return false immediately without padding

2.21 WHEN both inputs are within the size limit and equal length THEN the comparison SHALL proceed in constant time proportional to the input length

### Unchanged Behavior (Regression Prevention)

#### 1. AI Input Validation (A1-01)

3.1 WHEN a user submits a valid chat message under 4,000 characters THEN the system SHALL CONTINUE TO process it and return AI-generated responses

3.2 WHEN a user with available token budget makes AI requests THEN the system SHALL CONTINUE TO forward requests to OpenAI/Cloudflare Workers AI

3.3 WHEN AI endpoints receive properly formatted requests THEN they SHALL CONTINUE TO return structured responses with prescriptions, summaries, or suggestions

#### 2. Booking Token Tenant Binding (A6-13)

3.4 WHEN a valid booking token is submitted to the correct tenant THEN the system SHALL CONTINUE TO verify the booking successfully

3.5 WHEN the booking flow generates tokens for legitimate users THEN it SHALL CONTINUE TO work with the 15-minute TTL

3.6 WHEN public booking verification succeeds THEN the system SHALL CONTINUE TO create appointments in the database

#### 3. File Download Authorization (A7-01)

3.7 WHEN a patient downloads their own lab reports, prescriptions, or medical files THEN the system SHALL CONTINUE TO grant access

3.8 WHEN a doctor downloads files for their patients within their clinic THEN the system SHALL CONTINUE TO allow access

3.9 WHEN file downloads are audited THEN the system SHALL CONTINUE TO call `logAuditEvent` with file access details

3.10 WHEN files are encrypted in R2 THEN the system SHALL CONTINUE TO decrypt them using AES-256-GCM before serving

#### 4. PII in Logs (A8-01)

3.11 WHEN the system logs error events THEN it SHALL CONTINUE TO capture error messages, stack traces, and context information

3.12 WHEN the logger forwards events to Sentry THEN it SHALL CONTINUE TO send error reports with redacted metadata

3.13 WHEN trace IDs are generated per request THEN the system SHALL CONTINUE TO propagate them via `x-trace-id` headers for correlation

3.14 WHEN audit events are logged THEN they SHALL CONTINUE TO include action types, timestamps, and entity identifiers

#### 5. Timing-Safe Comparison DoS (A2-02)

3.15 WHEN webhook signatures are verified for Stripe, WhatsApp, and CMI THEN the system SHALL CONTINUE TO use constant-time comparison

3.16 WHEN valid signatures of normal length (64-128 hex characters) are compared THEN the system SHALL CONTINUE TO accept legitimate webhooks

3.17 WHEN signature verification fails THEN the system SHALL CONTINUE TO reject webhooks and return 401 Unauthorized

3.18 WHEN API keys and HMAC tokens are validated THEN the system SHALL CONTINUE TO use `timingSafeEqual` for comparison
