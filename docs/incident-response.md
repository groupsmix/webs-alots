# Incident Response Runbook

> **Audience:** On-call engineers, platform operators
> **Last updated:** April 2026

---

## 1. Incident Classification

### 1.1 Severity Levels

| Severity  | Definition                                   | Response Time       | Examples                                |
| --------- | -------------------------------------------- | ------------------- | --------------------------------------- |
| **SEV-1** | Complete service outage or data loss         | Immediate (< 5 min) | Database down, all APIs returning 5xx   |
| **SEV-2** | Major feature broken, > 50% users affected   | < 15 min            | Booking API down, authentication broken |
| **SEV-3** | Minor feature degraded, < 50% users affected | < 1 hour            | Slow responses, minor feature broken    |
| **SEV-4** | Minor issue, no user impact                  | < 4 hours           | Logging errors, non-critical bugs       |

### 1.2 SLO Impact Classification

| Impact       | Condition                                    | Severity Override |
| ------------ | -------------------------------------------- | ----------------- |
| **Critical** | Availability SLO breached (> 4-9s downtime)  | SEV-1 or SEV-2    |
| **Major**    | Latency SLO breached (p95 > target)          | SEV-2 or SEV-3    |
| **Minor**    | Single error type accounting for < 1% errors | SEV-3 or SEV-4    |

---

## 2. Incident Response Process

### 2.1 Detection & Alerting

Incidents are detected via:

1. **Automated alerts** from Cloudflare, Sentry, or custom monitoring
2. **User reports** via Slack `#support` or direct contact
3. **On-call engineer observation**

When an alert fires:

1. Acknowledge the alert (prevents escalation)
2. Join the incident Slack channel
3. Begin assessment

### 2.2 Initial Assessment (First 5 Minutes)

**For all incidents:**

1. Identify affected services and scope
2. Check current error rates vs. SLO baseline
3. Verify monitoring dashboards are showing correct data
4. Identify any recent deployments or config changes

**SEV-1 specific:**

1. Immediately page additional responders if needed
2. Consider enabling maintenance mode to prevent data corruption
3. Begin impact assessment: How many users affected?

### 2.3 Incident Commander Role

For SEV-1 and SEV-2:

- **IC (Incident Commander)**: Coordinates response, makes decisions, delegates
- **Comms**: Communicates status to stakeholders
- **Tech Lead**: Leads technical investigation and remediation

For SEV-3 and SEV-4:

- Single engineer can lead (may still designate IC for complex incidents)

### 2.4 Communication Cadence

| Severity | Status Updates   | Stakeholder Updates |
| -------- | ---------------- | ------------------- |
| SEV-1    | Every 15 minutes | Every 30 minutes    |
| SEV-2    | Every 30 minutes | Every 1 hour        |
| SEV-3    | Hourly           | End of incident     |
| SEV-4    | End of incident  | End of incident     |

### 2.5 Resolution & Closure

When service is restored:

1. Verify metrics are back to normal (wait 5-10 minutes)
2. Document root cause in incident channel
3. Schedule post-mortem meeting (within 48 hours)
4. Close incident in PagerDuty/alerting system

---

## 3. Service-Specific Runbooks

### 3.1 Supabase Down

**Symptoms:**

- All API requests returning 500/503
- Database connection errors in logs
- Slow query times or timeouts

**Assessment:**

1. Check Supabase Status (status.supabase.com)
2. Check Supabase Dashboard for active incidents
3. Check database connection pool exhaustion

**Mitigation:**

1. Enable maintenance mode to prevent partial writes
2. If connection pool exhausted: restart API workers to reset connections
3. Monitor for automatic Supabase recovery
4. If > 15 minutes, escalate to Supabase support

**Recovery:**

1. Wait for Supabase to restore service
2. Verify RLS policies intact
3. Run post-incident health check

### 3.1.1 Supabase Region Outage — Vendor-Exit Playbook (A248-02)

**Scenario:** Supabase's primary region (eu-central-1) is unavailable for >4 hours, or Supabase announces extended downtime.

**Assessment:**

1. Confirm scope: region outage vs global outage vs project-level issue
2. Check Supabase status page (status.supabase.com) for ETA
3. Evaluate if failover is warranted (>4h outage or no ETA)

**Failover Options (in order of preference):**

1. **Supabase read replica (if Pro plan PITR enabled):**
   - Promote read replica to primary via Supabase Dashboard
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Cloudflare Workers env
   - Re-deploy via `wrangler deploy`
   - Caveat: Read replica may have up to 1 minute of replication lag

2. **Neon PostgreSQL (cold standby):**
   - Restore from latest nightly R2 backup (see `docs/bcp.md`)
   - Create Neon project, import backup
   - Update connection strings in Workers env
   - Caveat: RLS policies and auth.users must be manually verified

3. **Self-hosted PostgreSQL:**
   - Provision a Hetzner/OVH VPS in EU
   - Restore from R2 backup
   - Update connection strings
   - Caveat: No Supabase Auth — must use JWT verification only

