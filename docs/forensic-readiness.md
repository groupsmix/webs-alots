# Forensic Readiness Plan

> **Audit finding:** A193 | **Last updated:** April 2026

This document ensures that when an incident occurs, the team can collect,
preserve, and analyze evidence without scrambling for tools or access.

---

## 1. Pre-Positioned Evidence Sources

| Source | What It Contains | How to Collect | Retention |
|--------|-----------------|----------------|-----------|
| **Supabase `audit_logs`** | All state-changing operations (user, clinic, action, IP, user-agent) | `psql` export or Supabase Dashboard | Indefinite (DB) + 1y archive (R2 WORM) |
| **Supabase PITR** | Point-in-time database snapshots | Supabase Dashboard (Team/Enterprise plan) | 7-30 days (plan-dependent) |
| **Cloudflare Workers Logs** | Request/response metadata, errors | Cloudflare Dashboard or Logpush | 72h (Workers) / configurable (Logpush) |
| **Cloudflare Audit Log** | Admin actions (DNS changes, Worker deploys, WAF changes) | Cloudflare Dashboard -> Audit Log | 18 months |
| **Sentry** | Error traces with stack traces, breadcrumbs, request context | Sentry Dashboard or API | 90 days |
| **GitHub Audit Log** | Org-level events (member changes, repo access, secret access) | GitHub Settings -> Audit Log or API | 90 days (free) / 6 months (enterprise) |
| **R2 Backup Bucket** | Nightly pg_dump, R2 file replicas | S3 API | Per lifecycle policy |
| **GitHub Actions Logs** | CI/CD execution logs, deploy artifacts | GitHub Actions UI or API | 90 days |
| **Stripe Dashboard** | Payment events, webhook delivery logs | Stripe Dashboard | 2 years |

---

## 2. Correlation IDs

End-to-end tracing requires a request ID that flows through all layers:

```
Client Request
  -> Cloudflare Worker (cf-ray header)
    -> Next.js middleware (x-request-id)
      -> API route handler (logged via @/lib/logger)
        -> Supabase query (audit_logs.metadata.request_id)
          -> Sentry trace (tags.request_id)
```

### Implementation Status

- [x] Sentry trace IDs attached to errors
- [x] `logAuditEvent()` captures IP and user-agent
- [ ] **Gap:** Ensure `x-request-id` (or `cf-ray`) is propagated to `audit_logs.metadata`
- [ ] **Gap:** Ensure Sentry breadcrumbs include the same request ID

### Action Items

- [ ] Add `request_id` to `logAuditEvent()` metadata parameter
- [ ] Set `Sentry.setTag("request_id", requestId)` in middleware
- [ ] Document correlation ID format in this file

---

## 3. Evidence Collection Procedures

### 3.1 Database Snapshot (Supabase)

```bash
# Immediate snapshot (if PITR available)
# Go to Supabase Dashboard -> Database -> Backups -> Create backup

# Manual export of specific tables
psql "$SUPABASE_DB_URL" -c \
  "COPY (SELECT * FROM audit_logs WHERE created_at BETWEEN '[start]' AND '[end]')
   TO STDOUT WITH CSV HEADER" > evidence_audit_logs.csv

# Hash the evidence
sha256sum evidence_audit_logs.csv > evidence_audit_logs.csv.sha256
```

### 3.2 Cloudflare Logs

```bash
# Export via Logpush (if configured) or manually from Dashboard
# Cloudflare Dashboard -> Analytics & Logs -> Logs

# For Audit Log (admin actions):
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/audit_logs?since=[ISO_DATE]&until=[ISO_DATE]" \
  | jq . > evidence_cf_audit.json

sha256sum evidence_cf_audit.json > evidence_cf_audit.json.sha256
```

### 3.3 Sentry Events

```bash
# Export via Sentry API
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/events/?query=timestamp%3A%3E[ISO_DATE]" \
  | jq . > evidence_sentry.json

sha256sum evidence_sentry.json > evidence_sentry.json.sha256
```

### 3.4 GitHub Audit Log

```bash
# Export via GitHub API
gh api /orgs/groupsmix/audit-log \
  --paginate \
  -X GET \
  -f phrase="created:>=[ISO_DATE]" \
  > evidence_github_audit.json

sha256sum evidence_github_audit.json > evidence_github_audit.json.sha256
```

---

## 4. NTP / Time Synchronization

Accurate timestamps are critical for evidence correlation.

| System | NTP Source | Accuracy |
|--------|-----------|----------|
| Cloudflare Workers | Cloudflare internal NTP | Sub-millisecond |
| Supabase (PostgreSQL) | AWS NTP (chrony) | Sub-millisecond |
| Sentry | Sentry server NTP | Seconds (client clock skew possible) |
| Developer laptops | OS default NTP | Depends on MDM enforcement |

**Action:** Enforce NTP on developer machines via MDM policy (see
`docs/workforce-security.md` Section 4).

---

## 5. Memory / Disk Capture

### Serverless (Cloudflare Workers)

- Memory capture is **not applicable** -- Workers are ephemeral, stateless.
- Evidence is limited to logs and request traces.

### Supabase (Managed Postgres)

- Disk imaging is **not possible** (managed service).
- Use **PITR snapshots** as the closest equivalent.
- Supabase support can provide additional logs on request (Enterprise plan).

### Developer Laptops

- If a laptop is suspected compromised:
  1. **Do not shut down** (preserves memory).
  2. If MDM supports it, trigger remote memory capture.
  3. Image the disk before wiping (use `dd` or forensic tools like FTK Imager).
  4. Store image on encrypted external drive; document chain of custody.

---

## 6. Evidence Storage

| Location | Purpose | Access |
|----------|---------|--------|
| `s3://oltigo-audit-archive/incidents/INC-XXXX/` | Immutable incident evidence | Security Officer + DPO only |
| Encrypted external drive (offline) | Disk images, memory dumps | Physical custody (two-person) |
| `docs/comms-templates/README.md` (chain of custody log) | Tracking evidence handling | Incident team |

---

## 7. Action Items

- [ ] Propagate `request_id` / `cf-ray` through audit log metadata
- [ ] Set Sentry tags for request ID correlation
- [ ] Create `oltigo-audit-archive` R2 bucket with Object Lock
- [ ] Document NTP enforcement in MDM policy
- [ ] Test evidence collection procedures in next tabletop exercise

---

## Related Documents

- [Log Retention & Immutability](./log-retention.md)
- [Incident Response Runbook](./incident-response.md)
- [Communications Templates (Chain of Custody)](./comms-templates/README.md)
- [Tabletop Exercises](./tabletop/README.md)
