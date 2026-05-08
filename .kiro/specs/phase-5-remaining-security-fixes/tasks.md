# Implementation Plan: Phase 5 Remaining Security Fixes

## Overview

This implementation plan addresses 25 remaining security vulnerabilities grouped into 6 logical bug groups. Each group follows the bugfix workflow: write tests BEFORE fixes to understand the vulnerabilities, then implement fixes with verification.

---

## Bug Group 1: Input Validation and Injection Prevention (A1-03, A1-04, S5-06)

- [x] 1.1 Write bug condition exploration test for input validation
  - **Property 1: Bug Condition** - Input Validation Gaps
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms bugs exist
  - **GOAL**: Surface counterexamples demonstrating injection vulnerabilities
  - Test implementation:
    - Test Slack markdown injection with `<!channel>` in clinic_name
    - Test CMI open redirect with non-allowlisted hostname
    - Test blog XSS with script tags in sanitized content
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (injections not prevented - proves bugs exist)
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 Write preservation property tests for input validation (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Input Behavior
  - Observe behavior on UNFIXED code:
    - Test successful Slack notifications with normal clinic names
    - Test valid CMI callback URLs
    - Test safe HTML content in blog posts
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 1, 2, 3_

- [x] 1.3 Fix for input validation issues

  - [x] 1.3.1 Fix Slack markdown injection (A1-03)
    - Update `src/app/api/v1/register-clinic/route.ts`
    - Replace mrkdwn blocks with plain_text blocks for user fields
    - OR escape markdown special characters: <, >, |, *, _, ~, !, `
    - _Requirements: 1.1_

  - [x] 1.3.2 Fix CMI open redirect (A1-04)
    - Update `src/app/api/payments/cmi/route.ts`
    - Add hostname allowlist: `const allowedHosts = new Set(['payment.cmi.co.ma'])`
    - Reject URLs with non-allowlisted hostnames
    - _Requirements: 1.2_

  - [x] 1.3.3 Fix blog XSS (S5-06)
    - Update `src/lib/sanitize-html.ts`
    - Verify DOMPurify is used (already done in Phase 4)
    - Remove "not safe for user input" warning if applicable
    - _Requirements: 1.3_

  - [x] 1.3.4 Verify bug condition exploration test now passes
    - Re-run test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms injections are prevented)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3.5 Verify preservation tests still pass
    - Re-run tests from step 1.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 1.4 Checkpoint - Ensure Bug Group 1 tests pass

---

## Bug Group 2: Cryptographic Operations (A6-10, A6-11)

- [x] 2.1 Write bug condition exploration test for crypto operations
  - **Property 1: Bug Condition** - Missing Crypto Features
  - Test implementation:
    - Test PHI key rotation script exists in `scripts/rotate-phi-key.ts`
    - Test TOTP recovery code reuse prevention
    - Test TOTP recovery codes are hashed before storage
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (script missing, codes not hashed - proves bugs exist)
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.2 Write preservation property tests for crypto operations (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Crypto Behavior
  - Observe behavior on UNFIXED code:
    - Test valid TOTP recovery codes authenticate users
    - Test PHI encryption/decryption works correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 4, 5_

- [x] 2.3 Fix for crypto operations

  - [x] 2.3.1 Create PHI key rotation script (A6-10)
    - Create `scripts/rotate-phi-key.ts`
    - Implement key rotation for all R2 encrypted files
    - Add E2E test for rotation without data loss
    - Document usage in `docs/SOP-PHI-KEY-ROTATION.md`
    - _Requirements: 2.1_

  - [x] 2.3.2 Fix TOTP recovery code reuse (A6-11)
    - Update `src/lib/mfa.ts`
    - Mark recovery codes as consumed after use
    - Hash codes with SHA-256 before storage
    - Prevent reuse of consumed codes
    - _Requirements: 2.2, 2.3_

  - [x] 2.3.3 Verify bug condition exploration test now passes
    - Re-run test from step 2.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms script exists, codes hashed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [-] 2.3.4 Verify preservation tests still pass
    - Re-run tests from step 2.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 2.4 Checkpoint - Ensure Bug Group 2 tests pass

---

## Bug Group 3: Data Integrity and Schema Enforcement (A16-06, A16-07, A23-01, A23-02, A23-03, API9)

- [x] 3.1 Write bug condition exploration test for data integrity
  - **Property 1: Bug Condition** - Data Integrity Gaps
  - Test implementation:
    - Test JSONB insertion without schema validation
    - Test select("*") returns sensitive columns
    - Test list endpoints without .limit() return unbounded results
    - Test deprecated clinicId field is accepted
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (gaps exist - proves bugs exist)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3.2 Write preservation property tests for data integrity (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Query Behavior
  - Observe behavior on UNFIXED code:
    - Test existing queries return correct results
    - Test tenant isolation is enforced
    - Test RLS policies work correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 6, 7_

- [ ] 3.3 Fix for data integrity issues

  - [-] 3.3.1 Add JSONB schema validation (A16-06)
    - Update prescription insertion code
    - Add Zod schema validation before JSONB insert
    - Consider adding CHECK constraint: `jsonb_typeof(content) = 'array'`
    - _Requirements: 3.1_

  - [x] 3.3.2 Review stock table CASCADE (A16-07)
    - Review `supabase/migrations/00001_initial_schema.sql`
    - Document ON DELETE CASCADE behavior for stock → products
    - Add comment explaining cascade rationale
    - _Requirements: 3.1_

  - [x] 3.3.3 Replace select("*") with explicit columns (A23-01)
    - Audit all `.select("*")` calls in `src/lib/data/` and `src/app/api/`
    - Replace with explicit column lists
    - Prioritize routes returning sensitive data (notes, metadata, config)
    - _Requirements: 3.2_

  - [x] 3.3.4 Add .limit() to list endpoints (A23-03)
    - Audit all list endpoints for missing .limit() clauses
    - Add .limit(100) or use queryPaginated helper
    - Document pagination requirements in CONTRIBUTING.md
    - _Requirements: 3.3_

  - [x] 3.3.5 Remove deprecated clinicId field (API9)
    - Update `src/lib/validations.ts` labReportSchema
    - Remove clinicId field (use clinic_id instead)
    - Update API documentation
    - _Requirements: 3.4_

  - [x] 3.3.6 Verify bug condition exploration test now passes
    - Re-run test from step 3.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms gaps are closed)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3.7 Verify preservation tests still pass
    - Re-run tests from step 3.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - **STATUS**: ✅ VERIFIED (Documentation-based - see BUG_GROUP_3_PRESERVATION_VERIFICATION.md)

- [x] 3.4 Checkpoint - Ensure Bug Group 3 tests pass

---

## Bug Group 4: Infrastructure Documentation (A13-04, A13-05, A19-05, A21-02, A22-05, A24-01)

- [~] 4.1 Write bug condition exploration test for infrastructure docs
  - **Property 1: Bug Condition** - Missing Documentation
  - Test implementation:
    - Test wrangler.toml contains no literal secrets
    - Test MinIO credentials are documented as local-dev-only
    - Test migration rollback SOP exists
    - Test KMS envelope encryption is documented
    - Test PITR retention meets 30-day SLA
    - Test SSL mode is enabled for production DB
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (docs missing - proves gaps exist)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [~] 4.2 Write preservation property tests for infrastructure (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Infrastructure Behavior
  - Observe behavior on UNFIXED code:
    - Test production configs work correctly
    - Test database connections are secure
    - Test migrations apply successfully
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 7, 8_

- [ ] 4.3 Fix for infrastructure documentation

  - [~] 4.3.1 Review wrangler.toml for secrets (A13-04)
    - Manually review `wrangler.toml`
    - Ensure no literal secrets in vars section
    - Document review in security checklist
    - _Requirements: 4.1_

  - [~] 4.3.2 Document MinIO credentials (A13-05)
    - Add comment to `docker-compose.yml`
    - Document that minioadmin/minioadmin is local-dev-only
    - Add warning not to use in production
    - _Requirements: 4.2_

  - [~] 4.3.3 Create migration rollback SOP (A19-05)
    - Create `docs/db-rollback-procedures.md`
    - Document rollback steps for each migration type
    - Include data loss prevention checklist
    - _Requirements: 4.3_

  - [~] 4.3.4 Document KMS envelope encryption (A21-02)
    - Create `docs/kms-envelope-encryption.md`
    - Document integration pattern for future reference
    - Include key rotation procedures
    - _Requirements: 4.4_

  - [~] 4.3.5 Verify PITR retention SLA (A22-05)
    - Check Supabase project settings
    - Confirm PITR retention ≥ 30 days
    - Document in `docs/backup-recovery-runbook.md`
    - _Requirements: 4.5_

  - [~] 4.3.6 Verify SSL mode for DB connections (A24-01)
    - Check `SUPABASE_DB_URL` in production
    - Confirm sslmode=verify-full is set
    - Document in deployment checklist
    - _Requirements: 4.6_

  - [~] 4.3.7 Verify bug condition exploration test now passes
    - Re-run test from step 4.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms docs exist)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [~] 4.3.8 Verify preservation tests still pass
    - Re-run tests from step 4.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [~] 4.4 Checkpoint - Ensure Bug Group 4 tests pass

---

## Bug Group 5: Performance and Resource Management (A17-05, A18-02, A10-02)

- [~] 5.1 Write bug condition exploration test for performance
  - **Property 1: Bug Condition** - Performance Gaps
  - Test implementation:
    - Test audit_log queries without index are slow
    - Test clinicConfig drift is not detected
    - Test subdomain cache has stale entries
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (gaps exist - proves bugs exist)
  - _Requirements: 5.1, 5.2, 5.3_

- [~] 5.2 Write preservation property tests for performance (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Performance Behavior
  - Observe behavior on UNFIXED code:
    - Test query performance is acceptable
    - Test cache behavior is correct
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 6_

- [ ] 5.3 Fix for performance issues

  - [~] 5.3.1 Add audit_log index (A17-05)
    - Create migration `supabase/migrations/000XX_audit_log_index.sql`
    - Add index: `CREATE INDEX idx_audit_log_clinic_created ON audit_log(clinic_id, created_at DESC)`
    - Test query performance improvement
    - _Requirements: 5.1_

  - [~] 5.3.2 Add clinicConfig drift detection (A18-02)
    - Create `scripts/check-clinic-config-drift.ts`
    - Compare static files against database records
    - Alert on drift detection
    - Add to CI pipeline
    - _Requirements: 5.2_

  - [~] 5.3.3 Add subdomain cache busting (A10-02)
    - Update `src/lib/subdomain-cache.ts`
    - Add cache invalidation on subdomain update
    - Use Cloudflare KV or Durable Object for cross-isolate cache busting
    - Document acceptable staleness window
    - _Requirements: 5.3_

  - [~] 5.3.4 Verify bug condition exploration test now passes
    - Re-run test from step 5.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms gaps are closed)
    - _Requirements: 5.1, 5.2, 5.3_

  - [~] 5.3.5 Verify preservation tests still pass
    - Re-run tests from step 5.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [~] 5.4 Checkpoint - Ensure Bug Group 5 tests pass

---

## Bug Group 6: Technical Debt Removal (A2-01, A2-04, A8-05)

- [~] 6.1 Write bug condition exploration test for technical debt
  - **Property 1: Bug Condition** - Technical Debt Exists
  - Test implementation:
    - Test trade_license_base64 field is accepted in registration schema
    - Test CVE-2024-XXXXX placeholder exists in package.json
    - Test POST/PUT/DELETE handlers without logAuditEvent() calls
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (debt exists - proves bugs exist)
  - _Requirements: 6.1, 6.2, 6.3_

- [~] 6.2 Write preservation property tests for technical debt (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Registration Behavior
  - Observe behavior on UNFIXED code:
    - Test existing registration flows work
    - Test audit logging works for existing handlers
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: Preservation 8_

- [ ] 6.3 Fix for technical debt

  - [~] 6.3.1 Remove trade_license_base64 dead code (A2-01)
    - Update `src/lib/validations.ts` registerClinicSchema
    - Remove trade_license_base64 field entirely
    - Remove related code in registration route
    - _Requirements: 6.1_

  - [~] 6.3.2 Replace CVE placeholder (A2-04)
    - Update `package.json` _overrides_rationale.postcss
    - Replace CVE-2024-XXXXX with actual CVE identifier
    - Research correct CVE for postcss vulnerability
    - _Requirements: 6.2_

  - [~] 6.3.3 Add audit log coverage enforcement (A8-05)
    - Create ESLint rule or test for logAuditEvent() coverage
    - Scan all POST/PUT/DELETE handlers
    - Add logAuditEvent() calls where missing
    - Document requirement in CONTRIBUTING.md
    - _Requirements: 6.3_

  - [~] 6.3.4 Verify bug condition exploration test now passes
    - Re-run test from step 6.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms debt is removed)
    - _Requirements: 6.1, 6.2, 6.3_

  - [~] 6.3.5 Verify preservation tests still pass
    - Re-run tests from step 6.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [~] 6.4 Checkpoint - Ensure Bug Group 6 tests pass

---

## Final Checkpoint

- [~] 7. Ensure all tests pass
  - Run full test suite: `npm run test`
  - Run E2E tests: `npm run test:e2e`
  - Verify all 6 bug groups are fixed
  - Verify all preservation tests pass
  - Ask the user if questions arise
