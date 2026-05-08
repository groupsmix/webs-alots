# Phase 3 Security Fixes Bugfix Design

## Overview

This bugfix addresses 17 security vulnerabilities identified in the Oltigo Health platform security audit (2026-04-30), comprising 8 MEDIUM and 9 LOW priority findings. Following Phase 1 (critical vulnerabilities) and Phase 2 (infrastructure hardening), this phase focuses on database integrity, input validation, resource management, and supply chain security.

The fix strategy implements defense-in-depth controls across seven categories:
1. **Database Integrity** - Add CHECK and UNIQUE constraints to prevent invalid data
2. **RPC Validation** - Add regression tests for SECURITY DEFINER functions
3. **Cryptographic Handling** - Add input validation before exception-prone operations
4. **Resource Leaks** - Implement LRU eviction for unbounded maps/caches
5. **Supply Chain** - Document CVE fixes, protect postinstall scripts
6. **Feature Flags** - Remove dead code, add production validation
7. **Input Validation** - Add regex, max length, NFC normalization, null byte handling

This is a healthcare platform handling PHI under Moroccan Law 09-08 and GDPR, deployed on Next.js 16 + Supabase + Cloudflare Workers.

## Glossary

- **Bug_Condition (C)**: Security configuration has Phase 3 gaps (missing constraints, no RPC tests, unvalidated crypto input, unbounded caches, CVE placeholder, dead code, weak validation)
- **Property (P)**: Security SHALL enforce data integrity, prevent resource exhaustion, validate all inputs, and maintain supply chain transparency
- **Preservation**: Existing functionality (valid appointments, bookings, webhooks, rate limiting, subdomain resolution, registration, input validation) must continue working
- **CHECK Constraint**: Database constraint that validates data before INSERT/UPDATE (e.g., `slot_end > slot_start`)
- **UNIQUE Constraint**: Database constraint preventing duplicate rows (e.g., unique time slots per doctor)
- **SECURITY DEFINER**: PostgreSQL function that runs with creator's privileges, requiring strict validation to prevent privilege escalation
- **LRU (Least Recently Used)**: Cache eviction policy that removes oldest entries when capacity is reached
- **NFC Normalization**: Unicode normalization form that prevents homoglyph attacks (e.g., Cyrillic 'а' vs Latin 'a')
- **Null Byte**: `\u0000` character that can cause string truncation or injection attacks
- **CVE (Common Vulnerabilities and Exposures)**: Standardized identifier for security vulnerabilities
- **Feature Flag**: Runtime configuration that enables/disables code paths, requiring validation in production

## Bug Details

### Bug Condition

The bug manifests when security configuration has Phase 3 gaps across seven categories. The platform either lacks data integrity constraints (appointments with end before start, negative prices, duplicate time slots), has no regression tests for privilege-escalation-prone RPC functions, throws exceptions on malformed cryptographic input, allows unbounded resource growth (DoS risk), documents fake CVE placeholders, contains dead code under feature flags, or has weak input validation (no regex, no max length, no normalization).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SecurityConfiguration
  OUTPUT: boolean
  
  RETURN (
    // Database integrity
    input.appointmentsTableHasSlotCheck = false OR
    input.servicesTableHasPriceCheck = false OR
    input.timeSlotsTableHasUniqueConstraint = false OR
    
    // RPC validation
    input.bookingRpcHasRegressionTest = false OR
    
    // Cryptographic handling
    input.hexToBytesValidatesLength = false OR
    
    // Resource management
    input.userRateBucketsHasLRU = false OR
    input.subdomainCacheHasSizeLimit = false OR
    
    // Supply chain
    input.packageJsonHasCVEPlaceholder = true OR
    input.postinstallScriptsUnprotected = true OR
    
    // Feature flags
    input.tradeLicenseCodeExists = true OR
    input.productionFlagValidationMissing = true OR
    
    // Input validation
    input.phoneValidationHasRegex = false OR
    input.testNameHasMaxLength = false OR
    input.textFieldsNormalizeNFC = false OR
    input.nullBytesStripped = false OR
    input.localeDecodingUnprotected = true
  )
