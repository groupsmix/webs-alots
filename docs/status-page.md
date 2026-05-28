# Status Page — Oltigo Health (S0-09-04)

> **Audit finding:** S0-09-04 (Low) — No public-facing status page tracked in repo.

## Proposed Architecture

**Domain:** `status.oltigo.com`

### Option A: Cloudflare-native (Recommended)

Use **Cloudflare Pages** with a static status dashboard:

1. Create a Cloudflare Pages project at `status.oltigo.com`
2. Deploy a minimal static HTML/React app that polls health endpoints
3. Integrate with Cloudflare Notifications for uptime monitoring

### Option B: Third-party (Betteruptime / Instatus / Statuspage)

Use a managed status page provider:

- **Betteruptime** (free tier: 5 monitors, public status page)
- **Instatus** (free tier: unlimited subscribers, custom domain)
- **Atlassian Statuspage** (paid, industry standard)

## Health Endpoints to Monitor

| Endpoint                                      | Method | Expected | Description         |
| --------------------------------------------- | ------ | -------- | ------------------- |
| `https://oltigo.com/api/health`               | GET    | 200      | Application health  |
| `https://oltigo.com/api/booking/availability` | GET    | 200      | Booking service     |
| `https://oltigo.com`                          | GET    | 200      | Public landing page |

## Incident Communication SLA

| Severity               | Initial Update | Follow-up Cadence | Post-mortem     |
| ---------------------- | -------------- | ----------------- | --------------- |
| SEV-1 (Full outage)    | 5 min          | Every 15 min      | Within 48 hours |
| SEV-2 (Partial outage) | 15 min         | Every 30 min      | Within 1 week   |
| SEV-3 (Degraded)       | 30 min         | Every 1 hour      | Optional        |

## Integration with IR Process

1. When an incident is declared (see `docs/incident-response.md`), update the status page
2. Post incident updates at the cadence above
3. Mark resolved when recovery is confirmed
4. Link post-mortem from the incident timeline

## Action Items

- [ ] Choose status page provider (Option A or B)
- [ ] Configure `status.oltigo.com` DNS CNAME
- [ ] Set up health check monitors
- [ ] Add status page link to application footer
- [ ] Document in `docs/incident-response.md` Section 2.4
