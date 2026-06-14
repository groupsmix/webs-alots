# Post-Mortem Template

> **Audit finding:** A195 | **Last updated:** May 2026

Use this template after every SEV-1/SEV-2 incident. Complete within 5
business days of incident resolution.

---

## Incident Summary

| Field                  | Value                    |
| ---------------------- | ------------------------ |
| **Incident ID**        | INC-YYYY-NNN             |
| **Date/Time (UTC)**    | YYYY-MM-DD HH:MM – HH:MM |
| **Duration**           | X hours Y minutes        |
| **Severity**           | SEV-1 / SEV-2 / SEV-3    |
| **Incident Commander** | [Name]                   |
| **Author**             | [Name]                   |
| **Status**             | Draft / Final            |

## Impact

- **Users affected:** [Number/percentage, which clinics]
- **Revenue impact:** [Estimated MAD lost, if applicable]
- **Data impact:** [Any PHI exposure? Breach notification required?]
- **SLO impact:** [Which SLOs were breached, by how much]

## Timeline

| Time (UTC) | Event                            |
| ---------- | -------------------------------- |
| HH:MM      | [First alert / user report]      |
| HH:MM      | [Incident declared, IC assigned] |
| HH:MM      | [Root cause identified]          |
| HH:MM      | [Mitigation deployed]            |
| HH:MM      | [Service restored]               |
| HH:MM      | [Monitoring confirms stable]     |

## Root Cause

[Technical explanation of what failed and why. Be specific — include
file names, commit SHAs, config values, error messages.]

## Detection

- **How was it detected?** [Alert / user report / scheduled check / other]
- **Time to detect (TTD):** [Minutes from onset to first alert]
- **Could we have detected it faster?** [Yes/No — how?]
- **Was the documented alert/rule actually configured and firing?** [Yes/No/Unknown]
- **Was the runbook current?** [Yes/No — if no, link the doc fix]

## Resolution

[What was done to fix the issue. Include rollback steps, hotfixes,
config changes, etc.]

## Contributing Factors

1. [Factor 1 — e.g., missing monitoring, inadequate test coverage]
2. [Factor 2 — e.g., config drift, undocumented dependency]
3. [Factor 3 — e.g., team was unavailable, runbook was outdated]

## Action Items

| Priority | Action                                           | Owner  | Due Date | Status |
| -------- | ------------------------------------------------ | ------ | -------- | ------ |
| P0       | [Immediate fix already deployed]                 | [Name] | Done     | Done   |
| P1       | [Prevent recurrence — e.g., add alert, fix test] | [Name] | [Date]   | Open   |
| P2       | [Systemic improvement — e.g., improve runbook]   | [Name] | [Date]   | Open   |

## Lessons Learned

### What went well

- [Thing that worked as designed]

### What went poorly

- [Thing that made the incident worse or slower to resolve]

### Where we got lucky

- [Thing that could have been much worse]

## Appendix

- [Link to Slack thread / war room]
- [Link to relevant dashboards / logs]
- [Link to deploy / commit that caused or fixed the issue]
- [Link to PRs/docs that updated monitoring, alerts, or operator guidance afterward]

---

**Review sign-off:**

| Role             | Name | Date |
| ---------------- | ---- | ---- |
| IC               |      |      |
| Engineering Lead |      |      |
| CTO / CEO        |      |      |
