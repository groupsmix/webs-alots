# Dependency Update Policy
## Finding F-A178

> **Version:** 1.0 | **Owner:** Engineering Lead + CISO | **Review:** Quarterly

---

## Purpose

Unpatched dependencies are the #1 supply-chain attack vector. This policy defines how Oltigo Health manages third-party dependency updates to balance security, stability, and velocity.

---

## 1. Severity-Based SLA

| CVSS Score | Severity | Max Time to Patch |
|---|---|---|
| 9.0–10.0 | Critical | **24 hours** (emergency PR) |
| 7.0–8.9 | High | **72 hours** |
| 4.0–6.9 | Medium | **2 weeks** |
| 0.1–3.9 | Low | **Next monthly update cycle** |
| 0.0 / Informational | None | Batch with quarterly updates |

Emergency patches bypass the standard review window but still require:
- CI passing (lint + type-check + unit tests + bundle size)
- One human review (CISO or Engineering Lead)

---

## 2. Automated Scanning

### Tools Configured

| Tool | Trigger | Action |
|---|---|---|
| `npm audit` | Every `npm install`, CI pre-build | Fails build on HIGH+ |
| GitHub Dependabot | Daily | Opens PRs for vulnerable deps |
| Snyk (optional) | Weekly | Sends Slack report to #security |

### CI Enforcement

```yaml
# .github/workflows/ci.yml (excerpt)
- name: npm audit
  run: npm audit --audit-level=high --production
```

This fails the build on any HIGH or CRITICAL vulnerability in production dependencies.

---

## 3. Routine Update Cadence

| Frequency | Scope | Owner |
|---|---|---|
| Weekly | Patch releases (`x.y.Z`) for direct deps | Engineering Lead |
| Monthly | Minor releases (`x.Y.z`) after 1-week soak | Engineering Lead |
| Quarterly | Major releases (`X.y.z`) — review breaking changes | Arch review required |

### Batch Update Process

```bash
# Check for updates
npx npm-check-updates --target minor

# Apply patch/minor updates
npx npm-check-updates --target minor --upgrade
npm install

# Run full test suite
npm test && npm run test:e2e

# Verify bundle size hasn't grown >5 kB
npm run build
```

---

## 4. Prohibited Dependencies

The following categories are **never** permitted without CISO sign-off:

- GPL / LGPL / AGPL / EUPL licensed packages in production bundles (copyleft risk)
- Packages with no maintainer activity in 24+ months
- Packages with `0` weekly downloads (abandoned)
- Packages owned by single-maintainer with no 2FA (supply-chain risk)
- Packages that execute `postinstall` scripts not in the approved list (`docs/approved-postinstall-scripts.md`)

Enforcement via CI:
```bash
npm run licenses:check   # fails on copyleft
npm run audit:dependencies   # checks maintainer activity
```

---

## 5. `package.json` Overrides

When a transitive dependency has a known vulnerability and the direct dependency hasn't released a fix, use `overrides` in `package.json`:

```json
{
  "overrides": {
    "vulnerable-package": ">=patched-version"
  },
  "_overrides_rationale": {
    "vulnerable-package": "CVE-XXXX-XXXXX: [description]. Upstream fix pending. Remove when direct-dep@X.Y.Z releases."
  }
}
```

**Required:** Every override entry must have a corresponding `_overrides_rationale` entry with CVE reference and removal condition. Overrides with no rationale are flagged in CI.

---

## 6. Lock File Integrity

- `package-lock.json` is committed and must not be modified manually
- `npm ci` is used in CI (not `npm install`)
- Lock file changes in PRs are reviewed by Engineering Lead
- Automated Dependabot PRs with only lock file changes are auto-merged if CI passes

---

## 7. Incident Response

If a Critical CVE is discovered:

1. **Immediately** pin to a safe version in `package.json` + `overrides`
2. Open emergency PR with CISO + Engineering Lead as required reviewers
3. Deploy within the SLA (24h for CRITICAL)
4. File a post-mortem if the vulnerability was in production for >7 days
5. Review how the vulnerable version was introduced (bypass of CI audit check?)

---

## 8. Review & Exceptions

All exceptions to this policy require written approval from CISO, filed in `docs/audit/policy-exceptions.md` with expiry date.
