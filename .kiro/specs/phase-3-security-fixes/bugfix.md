# Bugfix Requirements Document: Phase 3 Security Fixes

## Introduction

This document specifies the requirements for fixing the next batch of critical security vulnerabilities identified in the Oltigo Health platform security audit (2026-04-30). Following the completion of Phase 1 (critical vulnerabilities A1-01, A6-13, A7-01, A8-01, A2-02) and Phase 2 (infrastructure hardening A31-A60), this phase addresses 17 additional security findings across database integrity, input validation, resource management, and supply chain security.

The platform is built on Next.js 16 + Supabase + Cloudflare Workers and must comply with Morocco Law 09-08 and GDPR for healthcare data protection. These fixes address:

**MEDIUM Priority (8 findings):**
- **A2-03**: SECURITY DEFINER RPC validation regression risk
- **A2-04**: Unexplained CVE placeholder in package.json
- **A10-07**: HexToBytes exception on odd-length hex input
- **A12-02**: userRateBuckets map resource leak (DoS risk)
- **A12-04**: Subdomain cache unbounded growth
- **A16-03**: appointments table missing CHECK constraint (slot_end > slot_start)
- **A16-04**: services.price missing CHECK constraint (price >= 0)
- **A16-05**: time_slots missing UNIQUE constraint on (doctor_id, day_of_week, start_time)

**LOW Priority (9 findings):**
- **A2-01**: Dead code under feature flag (trade_license_base64)
- **A2-05**: postinstall script security risk
- **A2-08**: Feature flag surface area
- **A14-02**: bookingVerifySchema.phone regex validation
- **A14-03**: labReportSchema.results[].testName max length
- **A14-04**: NFC normalization for text fields
- **A14-05**: Null byte handling in Zod schemas
- **A14-06**: Locale cookie decodeURIComponent error handling

**Affected Components:**
- Database: `supabase/migrations/00072_booking_slot_advisory_lock.sql`, schema constraints for `appointments`, `services`, `time_slots` tables
- Cryptographic utilities: `src/lib/crypto-utils.ts` (hexToBytes function)
- Rate limiting: `src/lib/with-auth.ts` (userRateBuckets map)
- Subdomain resolution: `src/lib/subdomain-cache.ts`
- Input validation: `src/lib/validations.ts` (multiple schemas)
- Registration: `src/app/api/v1/register-clinic/route.ts`
- Package management: `package.json`
- Environment configuration: `.env.example`

## Bug Analysis

### Current Behavior (Defect)

#### 1. Database Integrity Issues (A16-03, A16-04, A16-05)

1.1 WHEN an appointment is created with slot_end <= slot_start THEN the database accepts the invalid time range without constraint violation

1.2 WHEN a service is created with a negative price value THEN the database accepts it without validation

1.3 WHEN multiple time_slots are created for the same doctor with identical (day_of_week, start_time) THEN the database allows duplicate slots without UNIQUE constraint enforcement

1.4 WHEN appointment queries filter by time ranges THEN invalid data (end before start) can cause incorrect results or application logic errors

1.5 WHEN billing calculations use service prices THEN negative prices can cause accounting errors and revenue loss

#### 2. SECURITY DEFINER RPC Validation (A2-03)

1.6 WHEN booking_atomic_insert RPC is called THEN it validates that doctor_id, service_id, and patient_id belong to the supplied clinic_id

1.7 WHEN a hostile author modifies the RPC THEN they could accidentally or maliciously remove validation checks without detection

1.8 WHEN cross-tenant booking attempts occur THEN the validation logic prevents unauthorized bookings, but this protection is not regression-tested

1.9 WHEN the RPC is granted to anon role THEN any validation regression would allow unauthenticated cross-tenant data insertion

#### 3. Cryptographic Exception Handling (A10-07)

1.10 WHEN hexToBytes receives an odd-length hex string THEN it uses non-null assertion on .match() result causing TypeError

1.11 WHEN webhook signature verification fails due to malformed hex THEN the exception bubbles to a 500 Internal Server Error instead of 401 Unauthorized

1.12 WHEN an attacker sends a malformed signature (odd-length hex) THEN the error exposes internal implementation details in the stack trace

1.13 WHEN hexToBytes is called from Stripe, WhatsApp, or CMI webhook handlers THEN odd-length input causes service disruption

