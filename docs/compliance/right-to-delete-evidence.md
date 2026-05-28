# Right-to-Delete — Execution Evidence

> **Audience:** DPO, compliance auditors, platform operators
> **Last updated:** May 2026
> **Legal basis:** Moroccan Law 09-08 Art. 8, GDPR Art. 17 (Right to Erasure)
> **Cron:** `/api/cron/gdpr-purge` — daily at 03:00 UTC

---

## 1. Deletion Architecture

### Patient-Initiated Deletion

1. Patient navigates to Settings → Delete Account in their dashboard
2. `POST /api/patient/delete-account` sets `deletion_requested_at = NOW()` on the user row
3. Patient receives confirmation email/WhatsApp with a 30-day grace period notice
4. During the grace period, the patient can log in and cancel the deletion
5. After 30 days, the GDPR purge cron permanently deletes the data

### Automated GDPR Purge (`/api/cron/gdpr-purge`)

Runs daily. For each user where `deletion_requested_at < NOW() - 30 days`:

1. **Delete dependent records** (respects FK constraints):
   - Appointments (including related appointment_doctors)
   - Consultation notes
   - Prescriptions
   - Medical records
   - Documents (R2 objects deleted via `deleteFromR2`)
   - Notifications
   - Waiting list entries
   - Custom field values
2. **Anonymize consent logs** (GDPR Art. 7(1) proof retention):
   - Set `user_id = NULL`
   - Retain `anonymized_user_id` (HMAC pseudonymization)
   - Consent record becomes pseudonymous — proves consent existed without linking to natural person
3. **Delete the user row** from `users` table
4. **Delete the auth user** from Supabase Auth

### Data NOT Deleted

| Data                    | Why                         | Legal Basis                                |
| ----------------------- | --------------------------- | ------------------------------------------ |
| Anonymized consent logs | Proof of consent processing | GDPR Art. 7(1)                             |
| Aggregated statistics   | No PII remains              | Legitimate interest                        |
| Audit log entries       | Security compliance         | Law 09-08, retained for 2 years            |
| Financial records       | Tax regulations             | Code General des Impots, 10-year retention |

---

## 2. Verification Procedure

After each GDPR purge run, verify:

```sql
-- 1. No user rows remain for purged users
SELECT id, email FROM users
WHERE deletion_requested_at < NOW() - INTERVAL '30 days';
-- Expected: 0 rows

-- 2. Consent logs are anonymized (user_id NULL, anonymized_user_id retained)
SELECT id, user_id, anonymized_user_id, action
FROM consent_logs
WHERE anonymized_user_id IS NOT NULL AND user_id IS NULL
ORDER BY created_at DESC LIMIT 5;
-- Expected: rows with user_id=NULL, anonymized_user_id present

-- 3. No orphan appointments exist
SELECT a.id FROM appointments a
LEFT JOIN users u ON a.patient_id = u.id
WHERE u.id IS NULL AND a.patient_id IS NOT NULL;
-- Expected: 0 rows

-- 4. No orphan R2 objects (checked by /api/cron/r2-cleanup)
-- See Sentry cron dashboard for r2-cleanup-hourly status
```

---

## 3. Evidence Records

### Template

Copy this block for each deletion event or batch:

```
### Deletion Batch YYYY-MM-DD

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Cron run time | HH:MM UTC |
| Users purged | N |
| Users failed | N |
| R2 objects deleted | N |
| Consent logs anonymized | N |
| Sentry check-in status | ok / error |
| Sentry check-in ID | [Sentry monitor slug: gdpr-purge-daily] |
| Verification query — orphan users | 0 rows |
| Verification query — orphan appointments | 0 rows |
| Issues | None / [describe] |
| Operator review | [Name] |

Notes: [any observations]
```

---

## 4. Monitoring

| Monitor                  | Tool                              | Alert                                        |
| ------------------------ | --------------------------------- | -------------------------------------------- |
| Cron execution           | Sentry Crons (`gdpr-purge-daily`) | Alert if missed (> 5 min margin) or failed   |
| Purge errors             | Sentry error tracking             | Alert on `GDPR purge failed for user` errors |
| Orphan detection         | R2 cleanup cron                   | Alert if orphan rate exceeds threshold       |
| Deletion request backlog | Manual quarterly check            | Verify no requests older than 60 days remain |

---

## 5. Historical Deletions

> Record completed deletion batches below. Newest first.

_No production deletions recorded yet. System operational and tested in staging._
