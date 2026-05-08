# Data Retention Schedule

**C-02 / R-03: Per-data-class retention schedule with enforcement cron references.**

## Retention Periods

| Data Class | Table(s) | Retention | Legal Basis | Purge Mechanism |
|---|---|---|---|---|
| **Patient records** | `users` (role=patient) | Account lifetime + 5 years after deletion request | Law 09-08 Art. 3 | `/api/cron/gdpr-purge` |
| **Medical records** | `consultation_notes`, `prescriptions` | 10 years from creation | Moroccan healthcare regulations | Manual archive + purge cron |
| **Appointment data** | `appointments` | 10 years from appointment_date | Healthcare records retention | Partition-based archive (P-06) |
| **Payment records** | `payments` | 10 years from payment date | Tax regulations (Code General des Impots) | Manual archive |
| **PHI documents** | `documents` (R2) | 10 years from upload | Healthcare records retention | R2 lifecycle policy + cron |
| **Audit logs** | `activity_logs` | 2 years from event | Law 09-08 compliance evidence | Partition pruning (R-02) |
| **Notification logs** | `notification_log` | 90 days | Operational | `/api/cron/gdpr-purge` |
| **Rate limit entries** | `rate_limit_entries` | 24 hours after reset_at | Operational | `cleanup_expired_rate_limit_entries()` |
| **Consent records** | `consent_logs`, `processing_consents` | Permanent (immutable ledger) | GDPR Art. 7(1) proof | Never deleted; anonymized after account deletion |
| **Session / auth data** | Supabase Auth | 30 days inactive | Operational | Supabase auto-cleanup |
| **Analytics** | Plausible (external) | 2 years | Legitimate interest | Plausible data retention settings |
| **GDPR anonymized data** | `consent_logs.anonymized_user_id` | Permanent | Statistical purposes | N/A (pseudonymized via HMAC) |

## Enforcement

Each retention period is enforced by one or more of:

1. **Automated crons**: `/api/cron/gdpr-purge` runs daily at 3 AM UTC
2. **Database partitioning**: `activity_logs` partitioned by month (R-02)
3. **R2 lifecycle rules**: `r2-lifecycle.json` configures object expiry
4. **Manual archive**: For data requiring human review before deletion

## Review Schedule

This schedule must be reviewed annually alongside the DPIA.
