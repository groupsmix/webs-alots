# Service Level Objectives (SLOs)

> **Audience:** Platform operators, on-call engineers, product managers
> **Last updated:** April 2026

---

## 1. Overview

This document defines the Service Level Objectives (SLOs) for the Oltigo Health platform. SLOs provide a clear, measurable commitment to service reliability and form the basis for error budgets and incident prioritization.

### Why SLOs?

- **Accountability**: Provides a shared understanding of what "good" looks like
- **Prioritization**: Helps focus on the most impactful improvements
- **Error Budget**: Allows informed risk-taking within the defined error budget
- **Incident Response**: Defines severity based on SLO impact

---

## 2. SLO Definitions

### 2.1 Availability SLOs

| Service | Availability Target | Measurement Window |
|---------|---------------------|---------------------|
| **API (booking, appointments)** | 99.9% (4-9s downtime/month) | Rolling 30 days |
| **Branding (clinic pages)** | 99.9% (4-9s downtime/month) | Rolling 30 days |
| **Webhook processing** | 99.5% (22m downtime/month) | Rolling 30 days |
| **Dashboard (authenticated)** | 99.5% (22m downtime/month) | Rolling 30 days |

### 2.2 Latency SLOs (p95)

| Route | Method | p95 Latency Target | Notes |
|-------|--------|---------------------|-------|
| `/api/v1/booking` | POST | < 800ms | Patient booking flow |
| `/api/branding/{clinic}` | GET | < 200ms | Public clinic pages |
| `/api/webhooks/*` | POST | < 500ms | Must ack quickly, process async |
| `/api/appointments/*` | GET/POST | < 500ms | Appointment management |
| `/api/v1/availability/*` | GET | < 300ms | Availability checks |
| Health check (`/`) | GET | < 100ms | Basic liveness probe |

### 2.3 Error Budget

| Service | Monthly Error Budget | Burn Rate Alert |
|---------|---------------------|-----------------|
| API (booking) | 0.1% (4-9s) | > 50% in 7 days |
| Branding | 0.1% (4-9s) | > 50% in 7 days |
| Webhook | 0.5% (22m) | > 50% in 7 days |
| Dashboard | 0.5% (22m) | > 50% in 7 days |

---

## 3. Error Budget Policy

### 3.1 Error Budget Calculation

For a 99.9% SLO over 30 days:
- Total minutes in month: 43,200 (30 days × 24 hours × 60 minutes)
- Allowed downtime: 43.2 minutes (0.1%)
- Error budget: 43.2 minutes of downtime

### 3.2 Burn Rate Alerts

When error budget consumption exceeds thresholds, trigger alerts:

| Burn Rate | Alert Level | Action |
|-----------|-------------|--------|
| > 50% in 7 days | Warning | Monitor closely, investigate root causes |
| > 75% in 3 days | Critical | Active incident, all hands on deck |
| > 100% (budget exhausted) | Emergency | Page on-call immediately |

### 3.3 Error Budget Spending Policy

- **Normal operations**: Consume up to 50% of error budget without escalation
- **Feature launches**: May consume up to 75% with engineering lead approval
- **Incidents**: Consume whatever is needed to restore service; do not limit during outages

---

## 4. SLO Measurement

### 4.1 Measurement Method

SLOs are measured using Cloudflare Analytics and Sentry Performance:

1. **Cloudflare Workers**: Track request counts and error rates via `workers.metrics`
2. **Sentry Performance**: Track p95 latency per route via traces
3. **Custom dashboards**: Aggregated view in Grafana/Cloudflare dashboards

### 4.2 Availability Calculation

```
Availability = (Total Requests - Failed Requests) / Total Requests * 100
```

Where "Failed Requests" includes:
- HTTP 5xx responses
- Requests that timed out (> 30 seconds)
- Requests that triggered circuit breakers

### 4.3 Latency Calculation

p95 latency is calculated from the 95th percentile of request durations:
- Only counted for successful responses (2xx, 3xx)
- Excludes requests that failed before reaching the application

---

## 5. SLO Reporting

### 5.1 Weekly SLO Report

Every Monday, automated report generated covering:
- Current SLO status (previous 7 days)
- Error budget consumption
- Any SLO violations
- Top contributing error types

### 5.2 Monthly SLO Review

Monthly review meeting covering:
- SLO trend analysis
- Error budget analysis
- Identify top 3 reliability improvement opportunities
- Review and update SLO targets if needed

### 5.3 Error Budget Alerts

Configured in Cloudflare (or external monitoring tool):
- Slack: `#alerts-slo` for warnings
- PagerDuty: For critical/emergency alerts (budget exhausted)

---

## 6. SLO Maintenance

### 6.1 SLO Review Cadence

- **Monthly**: Review SLO targets and thresholds
- **Quarterly**: Full SLO review with stakeholders
- **After major incidents**: Re-assess targets based on learnings

### 6.2 Changing SLOs

SLO changes require:
1. Engineering lead approval
2. Stakeholder notification (48 hours minimum)
3. Documentation update
4. Updated error budget calculation

### 6.3 Sunset Policy

When deprecating a service:
1. Set SLO to 0% (allow any downtime)
2. Communicate deprecation timeline
3. Remove from active monitoring after sunset date

---

## 7. Related Documents

- [Incident Response Runbook](./incident-response.md)
- [On-Call Rotation](./oncall.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)