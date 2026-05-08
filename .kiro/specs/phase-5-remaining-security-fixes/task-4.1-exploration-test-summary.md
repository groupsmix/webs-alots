# Task 4.1: Bug Group 4 Infrastructure Documentation Exploration Test

## Summary

Created bug condition exploration test at:
`src/lib/__tests__/bug-group-4-infrastructure-docs-exploration.test.ts`

## Test Purpose

This test verifies 6 infrastructure documentation requirements for Bug Group 4. It follows the bugfix workflow methodology where **the test MUST FAIL on unfixed code** to prove the documentation gaps exist.

## Test Coverage

The test checks for the following documentation gaps:

### 1. A13-04: wrangler.toml Secrets Review
- **Checks:** No literal secrets in `[vars]` section
- **Expected on unfixed code:** PASS (wrangler.toml already has no literal secrets)
- **Validates:** Property 4.1 - wrangler.toml SHALL contain no literal secrets

### 2. A13-05: MinIO Credentials Documentation
- **Checks:** MinIO credentials documented as local-dev-only in docker-compose.yml
- **Expected on unfixed code:** FAIL (no "local-dev-only" or "not for production" warning exists)
- **Validates:** Property 4.2 - MinIO credentials SHALL be documented as local-dev-only

### 3. A19-05: Migration Rollback SOP
- **Checks:** Migration rollback procedures documented
- **Expected on unfixed code:** PASS (docs/db-rollback-constraints.md exists)
- **Validates:** Property 4.3 - Migration rollback procedures SHALL be documented

### 4. A21-02: KMS Envelope Encryption Documentation
- **Checks:** KMS envelope encryption pattern documented
- **Expected on unfixed code:** FAIL (docs/kms-envelope-encryption.md does NOT exist)
- **Validates:** Property 4.4 - KMS envelope encryption SHALL be documented

### 5. A22-05: PITR Retention SLA Verification
- **Checks:** PITR retention meets 30-day minimum SLA
- **Expected on unfixed code:** PASS (backup-recovery-runbook.md mentions "30 days")
- **Validates:** Property 4.5 - PITR retention SHALL meet 30-day minimum SLA

### 6. A24-01: SSL Mode Verification for DB Connections
- **Checks:** SSL mode documented for production DB connections
- **Expected on unfixed code:** FAIL (backup-recovery-runbook.md does NOT mention sslmode or verify-full)
- **Validates:** Property 4.6 - Production database connections SHALL use SSL mode verify-full

## Expected Test Results (Unfixed Code)

The test should have **mixed results** on unfixed code:

- ✅ **3 tests PASS** (wrangler.toml, migration rollback, PITR retention)
- ❌ **3 tests FAIL** (MinIO docs, KMS docs, SSL mode docs)

This is the **correct behavior** for a bug condition exploration test. The failures prove that documentation gaps exist.

## Test Structure

The test follows the established pattern from other bug group exploration tests:

1. **Bug Condition Functions** - Formal definitions of what constitutes a documentation gap
2. **Expected Behavior Properties** - References to design document properties
3. **Test Cases** - Organized by bug condition with descriptive names
4. **Validation** - Uses file system checks and content pattern matching

## Bug Condition Functions

```
FUNCTION isBugCondition_WranglerSecrets(wrangler_content)
  INPUT: wrangler_content of type string
  OUTPUT: boolean
  
  RETURN wrangler_content CONTAINS literal API keys OR
         wrangler_content CONTAINS literal passwords OR
         wrangler_content CONTAINS literal tokens IN [vars] section
END FUNCTION

FUNCTION isBugCondition_MinIODocumentation(docker_compose_content)
  INPUT: docker_compose_content of type string
  OUTPUT: boolean
  
  RETURN NOT (docker_compose_content CONTAINS "local-dev-only" OR
              docker_compose_content CONTAINS "not for production")
END FUNCTION

FUNCTION isBugCondition_MigrationRollbackSOP()
  OUTPUT: boolean
  
  RETURN NOT fileExists("docs/db-rollback-procedures.md") OR
         NOT fileExists("docs/db-rollback-constraints.md")
END FUNCTION

FUNCTION isBugCondition_KMSDocumentation()
  OUTPUT: boolean
  
  RETURN NOT fileExists("docs/kms-envelope-encryption.md")
END FUNCTION

FUNCTION isBugCondition_PITRRetention(backup_docs_content)
  INPUT: backup_docs_content of type string
  OUTPUT: boolean
  
  RETURN NOT (backup_docs_content CONTAINS "30 day" OR
              backup_docs_content CONTAINS "30-day" OR
              backup_docs_content CONTAINS "PITR")
END FUNCTION

FUNCTION isBugCondition_SSLMode(backup_docs_content)
  INPUT: backup_docs_content of type string
  OUTPUT: boolean
  
  RETURN NOT (backup_docs_content CONTAINS "sslmode=verify-full" OR
              backup_docs_content CONTAINS "SSL mode")
END FUNCTION
```

## Running the Test

```bash
npm run test -- bug-group-4-infrastructure-docs-exploration.test.ts --run
```

## Next Steps

After this exploration test:

1. **Task 4.2:** Write preservation property tests (verify existing infrastructure behavior)
2. **Task 4.3:** Implement fixes (add missing documentation)
3. **Task 4.3.7:** Re-run this exploration test - it should PASS after fixes
4. **Task 4.3.8:** Verify preservation tests still pass

## Requirements Validated

This test validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 from the requirements document:

- **8.1:** wrangler.toml SHALL ensure no literal secrets are present
- **8.2:** MinIO credentials SHALL be documented as local-dev-only
- **8.3:** Database migrations SHALL follow documented rollback procedures
- **8.4:** KMS envelope encryption SHALL be documented
- **8.5:** PITR SHALL verify retention SLA meets compliance requirements (30 days minimum)
- **8.6:** Database connections SHALL verify SSL mode is enabled for production

## Test Methodology

This test follows the **observation-first bugfix methodology**:

1. **Observe the bug** - Test fails on unfixed code, proving documentation gaps exist
2. **Preserve existing behavior** - Preservation tests verify infrastructure still works
3. **Implement fix** - Add missing documentation
4. **Verify fix** - Re-run exploration test, should pass after documentation is added

The test is designed to be **self-documenting** with clear comments explaining:
- What each test checks
- Why it should fail on unfixed code
- What the expected behavior is after fixes

## Files Checked

The test reads and validates the following files:

- `wrangler.toml` - Cloudflare Workers configuration
- `docker-compose.yml` - Local development environment setup
- `docs/db-rollback-procedures.md` or `docs/db-rollback-constraints.md` - Migration rollback documentation
- `docs/kms-envelope-encryption.md` - KMS envelope encryption documentation
- `docs/backup-recovery-runbook.md` - Backup and recovery procedures

## Success Criteria

The test is considered successful when:

1. **On unfixed code:** Test has mixed results (some pass, some fail) proving gaps exist
2. **After fixes:** All tests pass, proving documentation is complete
3. **Preservation tests:** Continue to pass, proving infrastructure still works correctly

## Notes

- This is a **documentation-focused test** - it does not test runtime behavior
- The test uses file system checks (`existsSync`) and content pattern matching (`includes`, regex)
- Some checks are already passing (wrangler.toml, migration rollback, PITR) because partial documentation exists
- The failing checks (MinIO, KMS, SSL mode) represent the actual documentation gaps to be fixed
