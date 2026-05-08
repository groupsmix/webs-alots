# Phase 4 High-Priority Security Fixes Bugfix Design

## Overview

This design addresses 5 high-priority security vulnerabilities identified in the technical audit that remain unresolved after Phase 1-3 fixes. The platform is a multi-tenant healthcare SaaS handling PHI under Morocco Law 09-08 and GDPR. These fixes span authentication bypass risks (A7-05), malware upload vectors (A37-06), SSRF/DoS attack surfaces (A1-02), operational blind spots (A8-02), and ReDoS vulnerabilities (R11-01). The approach combines static analysis enforcement, runtime scanning integration, rate limiting, operational resilience, and library replacement to systematically close each vulnerability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each of the 5 security vulnerabilities
- **Property (P)**: The desired secure behavior after fixes are applied
- **Preservation**: Existing functionality that must remain unchanged by the fixes
- **withAuth**: Authentication wrapper in `src/lib/with-auth.ts` that enforces RBAC
- **createClient**: Supabase client factory in `src/lib/supabase-server.ts`
- **ClamAV**: Open-source antivirus engine for malware scanning
- **ReDoS**: Regular Expression Denial of Service - CPU exhaustion via crafted input
- **DOMPurify**: Battle-tested HTML sanitization library with linear time complexity
- **Turnstile**: Cloudflare CAPTCHA service for bot protection
- **Rate Limiter**: Request throttling mechanism in `src/lib/rate-limit.ts`

## Bug Details

### Bug 1: Role Check Bypass via Direct createClient() Usage (A7-05)

The bug manifests when a route handler in `src/app/api/**/route.ts` uses `createClient()` directly without wrapping the handler in `withAuth()`. The route bypasses authentication and RBAC checks, allowing unauthenticated or unauthorized users to access protected resources. This occurs because `createClient()` returns an unauthenticated Supabase client, and without `withAuth()` there is no role verification.

**Formal Specification:**
```
FUNCTION isBugCondition_RoleBypass(file)
  INPUT: file of type SourceFile
  OUTPUT: boolean
  
  RETURN file.path MATCHES "src/app/api/**/route.ts" AND
         file.content CONTAINS "createClient()" AND
         file.content NOT_CONTAINS "withAuth(" AND
         file.content NOT_CONTAINS "withAuthAnyRole(" AND
         file.content NOT_CONTAINS "withAuthValidation("
END FUNCTION
```

**Examples:**
- `src/app/api/patients/route.ts` calls `createClient()` directly without `withAuth()` → unauthenticated access to patient data
- `src/app/api/appointments/route.ts` uses `createClient()` in POST handler → unauthorized users can create appointments
- `src/app/api/admin/users/route.ts` bypasses role check → patients can access admin endpoints
- Edge case: `src/app/api/health/route.ts` legitimately uses `createClient()` for health checks (public endpoint)

### Bug 2: No Malware Scanning on File Uploads (A37-06)

The bug manifests when a user uploads a file to `/api/upload` (POST handler). The system validates magic bytes and MIME types but does not scan for malware before persisting to R2 storage. A malicious file (e.g., PDF with embedded JavaScript, polyglot JPEG/HTML) passes validation and is stored, potentially infecting other users who download it.

**Formal Specification:**
```
FUNCTION isBugCondition_NoScan(upload)
  INPUT: upload of type FileUpload
  OUTPUT: boolean
  
  RETURN upload.endpoint = "/api/upload" AND
         upload.method = "POST" AND
         upload.magicBytesValid = TRUE AND
         upload.antivirusScanCompleted = FALSE
END FUNCTION
```

**Examples:**
- User uploads `malware.pdf` with embedded JavaScript → stored without scanning
- User uploads `polyglot.jpg` (valid JPEG header + HTML payload) → passes magic byte check, stored without AV scan
- User uploads `trojan.png` with malicious payload → stored and served to other clinic staff
- Edge case: Presigned uploads (GET /api/upload) are confirmed via PUT handler which also lacks AV scanning

