# Legal Hold & Chain-of-Custody Procedure
## F-A187 — Forensic Data Preservation

> **Version:** 1.0 | **Owner:** CISO + Legal | **Trigger:** Any litigation hold, regulatory investigation, or major breach

---

## What Is a Legal Hold?

A legal hold (also: litigation hold, preservation order) is the process of preserving all potentially relevant data when litigation, regulatory investigation, or a criminal proceeding is reasonably anticipated. Destroying data under legal hold is spoliation — a serious legal violation.

---

## Trigger Conditions

Issue a legal hold when any of the following occur:

- [ ] A court order or subpoena is received
- [ ] A patient or clinic files a formal complaint with CNDP or a court
- [ ] A regulatory investigation is opened (CNDP, CNSS, ANRT)
- [ ] Oltigo receives a preservation request from law enforcement
- [ ] An internal investigation determines that litigation is reasonably anticipated
- [ ] A confirmed data breach that may result in civil claims

---

## Step 1 — Declare the Hold (Legal/CISO)

1. Complete the **Legal Hold Notice** (template below).
2. Assign a unique **Hold ID**: `LH-YYYY-NNN` (e.g. `LH-2025-001`).
3. Document the scope: which clinic(s), date range, data categories.
4. Log the hold in `docs/audit/legal-hold-register.csv`.

---

## Step 2 — Preserve Evidence

### 2a. Database (Supabase)

```bash
# Export affected clinic's data via admin panel or pg_dump
supabase db dump --linked --data-only > hold-LH-YYYY-NNN-$(date +%Y%m%d).sql

# Disable automated deletion/anonymisation for affected clinic_id
# via supabase/config.toml: pause the gdpr_anonymize cron for this clinic
```

### 2b. R2 Object Storage

```bash
# Create a versioning snapshot of the affected prefix
# (R2 object lock must be enabled — see docs/r2-security.md)
# Tag affected objects with: x-amz-object-lock-retain-until-date = +7 years
```

### 2c. Application Logs (Cloudflare Workers)

- Enable Logpush to R2 for the affected period if not already enabled.
- Export from Workers Logs dashboard for the relevant time window.
- Hash the exported archive: `sha256sum export.tar.gz > export.tar.gz.sha256`

### 2d. Email & Communications

- Preserve all emails in/out of `security@oltigo.com` and `legal@oltigo.com` for the relevant period.
- Do not delete, archive, or move these emails until the hold is lifted.

---

## Step 3 — Chain of Custody

Every transfer of preserved data must be logged:

| Date | From | To | Method | Hash (SHA-256) | Witnessed by |
|---|---|---|---|---|---|
| | | | | | |

- Data must be transmitted encrypted (AES-256 or TLS 1.3).
- Physical media (USB/DVD) must be sealed in a tamper-evident bag.
- Hash the archive before and after transfer and verify they match.

---

## Step 4 — Notify Custodians

Send the Legal Hold Notice to all individuals who may have relevant data:
- Engineering (DB exports, logs)
- Customer Success (email threads with the clinic)
- Finance (invoice/payment records)
- HR (if involving an employee)

Template subject: `[LEGAL HOLD LH-YYYY-NNN] Preserve all data related to [Topic]`

---

## Step 5 — Ongoing Monitoring

- Review the hold scope monthly.
- Ensure automated data deletion jobs exclude held data.
- Update the hold register when new data is identified.

---

## Step 6 — Lift the Hold

The hold may only be lifted by Legal + CISO jointly, after:
- Written confirmation from opposing counsel or the court, **or**
- The statute of limitations for the relevant claim has expired.

When lifted:
1. Update `docs/audit/legal-hold-register.csv` with lift date and reason.
2. Notify all custodians in writing.
3. Resume normal data lifecycle (GDPR/Law 09-08 retention rules apply).

---

## Legal Hold Notice Template

```
LEGAL HOLD NOTICE
Hold ID: LH-YYYY-NNN
Date: YYYY-MM-DD
Issued by: [Name, Title]

You are required to preserve all documents, data, records, and
communications (including emails, chat logs, database records, and
log files) that are related to:

  [DESCRIPTION OF MATTER]

  Affected clinic(s): [clinic_id(s)]
  Date range: YYYY-MM-DD to YYYY-MM-DD
  Data categories: [e.g. patient records, appointment logs, payments]

DO NOT delete, alter, overwrite, or destroy any potentially relevant
information. Suspend all auto-deletion and archiving rules for the
above scope immediately.

If you have questions, contact legal@oltigo.com immediately.
```

---

## Register

Maintained at: `docs/audit/legal-hold-register.csv`  
Columns: `hold_id, issued_date, matter, scope_clinics, scope_dates, status, lifted_date, owner`
