# Incident Response Runbook

> **Audience:** On-call engineers, platform operators
> **Last updated:** April 2026

---

## 1. Incident Classification

### 1.1 Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **SEV-1** | Complete service outage or data loss | Immediate (< 5 min) | Database down, all APIs returning 5xx |
| **SEV-2** | Major feature broken, > 50% users affected | < 15 min | Booking API down, authentication broken |
| **SEV-3** | Minor feature degraded, < 50% users affected | < 1 hour | Slow responses, minor feature broken |
| **SEV-4** | Minor issue, no user impact | < 4 hours | Logging errors, non-critical bugs |

### 1.2 SLO Impact Classification

| Impact | Condition | Severity Override |
|--------|-----------|-------------------|
| **Critical** | Availability SLO breached (> 4-9s downtime) | SEV-1 or SEV-2 |
| **Major** | Latency SLO breached (p95 > target) | SEV-2 or SEV-3 |
| **Minor** | Single error type accounting for < 1% errors | SEV-3 or SEV-4 |

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

| Severity | Status Updates | Stakeholder Updates |
|----------|---------------|---------------------|
| SEV-1 | Every 15 minutes | Every 30 minutes |
| SEV-2 | Every 30 minutes | Every 1 hour |
| SEV-3 | Hourly | End of incident |
| SEV-4 | End of incident | End of incident |

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
| Item | Owner | Due Date |
|------|-------|----------|
| [Task] | [Person] | YYYY-MM-DD |
```

---

## 5. Escalation Contacts

| Service | Primary Contact | Escalation |
|---------|-----------------|------------|
| Supabase | Cloud support | enterprise@supabase.com |
| Cloudflare | Enterprise support | cf-support@oltigo.com |
| Stripe | merchant support | support@stripe.com |
| Meta/WhatsApp | Business support | businesssupport@meta.com |

---

## 6. Related Documents

- [SLO Document](./slo.md)
- [On-Call Rotation](./oncall.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)