# On-Call Rotation

> **Audience:** Platform operators, on-call engineers
> **Last updated:** April 2026

---

## 1. On-Call Overview

The on-call rotation ensures 24/7 coverage for incident response. Each engineer participates in the rotation with defined responsibilities and escalation paths.

### 1.1 Rotation Schedule

| Role                  | Rotation | Coverage             |
| --------------------- | -------- | -------------------- |
| **Primary On-Call**   | 1 week   | 24/7 (via PagerDuty) |
| **Secondary On-Call** | 1 week   | 24/7 (backup)        |
| **Engineering Lead**  | Rolling  | Escalation           |

### 1.2 Escalation Path

```
Alert Fired
    ↓
Primary On-Call (5 min ack)
    ↓ (if no ack or SEV-1)
Secondary On-Call (5 min)
    ↓ (if no ack)
Engineering Lead (immediate)
    ↓ (if no ack)
CTO (immediate)
```

---

## 2. On-Call Responsibilities

### 2.1 During Your Week

**Primary Responsibilities:**

- Acknowledge all alerts within 5 minutes
- Lead incident response for all SEV-1 and SEV-2 incidents
- Ensure appropriate escalation if needed
- Update status page and stakeholders

**Secondary Responsibilities:**

- Review and action any PagerDuty alerts (SEV-3/4)
- Monitor dashboards for anomalies
- Review previous week's incidents

### 2.2 Hand-Off

At the end of your on-call week:

1. Review open incidents or ongoing issues
2. Communicate any ongoing monitoring needs
3. Brief incoming on-call on anything to watch

### 2.3 Off-Hours Expectations

On-call engineers are expected to respond within:

- **15 minutes** for SEV-1 (pagercalled)
- **30 minutes** for SEV-2 (pagercalled)
- **4 hours** for SEV-3/4 (Slack notification)

Response should be via phone/zoom for SEV-1/2, Slack for SEV-3/4.

---

## 3. On-Call Tools

### 3.1 PagerDuty

Primary alerting and escalation tool. Configure:

- Phone app with sound enabled
- SMS for backup
- Desktop notifications when available

### 3.2 Slack

- `#incidents` - Incident coordination channel
- `#alerts-slo` - SLO/alert notifications
- `#support` - User-facing issues

### 3.3 Monitoring Dashboards

- **Cloudflare Dashboard**: API metrics, error rates, latency
- **Sentry**: Error rates, performance issues
- **Supabase Dashboard**: Database health, connection counts
- **Grafana** (if configured): Custom dashboards

---

## 4. On-Call Compensation

| Role                       | Compensation              |
| -------------------------- | ------------------------- |
| Primary On-Call (1 week)   | 8 hours OT or equivalent  |
| Secondary On-Call (1 week) | 4 hours OT or equivalent  |
| Holiday On-Call            | 12 hours OT or equivalent |

---

## 5. On-Call Expectations & Boundaries

### 5.1 Acceptable Interruptions

On-call is expected to interrupt your personal life for:

- SEV-1 incidents (service down)
- SEV-2 incidents (major feature broken)
- SLO budget at risk (> 75% consumed)

### 5.2 Not Urgent (Wait Until Business Hours)

The following should wait until business hours (9am-6pm local time):

- SEV-3/4 incidents (minor issues)
- Non-critical bug fixes
- Documentation updates
- Feature development

### 5.3 Boundaries

On-call engineers should NOT:

- Make significant architecture changes without approval
- Delete production data
- Share sensitive incident details outside the team
- Ignore mental health - if you're overwhelmed, escalate

---

## 6. On-Call Rotation Schedule

### 6.1 Current Rotation

| Week   | Primary      | Secondary    |
| ------ | ------------ | ------------ |
| Week 1 | [Engineer 1] | [Engineer 2] |
| Week 2 | [Engineer 2] | [Engineer 3] |
| Week 3 | [Engineer 3] | [Engineer 4] |
| Week 4 | [Engineer 4] | [Engineer 1] |

_Update this table with actual engineer names_

### 6.2 Handoff Meeting