#### 4. Resource Leak Issues (A12-02, A12-04)

1.14 WHEN userRateBuckets map reaches USER_RATE_MAX_KEYS (10,000) THEN no LRU eviction occurs, causing new legitimate users to be denied

1.15 WHEN an attacker generates requests with random user IDs THEN they can fill the userRateBuckets map and cause DoS

1.16 WHEN subdomain cache grows unbounded THEN memory consumption increases without size-based eviction

1.17 WHEN clinics rotate subdomains frequently THEN stale entries persist in cache without cleanup

1.18 WHEN Workers isolates restart THEN cache state is lost but no mechanism prevents unbounded growth in long-running isolates

#### 5. Supply Chain Security (A2-04, A2-05)

1.19 WHEN package.json documents postcss override rationale THEN it contains a literal "CVE-2024-XXXXX" placeholder instead of actual CVE identifier

1.20 WHEN a hostile reviewer modifies package.json THEN they could substitute a fake CVE ID to obscure malicious dependency pins

1.21 WHEN npm install runs THEN postinstall script executes scripts/patch-opennext.mjs automatically on every developer machine

1.22 WHEN dependency updates occur THEN malicious modifications to scripts/ directory would execute via postinstall without explicit review

#### 6. Feature Flag Security (A2-01, A2-08)

1.23 WHEN SELF_SERVICE_REGISTRATION_ENABLED flag is set THEN the registration endpoint accepts three verification modes including trade_license_base64

1.24 WHEN trade_license_base64 mode is selected THEN the code path exists but manual review workflow is not implemented

1.25 WHEN feature flags change security posture THEN no runtime startup assertion validates production flag configuration

1.26 WHEN an operator accidentally enables SELF_SERVICE_REGISTRATION_ENABLED in production THEN public registration opens without proper controls

#### 7. Input Validation Gaps (A14-02, A14-03, A14-04, A14-05, A14-06)

1.27 WHEN bookingVerifySchema validates phone numbers THEN it only checks min 6, max 30 length without regex format validation

1.28 WHEN a booking verification request contains phone="!@#$%^" (6 chars) THEN it passes validation despite being syntactically invalid

1.29 WHEN labReportSchema validates test names THEN it only enforces min(1) without max length, allowing unbounded strings

1.30 WHEN text fields are persisted THEN no Unicode NFC normalization occurs, allowing homoglyph attacks (e.g., Cyrillic 'а' vs Latin 'a')

1.31 WHEN Zod schemas validate strings THEN null bytes (\u0000) are not explicitly stripped, relying on Postgres TEXT semantics

1.32 WHEN locale cookie is parsed in /api/lab/report-html THEN decodeURIComponent can throw on malformed sequences causing 500 errors

### Expected Behavior (Correct)

#### 1. Database Integrity (A16-03, A16-04, A16-05)

2.1 WHEN an appointment is created THEN the database SHALL enforce CHECK (slot_end > slot_start) constraint

2.2 WHEN a service is created THEN the database SHALL enforce CHECK (price >= 0) constraint

2.3 WHEN time_slots are created THEN the database SHALL enforce UNIQUE (doctor_id, day_of_week, start_time) constraint

2.4 WHEN constraint violations occur THEN the database SHALL return clear error messages indicating the specific constraint failure

2.5 WHEN existing data is migrated THEN the migration SHALL validate and fix any existing constraint violations before adding constraints

#### 2. SECURITY DEFINER RPC Validation (A2-03)

2.6 WHEN booking_atomic_insert RPC is modified THEN a pgTAP test SHALL verify cross-tenant validation is enforced

2.7 WHEN the test suite runs THEN it SHALL call booking_atomic_insert with cross-tenant IDs and assert the error

2.8 WHEN validation checks are removed THEN the test SHALL fail, preventing regression

2.9 WHEN the RPC is deployed THEN automated tests SHALL verify that anon role cannot insert bookings across tenant boundaries

#### 3. Cryptographic Exception Handling (A10-07)

2.10 WHEN hexToBytes receives odd-length hex THEN it SHALL throw a descriptive error before calling .match()

2.11 WHEN webhook signature verification encounters malformed hex THEN it SHALL return 401 Unauthorized with a generic error message

2.12 WHEN hexToBytes validates input THEN it SHALL check (hex.length % 2 !== 0) and throw Error("Invalid hex string: odd length")

