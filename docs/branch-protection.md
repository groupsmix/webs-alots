# Branch Protection Requirements (A34.15)

This document specifies the branch protection rules that **must** be configured
in the GitHub repository settings. These settings live in the GitHub UI (not in
the repo tree), so this file serves as the auditable source of truth.

## Required Settings for `main`

| Setting | Required Value | Rationale |
|---------|---------------|-----------|
| Require pull request reviews | Yes, 1+ approving review | Prevents unilateral changes |
| Dismiss stale PR reviews on new pushes | Yes | Forces re-review after amendments |
| Require CODEOWNERS review | Yes | `.github/CODEOWNERS` covers security-critical files |
| Require status checks to pass | Yes | CI must pass before merge |
| Required status checks | `ci`, `security`, `e2e` | All three CI jobs must pass |
| Require branches to be up to date | Yes | Prevents merge skew |
| Require linear history | Recommended | Cleaner audit trail |
| Require signed commits | Deferred | Dependabot cannot sign (see A34.17) |
| Include administrators | Yes | No bypass for admins |
| Restrict who can push | Repository admins only | Prevent direct pushes |
| Allow force pushes | No | Prevents history rewriting |
| Allow deletions | No | Prevents branch deletion |

## Required Settings for `staging`

Same as `main` except:
- Required status checks: `ci` (e2e is advisory on staging)
- 1 approving review (can be the author for hotfixes if documented)

## Verification

Run the following to check branch protection via API:

```bash
gh api repos/groupsmix/webs-alots/branches/main/protection
```

## Signed Commits

Commit signing is recommended but not enforced because:
1. Dependabot does not sign commits (tracked at dependabot/dependabot-core#1039)
2. GitHub merge commits use GitHub's GPG key, not the author's

When Dependabot adds signing support, enable "Require signed commits" on both
branches and update `.github/dependabot.yml` accordingly.

## Audit Trail

Changes to branch protection rules should be logged in this file with a date
and reason. GitHub's audit log (Settings > Security > Audit log) also records
these changes for Enterprise accounts.

| Date | Change | Author |
|------|--------|--------|
| 2026-04-30 | Initial documentation (A34.15) | Security audit remediation |
