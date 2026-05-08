# Implementation Plan: Phase 4 High-Priority Security Fixes

## Overview

This implementation plan addresses 5 high-priority security vulnerabilities using the bug condition methodology. Each bug follows the exploratory workflow: write tests BEFORE fixes to understand the vulnerabilities, then implement fixes with verification.

---

## Bug 1: Role Check Bypass via Direct createClient() Usage (A7-05)

- [ ] 1.1 Write bug condition exploration test for role bypass
  - **Property 1: Bug Condition** - ESLint Rule Enforcement for Route Authentication
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating routes can bypass authentication
  - **Scoped PBT Approach**: Create test route file using `createClient()` without `withAuth()` wrapper
  - Test implementation details from Bug Condition in design:
    - Create `src/app/api/__test-bypass__/route.ts` with direct `createClient()` call
    - Run `npm run lint` and capture ESLint output
    - Assert ESLint emits error mentioning "no-direct-supabase-in-routes"
  - The test assertions should match Expected Behavior Properties from design (2.1, 2.2, 2.3)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (no ESLint rule exists yet - proves bug exists)
  - Document counterexamples: routes that bypass `withAuth()` are not caught by linter
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [~] 1.2 Write preservation property tests for role bypass fix (BEFORE implementing fix)
  - **Property 2: Preservation** - Authenticated Route Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for routes correctly using `withAuth()`:
    - Test existing authenticated endpoints (e.g., `/api/patients`, `/api/appointments`)
    - Verify authentication and authorization work correctly
    - Verify RBAC policies are enforced
  - Observe behavior on UNFIXED code for non-route files using `createClient()`:
    - Test utilities, middleware, server components
    - Verify direct client instantiation is allowed
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 1.3 Fix for role check bypass (A7-05)

  - [~] 1.3.1 Create custom ESLint rule
    - Create `eslint-rules/no-direct-supabase-in-routes.js`
    - Rule detects `createClient()` calls in `src/app/api/**/route.ts` files
    - Check if file contains `withAuth(`, `withAuthAnyRole(`, or `withAuthValidation(`
    - Emit error if `createClient()` used without authentication wrapper
    - Allow `createClient()` in non-route files (utilities, middleware, components)
    - _Bug_Condition: isBugCondition_RoleBypass(file) where file.path matches route.ts AND contains createClient() without withAuth_
    - _Expected_Behavior: ESLint SHALL reject code at lint time requiring withAuth() usage_
    - _Preservation: Non-route files SHALL continue to allow direct createClient() instantiation_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [~] 1.3.2 Register rule in ESLint config
    - Update `eslint.config.mjs`
    - Import custom rule from `eslint-rules/` directory
    - Apply rule to `src/app/api/**/route.ts` pattern
    - Set severity to "error" (not "warn") to block commits
    - _Requirements: 2.1, 2.2_

  - [~] 1.3.3 Update pre-commit hook
    - Update `.husky/pre-commit`
    - Ensure `npm run lint` runs before allowing commits
    - Verify ESLint errors block the commit
    - _Requirements: 2.1_

  - [~] 1.3.4 Document exception process
    - Add to `CONTRIBUTING.md`
    - Explain how to request exceptions for legitimate public endpoints
    - Require security review for any `eslint-disable` comments on this rule
    - _Requirements: 2.2_

  - [~] 1.3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - ESLint Rule Enforcement
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - The test from task 1.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms ESLint rule catches bypass attempts)
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 1.3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Authenticated Route Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 1.2 - do NOT write new tests
    - Run preservation property tests from step 1.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm authenticated routes and non-route files work correctly

- [~] 1.4 Checkpoint - Ensure Bug 1 tests pass
  - Verify ESLint rule catches direct `createClient()` usage in routes
  - Verify authenticated routes continue to work
  - Verify non-route files can still use `createClient()`

---

## Bug 2: No Malware Scanning on File Uploads (A37-06)

- [~] 2.1 Write bug condition exploration test for malware scanning
  - **Property 1: Bug Condition** - ClamAV Malware Detection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating malware is not scanned
  - **Scoped PBT Approach**: Use EICAR test file (standard AV test string) to verify scanning
  - Test implementation details from Bug Condition in design:
    - Create EICAR test file: `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`
    - POST to `/api/upload` with EICAR file
    - Assert file is stored to R2 without rejection
  - The test assertions should match Expected Behavior Properties from design (2.4, 2.5, 2.6)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (file is stored without AV scan - proves bug exists)
  - Document counterexamples: malicious files pass validation and are stored
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.4, 1.5, 1.6_

- [~] 2.2 Write preservation property tests for malware scanning fix (BEFORE implementing fix)
  - **Property 2: Preservation** - Clean File Upload Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for clean file uploads:
    - Upload legitimate PDF, JPEG, PNG files
    - Verify files are stored to R2 with correct keys
    - Verify `patient_files` table tracking works
    - Verify file download authorization enforces tenant isolation
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.4, 3.5, 3.6_