2.13 WHEN cryptographic functions fail THEN they SHALL not expose internal implementation details in error responses

#### 4. Resource Leak Issues (A12-02, A12-04)

2.14 WHEN userRateBuckets map reaches capacity THEN it SHALL implement LRU eviction to remove least recently used entries

2.15 WHEN a new user ID is added to a full map THEN the oldest entry SHALL be evicted automatically

2.16 WHEN subdomain cache grows THEN it SHALL enforce a maximum size limit with LRU eviction

2.17 WHEN cache entries expire THEN they SHALL be removed based on TTL to prevent unbounded growth

2.18 WHEN Workers isolates run long-term THEN memory usage SHALL remain bounded through automatic eviction

#### 5. Supply Chain Security (A2-04, A2-05)

2.19 WHEN package.json documents CVE fixes THEN it SHALL contain actual CVE identifiers (e.g., CVE-2023-44270) or remove placeholder

2.20 WHEN postinstall scripts exist THEN they SHALL be protected by CODEOWNERS requiring security review

2.21 WHEN CI runs npm install THEN it SHALL use --ignore-scripts by default with explicit allowlist for trusted scripts

2.22 WHEN scripts/ directory is modified THEN pull requests SHALL require security team approval

#### 6. Feature Flag Security (A2-01, A2-08)

2.23 WHEN SELF_SERVICE_REGISTRATION_ENABLED is true THEN trade_license_base64 verification mode SHALL be removed from the schema

2.24 WHEN feature flags affect security posture THEN runtime startup SHALL assert production flag configuration matches expected hash

2.25 WHEN production environment starts THEN it SHALL validate that security-critical flags are explicitly configured

2.26 WHEN flag configuration is invalid THEN the application SHALL refuse to start with a clear error message

#### 7. Input Validation (A14-02, A14-03, A14-04, A14-05, A14-06)

2.27 WHEN bookingVerifySchema validates phone THEN it SHALL enforce regex /^\+?[0-9()\s-]+$/ for syntactic validity

2.28 WHEN labReportSchema validates testName THEN it SHALL enforce max(200) length constraint

2.29 WHEN text fields are validated THEN Zod schemas SHALL apply .transform(s => s.normalize("NFC")) for Unicode normalization

2.30 WHEN string inputs are validated THEN Zod schemas SHALL strip null bytes via .transform(s => s.replace(/\u0000/g, ''))

2.31 WHEN locale cookie is parsed THEN decodeURIComponent SHALL be wrapped in try/catch with fallback to DEFAULT_LOCALE

2.32 WHEN validation errors occur THEN they SHALL return 400 Bad Request with descriptive error messages

### Unchanged Behavior (Regression Prevention)

#### 1. Database Operations

3.1 WHEN valid appointments are created with slot_end > slot_start THEN the system SHALL CONTINUE TO accept them

3.2 WHEN services are created with positive prices THEN the system SHALL CONTINUE TO accept them

3.3 WHEN time_slots are created with unique (doctor_id, day_of_week, start_time) combinations THEN the system SHALL CONTINUE TO accept them

3.4 WHEN existing valid data exists THEN migrations SHALL CONTINUE TO preserve it

#### 2. Booking Flow

3.5 WHEN legitimate booking_atomic_insert calls are made THEN they SHALL CONTINUE TO succeed

3.6 WHEN same-tenant bookings are created THEN the RPC SHALL CONTINUE TO insert them successfully

3.7 WHEN booking advisory locks are acquired THEN they SHALL CONTINUE TO prevent race conditions

#### 3. Webhook Processing

3.8 WHEN valid webhook signatures are received THEN hexToBytes SHALL CONTINUE TO parse them correctly

3.9 WHEN Stripe, WhatsApp, and CMI webhooks arrive THEN signature verification SHALL CONTINUE TO work

3.10 WHEN even-length hex strings are processed THEN hexToBytes SHALL CONTINUE TO return correct byte arrays

#### 4. Rate Limiting

3.11 WHEN legitimate users make requests THEN rate limiting SHALL CONTINUE TO allow them

3.12 WHEN rate limits are not exceeded THEN userRateBuckets SHALL CONTINUE TO track usage

3.13 WHEN users are within limits THEN requests SHALL CONTINUE TO be processed normally

#### 5. Subdomain Resolution