### Bug 3: SSRF and DoS via Unprotected Verification Token Endpoint (A1-02)

The bug manifests when an attacker calls `/api/v1/register-clinic/verification-token` with a user-supplied domain. The endpoint performs DoH metadata fetch without the same rate limiting or Turnstile CAPTCHA protection as the main registration endpoint. An attacker can repeatedly call this endpoint to issue self-generated tokens, perform SSRF attacks against internal services, or exhaust server resources via DoS.

**Formal Specification:**
```
FUNCTION isBugCondition_SSRF(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  RETURN request.path = "/api/v1/register-clinic/verification-token" AND
         request.method = "POST" AND
         (request.turnstileVerified = FALSE OR
          request.rateLimitStrict = FALSE OR
          request.emailConfirmationRequired = FALSE)
END FUNCTION
```

**Examples:**
- Attacker calls verification-token endpoint 1000 times/minute → no CAPTCHA blocks abuse
- Attacker supplies `website_domain: "internal.service.local"` → SSRF against internal DNS
- Attacker requests tokens for 10,000 domains → DoS via resource exhaustion
- Edge case: Legitimate user retries token request after DNS propagation delay (should be allowed with rate limit)

### Bug 4: Silent Slack Webhook Failures (A8-02)

The bug manifests when the Slack webhook POST fails during clinic registration in `/api/v1/register-clinic/route.ts`. The system only logs an error via `logger.error()` without alerting operations. When Slack is unavailable or misconfigured, operations staff are not notified of new registrations, causing manual processing delays and potential customer loss.

**Formal Specification:**
```
FUNCTION isBugCondition_SlackFailure(notification)
  INPUT: notification of type SlackNotification
  OUTPUT: boolean
  
  RETURN notification.slackPostSuccess = FALSE AND
         notification.emailFallbackSent = FALSE AND
         notification.metricEmitted = FALSE
END FUNCTION
```

**Examples:**
- Slack webhook returns 500 error → only logged, no email fallback sent
- Slack webhook times out after 10 seconds → registration completes but operations unaware
- Slack API rate limit exceeded → multiple registrations silently fail notification
- Edge case: Slack succeeds but email service is down (should not trigger fallback)

### Bug 5: ReDoS Vulnerability in HTML Sanitization (R11-01)

The bug manifests when crafted HTML input with nested tags is passed to the custom regex-based sanitizer in `src/lib/sanitize-html.ts`. The system's regex exhibits super-linear time complexity (catastrophic backtracking) causing CPU exhaustion. An attacker submitting malicious HTML to blog post rendering or user-generated content can make the system unresponsive, blocking other requests.

**Formal Specification:**
```
FUNCTION isBugCondition_ReDoS(input)
  INPUT: input of type HTMLString
  OUTPUT: boolean
  
  RETURN (input.containsNestedTags = TRUE OR
          input.containsRepetitivePatterns = TRUE) AND
         sanitizer.implementation = "custom-regex" AND
         sanitizer.timeComplexity(input) > O(n)
END FUNCTION
```

**Examples:**
- Input: `<div><div><div>...(1000 levels)...</div></div></div>` → CPU exhaustion for 30+ seconds
- Input: `<a href="x" href="x" href="x"...(1000 times)...>` → catastrophic backtracking
- Input: `<script>alert(1)</script>` repeated 10,000 times → super-linear processing time
- Edge case: Legitimate blog post with 50 nested `<ul><li>` lists (should sanitize in <100ms)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Routes that correctly use `withAuth()` must continue to authenticate and authorize requests
- Non-route files (utilities, middleware, server components) must continue to use `createClient()` for legitimate purposes
- Clean files uploaded without malware must continue to be stored and tracked in `patient_files` table
- File download authorization must continue to enforce tenant isolation and role-based access
- Legitimate users completing email confirmation must continue to receive verification tokens
- Main registration endpoint rate limits and CAPTCHA checks must remain unchanged
- Successful Slack webhook POSTs must continue without triggering email fallbacks
- Clinic registration must continue to create records and user accounts regardless of notification delivery
- Legitimate HTML content must continue to allow safe tags (p, strong, em, ul, ol, li, a, etc.)
- Blog posts must continue to display formatted content without XSS vulnerabilities