- [ ] 2.3 Fix for malware scanning (A37-06)

  - [~] 2.3.1 Deploy ClamAV REST service
    - Use Docker image `mkodockx/docker-clamav-rest` or similar
    - Configure `AV_SCAN_URL=http://clamav-rest:8080/scan` in environment
    - Add health check endpoint to verify ClamAV is running
    - Update `docker-compose.yml` with ClamAV service
    - _Requirements: 2.4_

  - [~] 2.3.2 Enforce AV scanning in POST handler
    - Update `src/app/api/upload/route.ts`
    - Remove `if (process.env.AV_SCAN_URL)` conditional - make scanning mandatory
    - Add `AV_SCAN_REQUIRED=true` to `.env.example` and deployment configs
    - Fail closed (reject upload) if AV service is unreachable
    - Add retry logic: up to 3 attempts with exponential backoff
    - _Bug_Condition: isBugCondition_NoScan(upload) where upload.antivirusScanCompleted = FALSE_
    - _Expected_Behavior: System SHALL scan with ClamAV before persisting to R2_
    - _Preservation: Clean files SHALL continue to be stored and tracked in patient_files_
    - _Requirements: 2.4, 2.5, 3.4_

  - [~] 2.3.3 Add AV scanning to PUT confirmation handler
    - After magic byte validation, download full file from R2
    - Send to ClamAV REST API for scanning
    - Delete from R2 if malware detected
    - _Requirements: 2.6_

  - [~] 2.3.4 Add metrics emission
    - Emit `av.scan.success` for clean files
    - Emit `av.scan.malware` for malware detected
    - Emit `av.scan.failure` for service unavailable
    - Use for alerting on AV service outages
    - _Requirements: 2.5_

  - [~] 2.3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - ClamAV Malware Detection
    - **IMPORTANT**: Re-run the SAME test from task 2.1 - do NOT write a new test
    - The test from task 2.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 2.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms EICAR file is rejected by AV scan)
    - _Requirements: 2.4, 2.5, 2.6_

  - [~] 2.3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Clean File Upload Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2.2 - do NOT write new tests
    - Run preservation property tests from step 2.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm clean files are stored and authorized correctly

- [~] 2.4 Checkpoint - Ensure Bug 2 tests pass
  - Verify EICAR test file is rejected by AV scan
  - Verify clean files are stored correctly
  - Verify file authorization continues to work

---

## Bug 3: SSRF and DoS via Unprotected Verification Token Endpoint (A1-02)

- [~] 3.1 Write bug condition exploration test for SSRF/DoS
  - **Property 1: Bug Condition** - Rate Limit and CAPTCHA Protection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating endpoint lacks protection
  - **Scoped PBT Approach**: Call verification-token endpoint without CAPTCHA and observe success
  - Test implementation details from Bug Condition in design:
    - POST to `/api/v1/register-clinic/verification-token` without `turnstileToken`
    - Assert request succeeds and returns DNS token
    - Test with internal domain (e.g., `internal.service.local`) to verify SSRF risk
    - Test with 100+ rapid requests to verify DoS risk
  - The test assertions should match Expected Behavior Properties from design (2.7, 2.8, 2.9)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (endpoint accepts requests without CAPTCHA - proves bug exists)
  - Document counterexamples: unprotected endpoint allows SSRF and DoS attacks
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.7, 1.8, 1.9_

- [~] 3.2 Write preservation property tests for SSRF/DoS fix (BEFORE implementing fix)
  - **Property 2: Preservation** - Legitimate Token Request Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for legitimate token requests:
    - Complete email confirmation flow
    - Request verification token with valid domain
    - Verify token is issued correctly
    - Verify main registration endpoint rate limits work
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.7, 3.8, 3.9_

