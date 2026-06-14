# Disaster Recovery Plan

> **Audience:** Platform, security, compliance, and incident commanders
> **Status:** Repo-grounded operational plan
> **Last updated:** June 2026

---

## 1. Purpose

This document defines the minimum disaster recovery (DR) plan for Oltigo Health.
It ties together the existing backup, restore, deployment, and incident-response
materials into one operator-facing plan.

It is intentionally grounded in what is verifiable from this repository today:

- application runtime: Cloudflare Workers via OpenNext
- primary database: Supabase PostgreSQL
- object storage: Cloudflare R2
- backup automation: `.github/workflows/backup.yml`
- restore drill automation: `.github/workflows/restore-test.yml`
- restore evidence log: `docs/restore-drill-evidence.md`
- detailed restore steps: `docs/backup-recovery-runbook.md`
- regional failover notes: `docs/multi-region-failover.md`
- incident command process: `docs/incident-response.md`

---

## 2. Current recovery posture

### What is already in place

- Nightly logical database backups to Cloudflare R2
- Encrypted backup flow using GPG in GitHub Actions
- Monthly automated restore-drill workflow scaffold
- Quarterly manual drill path documented in the backup runbook
- Production and staging Worker deployment automation via GitHub Actions
- Health endpoint support for restore-drill age via `LAST_RESTORE_TEST_AT`

### What remains true today

- Supabase is still a single primary regional dependency
- Full cross-region database failover is not automated in this repo
- Successful restore evidence must still be recorded outside the workflow logs
- Secret inventory and recovery ownership must be maintained operationally

This means DR is now **planned and scaffolded**, but not fully closed until
operators complete and record recurring drills.

---

## 3. Recovery objectives

These objectives align with the repo's current backup architecture and should be
used as the baseline until a stricter commercial SLA is formally adopted.

| Objective | Target | Basis |
| --- | --- | --- |
| App-tier RTO | < 30 minutes | Worker rollback/redeploy via GitHub Actions or Wrangler |
| Platform RTO (full DB restore path) | < 2 hours | Matches `docs/backup-recovery-runbook.md` |
| Baseline RPO | < 24 hours | Nightly encrypted logical backup |
| Improved RPO when Supabase PITR is available | Minutes to hours | Depends on Supabase plan and operator execution |

### Important note

The `< 24 hours` RPO is the **repo-verifiable baseline**, not a guarantee that
all incidents will only lose 24 hours of data. If Supabase PITR is enabled and
usable, operators should choose the tighter restore point and record the actual
RPO achieved in the drill evidence log.

---

## 4. Disaster classifications

Declare DR when any of the following occurs and normal incident handling is not
sufficient:

### DR-1 — Database corruption or destructive change
Examples:
- accidental destructive migration
- bulk tenant data corruption
- unrecoverable logical inconsistency in production data

### DR-2 — Primary database regional outage
Examples:
- prolonged Supabase regional outage
- upstream database unavailability beyond the incident tolerance window

### DR-3 — Storage loss or severe object-store degradation
Examples:
- R2 bucket deletion
- unreadable replicated objects
- widespread signed-download failures for patient files

### DR-4 — Control-plane drift blocks recovery
Examples:
- missing Worker route bindings
- wrong KV namespace IDs
- queue or bucket bindings lost during manual dashboard edits

---

## 5. Roles and ownership

| Role | Primary responsibility |
| --- | --- |
| Incident Commander | Declares DR, assigns workstreams, approves cutover/failback |
| Platform Lead | Worker deploys, Cloudflare bindings, route verification |
| Database Lead | Backup selection, restore execution, integrity verification |
| Security/Compliance Lead | PHI handling, evidence capture, notification obligations |
| Communications Lead | Internal updates, clinic/customer messaging, status page |

If one person fills multiple roles during a small-team incident, explicitly log
that in the incident timeline.

---

## 6. Required operator-held materials

The repo does **not** contain secret values. Before a real incident, operators
must maintain an out-of-band inventory containing at least:

- current Cloudflare account access owner
- current Supabase production access owner
- location of backup decryption material used by `backup.yml` / `restore-test.yml`
- current Worker runtime secret inventory owner
- approvers for production DNS / route / secret changes
- contact path for legal/compliance escalation

If any of the above cannot be produced during a drill, record the drill as a
failure even if the technical restore succeeded.

---

## 7. Recovery strategies by failure mode