3.14 WHEN valid subdomains are resolved THEN subdomain cache SHALL CONTINUE TO return correct clinic IDs

3.15 WHEN cache hits occur THEN subdomain resolution SHALL CONTINUE TO be fast

3.16 WHEN cache misses occur THEN database lookups SHALL CONTINUE TO populate the cache

#### 6. Package Management

3.17 WHEN npm install runs THEN legitimate dependencies SHALL CONTINUE TO be installed

3.18 WHEN patch-opennext.mjs runs THEN OpenNext patches SHALL CONTINUE TO be applied

3.19 WHEN builds execute THEN post-build-patch.mjs SHALL CONTINUE TO run successfully

#### 7. Feature Flags

3.20 WHEN SELF_SERVICE_REGISTRATION_ENABLED is false THEN registration SHALL CONTINUE TO be disabled

3.21 WHEN dns_verification mode is used THEN registration SHALL CONTINUE TO work

3.22 WHEN manual_approval mode is used THEN registration SHALL CONTINUE TO work

#### 8. Input Validation

3.23 WHEN valid phone numbers are submitted THEN bookingVerifySchema SHALL CONTINUE TO accept them

3.24 WHEN valid test names are submitted THEN labReportSchema SHALL CONTINUE TO accept them

3.25 WHEN normalized Unicode text is submitted THEN it SHALL CONTINUE TO be processed correctly

3.26 WHEN valid locale cookies are present THEN they SHALL CONTINUE TO be parsed correctly

3.27 WHEN strings without null bytes are submitted THEN they SHALL CONTINUE TO be accepted

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SecurityConfiguration
  OUTPUT: boolean
  
  // Returns true when Phase 3 security gaps exist
  RETURN (
    // Database integrity
    X.appointmentsTableHasSlotCheck = false OR
    X.servicesTableHasPriceCheck = false OR
    X.timeSlotsTableHasUniqueConstraint = false OR
    
    // RPC validation
    X.bookingRpcHasRegressionTest = false OR
    
    // Cryptographic handling
    X.hexToBytesValidatesLength = false OR
    
    // Resource management
    X.userRateBucketsHasLRU = false OR
    X.subdomainCacheHasSizeLimit = false OR
    
    // Supply chain
    X.packageJsonHasCVEPlaceholder = true OR
    X.postinstallScriptsUnprotected = true OR
    
    // Feature flags
    X.tradeLicenseCodeExists = true OR
    X.productionFlagValidationMissing = true OR
    
    // Input validation
    X.phoneValidationHasRegex = false OR
    X.testNameHasMaxLength = false OR
    X.textFieldsNormalizeNFC = false OR
    X.nullBytesStripped = false OR
    X.localeDecodingUnprotected = true
  )
END FUNCTION
```

### Property Specification: Fix Checking

```pascal
// Property: Fix Checking - Phase 3 Security Fixes
FOR ALL X WHERE isBugCondition(X) DO
  result ← applyPhase3Fixes'(X)
  ASSERT (
    // Database integrity
    result.appointmentsTableHasSlotCheck = true AND
    result.servicesTableHasPriceCheck = true AND
    result.timeSlotsTableHasUniqueConstraint = true AND
    
    // RPC validation
    result.bookingRpcHasRegressionTest = true AND
    
    // Cryptographic handling
    result.hexToBytesValidatesLength = true AND
    
    // Resource management
    result.userRateBucketsHasLRU = true AND
    result.subdomainCacheHasSizeLimit = true AND
    
    // Supply chain
    result.packageJsonHasCVEPlaceholder = false AND
    result.postinstallScriptsProtected = true AND
    
    // Feature flags
    result.tradeLicenseCodeRemoved = true AND
    result.productionFlagValidationExists = true AND
    
    // Input validation
    result.phoneValidationHasRegex = true AND
    result.testNameHasMaxLength = true AND
    result.textFieldsNormalizeNFC = true AND
    result.nullBytesStripped = true AND
    result.localeDecodingProtected = true
  )
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT applyPhase3Fixes(X) = applyPhase3Fixes'(X)
END FOR
```

This ensures that components already following security best practices remain unchanged after applying Phase 3 fixes.

### Counterexamples

**Counterexample 1: Invalid Appointment Time Range**
```sql
-- Current behavior: Accepted
INSERT INTO appointments (clinic_id, doctor_id, patient_id, slot_start, slot_end)
VALUES ('clinic-uuid', 'doctor-uuid', 'patient-uuid', 
        '2026-05-01 14:00:00', '2026-05-01 13:00:00');