- [ ] 3.3 Fix for SSRF and DoS (A1-02)

  - [~] 3.3.1 Add Turnstile CAPTCHA verification
    - Update `src/app/api/v1/register-clinic/verification-token/route.ts`
    - Import `verifyTurnstile` from `@/lib/turnstile`
    - Require `turnstileToken` in request body schema
    - Call `verifyTurnstile(turnstileToken)` before processing
    - Return 403 if CAPTCHA verification fails
    - _Bug_Condition: isBugCondition_SSRF(request) where request.turnstileVerified = FALSE_
    - _Expected_Behavior: System SHALL enforce CAPTCHA protection_
    - _Preservation: Legitimate verified requests SHALL continue to receive tokens_
    - _Requirements: 2.7, 2.9, 3.7_

  - [~] 3.3.2 Strengthen rate limiting
    - Reduce from 30 req/hour to 10 req/hour per IP
    - Add per-email rate limit (5 req/hour) to prevent enumeration
    - Log rate limit violations for security monitoring
    - _Requirements: 2.7, 2.9_

  - [~] 3.3.3 Add email confirmation requirement
    - Generate confirmation code and send via email
    - Store code in Redis/database with 15-minute expiry
    - Require `confirmationCode` in verification-token request body
    - Only issue DNS token after email confirmation succeeds
    - _Requirements: 2.8_

  - [~] 3.3.4 Add SSRF protection
    - Validate domain before DoH fetch
    - Reject private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    - Reject localhost, link-local, and reserved addresses
    - Reject non-FQDN inputs (must have at least one dot)
    - Use allowlist of public DNS resolvers for DoH queries
    - _Requirements: 2.9_

  - [~] 3.3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Rate Limit and CAPTCHA Protection
    - **IMPORTANT**: Re-run the SAME test from task 3.1 - do NOT write a new test
    - The test from task 3.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 3.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms endpoint rejects requests without CAPTCHA)
    - _Requirements: 2.7, 2.8, 2.9_

  - [~] 3.3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Legitimate Token Request Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 3.2 - do NOT write new tests
    - Run preservation property tests from step 3.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm legitimate users can still request tokens

- [~] 3.4 Checkpoint - Ensure Bug 3 tests pass
  - Verify endpoint rejects requests without CAPTCHA
  - Verify rate limiting blocks excessive requests
  - Verify email confirmation is required
  - Verify SSRF protection rejects internal domains

---

## Bug 4: Silent Slack Webhook Failures (A8-02)

- [~] 4.1 Write bug condition exploration test for Slack failures
  - **Property 1: Bug Condition** - Email Fallback and Metrics
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating silent failures
  - **Scoped PBT Approach**: Mock Slack webhook failure and verify no fallback is sent
  - Test implementation details from Bug Condition in design:
    - Mock `fetch()` to return 500 error for Slack webhook URL
    - POST to `/api/v1/register-clinic` with valid registration data
    - Assert no email fallback is sent (check email service mock)
    - Assert no metrics are emitted
  - The test assertions should match Expected Behavior Properties from design (2.10, 2.11, 2.12)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (only logger.error() called, no fallback - proves bug exists)
  - Document counterexamples: Slack failures are silent, operations unaware
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.10, 1.11, 1.12_

- [~] 4.2 Write preservation property tests for Slack failure fix (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Slack Notification Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for successful Slack notifications:
    - Mock Slack webhook to return 200 OK
    - Complete clinic registration
    - Verify Slack notification is sent
    - Verify email fallback is NOT sent
    - Verify clinic record and user account are created
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.10, 3.11, 3.12_

- [ ] 4.3 Fix for Slack webhook failures (A8-02)

  - [~] 4.3.1 Create email fallback function
    - Create `sendRegistrationEmailFallback()` in registration route
    - Accept clinic name, email, website, timestamp, error details
    - Send email to `OPERATIONS_EMAIL` (from environment variable)
    - Include all registration details for manual processing
    - Use Resend API (existing email service)
    - _Bug_Condition: isBugCondition_SlackFailure(notification) where notification.slackPostSuccess = FALSE_
    - _Expected_Behavior: System SHALL send email fallback with registration details_
    - _Preservation: Successful Slack posts SHALL not trigger email fallback_
    - _Requirements: 2.10, 2.12, 3.10_

  - [~] 4.3.2 Wrap Slack POST in try-catch
    - Update `src/app/api/v1/register-clinic/route.ts`
    - Add error handling around webhook call
    - Catch fetch errors, timeouts, non-200 responses
    - Call `sendRegistrationEmailFallback()` on any failure
    - Log both Slack failure and email fallback success/failure
    - _Requirements: 2.10_

  - [~] 4.3.3 Add metrics emission
    - Emit `slack.post.success` when webhook succeeds
    - Emit `slack.post.failure` when webhook fails
    - Emit `email.fallback.success` when fallback email sent
    - Emit `email.fallback.failure` when fallback email also fails
    - _Requirements: 2.11_

  - [~] 4.3.4 Configure alerting
    - Add alerts in monitoring system (docs/alerting-config.yml)
    - Alert on `slack.post.failure` rate > 10% over 1 hour
    - Alert on `email.fallback.failure` (critical - both channels down)
    - Include runbook link in alert for operations response
    - _Requirements: 2.11_

  - [~] 4.3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Email Fallback and Metrics
    - **IMPORTANT**: Re-run the SAME test from task 4.1 - do NOT write a new test
    - The test from task 4.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 4.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms email fallback is sent on Slack failure)
    - _Requirements: 2.10, 2.11, 2.12_

  - [~] 4.3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Slack Notification Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 4.2 - do NOT write new tests
    - Run preservation property tests from step 4.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm successful Slack posts don't trigger fallback

