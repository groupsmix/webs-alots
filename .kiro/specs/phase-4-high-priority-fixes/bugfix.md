# Bugfix Requirements Document: Phase 4 High-Priority Security Fixes

## Introduction

This document addresses 5 high-priority security vulnerabilities identified in the technical audit that remain unresolved after Phase 1-3 fixes. These vulnerabilities span authentication bypass risks, malware upload vectors, SSRF/DoS attack surfaces, operational blind spots, and ReDoS vulnerabilities. The platform is a multi-tenant healthcare SaaS handling PHI and must comply with Morocco Law 09-08 and GDPR.

**Affected Audit Findings:**
- **A7-05 (MEDIUM)**: Role check centralization - routes can bypass withAuth
- **A37-06 (HIGH)**: No antivirus scan on file uploads
- **A1-02 (MEDIUM)**: SSRF - DoH metadata fetch with user-supplied domain
- **A8-02 (MEDIUM)**: Silent failure in Slack webhook
- **R11-01 (MEDIUM)**: ReDoS in sanitize-html.ts

---

## Bug Analysis

### Bug 1: Role Check Bypass via Direct createClient() Usage (A7-05)

#### Current Behavior (Defect)

1.1 WHEN a route handler in `src/app/api/**/route.ts` uses `createClient()` directly without wrapping the handler in `withAuth()` THEN the system allows unauthenticated or unauthorized users to access protected resources

1.2 WHEN a developer adds a new API route and forgets to use `withAuth()` THEN the system does not prevent the route from being deployed with missing role checks

1.3 WHEN a route handler bypasses `withAuth()` and manually calls `createClient()` THEN the system does not enforce RBAC policies defined in the authentication layer

#### Expected Behavior (Correct)

2.1 WHEN a route handler in `src/app/api/**/route.ts` attempts to use `createClient()` directly THEN the system SHALL reject the code at lint time with an ESLint error requiring `withAuth()` usage

2.2 WHEN a developer adds a new API route THEN the system SHALL enforce that all route handlers use `withAuth()` or an approved authentication wrapper before accessing Supabase

2.3 WHEN a route handler needs database access THEN the system SHALL require the authenticated client from `withAuth()` context instead of direct `createClient()` instantiation

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN a route handler correctly uses `withAuth()` with appropriate role checks THEN the system SHALL CONTINUE TO allow the route to authenticate and authorize requests

3.2 WHEN non-route files (utilities, middleware, server components) use `createClient()` for legitimate purposes THEN the system SHALL CONTINUE TO allow direct client instantiation outside route handlers

3.3 WHEN existing authenticated routes process requests THEN the system SHALL CONTINUE TO enforce the same RBAC policies without performance degradation

---

### Bug 2: No Malware Scanning on File Uploads (A37-06)

#### Current Behavior (Defect)

1.4 WHEN a user uploads a file to `/api/files/upload` THEN the system persists the file to R2 storage without scanning for malware

1.5 WHEN a malicious file is uploaded THEN the system stores and serves the file to other users without virus detection

1.6 WHEN the upload-confirm endpoint is called THEN the system only validates file metadata but does not perform antivirus scanning before finalizing the upload

#### Expected Behavior (Correct)

2.4 WHEN a user uploads a file to `/api/files/upload` THEN the system SHALL scan the file with ClamAV before persisting to R2 storage

2.5 WHEN a malicious file is detected during scanning THEN the system SHALL reject the upload, delete any temporary files, and return an error to the user

2.6 WHEN the upload-confirm endpoint is called THEN the system SHALL verify that antivirus scanning has completed successfully before finalizing the upload

#### Unchanged Behavior (Regression Prevention)

3.4 WHEN a clean file is uploaded THEN the system SHALL CONTINUE TO persist the file to R2 and track ownership in the `patient_files` table

3.5 WHEN file upload authorization checks are performed THEN the system SHALL CONTINUE TO enforce tenant isolation and role-based access controls

3.6 WHEN file downloads are requested THEN the system SHALL CONTINUE TO enforce the existing authorization rules (patients see own files, staff see all clinic files)

---

### Bug 3: SSRF and DoS via Unprotected Verification Token Endpoint (A1-02)

#### Current Behavior (Defect)

1.7 WHEN an attacker calls `/api/v1/register-clinic/verification-token` with a user-supplied domain THEN the system performs DoH metadata fetch without rate limiting or CAPTCHA protection

1.8 WHEN an attacker repeatedly calls the verification token endpoint THEN the system allows unlimited self-issued tokens without email confirmation