Weekly handoff meeting: Friday 4pm

- Review ongoing incidents
- Update rotation schedule
- Address any concerns

---

## 7. Break-Glass Account (A38-03)

A sealed **break-glass super_admin** account exists for emergency access when normal authentication paths are unavailable (e.g., IdP compromise, MFA lockout).

### Access Protocol

1. **Two-person rule:** Break-glass credentials require two authorized personnel to retrieve (split-knowledge: one holds the email, one holds the password).
2. **Storage:** Credentials are stored in a sealed envelope in the physical safe, **not** in any digital password manager accessible to a single person.
3. **Usage:** Only permitted during a declared SEV-1 incident when all other admin accounts are inaccessible.
4. **Audit:** Every break-glass login generates an `activity_logs` entry with `type='break_glass'`. The on-call engineer must file a post-mortem within 24 hours documenting why break-glass was needed.
5. **Rotation:** After every use, rotate the break-glass password immediately and reseal.

### Post-Use Checklist

- [ ] Rotate break-glass password
- [ ] Reseal credentials in physical safe
- [ ] File post-mortem documenting usage
- [ ] Review whether the root cause (IdP outage, MFA failure) has been resolved
- [ ] Notify security lead within 4 hours

---

## 8. Top-10 Alert Playbook (A94-2)

The following are the most critical alerts an on-call engineer will encounter, listed in priority order. Each entry references the relevant SLO or system component.

| #   | Alert Name                                    | Source           | Severity | Runbook                                                                                                                                                                           |
| --- | --------------------------------------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **API error budget > 75% consumed in 3 days** | SLO burn-rate    | SEV-1    | Check Cloudflare dashboard for 5xx spike. Identify failing route via Sentry. If DB-related, check Supabase connection count. Roll back last deploy if error started post-deploy.  |
| 2   | **API error budget > 50% consumed in 7 days** | SLO burn-rate    | SEV-2    | Investigate top error in Sentry. Check for slow queries in Supabase logs. Review recent PRs for regressions.                                                                      |
| 3   | **API p95 latency > 800ms (booking)**         | SLO latency      | SEV-2    | Check Supabase query performance. Verify KV rate-limit backend is responsive. Check for cache stampede (A75-2). Consider enabling circuit breaker if external dependency is slow. |
| 4   | **Worker CPU time exhausted**                 | Cloudflare       | SEV-1    | Likely a hot loop or unbound AI call. Check `wrangler tail` for long-running requests. Verify circuit breaker is tripping for slow OpenAI calls (A74-2).                          |
| 5   | **Database connection pool exhausted**        | Supabase         | SEV-1    | Check for connection leaks (unclosed clients). Verify connection pooler (PgBouncer) is healthy. May need to restart the pooler or scale the plan.                                 |
| 6   | **Rate limiter KV/DO backend unreachable**    | Internal         | SEV-2    | System falls back to in-memory rate limiting (per-isolate). Check Cloudflare KV status page. If persistent, verify KV namespace binding in `wrangler.toml`.                       |
| 7   | **Webhook processing failure > 5%**           | SLO availability | SEV-2    | Check WhatsApp/Stripe webhook logs. Verify signature validation. Check tenant resolution for webhook payloads.                                                                    |
| 8   | **PHI encryption key rotation failure**       | Cron/backup      | SEV-2    | Verify R2 bucket access. Check encryption key in KV. Manual rotation: see `docs/backup-recovery-runbook.md`.                                                                      |
| 9   | **CSP violation spike**                       | Sentry CSP       | SEV-3    | Check CSP report endpoint for new violation patterns. May indicate XSS attempt or new third-party script. Review recent frontend deploys.                                         |
| 10  | **Auth rate-limit 429 spike**                 | Cloudflare       | SEV-3    | Likely brute-force attempt. Verify the rate limiter is correctly identifying IPs via CF-Connecting-IP. Check for credential stuffing patterns in logs.                            |

---

## 9. Related Documents

- [SLO Document](./slo.md)
- [Incident Response Runbook](./incident-response.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)