- [~] 4.4 Checkpoint - Ensure Bug 4 tests pass
  - Verify email fallback is sent on Slack failure
  - Verify metrics are emitted correctly
  - Verify successful Slack posts don't trigger fallback
  - Verify clinic registration completes regardless of notification status

---

## Bug 5: ReDoS Vulnerability in HTML Sanitization (R11-01)

- [~] 5.1 Write bug condition exploration test for ReDoS
  - **Property 1: Bug Condition** - Linear Time HTML Sanitization
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating ReDoS vulnerability
  - **Scoped PBT Approach**: Generate deeply nested HTML and measure execution time
  - Test implementation details from Bug Condition in design:
    - Generate HTML with 1000 nested `<div>` tags
    - Call `sanitizeHtml()` and measure execution time
    - Assert execution time > 1 second (catastrophic backtracking)
    - Test with repetitive patterns (10,000+ repeated tags)
  - The test assertions should match Expected Behavior Properties from design (2.13, 2.14, 2.15)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (custom regex exhibits super-linear time - proves bug exists)
  - Document counterexamples: nested HTML causes CPU exhaustion
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.13, 1.14, 1.15_

- [~] 5.2 Write preservation property tests for ReDoS fix (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal HTML Sanitization Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for normal HTML content:
    - Test blog posts with safe tags (p, strong, em, ul, ol, li, a)
    - Verify formatting and readability are preserved
    - Verify XSS protection (script, iframe tags are stripped)
    - Verify allowed tags continue to work
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.13, 3.14, 3.15_

- [ ] 5.3 Fix for ReDoS vulnerability (R11-01)

  - [~] 5.3.1 Remove custom regex sanitization
    - Update `src/lib/sanitize-html.ts`
    - Delete all custom regex-based sanitization code
    - Verify file already uses DOMPurify (imported from `isomorphic-dompurify`)
    - Search codebase for `/<[^>]+>/g` and similar patterns
    - _Bug_Condition: isBugCondition_ReDoS(input) where customSanitizer.timeComplexity(input) > O(n)_
    - _Expected_Behavior: System SHALL use DOMPurify with linear time complexity_
    - _Preservation: Normal HTML SHALL continue to allow safe tags and strip dangerous elements_
    - _Requirements: 2.13, 2.14, 3.13_

  - [~] 5.3.2 Verify DOMPurify configuration
    - Ensure `ALLOWED_TAGS` includes only safe tags (no script, iframe, object, embed)
    - Ensure `FORBID_TAGS` explicitly blocks dangerous tags (defense-in-depth)
    - Ensure `FORBID_ATTR` blocks event handlers (onerror, onload, onclick, etc.)
    - Ensure `ALLOWED_URI_REGEXP` restricts to http/https/mailto/tel/data:image
    - _Requirements: 2.15, 3.13_

  - [~] 5.3.3 Add timeout protection
    - Wrap sanitization in `Promise.race()` with 5-second timeout
    - Return empty string if sanitization exceeds timeout
    - Log timeout events for monitoring (should never happen with DOMPurify)
    - _Requirements: 2.14_

  - [~] 5.3.4 Add input size limit
    - Limit to 1 MB (1,048,576 bytes) before sanitization
    - Return error for oversized inputs
    - Prevents memory exhaustion attacks
    - _Requirements: 2.14_

  - [~] 5.3.5 Add performance tests
    - Create property-based tests for deeply nested HTML (1000+ levels)
    - Create property-based tests for repetitive patterns (10,000+ repeated tags)
    - Assert sanitization completes in <100ms for all inputs
    - Assert linear time complexity O(n) where n = input length
    - _Requirements: 2.13, 2.14_

  - [~] 5.3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Linear Time HTML Sanitization
    - **IMPORTANT**: Re-run the SAME test from task 5.1 - do NOT write a new test
    - The test from task 5.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms nested HTML sanitizes in <100ms)
    - _Requirements: 2.13, 2.14, 2.15_

  - [~] 5.3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal HTML Sanitization Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 5.2 - do NOT write new tests
    - Run preservation property tests from step 5.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm normal HTML continues to be sanitized correctly

- [~] 5.4 Checkpoint - Ensure Bug 5 tests pass
  - Verify nested HTML sanitizes in <100ms
  - Verify normal HTML formatting is preserved
  - Verify XSS protection still works
  - Verify no CPU exhaustion occurs

---

## Final Checkpoint

- [~] 6. Ensure all tests pass
  - Run full test suite: `npm run test`
  - Run E2E tests: `npm run test:e2e`
  - Verify all 5 bugs are fixed
  - Verify all preservation tests pass
  - Ask the user if questions arise
