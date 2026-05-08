# Break-Glass Procedure — Emergency Privileged Access
## Finding F-A181

> **Version:** 1.0 | **Owner:** CISO | **Classification:** CONFIDENTIAL  
> **Review:** Quarterly + after every use

---

## Purpose

Break-glass is the emergency access procedure for situations where normal access channels fail (e.g. all CLI credentials are rotated due to a breach, IdP is down, on-call engineer is unavailable). It provides a last-resort path to production with strict accountability controls.

---

## Break-Glass Assets

The following are sealed and stored offline:

| Asset | Location | Custodian A | Custodian B |
|---|---|---|---|
| Production `SUPABASE_SERVICE_ROLE_KEY` | Sealed envelope in fireproof safe, registered address | CTO | CISO |
| Cloudflare `CF_API_TOKEN` (super-admin) | Sealed envelope in bank safe-deposit box | CEO | CTO |
| GitHub Personal Access Token (break-glass-bot) | Bitwarden Emergency Access | CTO | Engineering Manager |

> **Two-person rule:** No single individual may unseal and use break-glass credentials without a second custodian present and witnessing. Remote witnessing via video call with recording is acceptable.

---

## When to Use Break-Glass

Only if **all** of the following are true:

1. Normal access (IdP, MFA, team accounts) is unavailable
2. A production incident requires immediate intervention
3. Delay would cause material harm (patient safety, data breach, extended outage)
4. The incident commander has authorised the break-glass action

---

## Procedure

### Step 1 — Declare Break-Glass

1. Incident commander sends `[BREAK-GLASS DECLARED]` to the `#security-alerts` Slack channel.
2. Notify both custodians via phone (not Slack/email — they may be down).
3. Record declaration in the incident log.

### Step 2 — Retrieve Credentials

1. Both custodians must be present (in-person or video call with recording).
2. Unseal the envelope / access the vault.
3. Photograph the sealed envelope before opening (shows tamper seal intact).
4. Record: date, time, custodians present, reason.

### Step 3 — Use Credentials

1. Perform **only** the minimum necessary actions.
2. Record every command executed (copy-paste terminal output to the incident log).
3. Do not use break-glass credentials for any purpose beyond the immediate need.
4. Time-limit: use must conclude within 4 hours unless incident is ongoing.

### Step 4 — Seal the Break-Glass

Within **24 hours** of use:

- [ ] Rotate all break-glass credentials (assume compromised after use)
- [ ] Re-seal new credentials in tamper-evident envelopes
- [ ] Have both custodians sign the new seal
- [ ] Update the sealed asset register
- [ ] File the incident report

---

## Drill Schedule

| Date | Type | Participants | Outcome |
|---|---|---|---|
| Q1 2025 | Tabletop (no actual credentials used) | CTO, CISO, Eng Manager | _Not yet conducted_ |
| Q3 2025 | Tabletop | CTO, CISO | _Not yet conducted_ |

> **Drills must not use real production credentials.** Use a staging break-glass envelope with staging credentials.

---

## Post-Use Report

After every real break-glass use, file a report in `docs/audit/break-glass-log.csv`:

```
date, incident_id, custodian_a, custodian_b, actions_taken, credentials_rotated, rotated_by, review_date
```

---

## Custodian Update

Update custodians when any custodian leaves the company (see `docs/jml-policy.md`).
