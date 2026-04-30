# Tabletop Exercise Program

> **Audit finding:** A189 | **Last updated:** April 2026

Tabletop exercises are discussion-based walkthroughs of incident scenarios.
They validate that the team knows the IR plan, reveal gaps, and build muscle
memory without impacting production.

---

## Schedule

**Frequency:** Quarterly (minimum)

| Quarter | Scenario | Date | Facilitator | Gaps Found |
|---------|----------|------|-------------|------------|
| Q3 2026 | _TBD (pick from library below)_ | _TBD_ | _TBD_ | _TBD_ |
| Q4 2026 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Scenario Library

Pick one per quarter. Rotate through all scenarios within 2 years.

### 1. Ransomware on Developer Laptop

- Attacker encrypts a developer's laptop that had a local Supabase clone.
- Questions: Is FDE enabled? Can we confirm no PHI was exfiltrated? Do we
  notify CNDP? How do we revoke the developer's access?

### 2. Insider Data Exfiltration

- A departing team member bulk-exports patient data via `SELECT *` on prod.
- Questions: Would our audit logs catch this? How fast? Do we have alerts
  for bulk queries? What is our CNDP notification obligation?

### 3. Production Database Drop

- An accidental `DROP TABLE appointments` on production.
- Questions: What is our RPO? Can we restore from backup within RTO? How do
  we communicate to clinics? Which backup do we use (Supabase PITR vs R2)?

### 4. Cloud Account Takeover (Cloudflare)

- Attacker gains access to the Cloudflare account via a compromised API token.
- Questions: What damage can they do? (DNS hijack, Worker replace, R2 delete)
  How do we detect it? How do we recover? (See SOP-SECRET-ROTATION.md #2)

### 5. Vendor Outage (Supabase Down for 4+ Hours)

- Supabase experiences a multi-hour outage affecting our eu-west-1 region.
- Questions: What degrades? Can we serve cached data? What do we tell clinics?
  Do we invoke the vendor exit playbook?

### 6. GitHub Credentials / PAT Leak

- A Personal Access Token with repo write access is found in a public paste.
- Questions: How do we detect it? (Gitleaks? GitHub secret scanning?) How
  fast can we revoke? What could the attacker have accessed?

### 7. AI Model Data Leak

- OpenAI reports that a batch of API requests (including ours) was logged
  in plaintext due to a bug.
- Questions: Did we send any PHI in prompts? (Should be no -- verify.) Do
  we need to notify CNDP? What compensating controls exist?

### 8. WhatsApp Business Account Suspension

- Meta suspends our WhatsApp Business account for policy violation.
- Questions: What is the patient notification fallback? (Twilio SMS, email)
  How long can we operate without WhatsApp? How do we appeal?

---

## Exercise Template

Use this template for each exercise. Store completed exercises in
`docs/tabletop/YYYY-MM-scenario-name.md`.

```markdown
# Tabletop Exercise: [Scenario Name]

**Date:** YYYY-MM-DD
**Facilitator:** [Name]
**Participants:** [Names]
**Duration:** [X minutes]

## Scenario

[Describe the scenario in detail. Include the initial alert/trigger.]

## Discussion Points

1. How would we detect this?
2. Who gets paged first?
3. What is the first containment action?
4. What evidence do we preserve?
5. Who do we notify? (Internal, customers, regulators)
6. What is the recovery procedure?
7. How do we confirm the incident is fully resolved?

## Gaps Identified

| # | Gap | Severity | Owner | Remediation | Due Date |
|---|-----|----------|-------|-------------|----------|
| 1 | [Description] | [H/M/L] | [Name] | [Action] | [Date] |

## Action Items

- [ ] [Action item from gap #1]
- [ ] [Action item from gap #2]

## Lessons Learned

[Summary of key takeaways]
```

---

## Related Documents

- [Incident Response Runbook](../incident-response.md)
- [Communications Templates](../comms-templates/README.md)
- [Forensic Readiness](../forensic-readiness.md)
- [Break-Glass Procedures](../workforce-security.md#3-break-glass-accounts-a181)
