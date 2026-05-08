# Requirements Document: Phase 5 Remaining Security Fixes

## Introduction

This document specifies requirements for fixing the remaining 25 security vulnerabilities from the technical audit that were not addressed in Phases 1-4. The Oltigo Health platform is a multi-tenant healthcare SaaS handling Protected Health Information (PHI) under Morocco Law 09-08 and GDPR. These fixes address input validation gaps, infrastructure hardening, operational resilience, data integrity, and documentation requirements across MEDIUM, LOW, and INFO severity findings.

## Glossary

- **System**: The Oltigo Health multi-tenant healthcare platform
- **Slack_Notifier**: The notification service that sends clinic registration alerts to Slack
- **CMI_Gateway**: The Moroccan interbank payment gateway integration
- **Sanitizer**: The HTML sanitization service for blog content
- **AV_Scanner**: The ClamAV antivirus scanning service for file uploads
- **Rate_Limiter**: The request throttling mechanism in `src/lib/rate-limit.ts`
- **Turnstile**: Cloudflare CAPTCHA service for bot protection
- **TOTP_Service**: Time-based One-Time Password authentication service
- **Audit_Logger**: The audit logging service in `src/lib/audit-log.ts`
- **Data_Layer**: The database query layer using Supabase client
- **PHI**: Protected Health Information - patient medical data
- **EICAR**: European Institute for Computer Antivirus Research test file
- **DoH**: DNS over HTTPS - secure DNS resolution protocol
- **SSRF**: Server-Side Request Forgery attack
- **ReDoS**: Regular Expression Denial of Service attack
- **XSS**: Cross-Site Scripting attack
- **RLS**: Row Level Security - PostgreSQL security policies
- **JSONB**: PostgreSQL JSON binary data type
- **PITR**: Point-In-Time Recovery for database backups

## Requirements

### Requirement 1: Input Validation and Injection Prevention

**User Story:** As a security engineer, I want all user inputs to be properly validated and sanitized, so that injection attacks (XSS, markdown injection, open redirects) are prevented.

#### Acceptance Criteria

1. WHEN a clinic registration notification is sent to Slack, THE Slack_Notifier SHALL escape or use plain_text blocks for all user-supplied fields (clinic name, email, website) to prevent markdown injection
2. WHEN a CMI payment callback URL is constructed, THE CMI_Gateway SHALL validate the success_url and fail_url against an allowlist of permitted hostnames to prevent open redirect attacks
3. WHEN HTML content is sanitized for blog posts, THE Sanitizer SHALL use DOMPurify library with linear time complexity to prevent ReDoS attacks
4. WHEN HTML content exceeds 1 MB in size, THE Sanitizer SHALL reject the input to prevent memory exhaustion
5. WHEN AI provider payloads are constructed, THE System SHALL enforce maximum token limits per request to prevent token exhaustion (covered by Phase 1 A1-01 fix, verification only)

### Requirement 2: Cryptographic Operations and Key Management

**User Story:** As a compliance officer, I want cryptographic operations to be properly implemented and keys to be rotatable, so that PHI encryption meets regulatory requirements.

#### Acceptance Criteria

1. WHEN the PHI encryption key rotation script is executed, THE System SHALL rotate keys for all encrypted files in R2 storage without data loss
2. WHEN a TOTP recovery code is used for authentication, THE TOTP_Service SHALL mark the code as consumed and prevent reuse
3. WHEN TOTP recovery codes are stored, THE TOTP_Service SHALL hash codes with SHA-256 before storage to prevent plaintext exposure
4. WHEN a booking token is verified, THE System SHALL validate that the clinicId in the token matches the expected clinic before signature verification (covered by Phase 1 A6-13 fix, verification only)

### Requirement 3: Rate Limiting and DoS Prevention

**User Story:** As a platform operator, I want all public endpoints to have appropriate rate limiting and bot protection, so that denial-of-service attacks are mitigated.

#### Acceptance Criteria

1. WHEN a request is made to `/api/v1/register-clinic/verification-token`, THE Rate_Limiter SHALL enforce the same rate limits as the main registration endpoint (10 requests/hour per IP)
2. WHEN a request is made to `/api/v1/register-clinic/verification-token`, THE System SHALL require Turnstile CAPTCHA verification before processing
3. WHEN a request is made to `/api/v1/register-clinic/verification-token`, THE System SHALL require email confirmation before issuing DNS verification tokens
4. WHEN a domain is supplied for DoH metadata fetch, THE System SHALL reject private IP ranges, localhost, and non-FQDN inputs to prevent SSRF attacks

### Requirement 4: Malware Detection and File Security

**User Story:** As a security engineer, I want all file uploads to be scanned for malware, so that malicious files cannot be stored or distributed to users.

#### Acceptance Criteria

1. WHEN a file is uploaded to `/api/upload`, THE AV_Scanner SHALL scan the file with ClamAV before persisting to R2 storage
2. WHEN malware is detected in an uploaded file, THE System SHALL reject the upload and delete any temporary files
3. WHEN the AV scanning service is unavailable, THE System SHALL fail closed and reject uploads until the service is restored
4. WHEN an EICAR test file is uploaded, THE AV_Scanner SHALL detect it as malware and reject the upload (test case)

### Requirement 5: Operational Resilience and Monitoring

**User Story:** As an operations engineer, I want critical notification failures to have fallback mechanisms and alerting, so that no registrations are lost due to infrastructure issues.

#### Acceptance Criteria

