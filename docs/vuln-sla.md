# Vulnerability Remediation SLA

> **Audit finding:** A174 | **Last updated:** April 2026

This document defines the maximum time allowed to remediate known
vulnerabilities, by severity, once they are identified by any source
(SCA, SAST, pen-test, bug bounty, vendor advisory).

---

## Remediation Timelines

| Severity | CVSS Range | Remediation SLA | Escalation If Missed |
|----------|-----------|-----------------|----------------------|
| **Critical** | 9.0 - 10.0 | **7 calendar days** | CTO + Security Officer |
| **High** | 7.0 - 8.9 | **30 calendar days** | Security Officer |
| **Medium** | 4.0 - 6.9 | **90 calendar days** | Engineering lead |
| **Low** | 0.1 - 3.9 | **180 calendar days** | Tracked in backlog |
| **Informational** | 0.0 | Best effort | N/A |

---

## Applicability

These SLAs apply to:

- **Dependencies** flagged by `npm audit`, Dependabot, Socket, or any SCA tool
- **SBOM-derived findings** from CycloneDX/SPDX scans
- **Infrastructure vulnerabilities** in Cloudflare, Supabase, or other vendors
- **Application vulnerabilities** found by SAST, pen-test, or bug bounty
- **Container / OS vulnerabilities** in CI runners or dev environments

---

## Exception Process

If a vulnerability cannot be remediated within the SLA:

1. File a risk-acceptance ticket with:
   - Vulnerability details (CVE, affected component, CVSS)
   - Reason remediation is delayed
   - Compensating controls in place
   - Proposed new deadline
2. Security Officer must approve the exception.
3. Exception is reviewed monthly until resolved.
4. Maximum exception duration: 90 days for Critical, 180 days for High.

---

## SBOM Publication

A Software Bill of Materials (CycloneDX format) is generated on every PR
via CI. To ensure traceability:

- [ ] Attach SBOM as a release artifact on every Cloudflare deploy
  (add step to `.github/workflows/deploy.yml`)
- [ ] Store SBOM in R2 alongside deploy artifacts
- [ ] Retain SBOMs for at least 1 year

### Generating SBOM Manually

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

---

## Metrics

Track and report monthly:

| Metric | Target |
|--------|--------|
| Mean Time to Remediate (Critical) | < 5 days |
| Mean Time to Remediate (High) | < 20 days |
| Open Critical/High vulns older than SLA | 0 |
| Dependency freshness (% up-to-date) | > 90% |

---

## Related Documents

- [Data Residency & Sub-Processors](./data-residency.md)
- [Incident Response Runbook](./incident-response.md)
- [SECURITY.md](../SECURITY.md)
