# Post-Mortem Report: [INCIDENT TITLE]

> **Incident ID:** INC-YYYY-NNN
> **Date of incident:** YYYY-MM-DD HH:MM UTC
> **Date of post-mortem:** YYYY-MM-DD
> **Author:** [Name]
> **Severity:** SEV-1 / SEV-2 / SEV-3 / SEV-4
> **Status:** Draft / Final

---

## TL;DR

_One-paragraph summary of what happened, what the impact was, and what the
most important action item is._

---

## Timeline (all times UTC)

| Time | Event |
|------|-------|
| HH:MM | First alert / detection |
| HH:MM | On-call paged |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service fully restored |
| HH:MM | Customer communication sent |

---

## Impact

| Metric | Value |
|--------|-------|
| **Duration** | X hours Y minutes |
| **Users affected** | ~N users / N% of traffic |
| **Tenants affected** | All / specific clinic IDs |
| **Data loss** | None / describe |
| **Revenue impact** | None / estimated MAD |
| **SLO budget consumed** | X% of monthly budget |

---

## Root Cause Analysis (5 Whys)

1. **Why did the incident happen?**
   _Answer._

2. **Why did [answer 1] happen?**
   _Answer._

3. **Why did [answer 2] happen?**
   _Answer._

4. **Why did [answer 3] happen?**
   _Answer._

5. **Why did [answer 4] happen?**
   _Answer._

### Contributing Factors

- _Factor 1 (e.g. missing monitoring, insufficient test coverage)_
- _Factor 2_
- _Factor 3_

---

## What Went Well

- _Item 1 (e.g. alerting fired within SLO, team responded quickly)_
- _Item 2_

## What Went Poorly

- _Item 1 (e.g. runbook was out of date, rollback took too long)_
- _Item 2_

## Where We Got Lucky

- _Item 1 (e.g. happened during low-traffic hours)_
- _Item 2_

---

## Action Items

| # | Action | Owner | Priority | Due Date | Ticket |
|---|--------|-------|----------|----------|--------|
| 1 | _Description of remediation_ | @name | P0 / P1 / P2 | YYYY-MM-DD | JIRA-XXX |
| 2 | _Description_ | @name | P0 / P1 / P2 | YYYY-MM-DD | JIRA-XXX |
| 3 | _Description_ | @name | P0 / P1 / P2 | YYYY-MM-DD | JIRA-XXX |

---

## Follow-Up Audit

- [ ] Action items reviewed in next sprint planning
- [ ] Monitoring / alerting improvements deployed
- [ ] Runbook updated
- [ ] Customer communication closed out
- [ ] Post-mortem shared with wider team (blameless)
- [ ] Follow-up audit scheduled (30 days after incident)

---

## Appendix

### Relevant Logs / Screenshots

_Attach or link to dashboards, log queries, or screenshots that are
relevant to the investigation._

### References

- [Incident Response Runbook](./incident-response.md)
- [On-Call Guide](./oncall.md)
- [SLO Dashboard](./slo.md)

---

> **Blameless culture reminder:** This post-mortem is a learning exercise,
> not a blame exercise. We focus on systemic improvements, not individual
> fault. If you feel uncomfortable with any content in this document,
> raise it with the facilitator before publication.
