# Phase 5: Remaining Security Fixes

## Status: Ready for Implementation

## Overview

This spec addresses the remaining 25 security vulnerabilities from the technical audit that were not fixed in Phases 1-4. The vulnerabilities are grouped into 6 logical bug groups for systematic implementation.

## What's Included

- **requirements.md**: 10 requirement groups covering all 25 vulnerabilities
- **design.md**: Bug condition analysis, expected behavior, and preservation requirements
- **tasks.md**: 6 bug groups with exploration tests, preservation tests, and implementation tasks
- **.config.kiro**: Workflow configuration (bugfix, requirements-first)

## Bug Groups Summary

### Bug Group 1: Input Validation (3 issues - MEDIUM/LOW)
- A1-03: Slack markdown injection
- A1-04: CMI open redirect
- S5-06: Blog XSS

### Bug Group 2: Cryptographic Operations (2 issues - LOW)
- A6-10: PHI key rotation script missing
- A6-11: TOTP recovery code reuse

### Bug Group 3: Data Integrity (6 issues - MEDIUM/LOW)
- A16-06: JSONB schema enforcement
- A16-07: Stock table CASCADE review
- A23-01: select("*") over-fetching
- A23-02: API property-level auth
- A23-03: Missing .limit() on lists
- API9: Deprecated clinicId field

### Bug Group 4: Infrastructure Documentation (6 issues - INFO/LOW)
- A13-04: wrangler.toml secrets review
- A13-05: MinIO credentials docs
- A19-05: Migration rollback SOP
- A21-02: KMS envelope encryption docs
- A22-05: PITR retention verification
- A24-01: SSL mode verification

### Bug Group 5: Performance (3 issues - MEDIUM/LOW)
- A17-05: audit_log index
- A18-02: clinicConfig drift detection
- A10-02: Subdomain cache race

### Bug Group 6: Technical Debt (3 issues - MEDIUM/LOW)
- A2-01: Remove trade_license_base64
- A2-04: Replace CVE placeholder
- A8-05: Audit log coverage enforcement

## Implementation Workflow

Each bug group follows the bugfix workflow:

1. **Exploration Test** - Write test that FAILS on unfixed code (demonstrates bug)
2. **Preservation Test** - Write test that PASSES on unfixed code (captures existing behavior)
3. **Implementation** - Fix the bug
4. **Verification** - Confirm exploration test now PASSES and preservation test still PASSES

## Priority Order

1. **MEDIUM severity** (Bug Groups 1, 3, 5) - Input validation, data integrity, performance
2. **LOW severity** (Bug Groups 2, 6) - Cryptographic operations, technical debt
3. **INFO severity** (Bug Group 4) - Infrastructure documentation

## Next Steps

To begin implementation:

1. Review the requirements.md to understand all 25 vulnerabilities
2. Review the design.md to understand bug conditions and expected behavior
3. Start with Bug Group 1 (Input Validation) in tasks.md
4. Follow the bugfix workflow for each group
5. Run tests after each group to verify fixes

## Relationship to Previous Phases

- **Phase 1**: Fixed 5 critical vulnerabilities (A1-01, A6-13, A7-01, A8-01, A2-02)
- **Phase 2**: Fixed 11 infrastructure hardening categories (A31-A43)
- **Phase 3**: Fixed 17 security gaps (A16-03/04/05, A2-03/04/05/01/08, A10-07, A12-02/04, A14-02/03/04/05/06)
- **Phase 4**: Fixed 5 high-priority bugs (A7-05, A37-06, A1-02, A8-02, R11-01)
- **Phase 5**: Fixes remaining 25 vulnerabilities (this spec)

## Completion Criteria

All 6 bug groups must have:
- ✅ Exploration tests passing (bugs fixed)
- ✅ Preservation tests passing (no regressions)
- ✅ Full test suite passing
- ✅ E2E tests passing

## Notes

- Some requirements are verification-only (confirming Phase 1-4 fixes work correctly)
- Infrastructure documentation may not require code changes (policy/process updates)
- All fixes must maintain backward compatibility
- Testing strategy emphasizes property-based testing for strong guarantees
