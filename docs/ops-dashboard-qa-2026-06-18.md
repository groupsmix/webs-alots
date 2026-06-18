# Operations Dashboard — QA Remediation (2026-06-18)

Addresses the Super Admin → Operations QA report (System Status · Health
Metrics · Uptime SLA · Compliance · Support). This change set fixes the
**dashboard/code** issues. Items that are genuine infrastructure, data-pipeline,
or legal actions (and therefore cannot be fixed by front-end code) are listed at
the bottom so they are not lost.

## Root cause of the headline contradiction

System Status and Uptime SLA both read `GET /api/admin/health`, but they
interpreted failures differently. The health route returns **503** when the
database is unreachable. System Status correctly treated that as DB **Down**;
the Uptime SLA page only updated the database status on the **success** path and
left it at its initial `"operational"` value on the error path — so the same
503 showed the DB as **Operational** on one page and **Down** on the other.

Both pages now derive Web App / Database / Auth status through a single shared
probe so they can no longer drift apart.

## What changed (code)

New shared module:

- `src/lib/monitoring/services.ts` — pure status logic: `deriveHealthStatus`,
  `computeOverallStatus`, `MONITORED_SERVICES`, shared types.
- `src/lib/monitoring/health-client.ts` — `fetchCoreHealth()`, the single
  client-side probe used by both Operations pages.
- `src/lib/monitoring/__tests__/health-status.test.ts` — unit tests, including a
  regression test asserting a 503 maps the DB to **down**.

| #   | Report finding                                                                   | Fix                                                                                                                                      |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | System Status DB "Down" vs Uptime SLA DB "Operational"                           | Shared probe; DB is marked **down** on any health error (503/parse/network).                                                             |
| 2   | Severity label mismatch ("Down" vs "Degraded")                                   | Status now computed in one place via `deriveHealthStatus`.                                                                               |
| 3   | Three panels stuck on "Loading…" forever (Environment, Backups, Background Jobs) | Added a settled flag; panels show an "unavailable" message instead of spinning when an endpoint fails.                                   |
| 4   | "Recent Incidents" hardcoded to "No recent incidents" during outages             | Now derived from live service health; lists every non-operational service.                                                               |
| 5   | "Last Deployment" = N/A                                                          | `NEXT_PUBLIC_DEPLOY_TIME` now defaults to the build timestamp in `next.config.ts`; rendered via a date formatter.                        |
| 6   | "Node.js Version" blank                                                          | `/api/admin/health` now returns `nodeVersion`; the page reads it from the server instead of the (always-empty) client `process.version`. |
| 7   | "API Latency" hardcoded "avg 120ms"                                              | Shows the real measured health round-trip time.                                                                                          |
| 8   | Health Metrics "Services Tracked: 0"                                             | Counts distinct monitors, falling back to the canonical `MONITORED_SERVICES` count so it never reads a misleading 0.                     |
| 9   | Health Metrics / SLA tables blank with no explanation                            | Added explicit empty-state rows/messages.                                                                                                |
| 10  | Compliance "Open DSARs" showed a warning badge on a 0 value                      | Badge is now success when there are no open/overdue DSARs, warning only when there are open ones, destructive when overdue.              |
| 11  | Support "Avg Response" showed "--"                                               | Now shows "N/A".                                                                                                                         |

## Not fixable in dashboard code (infra / data / legal follow-ups)

These were reported as issues but are not front-end bugs. The dashboard now
reports them honestly; resolving them requires action outside this repo:

- **Database (Supabase) production outage** — operational; fix the database /
  connection, not the UI.
- **CNDP registration not filed** — legal/compliance action (Moroccan CNDP
  filing). The dashboard correctly shows "Not filed / pending".
- **6 overdue retention purge runs** — the data-retention purge job is not
  advancing `next_purge_at`. Backend cron/worker fix.
- **Consent ledger = 0** — needs consent-evidence logging wired into the consent
  flows (data pipeline), not a display change.
- **Health Metrics / SLA history empty** — the monitoring pipeline that writes
  `uptime_sla_monthly` / `uptime_events` needs to run; the pages now show
  empty-state messaging until it does.
- **Last Deployment in production** — set `NEXT_PUBLIC_DEPLOY_TIME` in CI (e.g.
  to the deploy time or release SHA) to override the build-time default.