1. WHEN a Slack webhook POST fails during clinic registration, THE System SHALL send an email fallback notification to the operations team
2. WHEN a Slack webhook POST fails, THE System SHALL emit a `slack.post.failure` metric for monitoring systems
3. WHEN a Slack webhook POST succeeds, THE System SHALL NOT trigger email fallback notifications
4. WHEN the email fallback service is also unavailable, THE System SHALL log the failure and emit a `email.fallback.failure` metric for critical alerting

### Requirement 6: Code Quality and Static Analysis

**User Story:** As a developer, I want static analysis to prevent common security mistakes, so that authentication bypasses and audit log gaps are caught at development time.

#### Acceptance Criteria

1. WHEN a route handler in `src/app/api/**/route.ts` uses `createClient()` without `withAuth()`, THE System SHALL emit an ESLint error preventing commit
2. WHEN a non-route file (utility, middleware, component) uses `createClient()`, THE System SHALL allow the usage without ESLint errors
3. WHEN a state-changing API operation is performed, THE Audit_Logger SHALL log the event (enforcement via ESLint rule recommended but not required)

### Requirement 7: Data Integrity and Schema Enforcement

**User Story:** As a database administrator, I want database schemas to enforce data integrity constraints, so that invalid data cannot be persisted.

#### Acceptance Criteria

1. WHEN prescription content is stored as JSONB, THE System SHALL validate the structure against a Zod schema before insertion
2. WHEN a product is deleted from the products table, THE System SHALL handle the cascade behavior for stock table references appropriately (review and document behavior)
3. WHEN API responses are constructed, THE Data_Layer SHALL use explicit column selection instead of `select("*")` to prevent over-fetching
4. WHEN list endpoints are queried, THE Data_Layer SHALL enforce `.limit()` clauses to prevent unbounded result sets
5. WHEN the deprecated `clinicId` field is submitted in lab report API requests, THE System SHALL reject the request with a validation error

### Requirement 8: Infrastructure Configuration and Documentation

**User Story:** As a DevOps engineer, I want infrastructure configurations to be reviewed and documented, so that security best practices are followed.

#### Acceptance Criteria

1. WHEN `wrangler.toml` is deployed, THE System SHALL ensure no literal secrets are present in the configuration file
2. WHEN MinIO credentials are used in local development, THE System SHALL document that default credentials are for local-dev-only and not for production
3. WHEN database migrations are rolled back, THE System SHALL follow documented rollback procedures to prevent data loss
4. WHEN KMS envelope encryption is used, THE System SHALL document the integration pattern for future reference
5. WHEN PITR (Point-In-Time Recovery) is configured, THE System SHALL verify the retention SLA meets compliance requirements (30 days minimum)
6. WHEN database connections are established, THE System SHALL verify SSL mode is enabled for all production connections

### Requirement 9: Performance and Resource Management

**User Story:** As a platform operator, I want database queries to be optimized and resource usage to be bounded, so that performance degradation and resource exhaustion are prevented.

#### Acceptance Criteria

1. WHEN the `audit_log` table is queried, THE System SHALL use indexed columns to prevent full-table scans
2. WHEN clinic configuration is loaded, THE System SHALL detect drift between static files and database records and alert operators
3. WHEN API property-level authorization is enforced, THE System SHALL validate that users can only access fields they are authorized to view

### Requirement 10: Dead Code and Technical Debt Removal

**User Story:** As a developer, I want dead code and placeholder comments to be removed, so that the codebase is maintainable and security-reviewed code is production-ready.

#### Acceptance Criteria

1. WHEN the codebase is scanned, THE System SHALL have no references to `trade_license_base64` verification mode (covered by Phase 3 A2-01 fix, verification only)
2. WHEN `package.json` is reviewed, THE System SHALL have no CVE placeholder comments in dependency rationale fields
3. WHEN the codebase is scanned, THE System SHALL have no TODO comments related to security features that are not yet implemented

## Preservation Requirements

### Existing Functionality That Must Remain Unchanged

1. **Authentication and Authorization**: All routes using `withAuth()` correctly must continue to authenticate and authorize requests with the same RBAC policies
2. **Clean File Uploads**: Files that pass AV scanning must continue to be stored to R2 and tracked in `patient_files` table exactly as before
3. **Legitimate Registration Requests**: Users completing email confirmation and CAPTCHA must continue to receive verification tokens
4. **Successful Notifications**: Slack webhook POSTs that succeed must continue without triggering email fallbacks
5. **Safe HTML Content**: Legitimate blog posts with safe tags (p, strong, em, ul, ol, li, a) must continue to display with the same formatting
6. **Tenant Isolation**: All database operations must continue to enforce clinic_id scoping and RLS policies
7. **Existing Rate Limits**: Rate limits on other endpoints must remain unchanged
8. **Data Layer Queries**: Queries that already use explicit column selection must continue to work identically
9. **Migration Behavior**: Existing migrations must continue to apply successfully
10. **Audit Logging**: Existing audit log calls must continue to function identically

## Notes

- This phase addresses 25 remaining vulnerabilities across MEDIUM (8), LOW (15), and INFO (2) severity levels
- Fixes are grouped into 10 logical requirements covering input validation, cryptography, rate limiting, malware detection, operational resilience, code quality, data integrity, infrastructure, performance, and technical debt
- All fixes must maintain backward compatibility with existing functionality
- Testing strategy will follow bugfix workflow: exploration tests → preservation tests → implementation → verification
- Some requirements are verification-only (confirming Phase 1-3 fixes are working correctly)
- Infrastructure and documentation requirements may not require code changes (policy/process updates)
