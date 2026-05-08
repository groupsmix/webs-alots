# Phase 5 Remaining Security Fixes - Design Document

## Overview

This design addresses 25 remaining security vulnerabilities identified in the technical audit after Phase 1-4 fixes. The platform is a multi-tenant healthcare SaaS handling PHI under Morocco Law 09-08 and GDPR. These fixes span input validation (Slack markdown injection, CMI open redirects), cryptographic operations (PHI key rotation, TOTP recovery codes), data integrity (JSONB schema, select("*") over-fetching), infrastructure documentation, and technical debt removal. The approach combines input sanitization, allowlist validation, schema enforcement, documentation updates, and dead code removal to systematically close each vulnerability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each security vulnerability
- **Property (P)**: The desired secure behavior after fixes are applied
- **Preservation**: Existing functionality that must remain unchanged by the fixes
- **Slack_Notifier**: Notification service for clinic registration alerts
- **CMI_Gateway**: Moroccan interbank payment gateway integration
- **Data_Layer**: Database query layer using Supabase client
- **JSONB**: PostgreSQL JSON binary data type
- **PITR**: Point-In-Time Recovery for database backups
- **KMS**: Key Management Service for encryption key storage

## Bug Groups

### Bug Group 1: Input Validation and Injection Prevention (A1-03, A1-04, S5-06)

**Issues:**
- A1-03 (LOW): Slack markdown injection in registration notifications
- A1-04 (LOW): Open redirect surface in CMI payment URLs
- S5-06 (MEDIUM): Blog XSS - sanitize-html.ts not safe for user input

**Root Cause:** User-supplied fields are interpolated into Slack markdown blocks without escaping, CMI URLs are not validated against an allowlist, and blog content sanitization relies on a library marked "not safe for user input".

**Fix Approach:**
1. Escape Slack markdown special characters or use plain_text blocks
2. Add hostname allowlist for CMI callback URLs
3. Verify DOMPurify is used consistently for all HTML sanitization

### Bug Group 2: Cryptographic Operations (A6-10, A6-11)

**Issues:**
- A6-10 (LOW): PHI key rotation script missing from repository
- A6-11 (LOW): TOTP recovery code reuse prevention

**Root Cause:** The PHI encryption key rotation script is referenced in comments but not present in the repository. TOTP recovery codes may not be marked as single-use or hashed before storage.

**Fix Approach:**
1. Create and test PHI key rotation script in `scripts/rotate-phi-key.ts`
2. Ensure TOTP recovery codes are hashed with SHA-256 and marked as consumed after use

### Bug Group 3: Data Integrity and Schema Enforcement (A16-06, A16-07, A23-01, A23-02, A23-03, API9)

**Issues:**
- A16-06 (LOW): Prescriptions JSONB schema enforcement
- A16-07 (LOW): Stock table ON DELETE CASCADE review
- A23-01 (MEDIUM): select("*") over-fetching in data layer
- A23-02 (LOW): API property-level authorization gaps
- A23-03 (LOW): Missing .limit() on list endpoints
- API9 (FAIL): Deprecated clinicId field in labReportSchema still accepted

**Root Cause:** JSONB columns lack database-level schema validation, select("*") returns all columns including sensitive fields, list endpoints may return unbounded result sets, and deprecated fields are still accepted for backward compatibility.

**Fix Approach:**
1. Add Zod schema validation before JSONB insertion
2. Review and document ON DELETE CASCADE behavior
3. Replace select("*") with explicit column lists
4. Add .limit() to all list endpoints
5. Remove deprecated clinicId field from labReportSchema

### Bug Group 4: Infrastructure Documentation (A13-04, A13-05, A19-05, A21-02, A22-05, A24-01)

**Issues:**
- A13-04 (INFO): wrangler.toml secrets review
- A13-05 (INFO): MinIO credentials documentation
- A19-05 (INFO): Migration rollback plan documentation
- A21-02 (LOW): KMS envelope integration documentation
- A22-05 (LOW): PITR retention SLA verification
- A24-01 (LOW): SSL mode verification for DB connections

**Root Cause:** Infrastructure configurations and operational procedures lack documentation or verification.

**Fix Approach:**
1. Review wrangler.toml for literal secrets
2. Document MinIO credentials are local-dev-only
3. Create migration rollback SOP
4. Document KMS envelope encryption pattern
5. Verify PITR retention meets 30-day SLA
6. Verify SSL mode is enabled for production DB connections

### Bug Group 5: Performance and Resource Management (A17-05, A18-02, A10-02)

**Issues:**
- A17-05 (LOW): audit_log table full-scan risk
- A18-02 (MEDIUM): clinicConfig static file drift
- A10-02 (MEDIUM): Subdomain cache race condition

**Root Cause:** audit_log table lacks composite index, clinicConfig static files can drift from database, subdomain cache can have stale entries across Workers isolates.

**Fix Approach:**
1. Add (clinic_id, created_at DESC) index to audit_log table
2. Add drift detection between clinicConfig files and database
3. Add cache busting mechanism for subdomain updates

### Bug Group 6: Technical Debt Removal (A2-01, A2-04, A8-05)

**Issues:**
- A2-01 (LOW): Dead code - trade_license_base64 verification mode
- A2-04 (MEDIUM): CVE placeholder in package.json rationale
- A8-05 (LOW): Audit log coverage enforcement

**Root Cause:** Dead code paths remain in schemas, CVE placeholders are not filled in, and audit logging is not enforced via static analysis.