-- slot_end (13:00) is before slot_start (14:00) but no constraint prevents it
```
**Bug Condition**: `X.appointmentsTableHasSlotCheck = false` → true  
**Expected**: Constraint violation error

**Counterexample 2: Negative Service Price**
```sql
-- Current behavior: Accepted
INSERT INTO services (clinic_id, name, price)
VALUES ('clinic-uuid', 'Consultation', -100.00);
-- Negative price accepted, causing billing errors
```
**Bug Condition**: `X.servicesTableHasPriceCheck = false` → true  
**Expected**: Constraint violation error

**Counterexample 3: Duplicate Time Slots**
```sql
-- Current behavior: Accepted
INSERT INTO time_slots (doctor_id, day_of_week, start_time, end_time)
VALUES ('doctor-uuid', 1, '09:00:00', '10:00:00');
INSERT INTO time_slots (doctor_id, day_of_week, start_time, end_time)
VALUES ('doctor-uuid', 1, '09:00:00', '11:00:00');
-- Duplicate (doctor_id, day_of_week, start_time) allowed
```
**Bug Condition**: `X.timeSlotsTableHasUniqueConstraint = false` → true  
**Expected**: UNIQUE constraint violation

**Counterexample 4: Odd-Length Hex String**
```typescript
// Current behavior: TypeError
const result = hexToBytes("abc");  // Odd length
// hex.match(/.{2}/g)! throws TypeError: Cannot read property 'map' of null
```
**Bug Condition**: `X.hexToBytesValidatesLength = false` → true  
**Expected**: Descriptive error before .match() call

**Counterexample 5: Rate Bucket DoS**
```typescript
// Current behavior: Legitimate users denied
// Attacker fills userRateBuckets with 10,000 random IDs
for (let i = 0; i < 10000; i++) {
  makeRequest({ userId: `fake-${i}` });
}
// Map is full, no eviction, legitimate user denied
makeRequest({ userId: "real-user-uuid" });  // Fails
```
**Bug Condition**: `X.userRateBucketsHasLRU = false` → true  
**Expected**: LRU eviction allows legitimate user

**Counterexample 6: CVE Placeholder**
```json
// package.json (current)
{
  "_overrides_rationale": {
    "postcss": "Pin postcss to >=8.5.10 to fix CVE-2024-XXXXX"
  }
}
```
**Bug Condition**: `X.packageJsonHasCVEPlaceholder = true` → true  
**Expected**: Actual CVE ID or remove placeholder

**Counterexample 7: Invalid Phone Format**
```typescript
// Current behavior: Accepted
const result = bookingVerifySchema.safeParse({
  phone: "!@#$%^",  // 6 chars, passes min/max but invalid format
  code: "123456"
});
// result.success = true
```
**Bug Condition**: `X.phoneValidationHasRegex = false` → true  
**Expected**: Validation error for invalid phone format

**Counterexample 8: Unbounded Test Name**
```typescript
// Current behavior: Accepted
const result = labReportSchema.safeParse({
  results: [{
    testName: "A".repeat(10000),  // 10KB string accepted
    value: "Normal"
  }]
});
// result.success = true
```
**Bug Condition**: `X.testNameHasMaxLength = false` → true  
**Expected**: Validation error for exceeding max length

**Counterexample 9: Homoglyph Attack**
```typescript
// Current behavior: Accepted without normalization
const clinicName1 = "Clinic";  // Latin 'C'
const clinicName2 = "Сlinic";  // Cyrillic 'С' (U+0421)
// Both accepted as different strings, enabling impersonation
```
**Bug Condition**: `X.textFieldsNormalizeNFC = false` → true  
**Expected**: NFC normalization prevents homoglyph confusion

**Counterexample 10: Malformed Locale Cookie**
```typescript
// Current behavior: 500 Internal Server Error
const locale = decodeURIComponent("%E0%A4%A");  // Malformed UTF-8
// Throws URIError, bubbles to 500
```
**Bug Condition**: `X.localeDecodingUnprotected = true` → true  
**Expected**: Fallback to DEFAULT_LOCALE, return 200