**Scope:**
All inputs that do NOT trigger the bug conditions should be completely unaffected by these fixes. This includes:
- Authenticated routes using `withAuth()` correctly
- Non-route files using `createClient()` for server-side operations
- Clean file uploads passing AV scans
- Legitimate registration requests with CAPTCHA and email confirmation
- Successful Slack notifications
- Normal HTML content without ReDoS patterns

## Hypothesized Root Cause

Based on the bug descriptions and code analysis, the most likely issues are:

1. **Missing Static Analysis Enforcement (A7-05)**: No ESLint rule prevents developers from using `createClient()` directly in route handlers
   - Routes can bypass `withAuth()` by calling `createClient()` directly
   - No compile-time or lint-time enforcement of authentication wrapper usage
   - Developers may forget to wrap handlers when adding new endpoints

2. **Incomplete AV Integration (A37-06)**: The upload route has a TODO comment for ClamAV integration but no actual scanning
   - `AV_SCAN_URL` environment variable is checked but scanning is not enforced
   - Presigned upload confirmation (PUT handler) also lacks AV scanning
   - Magic byte validation alone cannot detect malware in valid file formats

3. **Inconsistent Rate Limiting (A1-02)**: The verification-token endpoint has weaker protection than the main registration endpoint
   - Verification-token uses 30 req/hour per IP, registration uses stricter limits + CAPTCHA
   - No email confirmation required before issuing tokens
   - SSRF protection relies only on domain normalization, not request throttling

4. **Missing Operational Resilience (A8-02)**: Slack webhook failures are logged but not escalated
   - No email fallback when Slack POST fails
   - No metrics emitted for monitoring/alerting systems
   - Operations team has no visibility into notification failures

5. **Custom Regex Sanitization (R11-01)**: Hand-rolled regex-based HTML sanitization has known ReDoS vectors
   - Custom regex patterns exhibit catastrophic backtracking on nested/repetitive input
   - No timeout or complexity limits on sanitization
   - DOMPurify library already integrated but not used consistently

## Correctness Properties

Property 1: Bug Condition - ESLint Rule Enforcement (A7-05)

_For any_ route file in `src/app/api/**/route.ts` that contains `createClient()` without `withAuth()`, `withAuthAnyRole()`, or `withAuthValidation()`, the ESLint linter SHALL emit an error requiring the use of an authentication wrapper before the code can be committed.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - ClamAV Malware Scanning (A37-06)

_For any_ file upload to `/api/upload` (POST or PUT confirmation), the system SHALL scan the file with ClamAV before persisting to R2 storage, and SHALL reject uploads where malware is detected, deleting any temporary files.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 3: Bug Condition - Rate Limit and CAPTCHA Protection (A1-02)

_For any_ request to `/api/v1/register-clinic/verification-token`, the system SHALL enforce the same rate-limit and Turnstile CAPTCHA protection as the main registration endpoint, and SHALL require email confirmation before issuing tokens.

**Validates: Requirements 2.7, 2.8, 2.9**

Property 4: Bug Condition - Email Fallback and Metrics (A8-02)

_For any_ Slack webhook POST failure during clinic registration, the system SHALL send an email fallback notification to the operations team with registration details, and SHALL emit a `slack.post.failure` metric for monitoring systems.

**Validates: Requirements 2.10, 2.11, 2.12**

Property 5: Bug Condition - Linear Time HTML Sanitization (R11-01)

_For any_ HTML input passed to the sanitization function, the system SHALL use DOMPurify library with linear time complexity guarantees, and SHALL sanitize content without CPU exhaustion or request timeouts regardless of input patterns.

**Validates: Requirements 2.13, 2.14, 2.15**

Property 6: Preservation - Authenticated Route Behavior