**Recovery (after Supabase restores):**

1. Compare data between failover and primary: identify any writes during outage
2. Merge/reconcile conflicts manually
3. Switch connection strings back to Supabase
4. Re-deploy and verify RLS policies

**RPO/RTO Posture (A74-02):**

- **Current RPO:** 24 hours (nightly R2 backup)
- **With Supabase Pro PITR:** ~1 minute (continuous WAL archiving)
- **Target RTO:** 1 hour for read-only mode, 4 hours for full read-write failover
- **Recommendation:** Enable Supabase Pro PITR to reduce RPO from 24h to ~1min

### 3.2 R2 Down

**Symptoms:**

- File upload failures (500 on upload API)
- Missing images on clinic pages
- Error logs showing R2/S3 errors

**Assessment:**

1. Check Cloudflare R2 status
2. Verify R2 credentials are valid
3. Check for R2 bucket policy issues

**Mitigation:**

1. If uploads failing: enable maintenance mode for file uploads
2. If downloads failing: show placeholder images
3. Check if issue is specific to one bucket or all

**Recovery:**

1. Wait for R2 to recover
2. If credentials issue: rotate credentials
3. Verify uploaded files are accessible

### 3.3 Cloudflare Incident

**Symptoms:**

- All requests failing (DNS issues)
- Intermittent 5xx errors
- Slow response times globally

**Assessment:**

1. Check Cloudflare Status (cloudflare.status.com)
2. Check for widespread issues vs. account-specific
3. Verify DNS is resolving correctly

**Mitigation:**

1. If account-level: point directly to Supabase/S3 origins temporarily
2. If global outage: wait for Cloudflare to restore
3. Consider enabling "Under Attack" mode if DDoS suspected

**Recovery:**

1. Verify Cloudflare cache is repopulating
2. Check for any residual issues
3. Update status page

### 3.4 Stripe Webhook Backlog

**Symptoms:**

- Stripe webhook delivery failures
- Payment status not updating
- Refund/ subscription issues

**Assessment:**

1. Check Stripe Dashboard for webhook failures
2. Check application logs for Stripe errors
3. Verify Stripe API is accessible

**Mitigation:**

1. Check for code issues causing webhook processing failures
2. If processing is failing, fix the root cause
3. Use Stripe dashboard to retry failed webhooks

**Recovery:**

1. Process backlog via Stripe dashboard "Retry" feature
2. Verify payment status is correct in database
3. Manually reconcile if needed

### 3.5 KV Down

**Symptoms:**

- Rate limiting not working
- Feature flags not updating
- Inconsistent state across requests

**Assessment:**

1. Check Cloudflare KV status
2. Verify KV binding is correct
3. Check for quota exhaustion

**Mitigation:**

1. Fall back to Supabase-based rate limiting
2. Use default feature flags (defined in code)
3. Monitor for quota issues

**Recovery:**

1. Wait for KV to recover
2. Verify rate limiting is working again
3. Consider increasing KV quota if exhausted

### 3.6 Meta API Outage (WhatsApp)

**Symptoms:**

- WhatsApp messages not sending
- Meta API errors in logs
- Message queue backup

**Assessment:**

1. Check Meta for Business status
2. Check WhatsApp API status
3. Verify API credentials are valid

**Mitigation:**

1. Switch to email as fallback notification
2. Queue messages for later delivery
3. Enable offline mode for notifications

**Recovery:**

1. Monitor Meta API recovery
2. Process queued messages
3. Verify message delivery

### 3.7 OpenAI Outage

**Symptoms:**

- AI features not working
- OpenAI API errors
- Timeout errors from AI endpoints

**Assessment:**

1. Check OpenAI Status (status.openai.com)
2. Verify API key is valid
3. Check rate limit status

**Mitigation:**

1. Use fallback responses for non-critical AI features
2. Disable AI features if critical path
3. Display user-friendly error messages

**Recovery:**

1. Monitor OpenAI recovery
2. Re-enable features gradually
3. Process any queued requests

### 3.8 Audit Log Gap Detected

**Symptoms:**

- Missing entries in audit_logs table
- Gap in sequential IDs
- Suspicious activity not logged

**Assessment:**

1. Identify time range of gap
2. Check for errors in audit-log writing
3. Verify database is not in degraded state

**Mitigation:**

1. Enable additional logging to capture details
2. Identify affected records manually
3. Preserve current state for investigation

**Recovery:**

1. Document gap and reason
2. Implement fix to prevent future gaps
3. If data integrity compromised, notify compliance team

### 3.9 Cloudflare "Under Attack Mode" (A40-02)

**When to activate:**

- Sustained L7 DDoS — request volume exceeds 10× normal baseline for >5 minutes
- Origin CPU/memory saturation despite Cloudflare caching
- Rate-limiting rules are overwhelmed (>50% of requests returning 429)

**Steps:**

1. **Activate:** Cloudflare Dashboard → Security → Settings → Security Level → "I'm Under Attack!"
   - This forces all visitors through a JavaScript interstitial (5-second challenge)
   - API clients using `fetch()` will fail — notify integration partners
