# Incident Communications Templates

> **Audit finding:** A187 | **Last updated:** April 2026

Pre-approved templates for incident communications. Fill in the bracketed
fields and send via the designated channel.

---

## 1. Internal Slack / Team Notification

**Channel:** `#incidents` (or `#general` for SEV-1)

```
:rotating_light: INCIDENT DECLARED — [SEV-1/2/3/4]

Summary: [Brief description of the issue]
Impact: [What is broken, who is affected, estimated user count]
Status: [Investigating / Identified / Monitoring / Resolved]
IC (Incident Commander): [Name]
War room: [Slack channel / Google Meet link]

Next update in [15/30/60] minutes.
```

---

## 2. Customer Email (Service Disruption)

**From:** `support@oltigo.com`
**Subject:** `[Oltigo Health] Service disruption — [brief description]`

```
Bonjour,

We are currently experiencing [a service disruption / degraded performance]
affecting [booking / appointments / notifications / all services].

What is happening:
[Brief, non-technical description]

Impact:
[What users may notice — e.g., "appointment booking may be temporarily unavailable"]

What we are doing:
Our team is actively investigating and working to restore normal service.

We will provide an update by [time, Africa/Casablanca timezone].

If you have urgent needs, please contact us at support@oltigo.com.

Cordialement,
Oltigo Health Team
```

---

## 3. Customer Email (Resolution)

**From:** `support@oltigo.com`
**Subject:** `[Oltigo Health] Service restored — [brief description]`

```
Bonjour,

The service disruption affecting [component] has been resolved as of
[timestamp, Africa/Casablanca timezone].

Root cause: [brief, non-technical explanation]
Duration: [X hours Y minutes]
Data impact: [No data was lost / Describe any data impact]

We apologize for the inconvenience. We are taking steps to prevent
recurrence, including [brief description of remediation].

If you notice any remaining issues, please contact support@oltigo.com.

Cordialement,
Oltigo Health Team
```

---

## 4. Regulator Notification (CNDP — Moroccan Data Authority)

**To:** `contact@cndp.ma`
**Subject:** `Notification d'incident de securite — Oltigo Health`

See [docs/compliance/breach-notification-templates.md](../compliance/breach-notification-templates.md)
for the full CNDP and GDPR breach notification templates.

---

## 5. Legal Hold Notice

**Purpose:** Preserve all evidence related to a security incident for
potential legal proceedings or regulatory investigation.

**From:** Security Officer / DPO
**To:** All team members with access to affected systems

```
LEGAL HOLD NOTICE — CONFIDENTIAL

Date: [YYYY-MM-DD]
Incident reference: [INC-XXXX]

You are hereby notified that a legal hold is in effect related to
[brief description of incident]. Effective immediately, you must:

1. PRESERVE all documents, communications, logs, screenshots, and
   any other materials related to [affected systems / timeframe].

2. DO NOT delete, modify, overwrite, or destroy any potentially
   relevant information, including:
   - Email and Slack messages
   - Code commits and pull requests
   - Database snapshots and backups
   - Log files (application, access, audit)
   - Screenshots and screen recordings
   - Personal notes about the incident

3. DO NOT discuss this incident outside the designated incident
   response team without authorization from [Security Officer name].

4. CONTACT [Security Officer email] immediately if you become
   aware of any relevant information or if you have questions.

This hold remains in effect until you receive written notice of
its release.

[Security Officer / DPO name]
[Title]
[Date]
```

---

## 6. Chain of Custody Log

Use this template to document evidence handling during an incident.

| # | Evidence Item | Collected By | Date/Time (UTC) | Source | Hash (SHA-256) | Storage Location | Notes |
|---|--------------|-------------|-----------------|--------|----------------|-----------------|-------|
| 1 | [e.g., Supabase audit_logs export] | [Name] | [YYYY-MM-DD HH:MM] | [Supabase Dashboard] | [hash] | [R2 bucket / local encrypted drive] | [any notes] |
| 2 | | | | | | | |

### Chain of Custody Transfer

| Evidence # | From | To | Date/Time (UTC) | Reason | Signature |
|-----------|------|-----|-----------------|--------|-----------|
| 1 | [Name] | [Name] | [YYYY-MM-DD HH:MM] | [Reason] | [Digital signature / initials] |

---

## Related Documents

- [Incident Response Runbook](../incident-response.md)
- [Breach Notification Templates](../compliance/breach-notification-templates.md)
- [Forensic Readiness](../forensic-readiness.md)
