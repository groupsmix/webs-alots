# Remediation Tracker — Repo-Grounded Audit

> Date: 2026-06-14  
> Scope: Actions tied to repository evidence

| ID    | Finding                                                            | Repo evidence                                                                                         | Type               | Priority | Recommended action                                                                                                       | Effort | Owner        | Target date |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ------------ | ----------- |
| RT-01 | OpenNext/Workers deployment fragility                              | `wrangler.toml`, `.github/workflows/deploy.yml`, `package.json`                                       | Confirmed          | P0       | Replace deferred queue/DO workaround with a supported worker entry strategy, or reduce reliance on unsupported exports   | L      | Platform     | TBD         |
| RT-02 | Coverage floors far below target                                   | `docs/audit/baseline.md`, `.vitest-coverage-floor.json`                                               | Confirmed          | P0       | Raise coverage on auth, booking, tenant isolation, webhook, PHI, and cron-critical paths; ratchet floors upward          | L      | App Eng      | TBD         |
| RT-03 | Queue consumer not wired; cron fallback remains                    | `wrangler.toml`                                                                                       | Confirmed          | P1       | Implement queue consumer path or document cron fallback as an accepted interim design with SLAs                          | M/L    | Platform     | TBD         |
| RT-04 | Runtime controls depend on operator configuration                  | `wrangler.toml`, `src/lib/env.ts`, runbooks                                                           | Confirmed          | P1       | Create operator checklist with evidence capture for secrets, bindings, env separation, cron guards, and monitoring rules | M      | Platform/Ops | TBD         |
| RT-05 | Pooler support exists but scale validation incomplete              | `src/lib/supabase-server.ts`, `src/lib/connection-pooling.ts`, `src/app/api/health/internal/route.ts` | Confirmed          | P1       | Validate `SUPABASE_POOLER_URL` in each environment, add pool exhaustion alerts, run burst/load tests                     | M      | Platform/DB  | TBD         |
| RT-06 | SLOs documented but runtime enforcement not repo-verifiable        | `docs/oncall.md`, `docs/incident-response.md`                                                         | Runtime-unverified | P1       | Export/record actual alert rules and dashboard screenshots for enterprise/compliance evidence                            | S/M    | Ops          | TBD         |
| RT-07 | Backup and restore are defined but execution evidence is external  | `.github/workflows/backup.yml`, `.github/workflows/restore-test.yml`                                  | Runtime-unverified | P1       | Capture recurring workflow success evidence and restore-drill results in a dated ops log                                 | S/M    | Ops          | TBD         |
| RT-08 | Branch protection / required checks not fully verifiable from repo | `.github/CODEOWNERS`, workflow docs                                                                   | Runtime-unverified | P2       | Capture GitHub branch protection settings and required checks in docs/evidence pack                                      | S      | Eng Mgmt     | TBD         |
| RT-09 | Dashboard/alert completeness not fully verifiable from repo        | `docs/oncall.md`, Sentry config files                                                                 | Runtime-unverified | P2       | Create monitoring inventory: dashboard URL, owner, alert source, escalation path, review cadence                         | M      | Ops          | TBD         |
| RT-10 | Documentation can drift from runtime reality                       | multiple audit/runbook docs                                                                           | Inference          | P2       | Add doc review cadence and require doc updates in PRs affecting ops/security/deploy behavior                             | S      | Eng Mgmt     | TBD         |

## Suggested sequencing

### Wave 1

- `RT-01`, `RT-02`, `RT-03`

### Wave 2

- `RT-04`, `RT-05`, `RT-06`, `RT-07`

### Wave 3

- `RT-08`, `RT-09`, `RT-10`

## Notes

- Use `docs/audit/repo-grounded-operational-audit-2026-06.md` as the detailed source of truth.
- Use `docs/audit/executive-summary-2026-06.md` for leadership/board/shareable summary.
- 2026-06-14 groundwork added: `infra/` Terraform scaffold for Cloudflare KV/R2/Queues/routes and `docs/disaster-recovery.md` for the formal DR plan.
- Replace `TBD` fields with named owners and dates during planning.
