# Log Retention Policy
## Reference: F-A93-04, Moroccan Law 09-08 Art.24, ISO 27001 A.12.4

> **Version:** 1.1 | **Owner:** CISO + Engineering Lead | **Review:** Annual

---

## Purpose

This policy defines how Oltigo Health application logs are retained, protected, and destroyed. Moroccan Law 09-08 requires that access to personal data be auditable. Deleting or downsampling access logs at the application layer violates this requirement.

**Critical rule: `Math.random()`-based downsampling of audit events is PROHIBITED. All authenticated API requests must be logged.** Volume is managed at the infrastructure layer.

---

## Log Categories & Retention Periods

| Category | Examples | Retention | Storage | Deletion |
|---|---|---|---|---|
| **PHI Access Logs** | Patient record views, file downloads, appointment reads | **7 years** | R2 (Object Lock) | Automated after 7y |
| **Mutation Audit Logs** | `activity_logs` table inserts | **7 years** | Postgres → R2 WORM (migration `00086`) | Never manually |
| **Authentication Logs** | Login, logout, failed auth, session events | **3 years** | Supabase + R2 | Automated after 3y |
| **API Request Logs** | All authenticated GET/POST/PUT/DELETE | **1 year** | Cloudflare Logpush | Automated after 1y |
| **Security Events** | Rate limit exceeded, CSRF blocked, HMAC failures | **3 years** | Sentry + R2 export | Automated after 3y |
| **System/Debug Logs** | Performance metrics, worker boot events | **30 days** | Cloudflare Logs | Automated |

---

## Volume Management (Infrastructure Layer Only)

Application-level downsampling of audit events is **prohibited**. Volume must be managed at the infrastructure layer:

### Cloudflare Logpush
```json
{
  "name": "oltigo-audit-logs",
  "destination_conf": "r2://oltigo-audit-logs/{DATE}/{HOUR}",
  "dataset": "workers_trace_events",
  "frequency": "high"
}
```

### Supabase Log Drain
Push `activity_logs` to R2 (7-year object lock) and Axiom (90-day searchable window).

### Cost Estimation
At 10,000 API calls/day: ~50 MB/month gzipped → ~$42/year R2 storage at 7 years.

---

## WORM Archive (Tamper-Evident)

Per migration `00086_worm_audit_r2_sink.sql`:
- Every `activity_logs` INSERT is queued for R2 with Object Lock (Governance, 7 years)
- `activity_logs` rows are immutable — UPDATE/DELETE blocked by DB triggers
- R2 bucket `oltigo-audit-worm`: Versioning enabled, Object Lock mode Governance, 7-year retention

---

## Log Content Rules

**Always log (100%):** PHI endpoint reads, all mutations, auth events, security events, AI invocations.

**Never log:** Passwords, encryption keys, patient names/email/phone (use UUIDs only), full request bodies, payment card data.

---

## Legal Hold

When a legal hold is active (`docs/incident-response/legal-hold.md`): log deletion jobs for the affected `clinic_id` are suspended until Legal lifts the hold.
