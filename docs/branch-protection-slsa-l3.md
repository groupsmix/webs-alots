# Branch Protection Requirements — SLSA Level 3 (A175)

**Last verified:** 2026-05-28
**Status:** UNCERTAIN — requires verification in GitHub repo settings

---

## Overview

SLSA (Supply-chain Levels for Software Artifacts) Level 3 requires that the
build process is hermetic, isolated, and that source integrity is enforced
via branch protection. The CI already emits SLSA build-provenance attestations
(`actions/attest-build-provenance`), but the surrounding controls must be
verified in GitHub repository settings.

## Required GitHub Settings

The following settings MUST be enabled on the `main` branch:

### Branch Protection Rules (`main`)

| Setting                               | Required Value   | Purpose                                                 |
| ------------------------------------- | ---------------- | ------------------------------------------------------- |
| **Require pull request reviews**      | ≥ 1 reviewer     | Two-person integrity for all code changes               |
| **Dismiss stale reviews**             | Enabled          | Prevents merging after force-push without re-review     |
| **Require status checks to pass**     | Enabled          | Gate on CI (Lint, TypeCheck, Tests, Security, RLS, E2E) |
| **Require branches to be up to date** | Enabled          | Prevents merging stale branches                         |
| **Require signed commits**            | Recommended      | Cryptographic proof of author identity                  |
| **Include administrators**            | Enabled          | No bypass for admins                                    |
| **Restrict pushes**                   | No direct pushes | All changes via PR                                      |
| **Allow force pushes**                | Disabled         | Prevents history rewriting                              |
| **Allow deletions**                   | Disabled         | Prevents branch deletion                                |

### Required Status Checks

The following CI checks must be marked as **required**:

1. `Lint, Type Check & Tests` (ci job)
2. `Security Scans (Audit P2 #26)` (security job)
3. `RLS Integration Tests` (rls job)
4. `E2E Tests (Playwright)` (e2e job)
5. `Supply Chain (A173)` (supply-chain job)

### Two-Person Release

For SLSA L3 compliance:

1. All production deploys go through `main` branch
2. `main` requires PR with ≥1 approving review
3. The PR author cannot be the sole approver
4. Deploy workflow triggers automatically on merge to `main`

## Verification Procedure

To verify these settings are correctly configured:

```bash
# Using GitHub CLI (requires admin access)
gh api repos/{owner}/{repo}/branches/main/protection \
  | jq '{
    required_reviews: .required_pull_request_reviews.required_approving_review_count,
    dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews,
    status_checks: .required_status_checks.contexts,
    enforce_admins: .enforce_admins.enabled,
    restrict_pushes: .restrictions,
    allow_force_pushes: .allow_force_pushes.enabled,
    allow_deletions: .allow_deletions.enabled
  }'
```

## Annual Review

Verify branch protection settings:

- Quarterly during security audit seasons
- After any CI workflow changes
- After any repository admin changes
