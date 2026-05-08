# On-Call Playbook — Oltigo Health

> **Owner:** Engineering Lead + CISO | **Review:** Quarterly  
> **Reference:** F-A94-04, ISO 27001 A.16.1.5, Moroccan Law 09-08 Art.29

---

## Alert Response Matrix

| Alert | Severity | SLA (Ack / Resolve) | Runbook |
|---|---|---|---|
| P99 latency > 2s for 5 min | HIGH | 5 min / 30 min | [Latency](#latency-spike) |
| Error rate > 5% for 2 min | CRITICAL | 2 min / 15 min | [Error Spike](#error-rate-spike) |
| Supabase connection pool exhausted | CRITICAL | 2 min / 15 min | [DB Pool](#db-connection-pool) |
| R2 upload failure rate > 10% | HIGH | 5 min / 1h | [R2 Storage](#r2-upload-failures) |
| AI token budget > 80% for any clinic | MEDIUM | 30 min / 4h | [AI Budget](#ai-token-budget) |
| Audit archive queue backlog > 1000 | HIGH | 15 min / 2h | [WORM Archive](#worm-audit-archive) |
| `audit_archive_queue` drain failing | CRITICAL | 5 min / 1h | [WORM Archive](#worm-audit-archive) |
| WhatsApp webhook HMAC failure spike | HIGH | 5 min / 30 min | [WhatsApp Webhook](#whatsapp-webhook) |
| New clinic registered (flag on) | INFO | — / — | Ops review in Slack |
| Seed user login attempt in production | CRITICAL | 2 min / 15 min | [Seed Leak](#seed-user-in-production) |
| Stripe webhook signature failure | HIGH | 5 min / 30 min | [Billing](#stripe-webhook-failure) |
| CMI payment callback HMAC failure | CRITICAL | 2 min / 15 min | [CMI](#cmi-callback-failure) |
| Cross-tenant access attempt blocked | CRITICAL | 2 min / 24h | [Tenant Isolation](#cross-tenant-access) |
| `activity_logs` UPDATE blocked (tamper) | CRITICAL | 2 min / 24h | [Tamper Detection](#tamper-detection) |

---

## Runbooks

### Latency Spike

**Symptoms:** p99 > 2s, Cloudflare Workers CPU > 40ms average

**Diagnosis:**
```
1. Cloudflare Dashboard → Workers → Analytics → CPU Time
2. Check Sentry for slow-transaction traces (> 1s)
3. Check Supabase Dashboard → Query Performance for slow queries
4. Workers Logs: filter by duration > 1000ms
```

**Resolution:**
- If DB-side: identify long-running queries, add `EXPLAIN ANALYZE`, consider index
- If AI-side: circuit-breaker should have fired — check AI kill switch in Supabase `feature_flags`
- If R2-side: check R2 status page; enable CDN cache bypass temporarily

**Escalation:** If not resolved in 30 min → page Engineering Lead

---

### Error Rate Spike

**Symptoms:** HTTP 5xx rate > 5% for > 2 minutes

**Diagnosis:**
```
1. Sentry Dashboard → Issues sorted by volume
2. Workers Logs → filter status >= 500
3. Check recent deployments (Cloudflare → Workers → Deployments)
```

**Resolution:**
- **Rollback:** `wrangler rollback` (auto-reverts to previous stable deployment)
- **Kill switch:** set `ai_enabled = false` in `feature_flags` if AI-related
- **Database:** if Supabase errors, check CRIT alerts in Supabase dashboard

**Escalation:** Immediate page if > 10% error rate; initiate incident at [incidents/](./incident-response/)

---

### DB Connection Pool

**Symptoms:** `ERROR: sorry, too many clients already` in logs

**Diagnosis:**
```sql
-- Run in Supabase SQL Editor:
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;
```

**Resolution:**
- Cloudflare Workers use Supabase's connection pooler (pgBouncer); check pooler config
- Verify `SUPABASE_DB_POOL_SIZE` environment variable (should be ≤ 10 per Worker)
- Terminate idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';`

---

### R2 Upload Failures

**Symptoms:** File upload 500 errors; R2 write latency > 5s

**Diagnosis:**
```
1. Cloudflare Status Page → R2
2. Workers Logs → filter "R2" and "error"
3. Check UPLOADS_BUCKET binding in wrangler.toml
```

**Resolution:**
- Temporary: redirect uploads to secondary backup bucket
- If Cloudflare incident: wait for resolution; uploads will retry

---

### AI Token Budget

**Symptoms:** `checkAiTokenBudget` returning 429 for a clinic

**Diagnosis:**
```sql
SELECT clinic_id, role, tokens_used_this_month, token_limit
FROM ai_token_usage
WHERE tokens_used_this_month > token_limit * 0.8
ORDER BY tokens_used_this_month DESC;
```

**Resolution:**
- Contact clinic admin to review AI usage
- Temporarily increase limit in `ai_token_limits` table if legitimate spike
- Set `ai_enabled = false` in `feature_flags` for the specific clinic if abuse suspected

---

### WORM Audit Archive

**Symptoms:** `audit_archive_queue` backlog > 1000 unarchived rows; or cron drain failing

**Diagnosis:**
```
1. Check /api/cron/audit-archive endpoint health (requires CRON_SECRET)
2. Workers Logs → filter "audit-archive-cron" and "error"
3. Verify AUDIT_WORM_BUCKET R2 binding is active in Cloudflare
```

**Resolution:**
```bash
# Trigger manual drain (replace CRON_SECRET_VALUE):
curl -H "x-cron-secret: CRON_SECRET_VALUE" \
  https://api.oltigo.health/api/cron/audit-archive
```
- If R2 bucket unavailable: rows stay in queue (safe — no data lost)
- If persistent failure: export `audit_archive_queue` to file manually and upload to R2 with aws CLI

**Escalation:** If drain fails > 1 hour → page CISO (Law 09-08 tamper-evidence requirement)

---

### WhatsApp Webhook

**Symptoms:** HMAC verification failures spiking in `webhooks` context logs

**Diagnosis:**
```
1. Verify META_APP_SECRET is current in Cloudflare Secrets
2. Check Meta Business Suite → Webhooks → Delivery failures
3. Verify webhook URL hasn't changed (should be https://api.oltigo.health/api/webhooks)
```

**Resolution:**
- If secret rotated: update `META_APP_SECRET` via `wrangler secret put META_APP_SECRET`
- If replay attack: the 5-minute timestamp check will auto-reject; monitor for recurrence

---

### Seed User in Production

**Symptoms:** Login attempt with `admin@demo-clinic.com` or similar in production

**Diagnosis:**
```
1. Check activity_logs for the auth event
2. Identify source IP
3. Check if SEED_PASSWORDS_ROTATED=true and SEED_USERS_DELETED=true env vars are set
```

**Resolution:**
1. Block source IP via Cloudflare WAF immediately
2. Verify seed protection layers are active (see `src/lib/check-seed-user.ts`)
3. Initiate security incident per `docs/incident-response/`
4. Notify DPO within 1 hour (Law 09-08 Art.29)

---

### Stripe Webhook Failure

**Symptoms:** Stripe webhook signature validation failures; billing not updating

**Diagnosis:**
```
1. Stripe Dashboard → Developers → Webhooks → failed deliveries
2. Verify STRIPE_WEBHOOK_SECRET matches the endpoint's signing secret
3. Check Workers Logs → filter "billing/webhook"
```

**Resolution:**
- If secret mismatch: `wrangler secret put STRIPE_WEBHOOK_SECRET` with value from Stripe Dashboard
- Stripe retries for 72h; backlog will self-heal once secret is corrected

---

### CMI Callback Failure

**Symptoms:** CMI payment callbacks returning 401 or null from `verifyCmiCallback`

**Diagnosis:**
```
1. Check Workers Logs → filter "cmi" and "invalid hash"
2. Verify CMI_SECRET_KEY matches the key configured in CMI merchant portal
3. Check if CMI sent unexpected fields not in CMI_KNOWN_HASH_FIELDS allowlist
```

**Resolution:**
- Coordinate with CMI technical team to verify HMAC field set
- Do NOT process any payment callback that fails signature verification
- Initiate manual reconciliation with CMI for affected transactions

---

### Cross-Tenant Access

**Symptoms:** Log entry `"Tenant mismatch"` or `"Cross-tenant download attempt blocked"`

**Diagnosis:**
```
1. Extract affected clinic IDs from log entries
2. Check if a shared session cookie was somehow reaching multiple subdomains
3. Review recent deploys for any tenant isolation regression
```

**Resolution:**
1. Revoke all active sessions for affected clinic IDs: `supabase auth admin deleteUser`
2. Force re-login for all clinic users
3. Initiate security incident per `docs/incident-response/incident-response-plan.md`
4. Notify DPO immediately (cross-tenant PHI access = potential data breach under Law 09-08)

---

### Tamper Detection

**Symptoms:** DB trigger blocks UPDATE on `activity_logs`; logged as error in application

**Diagnosis:**
```sql
-- Check who attempted the update:
SELECT * FROM pg_stat_activity WHERE query LIKE '%activity_logs%';
-- Check application logs for the operation context
```

**Resolution:**
1. Identify whether the attempt was from application code or a DBA session
2. If application code: find the regression (activity_logs must NEVER be updated)
3. If DBA session: initiate insider threat procedure per `docs/incident-response/`
4. Preserve DB logs for forensics before any changes
5. Notify CISO immediately

---

## Incident Severity Levels

| Level | Description | SLA | Notification |
|---|---|---|---|
| P0 - Critical | Data breach, cross-tenant PHI access, DB tamper | 2 min ack, 1h resolve | CISO + DPO + Legal within 1h |
| P1 - High | Service down, payment failure, WORM archive broken | 5 min ack, 2h resolve | Engineering Lead + CISO |
| P2 - Medium | Degraded performance, partial feature failure | 30 min ack, 8h resolve | Engineering Lead |
| P3 - Low | Minor issues, non-critical alerts | Best effort | Ticket in backlog |

---

## Key Contacts

| Role | Contact Method |
|---|---|
| Engineering Lead (on-call) | PagerDuty escalation policy |
| CISO | Direct mobile (stored in 1Password Emergency Kit) |
| DPO | Email: dpo@oltigo.com |
| Cloudflare Support | support.cloudflare.com (Enterprise ticket) |
| Supabase Support | supabase.com/dashboard → Support (Pro plan) |
| CMI Technical | Stored in `docs/vendor-contacts.md` |
| Meta Business Support | business.facebook.com → Help Center |

---

## Runbook Testing

This playbook is tested quarterly by simulating P1 and P2 incidents in staging.  
Last tested: See `docs/incident-response/drill-log.md`