END FUNCTION
```

### Examples

**Example 1: Invalid Appointment Time Range (A16-03)**
- **Current**: `INSERT INTO appointments (slot_start, slot_end) VALUES ('2026-05-01 14:00', '2026-05-01 13:00')` succeeds despite end before start
- **Expected**: Database rejects with `CHECK constraint "appointments_slot_end_after_start" violated`

**Example 2: Negative Service Price (A16-04)**
- **Current**: `INSERT INTO services (price) VALUES (-100.00)` succeeds, causing billing errors
- **Expected**: Database rejects with `CHECK constraint "services_price_non_negative" violated`

**Example 3: Duplicate Time Slots (A16-05)**
- **Current**: Two time_slots with same `(doctor_id, day_of_week, start_time)` can be inserted
- **Expected**: Database rejects second insert with `UNIQUE constraint "time_slots_doctor_day_start_unique" violated`

**Example 4: Cross-Tenant Booking RPC (A2-03)**
- **Current**: No regression test verifies `booking_atomic_insert` rejects cross-tenant IDs
- **Expected**: pgTAP test calls RPC with mismatched clinic_id and asserts error

**Example 5: Odd-Length Hex String (A10-07)**
- **Current**: `hexToBytes("abc")` throws `TypeError: Cannot read property 'map' of null`
- **Expected**: `hexToBytes("abc")` throws `Error("Invalid hex string: odd length")` before `.match()` call

**Example 6: Rate Bucket DoS (A12-02)**
- **Current**: Attacker fills `userRateBuckets` with 10,000 random IDs, legitimate users denied
- **Expected**: LRU eviction removes oldest entries, legitimate users allowed

**Example 7: Unbounded Subdomain Cache (A12-04)**
- **Current**: `subdomainCache` grows indefinitely as clinics rotate subdomains
- **Expected**: Cache enforces max 1000 entries with LRU eviction

**Example 8: CVE Placeholder (A2-04)**
- **Current**: `package.json` contains `"postcss": "Pin to >=8.5.10 to fix CVE-2024-XXXXX"`
- **Expected**: Replace with actual CVE ID or remove placeholder

**Example 9: Unprotected Postinstall (A2-05)**
- **Current**: `postinstall` script runs automatically, no CODEOWNERS protection
- **Expected**: `scripts/` directory requires security team approval in CODEOWNERS

**Example 10: Dead Code (A2-01)**
- **Current**: `trade_license_base64` verification mode exists but manual workflow not implemented
- **Expected**: Remove dead code from schema and route handler

**Example 11: No Production Flag Validation (A2-08)**
- **Current**: No startup assertion validates `SELF_SERVICE_REGISTRATION_ENABLED` is false in production
- **Expected**: Runtime check throws error if security-critical flags misconfigured

**Example 12: Invalid Phone Format (A14-02)**
- **Current**: `bookingVerifySchema` accepts `phone: "!@#$%^"` (6 chars, passes min/max)
- **Expected**: Regex `/^\+?[0-9()\s-]+$/` rejects invalid format

**Example 13: Unbounded Test Name (A14-03)**
- **Current**: `labReportSchema` accepts `testName: "A".repeat(10000)` (10KB string)
- **Expected**: `max(200)` constraint rejects oversized input

**Example 14: Homoglyph Attack (A14-04)**
- **Current**: `"Clinic"` (Latin C) and `"Сlinic"` (Cyrillic С) accepted as different strings
- **Expected**: NFC normalization prevents homoglyph confusion

**Example 15: Null Byte Injection (A14-05)**
- **Current**: Zod schemas don't strip `\u0000`, relying on Postgres TEXT semantics
- **Expected**: `.transform(s => s.replace(/\u0000/g, ''))` strips null bytes

**Example 16: Malformed Locale Cookie (A14-06)**
- **Current**: `decodeURIComponent("%E0%A4%A")` throws `URIError`, bubbles to 500
- **Expected**: Try/catch with fallback to `DEFAULT_LOCALE`, returns 200

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Valid appointments with `slot_end > slot_start` SHALL CONTINUE TO be accepted
- Services with positive prices SHALL CONTINUE TO be accepted
- Time slots with unique `(doctor_id, day_of_week, start_time)` SHALL CONTINUE TO be accepted
- Same-tenant booking_atomic_insert calls SHALL CONTINUE TO succeed
- Even-length hex strings SHALL CONTINUE TO be parsed correctly by hexToBytes
- Legitimate users within rate limits SHALL CONTINUE TO be allowed
- Valid subdomains SHALL CONTINUE TO be resolved from cache
- Legitimate dependencies SHALL CONTINUE TO be installed via npm
- OpenNext patches SHALL CONTINUE TO be applied via postinstall
- dns_verification and manual_approval registration modes SHALL CONTINUE TO work
- Valid phone numbers SHALL CONTINUE TO be accepted by bookingVerifySchema
- Valid test names SHALL CONTINUE TO be accepted by labReportSchema
- Normalized Unicode text SHALL CONTINUE TO be processed correctly
- Valid locale cookies SHALL CONTINUE TO be parsed correctly
- Strings without null bytes SHALL CONTINUE TO be accepted

**Scope:**
All security configurations that do NOT have Phase 3 gaps should be completely unaffected by this fix. This includes:
- Existing application code (Next.js routes, React components, API handlers)
- Authentication and authorization flows
- Tenant isolation logic
- Payment processing and webhook handling
- WhatsApp notification delivery
- File encryption and upload logic
- Phase 1 and Phase 2 security fixes

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Missing Database Constraints**: CHECK and UNIQUE constraints were not added during initial schema design because they weren't in the MVP scope, and invalid data hasn't caused production incidents yet

2. **No RPC Regression Tests**: SECURITY DEFINER functions were audited manually but no automated tests were written to prevent future regressions during refactoring

3. **Unsafe Cryptographic Assumptions**: `hexToBytes` assumes `.match()` always returns an array, but odd-length input returns null, causing TypeError instead of descriptive error

4. **Unbounded Data Structures**: `userRateBuckets` and `subdomainCache` were implemented as simple Maps without eviction because initial load was low and memory limits weren't reached

5. **Documentation Placeholders**: CVE placeholder was added during dependency update but never replaced with actual CVE ID before merge

6. **Postinstall Script Convenience**: Postinstall scripts were used for developer convenience (automatic patching) without considering supply chain attack surface

7. **Feature Flag Debt**: `trade_license_base64` mode was scaffolded for future use but manual workflow was never implemented, leaving dead code

8. **No Production Flag Validation**: Feature flags were added incrementally without runtime validation because misconfiguration hadn't caused incidents

9. **Weak Input Validation**: Zod schemas use basic `min/max` constraints without regex, max length, or normalization because they weren't in initial requirements

10. **Error Handling Gaps**: `decodeURIComponent` error handling was missed because malformed locale cookies are rare in normal usage

## Correctness Properties

Property 1: Bug Condition - Phase 3 Security Fixes

_For any_ security configuration where the bug condition holds (isBugCondition returns true), the fixed configuration SHALL implement all Phase 3 security controls: database constraints, RPC regression tests, cryptographic input validation, LRU eviction, CVE documentation, postinstall protection, dead code removal, production flag validation, regex validation, max length constraints, NFC normalization, null byte stripping, and error handling.

**Validates: Requirements 2.1-2.32**

Property 2: Preservation - Existing Functionality

_For any_ security configuration where the bug condition does NOT hold (isBugCondition returns false), the fixed configuration SHALL produce exactly the same behavior as the original configuration, preserving all existing functionality for valid appointments, bookings, webhooks, rate limiting, subdomain resolution, registration, and input validation.

**Validates: Requirements 3.1-3.27**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### 1. Database Integrity Constraints (A16-03, A16-04, A16-05)

**File**: `supabase/migrations/00075_phase3_database_constraints.sql`

**Specific Changes**:
1. **Appointments Slot Check**: Add `ALTER TABLE appointments ADD CONSTRAINT appointments_slot_end_after_start CHECK (slot_end > slot_start);`
2. **Services Price Check**: Add `ALTER TABLE services ADD CONSTRAINT services_price_non_negative CHECK (price >= 0);`
3. **Time Slots Unique**: Add `ALTER TABLE time_slots ADD CONSTRAINT time_slots_doctor_day_start_unique UNIQUE (doctor_id, day_of_week, start_time);`
4. **Data Validation**: Before adding constraints, run `SELECT` queries to identify existing invalid data
5. **Data Cleanup**: Update invalid rows (e.g., swap slot_start/slot_end if reversed, set negative prices to 0, delete duplicate time_slots)
6. **Rollback Safety**: Use `NOT VALID` option for constraints, then `VALIDATE CONSTRAINT` after data cleanup

#### 2. RPC Regression Tests (A2-03)

**File**: `supabase/tests/booking_atomic_insert_security.sql` (NEW)

**Specific Changes**:
1. **pgTAP Test Setup**: Create test file with `BEGIN; SELECT plan(3);`
2. **Cross-Tenant Test**: Call `booking_atomic_insert` with doctor_id from clinic A and clinic_id for clinic B, assert error
3. **Cross-Tenant Service Test**: Call with service_id from clinic A and clinic_id for clinic B, assert error
4. **Cross-Tenant Patient Test**: Call with patient_id from clinic A and clinic_id for clinic B, assert error
5. **Test Teardown**: `SELECT * FROM finish(); ROLLBACK;`

**File**: `.github/workflows/ci.yml`

**Specific Changes**:
1. **Add pgTAP Step**: Add step to run `supabase test db` after migrations
2. **Fail on Test Failure**: Ensure pgTAP failures block CI pipeline

#### 3. Cryptographic Exception Handling (A10-07)

**File**: `src/lib/crypto-utils.ts`

**Specific Changes**:
1. **Length Validation**: Add `if (hex.length % 2 !== 0) throw new Error("Invalid hex string: odd length");` at start of `hexToBytes` function
2. **Input Sanitization**: Add `hex = hex.trim().toLowerCase();` before validation
3. **Descriptive Errors**: Replace generic errors with specific messages (e.g., "Invalid hex string: contains non-hex characters")
4. **Webhook Error Handling**: Update webhook handlers to catch crypto errors and return 401 instead of 500

#### 4. Resource Leak Fixes (A12-02, A12-04)

**File**: `src/lib/with-auth.ts`

**Specific Changes**:
1. **LRU Implementation**: Replace `Map` with LRU cache library (e.g., `lru-cache` npm package)
2. **Capacity Limit**: Set `max: 10000` for `userRateBuckets`
3. **TTL**: Set `ttl: 60000` (1 minute) for automatic expiration
4. **Eviction Logging**: Log when entries are evicted for monitoring

**File**: `src/lib/subdomain-cache.ts`

**Specific Changes**:
1. **LRU Implementation**: Replace `Map` with LRU cache
2. **Capacity Limit**: Set `max: 1000` for subdomain cache
3. **TTL**: Set `ttl: 300000` (5 minutes) for automatic expiration
4. **Cache Stats**: Add metrics for hit rate, eviction count

#### 5. Supply Chain Security (A2-04, A2-05)

**File**: `package.json`

**Specific Changes**:
1. **CVE Documentation**: Replace `CVE-2024-XXXXX` with actual CVE ID (e.g., `CVE-2023-44270`) or remove placeholder if no CVE exists
2. **Rationale Clarity**: Update `_overrides_rationale` to explain why override is needed (e.g., "Pin postcss to >=8.5.10 to fix ReDoS vulnerability")

**File**: `.github/CODEOWNERS`

**Specific Changes**:
1. **Scripts Protection**: Add `/scripts/ @security-team` to require security review for postinstall script changes
2. **Package.json Protection**: Add `/package.json @security-team` to require review for dependency changes

**File**: `.github/workflows/ci.yml`

**Specific Changes**:
1. **Ignore Scripts**: Add `npm ci --ignore-scripts` to CI pipeline
2. **Explicit Allowlist**: Add separate step `npm run postinstall` with explicit script execution after security scan

#### 6. Feature Flag Security (A2-01, A2-08)

**File**: `src/lib/validations.ts`

**Specific Changes**:
1. **Remove Dead Code**: Remove `trade_license_base64` from `clinicVerificationModeSchema` enum
2. **Schema Update**: Update schema to only include `dns_verification` and `manual_approval` modes

**File**: `src/app/api/v1/register-clinic/route.ts`

**Specific Changes**:
1. **Remove Dead Code**: Remove `trade_license_base64` handling logic from route handler
2. **Remove Imports**: Remove unused imports related to trade license verification

**File**: `src/lib/feature-flags.ts` (NEW)

**Specific Changes**:
1. **Production Validation**: Create new file with `validateProductionFlags()` function
2. **Flag Assertions**: Assert `SELF_SERVICE_REGISTRATION_ENABLED !== "true"` in production
3. **Startup Check**: Call `validateProductionFlags()` in `src/middleware.ts` on first request
4. **Error Handling**: Throw descriptive error if validation fails, preventing app startup

**File**: `.env.production.example`

**Specific Changes**:
1. **Document Flags**: Add comments explaining security implications of each flag
2. **Safe Defaults**: Set `SELF_SERVICE_REGISTRATION_ENABLED=false` as default

#### 7. Input Validation Enhancements (A14-02, A14-03, A14-04, A14-05, A14-06)

**File**: `src/lib/validations.ts`

**Specific Changes**:
1. **Phone Regex (A14-02)**: Update `bookingVerifySchema.phone` to `.regex(/^\+?[0-9()\s-]+$/, "Invalid phone format")`
2. **Test Name Max (A14-03)**: Update `labReportSchema.results[].testName` to `.max(200, "Test name too long")`
3. **NFC Normalization (A14-04)**: Create `safeText` transform: `z.string().transform(s => s.normalize("NFC"))`
4. **Null Byte Stripping (A14-05)**: Update `safeText` to chain `.transform(s => s.replace(/\u0000/g, ''))`
5. **Apply to All Schemas**: Update all text fields to use `safeText` (clinic_name, doctor_name, patient_name, etc.)

**File**: `src/app/api/lab/report-html/route.ts`

**Specific Changes**:
1. **Locale Decoding (A14-06)**: Wrap `decodeURIComponent(cookies.get("locale"))` in try/catch
2. **Fallback**: Catch `URIError` and fallback to `DEFAULT_LOCALE` constant
3. **Logging**: Log malformed locale attempts for monitoring

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the security gaps on unfixed code, then verify the fixes work correctly and preserve existing functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the security gaps BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that attempt to exploit each security gap (insert invalid appointments, replay cross-tenant tokens, send odd-length hex, fill rate buckets, access CVE placeholder, trigger dead code, bypass validation). Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Invalid Appointment Test**: Insert appointment with `slot_end <= slot_start` (will succeed on unfixed schema)
2. **Negative Price Test**: Insert service with `price < 0` (will succeed on unfixed schema)
3. **Duplicate Slot Test**: Insert two time_slots with same `(doctor_id, day_of_week, start_time)` (will succeed on unfixed schema)
4. **Cross-Tenant RPC Test**: Call `booking_atomic_insert` with mismatched clinic_id (will succeed on unfixed code if validation is missing)
5. **Odd-Length Hex Test**: Call `hexToBytes("abc")` (will throw TypeError on unfixed code)
6. **Rate Bucket DoS Test**: Fill `userRateBuckets` with 10,000 entries (will cause DoS on unfixed code)
7. **Unbounded Cache Test**: Add 10,000 subdomains to cache (will grow unbounded on unfixed code)
8. **CVE Placeholder Test**: Check `package.json` for `CVE-2024-XXXXX` (will find placeholder on unfixed code)
9. **Dead Code Test**: Submit registration with `trade_license_base64` mode (will execute dead code on unfixed code)
10. **Invalid Phone Test**: Submit booking verification with `phone: "!@#$%^"` (will succeed on unfixed schema)
11. **Unbounded Test Name Test**: Submit lab report with 10KB test name (will succeed on unfixed schema)
12. **Homoglyph Test**: Submit clinic name with Cyrillic characters (will succeed without normalization on unfixed code)
13. **Null Byte Test**: Submit input with `\u0000` (will pass validation on unfixed schema)
14. **Malformed Locale Test**: Send malformed locale cookie (will throw 500 on unfixed code)

**Expected Counterexamples**:
- Database accepts invalid appointments, negative prices, duplicate time slots
- No regression test prevents cross-tenant RPC calls
- hexToBytes throws TypeError on odd-length input
- userRateBuckets and subdomainCache grow unbounded
- package.json contains CVE placeholder
- Dead code exists under feature flag
- No production flag validation
- Weak input validation allows invalid formats, unbounded strings, homoglyphs, null bytes
- Malformed locale cookie causes 500 error

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyPhase3Fixes_fixed(input)
  ASSERT (
    result.appointmentsTableHasSlotCheck = true AND
    result.servicesTableHasPriceCheck = true AND
    result.timeSlotsTableHasUniqueConstraint = true AND
    result.bookingRpcHasRegressionTest = true AND
    result.hexToBytesValidatesLength = true AND
    result.userRateBucketsHasLRU = true AND
    result.subdomainCacheHasSizeLimit = true AND
    result.packageJsonHasCVEPlaceholder = false AND
    result.postinstallScriptsProtected = true AND
    result.tradeLicenseCodeRemoved = true AND
    result.productionFlagValidationExists = true AND
    result.phoneValidationHasRegex = true AND
    result.testNameHasMaxLength = true AND
    result.textFieldsNormalizeNFC = true AND
    result.nullBytesStripped = true AND
    result.localeDecodingProtected = true
  )
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT applyPhase3Fixes_original(input) = applyPhase3Fixes_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for valid operations (valid appointments, same-tenant bookings, even-length hex, legitimate rate limiting, valid subdomains, valid registration, valid input), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Valid Appointment Preservation**: Verify appointments with `slot_end > slot_start` continue to be accepted after constraint
2. **Valid Price Preservation**: Verify services with `price >= 0` continue to be accepted after constraint
3. **Valid Slot Preservation**: Verify unique time_slots continue to be accepted after constraint
4. **Same-Tenant Booking Preservation**: Verify same-tenant `booking_atomic_insert` calls continue to succeed after regression test
5. **Even-Length Hex Preservation**: Verify even-length hex strings continue to be parsed correctly after validation
6. **Legitimate Rate Limit Preservation**: Verify legitimate users continue to be allowed after LRU eviction
7. **Valid Subdomain Preservation**: Verify valid subdomains continue to be resolved after cache size limit
8. **Legitimate Dependency Preservation**: Verify legitimate dependencies continue to be installed after CODEOWNERS
9. **Valid Registration Preservation**: Verify dns_verification and manual_approval modes continue to work after dead code removal
10. **Valid Phone Preservation**: Verify valid phone numbers continue to be accepted after regex validation
11. **Valid Test Name Preservation**: Verify valid test names continue to be accepted after max length
12. **Normalized Text Preservation**: Verify normalized Unicode text continues to be processed correctly after NFC normalization
13. **Valid Locale Preservation**: Verify valid locale cookies continue to be parsed correctly after error handling

### Unit Tests

- Test database constraints reject invalid appointments, negative prices, duplicate time slots
- Test pgTAP regression test rejects cross-tenant RPC calls
- Test hexToBytes throws descriptive error on odd-length input
- Test LRU eviction removes oldest entries from userRateBuckets and subdomainCache
- Test CODEOWNERS requires security review for scripts/ changes
- Test production flag validation throws error on misconfiguration
- Test phone regex rejects invalid formats
- Test max length constraint rejects oversized test names
- Test NFC normalization prevents homoglyph attacks
- Test null byte stripping removes \u0000 from input
- Test locale decoding fallback handles malformed cookies

### Property-Based Tests

- Generate random appointment times and verify constraint enforcement
- Generate random service prices and verify non-negative constraint
- Generate random time slots and verify uniqueness constraint
- Generate random hex strings and verify length validation
- Generate random rate bucket scenarios and verify LRU eviction
- Generate random subdomain cache scenarios and verify size limit
- Generate random phone numbers and verify regex validation
- Generate random test names and verify max length
- Generate random Unicode text and verify NFC normalization
- Generate random strings with null bytes and verify stripping

### Integration Tests

- Test full appointment creation flow with constraint validation
- Test full booking flow with RPC regression test
- Test full webhook flow with cryptographic error handling
- Test full rate limiting flow with LRU eviction
- Test full subdomain resolution flow with cache size limit
- Test full registration flow with dead code removed
- Test full input validation flow with regex, max length, normalization, null byte stripping
- Test full locale parsing flow with error handling

### E2E Tests

**File**: `e2e/security-fixes-phase3.spec.ts` (NEW)

**Test Cases**:
1. **Database Constraints**: Attempt to create invalid appointment via UI, verify error message
2. **RPC Security**: Attempt cross-tenant booking via API, verify 403 response
3. **Webhook Resilience**: Send webhook with malformed signature, verify 401 response
4. **Rate Limiting**: Send burst of requests, verify legitimate users not blocked
5. **Input Validation**: Submit forms with invalid phone, oversized test name, homoglyphs, verify validation errors
6. **Locale Handling**: Set malformed locale cookie, verify app continues working with default locale