_For any_ route handler that correctly uses `withAuth()` with appropriate role checks, the fixed system SHALL produce exactly the same authentication and authorization behavior as the original system, preserving all existing RBAC policies.

**Validates: Requirements 3.1**

Property 7: Preservation - Non-Route createClient() Usage

_For any_ non-route file (utilities, middleware, server components) that uses `createClient()` for legitimate purposes, the fixed system SHALL continue to allow direct client instantiation without ESLint errors.

**Validates: Requirements 3.2**

Property 8: Preservation - Clean File Upload Behavior

_For any_ file upload where the AV scan returns "CLEAN", the fixed system SHALL store the file to R2 and track ownership in `patient_files` table exactly as the original system did.

**Validates: Requirements 3.4, 3.5, 3.6**

Property 9: Preservation - Legitimate Token Requests

_For any_ verification token request from a legitimate user who has completed email confirmation, the fixed system SHALL issue valid tokens for clinic registration exactly as the original system did.

**Validates: Requirements 3.7, 3.8, 3.9**

Property 10: Preservation - Successful Slack Notifications

_For any_ Slack webhook POST that succeeds, the fixed system SHALL send notifications to Slack without triggering email fallbacks, exactly as the original system did.

**Validates: Requirements 3.10, 3.11, 3.12**

Property 11: Preservation - Safe HTML Content

_For any_ legitimate HTML content with safe tags (p, strong, em, ul, ol, li, a, etc.), the fixed system SHALL sanitize and display the content with the same formatting and readability as the original system.

**Validates: Requirements 3.13, 3.14, 3.15**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**Bug 1: ESLint Rule for Role Check Enforcement (A7-05)**

**File**: `eslint.config.mjs`

**Specific Changes**:
1. **Add Custom ESLint Rule**: Create `eslint-rules/no-direct-supabase-in-routes.js`
   - Rule detects `createClient()` calls in `src/app/api/**/route.ts` files
   - Checks if the file contains `withAuth(`, `withAuthAnyRole(`, or `withAuthValidation(`
   - Emits error if `createClient()` is used without authentication wrapper
   - Allows `createClient()` in non-route files (utilities, middleware, components)

2. **Register Rule in ESLint Config**: Add to `eslint.config.mjs`
   - Import custom rule from `eslint-rules/` directory
   - Apply rule to `src/app/api/**/route.ts` pattern
   - Set severity to "error" (not "warn") to block commits

3. **Add Pre-commit Hook**: Update `.husky/pre-commit`
   - Run `npm run lint` before allowing commits
   - Ensure ESLint errors block the commit

4. **Document Exception Process**: Add to `CONTRIBUTING.md`
   - Explain how to request exceptions for legitimate public endpoints
   - Require security review for any `eslint-disable` comments on this rule

**Bug 2: ClamAV Integration for Malware Scanning (A37-06)**

**File**: `src/app/api/upload/route.ts`

**Specific Changes**:
1. **Enforce AV Scanning**: Replace the TODO comment with actual enforcement
   - Remove `if (process.env.AV_SCAN_URL)` conditional - make scanning mandatory
   - Add `AV_SCAN_REQUIRED=true` to `.env.example` and deployment configs
   - Fail closed (reject upload) if AV service is unreachable

2. **Scan Presigned Uploads**: Add AV scanning to PUT confirmation handler
   - After magic byte validation, download full file from R2
   - Send to ClamAV REST API for scanning
   - Delete from R2 if malware detected

3. **Add ClamAV REST Service**: Deploy `clamav-rest` container
   - Use Docker image `mkodockx/docker-clamav-rest` or similar
   - Configure `AV_SCAN_URL=http://clamav-rest:8080/scan` in environment
   - Add health check endpoint to verify ClamAV is running

4. **Add Retry Logic**: Handle transient AV service failures
   - Retry up to 3 times with exponential backoff
   - Only fail closed after all retries exhausted
   - Log retry attempts for monitoring

