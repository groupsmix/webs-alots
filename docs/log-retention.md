# Log Retention & Immutability Policy

> **Audit finding:** A188 | **Last updated:** April 2026

---

## 1. Log Sources

| Source | Type | Current Sink | Retention | Immutable? |
|--------|------|-------------|-----------|------------|
| `logAuditEvent()` | Audit trail (state changes) | Supabase `audit_logs` table | Indefinite | **No** (mutable Postgres) |
| `@/lib/logger` | Application logs | Cloudflare Workers Logs | 72 hours (Workers free tier) | No |
| Sentry | Error + performance traces | Sentry SaaS | 90 days (plan-dependent) | Yes (SaaS) |
| Cloudflare Analytics | Request metrics | Cloudflare dashboard | 30 days (free) / 1 year (enterprise) | Yes (SaaS) |
| Supabase Auth | Auth events | Supabase `auth.audit_log` | 7 days (default) | No |
| GitHub Actions | CI/CD logs | GitHub | 90 days | Yes (SaaS) |

---

## 2. Target Architecture

To meet WORM (Write-Once-Read-Many) requirements for at least 1 year:

```
App --> logAuditEvent() --> Supabase audit_logs (primary, queryable)
                       \-> R2 append-only bucket (immutable archive)
                       \-> (optional) SIEM ingestion
```

### Immutable Archive (R2 with Object Lock)

1. Create a dedicated R2 bucket: `oltigo-audit-archive`
2. Enable **Object Lock** in compliance mode (WORM):
   ```bash
   # R2 Object Lock is configured at bucket creation time
   # Contact Cloudflare support to enable Object Lock on the bucket
   ```
3. Ship audit logs nightly:
   ```bash
   # Export audit_logs for the previous day
   psql "$SUPABASE_DB_URL" -c \
     "COPY (SELECT * FROM audit_logs WHERE created_at >= NOW() - INTERVAL '1 day')
      TO STDOUT WITH CSV HEADER" \
     | gzip > "audit_$(date +%Y%m%d).csv.gz"
   
   # Upload to WORM bucket
   aws s3 cp "audit_$(date +%Y%m%d).csv.gz" \
     "s3://oltigo-audit-archive/$(date +%Y/%m)/" \
     --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
   ```
4. Set retention period: **1 year minimum** (regulatory) / **3 years recommended**.

### SIEM Integration (Optional)

For teams that need real-time alerting on log patterns:

| Option | Cost | Notes |
|--------|------|-------|
| **Panther** | $$ | Cloud SIEM, good for small teams |
| **Datadog Cloud SIEM** | $$$ | Full-featured, expensive |
| **Elastic Cloud** | $$ | Self-managed option available |
| **Grafana Loki** | $ | Open-source, pair with Grafana |

---

## 3. Retention Schedule

| Log Type | Minimum Retention | Recommended | Justification |
|----------|------------------|-------------|---------------|
| Audit logs (state changes) | **1 year** | 3 years | Law 09-08 compliance, incident investigation |
| Application logs | 90 days | 1 year | Debugging, incident response |
| Auth events | 1 year | 3 years | Access review, forensics |
| Error traces (Sentry) | 90 days | 1 year | Bug investigation |
| CI/CD logs | 90 days | 1 year | Supply-chain forensics |
| Request metrics | 30 days | 1 year | SLO tracking, capacity planning |

---

## 4. MTTD / MTTR Tracking

Track and report monthly in the SLO review:

| Metric | Definition | Target | Current |
|--------|-----------|--------|---------|
| **MTTD** (Mean Time to Detect) | Time from incident start to first alert | < 15 minutes | _TBD_ |
| **MTTR** (Mean Time to Resolve) | Time from first alert to service restored | < 2 hours (SEV-1) | _TBD_ |
| **MTTI** (Mean Time to Investigate) | Time from detection to root cause identified | < 1 hour | _TBD_ |

### Measurement Method

1. Record timestamps in incident post-mortems (see `docs/incident-response.md`).
2. Calculate rolling 90-day averages.
3. Report in monthly SLO review (see `docs/slo.md`).

---

## 5. Action Items

- [ ] Create `oltigo-audit-archive` R2 bucket with Object Lock
- [ ] Add nightly audit-log export job to `.github/workflows/backup.yml`
- [ ] Extend Supabase Auth audit log retention (check plan limits)
- [ ] Add MTTD/MTTR section to `docs/slo.md`
- [ ] Evaluate SIEM options if team grows beyond 5 people

---

## Related Documents

- [SLO Document](./slo.md)
- [Incident Response Runbook](./incident-response.md)
- [Forensic Readiness](./forensic-readiness.md)