1.9 WHEN the verification token endpoint is abused THEN the system does not prevent SSRF attacks against internal services or DoS attacks via resource exhaustion

#### Expected Behavior (Correct)

2.7 WHEN a user calls `/api/v1/register-clinic/verification-token` THEN the system SHALL enforce the same rate-limit and Turnstile CAPTCHA protection as the main registration endpoint

2.8 WHEN a verification token is requested THEN the system SHALL require email confirmation before issuing the token

2.9 WHEN the verification token endpoint detects suspicious activity (rate limit exceeded, CAPTCHA failure) THEN the system SHALL reject the request and log the attempt for security monitoring

#### Unchanged Behavior (Regression Prevention)

3.7 WHEN a legitimate user completes email confirmation and requests a verification token THEN the system SHALL CONTINUE TO issue valid tokens for clinic registration

3.8 WHEN the main registration endpoint `/api/v1/register-clinic/route.ts` processes requests THEN the system SHALL CONTINUE TO enforce existing rate limits and CAPTCHA checks

3.9 WHEN DoH metadata is fetched for verified domains THEN the system SHALL CONTINUE TO validate domain ownership and prevent unauthorized access

---

### Bug 4: Silent Slack Webhook Failures (A8-02)

#### Current Behavior (Defect)

1.10 WHEN the Slack webhook POST fails during clinic registration THEN the system only logs an error via `logger.error()` without alerting operations

1.11 WHEN Slack is unavailable or misconfigured THEN the system does not send fallback notifications to operations staff

1.12 WHEN multiple Slack failures occur THEN the system does not emit metrics or alerts for monitoring systems to detect the outage

#### Expected Behavior (Correct)

2.10 WHEN the Slack webhook POST fails THEN the system SHALL send an email fallback notification to the operations team with registration details

2.11 WHEN Slack failures are detected THEN the system SHALL emit a `slack.post.failure` metric for monitoring and alerting systems

2.12 WHEN the email fallback is sent THEN the system SHALL include sufficient context (clinic name, registration timestamp, error details) for operations to manually process the registration

#### Unchanged Behavior (Regression Prevention)

3.10 WHEN the Slack webhook POST succeeds THEN the system SHALL CONTINUE TO send notifications to Slack without triggering email fallbacks

3.11 WHEN clinic registration completes successfully THEN the system SHALL CONTINUE TO create the clinic record and user account regardless of notification delivery status

3.12 WHEN audit logs are written for registration events THEN the system SHALL CONTINUE TO record all state-changing operations via `logAuditEvent()`

---

### Bug 5: ReDoS Vulnerability in HTML Sanitization (R11-01)

#### Current Behavior (Defect)

1.13 WHEN crafted HTML input with nested tags is passed to `sanitize-html.ts` THEN the system's custom regex exhibits super-linear time complexity causing CPU exhaustion

1.14 WHEN an attacker submits malicious HTML to blog post rendering or user-generated content THEN the system becomes unresponsive due to ReDoS attack

1.15 WHEN the custom sanitization regex processes deeply nested or repetitive HTML patterns THEN the system consumes excessive CPU time blocking other requests

#### Expected Behavior (Correct)

2.13 WHEN HTML input is sanitized THEN the system SHALL use a battle-tested library (DOMPurify or sanitize-html npm package) with linear time complexity guarantees

2.14 WHEN crafted HTML input is processed THEN the system SHALL sanitize the content without CPU exhaustion or request timeouts

2.15 WHEN the sanitization library is integrated THEN the system SHALL configure it to allow only safe HTML tags and attributes appropriate for blog content

#### Unchanged Behavior (Regression Prevention)

3.13 WHEN legitimate HTML content is sanitized THEN the system SHALL CONTINUE TO allow safe tags (p, strong, em, ul, ol, li, a, etc.) and strip dangerous elements (script, iframe, etc.)

3.14 WHEN blog posts are rendered at `/app/(public)/blog/[slug]/page.tsx` THEN the system SHALL CONTINUE TO display formatted content without XSS vulnerabilities

3.15 WHEN sanitized HTML is displayed to users THEN the system SHALL CONTINUE TO preserve the intended formatting and readability of the content

---

## Bug Condition Derivation

### Bug 1: Role Check Bypass

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_RoleBypass(file)
  INPUT: file of type SourceFile
  OUTPUT: boolean
  
  // Returns true when a route.ts file uses createClient() directly
  RETURN (
    file.path MATCHES "src/app/api/**/route.ts" AND
    file.content CONTAINS "createClient()" AND
    file.content NOT_CONTAINS "withAuth("
  )
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - ESLint Rule Enforcement
FOR ALL file WHERE isBugCondition_RoleBypass(file) DO
  lintResult ← eslint.check(file)
  ASSERT lintResult.hasError("no-direct-supabase-in-routes")
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL file WHERE NOT isBugCondition_RoleBypass(file) DO
  // Non-route files can still use createClient()
  ASSERT file.canUseCreateClient = TRUE
