# Multi-Region Failover Notes

> Status: planning document
> Scope: repo-grounded interim guidance only

---

## Current state

From the repository, Oltigo Health currently appears to run with:

- Cloudflare Workers at the edge
- Supabase as the primary PostgreSQL platform
- Cloudflare R2 for object storage
- backup and restore workflows already documented in `docs/backup-recovery-runbook.md`

The repository does **not** define an automated multi-region database
failover topology today.

---

## What this means operationally

- an upstream regional Supabase incident can still become a platform incident
- the repo contains backup/restore procedures, but not live cross-region DB failover automation
- recovery currently depends on backup freshness, restore success, and operator execution

---

## Interim failover approach

If the primary database region is unavailable long enough to exceed the
service tolerance window:

1. restore the latest viable backup into a secondary recovery environment
2. repoint runtime database secrets/configuration to the recovered target
3. redeploy Workers
4. run smoke checks:
   - `/api/health`
   - `/api/health/internal`
   - login flow
   - booking flow
   - queue/cron-critical paths
5. communicate recovery status and residual data-loss window

---

## Pre-requisites outside the repo

Operators should document and maintain:

- the approved recovery region/provider target
- the exact secret rotation/update sequence for failover
- DNS and application cutover ownership
- evidence from restore drills and measured RTO/RPO

---

## Follow-up work

Longer-term improvements would include one or more of:

- formal infrastructure-as-code for failover-ready environments
- documented restore-drill evidence and measured recovery times
- database vendor features for replicas/failover when available and justified
- explicit SLOs for regional dependency outages