5. **Add Metrics**: Emit metrics for AV scan results
   - `av.scan.success` - clean file scanned
   - `av.scan.malware` - malware detected
   - `av.scan.failure` - service unavailable
   - Use for alerting on AV service outages

**Bug 3: Rate Limiting and CAPTCHA for Verification Token (A1-02)**

**File**: `src/app/api/v1/register-clinic/verification-token/route.ts`

**Specific Changes**:
1. **Add Turnstile CAPTCHA Verification**: Import `verifyTurnstile` from `@/lib/turnstile`
   - Require `turnstileToken` in request body schema
   - Call `verifyTurnstile(turnstileToken)` before processing
   - Return 403 if CAPTCHA verification fails

2. **Strengthen Rate Limiting**: Reduce from 30 req/hour to 10 req/hour per IP
   - Match the stricter rate limit used by main registration endpoint
   - Add per-email rate limit (5 req/hour) to prevent enumeration
   - Log rate limit violations for security monitoring

3. **Require Email Confirmation**: Add email confirmation flow
   - Generate confirmation code and send via email
   - Store code in Redis/database with 15-minute expiry
   - Require `confirmationCode` in verification-token request body
   - Only issue DNS token after email confirmation succeeds

4. **Add SSRF Protection**: Validate domain before DoH fetch
   - Reject private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
   - Reject localhost, link-local, and reserved addresses
   - Reject non-FQDN inputs (must have at least one dot)
   - Use allowlist of public DNS resolvers for DoH queries

**Bug 4: Email Fallback for Slack Failures (A8-02)**

**File**: `src/app/api/v1/register-clinic/route.ts`

**Specific Changes**:
1. **Add Email Fallback Function**: Create `sendRegistrationEmailFallback()`
   - Accept clinic name, email, website, timestamp, error details
   - Send email to `OPERATIONS_EMAIL` (from environment variable)
   - Include all registration details for manual processing
   - Use Resend API (existing email service)

2. **Wrap Slack POST in Try-Catch**: Add error handling around webhook call
   - Catch fetch errors, timeouts, non-200 responses
   - Call `sendRegistrationEmailFallback()` on any failure
   - Log both Slack failure and email fallback success/failure

3. **Emit Metrics**: Add metric emission for monitoring
   - `slack.post.success` - webhook succeeded
   - `slack.post.failure` - webhook failed, fallback triggered
   - `email.fallback.success` - fallback email sent
   - `email.fallback.failure` - fallback email also failed

4. **Add Alerting**: Configure alerts in monitoring system
   - Alert on `slack.post.failure` rate > 10% over 1 hour
   - Alert on `email.fallback.failure` (critical - both channels down)
   - Include runbook link in alert for operations response

**Bug 5: Replace Custom Regex with DOMPurify (R11-01)

**File**: `src/lib/sanitize-html.ts`

**Specific Changes**:
1. **Remove Custom Regex**: Delete all custom regex-based sanitization code
   - The file already uses DOMPurify (imported from `isomorphic-dompurify`)
   - Verify no other files use custom regex sanitization
   - Search codebase for `/<[^>]+>/g` and similar patterns

2. **Verify DOMPurify Configuration**: Ensure safe configuration
   - `ALLOWED_TAGS` includes only safe tags (no script, iframe, object, embed)
   - `FORBID_TAGS` explicitly blocks dangerous tags (defense-in-depth)
   - `FORBID_ATTR` blocks event handlers (onerror, onload, onclick, etc.)
   - `ALLOWED_URI_REGEXP` restricts to http/https/mailto/tel/data:image

3. **Add Timeout Protection**: Wrap sanitization in timeout
   - Use `Promise.race()` with 5-second timeout
   - Return empty string if sanitization exceeds timeout
   - Log timeout events for monitoring (should never happen with DOMPurify)

4. **Add Input Size Limit**: Reject excessively large HTML inputs
   - Limit to 1 MB (1,048,576 bytes) before sanitization
   - Return error for oversized inputs
   - Prevents memory exhaustion attacks

