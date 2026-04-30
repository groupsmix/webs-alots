# Legal Hold Procedure (A187)

## Purpose

When litigation, regulatory investigation, or a significant security incident is
reasonably anticipated, all relevant evidence must be preserved. This procedure
ensures logs, database records, and infrastructure artifacts are not destroyed
by routine retention policies or automated cleanup.

## Trigger Criteria

A legal hold is initiated when any of the following occur:

1. Receipt of a litigation threat, subpoena, or regulatory inquiry
2. A SEV-1 or SEV-2 security incident is declared
3. A data breach affecting patient PHI is confirmed
4. Direction from legal counsel

## Procedure

### 1. Issue the Hold (T+0)

- [ ] Legal counsel or Incident Commander issues a written hold notice to all custodians
- [ ] Identify the **scope**: date range, clinics affected, data types, systems
- [ ] Notify the following teams: Engineering, DevOps, Security, HR (if employee involved)

### 2. Preserve Evidence (T+1h)

- [ ] **Database:** Disable any scheduled `DELETE` or `TRUNCATE` jobs on affected tables
  - `activity_logs`, `audit_logs`, `billing_events`, `appointments`, `users`
- [ ] **Supabase:** Export a logical backup (`pg_dump`) of affected clinic(s)
  - Store in a separate, access-controlled R2 bucket or encrypted local storage
- [ ] **Cloudflare Workers logs:** Enable log retention (Workers Logpush) if not already active
- [ ] **R2 storage:** Enable Object Lock (compliance mode) on the uploads bucket for the hold period
- [ ] **Email/Slack:** Instruct custodians not to delete any messages related to the incident
- [ ] **Git history:** Tag the current HEAD: `git tag legal-hold/[INCIDENT-ID] HEAD`

### 3. Document the Chain of Custody

Use the template in `docs/chain-of-custody.md` for each piece of evidence collected.

### 4. Restrict Access

- [ ] Limit access to preserved evidence to: Legal Counsel, Incident Commander, Forensic Investigator
- [ ] Create a dedicated Supabase role or R2 bucket policy if needed

### 5. Maintain the Hold

- [ ] Review the hold scope monthly with legal counsel
- [ ] Log any access to preserved evidence in the chain-of-custody register

### 6. Release the Hold

- [ ] Legal counsel issues a written release
- [ ] Resume normal retention/deletion schedules
- [ ] Archive the chain-of-custody register with the incident post-mortem

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Legal Counsel | [NAME] | [EMAIL] |
| DPO | [NAME] | [EMAIL] |
| Incident Commander (on-call) | See `docs/oncall.md` | - |