**Fix Approach:**
1. Remove trade_license_base64 from registration schema
2. Replace CVE-2024-XXXXX placeholder with actual CVE ID
3. Add ESLint rule or test to enforce logAuditEvent() calls

## Expected Behavior Properties

### Bug Group 1: Input Validation

**Property 1.1:** For any clinic registration notification sent to Slack, the system SHALL escape markdown special characters (<, >, |, *, _, ~, !, `) in all user-supplied fields OR use plain_text blocks instead of mrkdwn.

**Property 1.2:** For any CMI payment callback URL, the system SHALL validate the hostname against an allowlist (e.g., payment.cmi.co.ma) and reject URLs with non-allowlisted hostnames.

**Property 1.3:** For any blog post HTML content, the system SHALL use DOMPurify for sanitization and reject the "not safe for user input" warning.

### Bug Group 2: Cryptographic Operations

**Property 2.1:** When the PHI key rotation script is executed, the system SHALL rotate encryption keys for all files in R2 storage without data loss.

**Property 2.2:** When a TOTP recovery code is used, the system SHALL mark the code as consumed and prevent reuse.

**Property 2.3:** When TOTP recovery codes are stored, the system SHALL hash them with SHA-256 before persistence.

### Bug Group 3: Data Integrity

**Property 3.1:** When prescription content is inserted as JSONB, the system SHALL validate the structure against a Zod schema.

**Property 3.2:** When API responses are constructed, the system SHALL use explicit column selection instead of select("*").

**Property 3.3:** When list endpoints are queried, the system SHALL enforce .limit() clauses.

**Property 3.4:** When the deprecated clinicId field is submitted, the system SHALL reject the request with a validation error.

### Bug Group 4: Infrastructure Documentation

**Property 4.1:** The wrangler.toml file SHALL contain no literal secrets.

**Property 4.2:** MinIO credentials SHALL be documented as local-dev-only.

**Property 4.3:** Migration rollback procedures SHALL be documented in a runbook.

**Property 4.4:** KMS envelope encryption SHALL be documented with integration patterns.

**Property 4.5:** PITR retention SHALL meet 30-day minimum SLA.

**Property 4.6:** Production database connections SHALL use SSL mode verify-full.

### Bug Group 5: Performance

**Property 5.1:** The audit_log table SHALL have a composite index on (clinic_id, created_at DESC).

**Property 5.2:** The system SHALL detect drift between clinicConfig static files and database records.

**Property 5.3:** The subdomain cache SHALL bust entries when subdomains are updated.

### Bug Group 6: Technical Debt

**Property 6.1:** The registration schema SHALL NOT accept trade_license_base64 field.

**Property 6.2:** The package.json rationale SHALL contain actual CVE identifiers, not placeholders.

**Property 6.3:** All POST/PUT/DELETE route handlers SHALL call logAuditEvent().

## Preservation Requirements

All existing functionality must remain unchanged:

1. **Slack Notifications:** Successful Slack posts must continue to work with proper formatting
2. **CMI Payments:** Valid CMI callback URLs must continue to work
3. **Blog Content:** Legitimate HTML content must continue to display correctly
4. **TOTP Authentication:** Valid recovery codes must continue to authenticate users
5. **Database Queries:** Existing queries must continue to return correct results
6. **Tenant Isolation:** All operations must continue to enforce clinic_id scoping
7. **Migration Behavior:** Existing migrations must continue to apply successfully
8. **Audit Logging:** Existing audit log calls must continue to function

## Testing Strategy

### Exploration Tests (Bug Condition)

Each bug group requires exploration tests that demonstrate the vulnerability on unfixed code:

1. **Input Validation:** Test Slack markdown injection, CMI open redirect, blog XSS
2. **Cryptographic Operations:** Test PHI key rotation script existence, TOTP code reuse
3. **Data Integrity:** Test JSONB validation, select("*") over-fetching, missing limits
4. **Infrastructure:** Review wrangler.toml, MinIO docs, migration rollback docs
5. **Performance:** Test audit_log query performance, clinicConfig drift detection
6. **Technical Debt:** Test trade_license_base64 acceptance, CVE placeholder presence

### Preservation Tests

Each bug group requires preservation tests that verify existing functionality:

1. **Input Validation:** Verify successful Slack posts, valid CMI URLs, safe HTML content
2. **Cryptographic Operations:** Verify valid TOTP codes work, PHI encryption works
3. **Data Integrity:** Verify existing queries return correct results
4. **Infrastructure:** Verify production configs work correctly
5. **Performance:** Verify query performance is acceptable
6. **Technical Debt:** Verify existing registration flows work

## Implementation Plan

The implementation will proceed in 6 bug groups, each following the bugfix workflow:

1. **Bug Group 1:** Input Validation (3 issues) - MEDIUM priority
2. **Bug Group 2:** Cryptographic Operations (2 issues) - LOW priority
3. **Bug Group 3:** Data Integrity (6 issues) - MEDIUM priority
4. **Bug Group 4:** Infrastructure Documentation (6 issues) - INFO/LOW priority
5. **Bug Group 5:** Performance (3 issues) - MEDIUM priority
6. **Bug Group 6:** Technical Debt (3 issues) - LOW/MEDIUM priority

Each group will have:
- Exploration test (demonstrates bug on unfixed code)
- Preservation test (verifies existing functionality)
- Implementation (fixes the bug)
- Verification (confirms fix works and preserves behavior)
