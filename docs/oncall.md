# On-Call Rotation

> **Audience:** Platform operators, on-call engineers
> **Last updated:** April 2026

---

## 1. On-Call Overview

The on-call rotation ensures 24/7 coverage for incident response. Each engineer participates in the rotation with defined responsibilities and escalation paths.

### 1.1 Rotation Schedule

| Role | Rotation | Coverage |
|------|----------|----------|
| **Primary On-Call** | 1 week | 24/7 (via PagerDuty) |
| **Secondary On-Call** | 1 week | 24/7 (backup) |
| **Engineering Lead** | Rolling | Escalation |

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

| Role | Compensation |
|------|--------------|
| Primary On-Call (1 week) | 8 hours OT or equivalent |
| Secondary On-Call (1 week) | 4 hours OT or equivalent |
| Holiday On-Call | 12 hours OT or equivalent |

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

| Week | Primary | Secondary |
|------|---------|-----------|
| Week 1 | [Engineer 1] | [Engineer 2] |
| Week 2 | [Engineer 2] | [Engineer 3] |
| Week 3 | [Engineer 3] | [Engineer 4] |
| Week 4 | [Engineer 4] | [Engineer 1] |

*Update this table with actual engineer names*

### 6.2 Handoff Meeting

Weekly handoff meeting: Friday 4pm
- Review ongoing incidents
- Update rotation schedule
- Address any concerns

---

## 7. Related Documents

- [SLO Document](./slo.md)
- [Incident Response Runbook](./incident-response.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)