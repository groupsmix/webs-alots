# Blameless Post-Mortem Template
## F-A195 — Incident Post-Mortem Process

> **Purpose:** Systematic, blame-free learning from incidents.  
> **Audience:** Engineering, CISO, Product  
> **Owner:** On-call engineer + Engineering Manager  
> **Trigger:** Any SEV-1/SEV-2 incident, or any breach of patient data

---

## Post-Mortem: [INCIDENT TITLE]

| Field | Value |
|---|---|
| **Date of incident** | YYYY-MM-DD |
| **Date of post-mortem** | YYYY-MM-DD (within 5 business days of resolution) |
| **Severity** | SEV-1 / SEV-2 / SEV-3 |
| **Duration** | HH:MM (detection to full resolution) |
| **Services affected** | e.g. Booking API, WhatsApp receptionist |
| **Incident commander** | @name |
| **Scribe** | @name |
| **Attendees** | @name, @name, … |

---

## 1. Executive Summary (≤3 sentences)

> What happened, what was the business impact, and what was done to resolve it?

_FILL IN_

---

## 2. Timeline (UTC)

| Time | Event |
|---|---|
| HH:MM | First alert / user report |
| HH:MM | Incident declared, on-call paged |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service restored |
| HH:MM | Incident closed |

---

## 3. Root Cause Analysis (5 Whys)

**Why did the incident occur?**  
→ Because …

**Why did [that] happen?**  
→ Because …

**Why did [that] happen?**  
→ Because …

**Why did [that] happen?**  
→ Because …

**Why did [that] happen?**  
→ Root cause: _[state the underlying cause]_

---

## 4. Impact Assessment

| Dimension | Detail |
|---|---|
| Patient data affected? | Yes / No / Unknown |
| Records affected | N patients across M clinics |
| Revenue impact | MAD X (downtime × MRR / uptime) |
| SLA breach? | Yes / No (see docs/slo.md) |
| Regulatory notification required? | Yes → see docs/incident-response/breach-notification-matrix.md |

---

## 5. What Went Well

- _List things that worked: good runbooks, fast detection, clear comms, …_

---

## 6. What Went Poorly

- _List things that didn't work: missing alerts, slow handoffs, unclear ownership, …_

---

## 7. Action Items

| # | Action | Owner | Due date | Priority |
|---|---|---|---|---|
| 1 | | @name | YYYY-MM-DD | P0 |
| 2 | | @name | YYYY-MM-DD | P1 |
| 3 | | @name | YYYY-MM-DD | P2 |

---

## 8. Lessons Learned

_What would you tell a new engineer about this incident?_

---

## 9. Sign-off

| Role | Name | Date |
|---|---|---|
| Engineering Manager | | |
| CISO / Security Officer | | |
| DPO (if PHI involved) | | |

---

## Blameless Culture Reminder

> This post-mortem exists to improve systems, not to assign blame.
> All participants are expected to approach this with curiosity and psychological safety.
> If you feel the process is being used punitively, raise it with People-Ops immediately.