END FOR
```

---

### Bug 2: No Malware Scanning

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_NoScan(upload)
  INPUT: upload of type FileUpload
  OUTPUT: boolean
  
  // Returns true when file is uploaded without antivirus scan
  RETURN (
    upload.endpoint = "/api/files/upload" AND
    upload.antivirusScanCompleted = FALSE
  )
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - ClamAV Integration
FOR ALL upload WHERE isBugCondition_NoScan(upload) DO
  result ← processUpload'(upload)
  ASSERT result.scanCompleted = TRUE AND
         (result.scanResult = "CLEAN" OR result.rejected = TRUE)
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL upload WHERE NOT isBugCondition_NoScan(upload) DO
  // Clean files continue to be stored and authorized correctly
  ASSERT processUpload(upload).stored = processUpload'(upload).stored
END FOR
```

---

### Bug 3: SSRF and DoS

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_SSRF(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  // Returns true when verification-token endpoint is called without protection
  RETURN (
    request.path = "/api/v1/register-clinic/verification-token" AND
    (request.rateLimitChecked = FALSE OR request.turnstileVerified = FALSE)
  )
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Rate Limit and CAPTCHA
FOR ALL request WHERE isBugCondition_SSRF(request) DO
  result ← handleVerificationToken'(request)
  ASSERT result.rateLimitEnforced = TRUE AND
         result.turnstileVerified = TRUE AND
         result.emailConfirmationRequired = TRUE
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL request WHERE NOT isBugCondition_SSRF(request) DO
  // Legitimate verified requests continue to work
  ASSERT handleVerificationToken(request).tokenIssued = 
         handleVerificationToken'(request).tokenIssued
END FOR
```

---

### Bug 4: Silent Slack Failures

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_SlackFailure(notification)
  INPUT: notification of type SlackNotification
  OUTPUT: boolean
  
  // Returns true when Slack POST fails
  RETURN notification.slackPostSuccess = FALSE
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Email Fallback and Metrics
FOR ALL notification WHERE isBugCondition_SlackFailure(notification) DO
  result ← handleNotification'(notification)
  ASSERT result.emailFallbackSent = TRUE AND
         result.metricEmitted = "slack.post.failure"
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL notification WHERE NOT isBugCondition_SlackFailure(notification) DO
  // Successful Slack posts don't trigger email fallback
  ASSERT handleNotification(notification).slackSent = TRUE AND
         handleNotification'(notification).emailFallbackSent = FALSE
END FOR
```

---

### Bug 5: ReDoS Vulnerability

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_ReDoS(input)
  INPUT: input of type HTMLString
  OUTPUT: boolean
  
  // Returns true when HTML has patterns that trigger super-linear regex
  RETURN (
    input.containsNestedTags = TRUE OR
    input.containsRepetitivePatterns = TRUE
  ) AND customSanitizer.timeComplexity(input) > O(n)
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Linear Time Sanitization
FOR ALL input WHERE isBugCondition_ReDoS(input) DO
  startTime ← now()
  result ← sanitizeHTML'(input)
  duration ← now() - startTime
  
  ASSERT duration < TIMEOUT_THRESHOLD AND
         result.sanitized = TRUE AND
         libraryUsed IN ["DOMPurify", "sanitize-html"]
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL input WHERE NOT isBugCondition_ReDoS(input) DO
  // Normal HTML continues to be sanitized with same output
  ASSERT sanitizeHTML(input).allowedTags = sanitizeHTML'(input).allowedTags AND
         sanitizeHTML(input).output ≈ sanitizeHTML'(input).output
END FOR
```

---

## Summary

This bugfix addresses 5 distinct security vulnerabilities:

1. **A7-05**: Prevents authentication bypass by enforcing ESLint rules against direct `createClient()` usage in route handlers
2. **A37-06**: Integrates ClamAV malware scanning before persisting uploaded files to R2
3. **A1-02**: Protects verification token endpoint with rate limiting, CAPTCHA, and email confirmation
4. **A8-02**: Adds email fallback and metrics emission when Slack webhook failures occur
5. **R11-01**: Replaces custom regex-based HTML sanitization with battle-tested library to prevent ReDoS

Each fix includes preservation checks to ensure existing functionality remains intact while closing the security gaps.