2. **Notify team:** Post in `#incidents` Slack channel with activation time
3. **Monitor:** Watch Analytics → Security Events for attack profile
4. **Scope WAF rules:** If attack uses a specific User-Agent, ASN, or path pattern:
   - Create a targeted WAF Custom Rule (Security → WAF → Custom Rules)
   - Example: Block requests from ASN 12345 to `/api/booking`
5. **Deactivate:** Once attack subsides (15-min sustained drop), switch Security Level back to "Medium"
6. **Post-mortem:** Document attack vector, duration, and WAF rules created

**Caution:**

- Under Attack Mode breaks WebSocket connections
- WhatsApp/Stripe webhook callbacks may be blocked — add their source IPs to the IP Access Rules allowlist _before_ activating
- Do NOT leave Under Attack Mode on permanently — it degrades UX for legitimate users

### 3.10 Credential Stuffing / Impossible Travel (A154-03)

**Symptoms:**

- Spike in failed login attempts from geographically dispersed IPs
- Successful logins from impossible-travel locations (e.g., Morocco → Europe in minutes)
- Account lockouts triggered for multiple users simultaneously

**Mitigation:**

1. Cloudflare Bot Management: enable on `/api/auth/*` endpoints to score requests and block automated credential stuffing.
2. Monitor Sentry for `USER_RATE_LIMIT` / `ACCOUNT_LOCKOUT` errors — a burst indicates an active attack.
3. If active attack confirmed, temporarily lower `loginLimiter` thresholds in `src/lib/rate-limit.ts`.
4. Consider enabling Cloudflare → Security → WAF → "Bot Fight Mode" for the `/api/auth/` path prefix.

### 3.11 Brand Impersonation (A151-01)

**Symptoms:**

- Reports of phishing emails impersonating Oltigo Health
- Fraudulent domains (e.g., `oltig0.com`, `oltigo-health.com`)
- Fake social media profiles using Oltigo branding
- Users reporting suspicious appointment confirmations they didn't make

**Assessment:**

1. Collect evidence: screenshots, email headers (full `Received:` chain), domain WHOIS
2. Verify the impersonating domain is NOT one of ours (check Cloudflare DNS zones)
3. Determine if patients have been phished (credential compromise)

**Containment:**

1. If credential compromise suspected: force password reset for affected users via Supabase Dashboard → Auth → Users
2. Add the impersonating domain to `_dmarc` reject policy if it spoofs our `From:` domain
3. Post an in-app notification warning patients about the phishing campaign

**Takedown:**

1. **Domain registrar abuse:** File abuse report with the registrar (WHOIS → Registrar Abuse Contact)
2. **Google Safe Browsing:** Submit at https://safebrowsing.google.com/safebrowsing/report_phish/
3. **DMARC report monitoring:** Check `rua` aggregate reports for unauthorized senders
4. **Social media:** Report fake profiles on each platform (Facebook, Instagram, LinkedIn)
5. **Moroccan CERT:** Report to ma-CERT (https://www.macert.ma/) for Moroccan-hosted infrastructure

**Recovery:**

1. Notify affected patients via verified channels (in-app + WhatsApp from verified WABA)
2. Document incident in post-mortem (Section 4)
3. Consider adding lookalike domain monitoring (e.g., dnstwist) to CI

---

## 4. Post-Incident Review

### 4.1 Post-Mortem Process

For SEV-1 and SEV-2 incidents, conduct a post-mortem within 48 hours:

1. **Timeline**: Document what happened, when, and who was involved
2. **Root Cause**: Identify the underlying cause (not just symptoms)
3. **Impact**: Document user impact, duration, and any data loss
4. **Response**: Evaluate response effectiveness
5. **Action Items**: Create specific, measurable action items

### 4.2 Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date:** YYYY-MM-DD
**Severity:** SEV-X
**Duration:** X hours Y minutes
**Affected Users:** X%

## Summary

[Brief description of incident]

## Timeline

- HH:MM - Event
- HH:MM - Event

## Root Cause

[What caused the incident]

## Impact

- Users affected: X
- Revenue impact: $X (if applicable)
- SLO impact: X minutes over budget

## What Went Well

- [List]

## What Could Be Improved

- [List]

## Action Items

| Item   | Owner    | Due Date   |
| ------ | -------- | ---------- |
| [Task] | [Person] | YYYY-MM-DD |
```

---

## 5. Escalation Contacts

| Service       | Primary Contact    | Escalation               |
| ------------- | ------------------ | ------------------------ |
| Supabase      | Cloud support      | enterprise@supabase.com  |
| Cloudflare    | Enterprise support | cf-support@oltigo.com    |
| Stripe        | merchant support   | support@stripe.com       |
| Meta/WhatsApp | Business support   | businesssupport@meta.com |

---

## 6. Related Documents

- [SLO Document](./slo.md)
- [On-Call Rotation](./oncall.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)
