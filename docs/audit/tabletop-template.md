# Tabletop Exercise Report

> **Exercise ID:** TT-YYYY-QN-SCENARIO
> **Date:** YYYY-MM-DD
> **Facilitator:** [Name]
> **Participants:** [Names and roles]
> **Scenario:** [Brief scenario name]
> **Duration:** X hours
> **Classification:** CONFIDENTIAL

---

## 1. Scenario Description

_Describe the scenario in 2-3 paragraphs. Include the threat actor, attack
vector, what has been compromised, and the business context (time of day,
staffing, external pressure)._

### Assumptions

- _Assumption 1 (e.g. backups are available and uncompromised)_
- _Assumption 2 (e.g. IdP is hostile / not hostile)_
- _Assumption 3 (e.g. press has the story / does not)_

### Injects (time-based escalations)

| Time | Inject |
|------|--------|
| T+0 | Initial detection signal |
| T+15 | Escalation: [additional complication] |
| T+30 | Escalation: [external pressure, e.g. press inquiry] |
| T+60 | Resolution window opens |

---

## 2. Exercise Timeline

| Time | Decision / Action | Who | Outcome |
|------|-------------------|-----|---------|
| T+0 | _Detection method and first action_ | On-call | _Result_ |
| T+5 | _Escalation decision_ | IC | _Result_ |
| T+10 | _Containment action_ | SRE | _Result_ |
| T+15 | _Communication decision_ | Legal/Comms | _Result_ |
| ... | ... | ... | ... |

---

## 3. Decisions Log

| # | Decision | Made by | Rationale | Alternative considered |
|---|----------|---------|-----------|----------------------|
| 1 | _e.g. Do not pay ransom_ | CISO + CEO | _Board policy_ | _Pay and negotiate_ |
| 2 | _e.g. Activate break-glass_ | IC | _IdP compromised_ | _Wait for IdP vendor_ |

---

## 4. Gaps Identified

| # | Gap | Severity | Current state | Desired state |
|---|-----|----------|---------------|---------------|
| 1 | _e.g. No cross-cloud backup_ | HIGH | _Single-cloud R2 only_ | _Cross-cloud copy with Object Lock_ |
| 2 | _e.g. Break-glass procedure untested_ | MEDIUM | _Documented but never drilled_ | _Quarterly drill_ |

---

## 5. What Went Well

- _Item 1_
- _Item 2_

## 6. What Went Poorly

- _Item 1_
- _Item 2_

---

## 7. Action Items

| # | Action | Owner | Priority | Due Date | Ticket |
|---|--------|-------|----------|----------|--------|
| 1 | _Remediation_ | @name | P0/P1/P2 | YYYY-MM-DD | JIRA-XXX |
| 2 | _Remediation_ | @name | P0/P1/P2 | YYYY-MM-DD | JIRA-XXX |

---

## 8. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Facilitator | | | |
| CISO | | | |
| Eng Lead | | | |
| CEO (if SEV-1) | | | |

---

## Appendix: Reference Scenarios

### A248 -- Prod DB Ransomware + IdP Compromise

See `docs/audit/TECHNICAL-AUDIT-2026-04.md` section A248 for the
minute-by-minute playbook covering:

- First 60 minutes containment
- RACI matrix
- Break-glass procedure
- Forensic preservation steps
- Communication templates
- Recovery and restore procedure

### Other Scenario Ideas

- **IdP compromise** (Entra/Okta breached, all SSO sessions suspect)
- **Vendor outage** (Supabase down 6h, no DB access)
- **Insider threat** (compromised clinic_admin exfiltrating PHI)
- **Supply chain** (malicious npm package in dependency tree)
- **DDoS + extortion** (volumetric attack on Cloudflare Workers)