5. **Add Performance Tests**: Create property-based tests
   - Generate deeply nested HTML (1000+ levels)
   - Generate repetitive patterns (10,000+ repeated tags)
   - Assert sanitization completes in <100ms for all inputs
   - Assert linear time complexity O(n) where n = input length

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior. Each bug requires different testing techniques (static analysis, integration testing, load testing, property-based testing).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate each vulnerability and assert failures on unfixed code.

**Test Cases**:

1. **Role Bypass Test (A7-05)**: Create a test route that uses `createClient()` without `withAuth()` (will fail lint on unfixed code)
   - Create `src/app/api/__test-bypass__/route.ts` with direct `createClient()` call
   - Run `npm run lint` and assert ESLint error is emitted
   - Verify error message mentions "no-direct-supabase-in-routes"
   - Expected: No ESLint rule exists yet, so lint passes (bug confirmed)

2. **Malware Upload Test (A37-06)**: Upload a test malware file (EICAR test string) (will fail on unfixed code)
   - Create EICAR test file: `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`
   - POST to `/api/upload` with EICAR file
   - Assert file is stored to R2 without rejection
   - Expected: File is stored (bug confirmed - no AV scanning)

3. **SSRF Test (A1-02)**: Call verification-token endpoint without CAPTCHA (will fail on unfixed code)
   - POST to `/api/v1/register-clinic/verification-token` without `turnstileToken`
   - Assert request succeeds and returns DNS token
   - Expected: Request succeeds without CAPTCHA (bug confirmed)

4. **Slack Failure Test (A8-02)**: Mock Slack webhook failure during registration (will fail on unfixed code)
   - Mock `fetch()` to return 500 error for Slack webhook URL
   - POST to `/api/v1/register-clinic` with valid registration data
   - Assert no email fallback is sent (check email service mock)
   - Expected: Only logger.error() is called, no email sent (bug confirmed)

5. **ReDoS Test (R11-01)**: Pass deeply nested HTML to sanitizer (will fail on unfixed code)
   - Generate HTML with 1000 nested `<div>` tags
   - Call `sanitizeHtml()` and measure execution time
   - Assert execution time > 1 second (catastrophic backtracking)
   - Expected: Custom regex exhibits super-linear time (bug confirmed)

**Expected Counterexamples**:
- ESLint allows direct `createClient()` in route handlers
- EICAR test file is stored without AV rejection
- Verification-token endpoint accepts requests without CAPTCHA
- Slack failures do not trigger email fallbacks
- Nested HTML causes CPU exhaustion in sanitizer

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed functions produce the expected secure behavior.

**Pseudocode:**

**Bug 1: ESLint Rule**
```
FOR ALL file WHERE isBugCondition_RoleBypass(file) DO
  lintResult := eslint.check(file)
  ASSERT lintResult.hasError("no-direct-supabase-in-routes")
END FOR
```

**Bug 2: AV Scanning**
```
FOR ALL upload WHERE isBugCondition_NoScan(upload) DO
  result := processUpload_fixed(upload)
  ASSERT result.scanCompleted = TRUE AND
         (result.scanResult = "CLEAN" OR result.rejected = TRUE)
END FOR
```

**Bug 3: Rate Limit + CAPTCHA**
```
FOR ALL request WHERE isBugCondition_SSRF(request) DO
  result := handleVerificationToken_fixed(request)
  ASSERT result.rateLimitEnforced = TRUE AND
         result.turnstileVerified = TRUE AND
         result.emailConfirmationRequired = TRUE
END FOR
```

**Bug 4: Email Fallback**
```
FOR ALL notification WHERE isBugCondition_SlackFailure(notification) DO
  result := handleNotification_fixed(notification)
  ASSERT result.emailFallbackSent = TRUE AND
         result.metricEmitted = "slack.post.failure"
END FOR
```