### 7.1 Worker-only or deploy regression
Use when the database is healthy but the deployed app is broken.

1. Halt further deploys
2. Roll back the Worker deployment
3. Verify:
   - `GET /api/health`
   - `GET /api/health/internal`
   - login flow
   - booking flow
4. Record start/end time and rollback version

Primary references:
- `docs/deployment.md`
- `.github/workflows/deploy.yml`

### 7.2 Database restore from Supabase backup/PITR
Use when Supabase remains reachable and platform-native restore is sufficient.

1. Choose restore point
2. Execute Supabase restore
3. Verify schema + tenant-critical tables
4. Run application smoke checks
5. Record actual RPO/RTO in `docs/restore-drill-evidence.md`

Primary references:
- `docs/backup-recovery-runbook.md`

### 7.3 Database restore from R2 encrypted logical backup
Use when PITR is unavailable, insufficient, or a separate recovery target is
required.

1. Fetch latest viable backup from R2
2. Decrypt using the approved recovery material
3. Restore into isolated recovery target
4. Repoint runtime database configuration
5. Redeploy Workers
6. Run smoke checks and tenant-isolation verification

Primary references:
- `.github/workflows/backup.yml`
- `.github/workflows/restore-test.yml`
- `docs/backup-recovery-runbook.md`

### 7.4 Regional failover / recovery environment cutover
Use when the primary database region is unavailable beyond the tolerance window.

1. Restore latest viable backup into approved secondary environment
2. Update runtime configuration to the recovered target
3. Redeploy Workers
4. Re-run health, auth, booking, and queue smoke tests
5. Communicate residual data-loss window to stakeholders

Primary references:
- `docs/multi-region-failover.md`
- `docs/backup-recovery-runbook.md`

### 7.5 R2 / file recovery
Use when encrypted uploads are unavailable.

1. Determine whether replica bucket or alternate copy exists
2. Restore or sync objects to the primary bucket
3. Verify signed download flow and audit logging
4. Notify affected clinics if file access remains degraded

Primary references:
- `docs/backup-recovery-runbook.md`

---

## 8. Minimum smoke test pack after recovery

Run these checks before declaring the platform recovered:

- [ ] `GET /api/health` returns success
- [ ] `GET /api/health/internal` returns success with no new critical check failures
- [ ] super admin login works
- [ ] clinic admin login works
- [ ] patient-facing booking flow works
- [ ] at least one tenant subdomain resolves correctly
- [ ] tenant isolation is manually spot-checked across two clinics
- [ ] notification queue path is healthy if queues are in scope for the incident
- [ ] file download path works if R2/storage was in scope

If tenant isolation cannot be verified, do **not** declare recovery complete.

---

## 9. Drill cadence and evidence

### Automated drill
- Workflow: `.github/workflows/restore-test.yml`
- Cadence: monthly
- Purpose: verify backup fetch, decrypt, decompress, and restore chain

### Manual full drill
- Cadence: quarterly
- Purpose: verify operator execution, cutover readiness, smoke checks, and evidence collection

### Evidence requirements
Every drill must update:

1. `docs/restore-drill-evidence.md`
2. `LAST_RESTORE_TEST_AT` in runtime configuration
3. incident/action log if issues were discovered

A workflow run alone is not enough. The evidence log must include:

- backup artifact used
- operator or workflow run identity
- restore duration
- smoke-test results
- actual RPO/RTO achieved
- unresolved gaps or blockers

---

## 10. Exit criteria for closing RISK-003

Treat the DR finding as fully closed only when all of the following are true:

- this DR plan remains current
- backup and restore runbooks are current
- at least one successful restore drill is recorded in `docs/restore-drill-evidence.md`
- quarterly drill cadence is being maintained
- secret recovery ownership is documented operationally
- `/api/health/internal` reflects current restore-drill age accurately

---

## 11. Known limitations

These items are still open after this documentation pass:

- no repo-managed cross-region database failover automation
- no repo-managed secret vault or Cloudflare Secrets Store workflow
- no repo-managed Cloudflare WAF / DNS / Access policies yet
- no attached evidence in-repo proving a successful full manual cutover drill yet

---

## 12. References

- `docs/backup-recovery-runbook.md`
- `docs/multi-region-failover.md`
- `docs/restore-drill-evidence.md`
- `docs/deployment.md`
- `docs/incident-response.md`
- `.github/workflows/backup.yml`
- `.github/workflows/restore-test.yml`
- `infra/README.md`