**Bug 5: Linear Time Sanitization**
```
FOR ALL input WHERE isBugCondition_ReDoS(input) DO
  startTime := now()
  result := sanitizeHTML_fixed(input)
  duration := now() - startTime
  
  ASSERT duration < 100ms AND
         result.sanitized = TRUE AND
         libraryUsed = "DOMPurify"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same results as the original functions.

**Pseudocode:**

**Bug 1: Authenticated Routes**
```
FOR ALL file WHERE NOT isBugCondition_RoleBypass(file) DO
  // Routes using withAuth() continue to work
  ASSERT authenticatedRoute_original(request) = authenticatedRoute_fixed(request)
END FOR
```

**Bug 2: Clean Files**
```
FOR ALL upload WHERE NOT isBugCondition_NoScan(upload) DO
  // Clean files are stored identically
  ASSERT processUpload_original(upload).stored = processUpload_fixed(upload).stored
END FOR
```

**Bug 3: Legitimate Tokens**
```
FOR ALL request WHERE NOT isBugCondition_SSRF(request) DO
  // Verified requests continue to receive tokens
  ASSERT handleVerificationToken_original(request).tokenIssued = 
         handleVerificationToken_fixed(request).tokenIssued
END FOR
```

**Bug 4: Successful Slack**
```
FOR ALL notification WHERE NOT isBugCondition_SlackFailure(notification) DO
  // Successful Slack posts don't trigger fallback
  ASSERT handleNotification_original(notification).slackSent = TRUE AND
         handleNotification_fixed(notification).emailFallbackSent = FALSE
END FOR
```

**Bug 5: Normal HTML**
```
FOR ALL input WHERE NOT isBugCondition_ReDoS(input) DO
  // Normal HTML sanitizes with same output
  ASSERT sanitizeHTML_original(input).allowedTags = sanitizeHTML_fixed(input).allowedTags AND
         sanitizeHTML_original(input).output ≈ sanitizeHTML_fixed(input).output
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bug inputs, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Authenticated Route Preservation**: Verify routes using `withAuth()` continue to work
   - Test existing authenticated endpoints (e.g., `/api/patients`, `/api/appointments`)
   - Assert authentication and authorization behavior unchanged
   - Verify RBAC policies still enforced correctly

2. **Clean File Preservation**: Verify clean files are stored correctly
   - Upload legitimate PDF, JPEG, PNG files
   - Assert files are stored to R2 with correct keys
   - Verify `patient_files` table tracking works

3. **Legitimate Token Preservation**: Verify verified users receive tokens
   - Complete email confirmation flow
   - Request verification token with valid CAPTCHA
   - Assert token is issued correctly

4. **Successful Slack Preservation**: Verify successful Slack posts don't trigger fallback
   - Mock Slack webhook to return 200 OK
   - Complete clinic registration
   - Assert email fallback is NOT sent

5. **Normal HTML Preservation**: Verify normal HTML sanitizes correctly
   - Test blog posts with safe tags (p, strong, em, ul, ol, li, a)
   - Assert formatting and readability preserved
   - Verify no XSS vulnerabilities introduced

### Unit Tests

- Test ESLint rule detects `createClient()` in route handlers
- Test ESLint rule allows `createClient()` in non-route files
- Test AV scanning rejects EICAR test file
- Test AV scanning allows clean files
- Test rate limiter blocks excessive verification-token requests
- Test Turnstile CAPTCHA verification rejects invalid tokens
- Test email fallback sends correct registration details
- Test metrics emission for Slack failures
- Test DOMPurify sanitizes deeply nested HTML in <100ms
- Test input size limit rejects 2 MB HTML inputs

### Property-Based Tests

- Generate random route files and verify ESLint rule correctness
- Generate random file uploads (clean and malicious) and verify AV scanning
- Generate random verification-token requests and verify rate limiting
- Generate random HTML inputs (nested, repetitive, normal) and verify linear time sanitization
- Test that all non-buggy inputs continue to work across many scenarios

### Integration Tests

- Test full registration flow with Slack failure and email fallback
- Test file upload → AV scan → storage → download flow
- Test verification-token → email confirmation → DNS token flow
- Test blog post rendering with sanitized HTML
- Test authenticated API routes with ESLint enforcement

