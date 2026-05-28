# Backup Restore Drill — Evidence Log

> **Audience:** Platform operators, compliance auditors
> **Last updated:** May 2026
> **Schedule:** Monthly (first Monday), per `docs/backup-recovery-runbook.md`
> **Workflow:** `.github/workflows/restore-test.yml` (automated monthly drill)

---

## Purpose

Healthcare SaaS handling PHI must prove that backups are restorable — not
just that they exist. This document records each restore drill with evidence
of the full decrypt → decompress → restore → smoke-test chain.

---

## Drill Procedure

### Automated (Monthly via GitHub Actions)

1. `.github/workflows/restore-test.yml` runs on `schedule: cron "0 4 1 * *"` (1st of each month, 04:00 UTC)
2. Fetches latest `.sql.gz.gpg` from `R2_BACKUP_BUCKET` (searches `backups/daily/`, `backups/weekly/`, `backups/monthly/`)
3. Imports `BACKUP_GPG_PRIVATE_KEY` and decrypts the backup
4. Decompresses with `gunzip`
5. Restores to an ephemeral PostgreSQL container
6. Runs smoke tests:
   - Row count verification on critical tables (`clinics`, `users`, `appointments`)
   - RPC existence check for key functions
   - RLS policy existence verification
7. Drops ephemeral database, removes GPG keyring

### Manual Drill (Quarterly)

For compliance evidence beyond automated testing:

```bash
# 1. Download latest backup from R2
aws s3 cp s3://${R2_BACKUP_BUCKET}/backups/daily/$(aws s3 ls s3://${R2_BACKUP_BUCKET}/backups/daily/ --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com | sort -r | head -1 | awk '{print $4}') /tmp/drill_backup.sql.gz.gpg --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# 2. Decrypt
gpg --batch --yes --decrypt /tmp/drill_backup.sql.gz.gpg > /tmp/drill_backup.sql.gz

# 3. Decompress
gunzip /tmp/drill_backup.sql.gz

# 4. Restore to isolated test database
createdb drill_test
psql drill_test < /tmp/drill_backup.sql

# 5. Smoke tests
psql drill_test -c "SELECT COUNT(*) FROM clinics;"
psql drill_test -c "SELECT COUNT(*) FROM users;"
psql drill_test -c "SELECT COUNT(*) FROM appointments;"
psql drill_test -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | head -20
psql drill_test -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;" | head -20

# 6. Cleanup
dropdb drill_test
rm /tmp/drill_backup.*
```

---

## Evidence Records

### Template

Copy this block for each drill:

```
### Drill YYYY-MM-DD

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Operator | [Name / GitHub handle] |
| Method | Automated (restore-test.yml) / Manual |
| Backup file | backups/daily/backup_YYYYMMDD_HHMMSS.sql.gz.gpg |
| Backup size (encrypted) | XX MB |
| Backup size (decompressed) | XX MB |
| GPG decrypt | Pass / Fail |
| gunzip decompress | Pass / Fail |
| PostgreSQL restore | Pass / Fail |
| Smoke test — clinics count | NNN rows |
| Smoke test — users count | NNN rows |
| Smoke test — appointments count | NNN rows |
| Smoke test — RLS policies present | Yes / No |
| Smoke test — RPCs present | Yes / No |
| Total drill duration | XX minutes |
| RPO verified | < 24 hours (backup age: XX hours) |
| RTO estimated | XX minutes (restore time) |
| Issues found | None / [describe] |
| GitHub Actions run URL | [link to workflow run] |
| Approved by | [Name / GitHub handle] |

Notes: [any additional observations]
```

---

## Historical Drills

> Record each completed drill below. Newest first.

### Drill 2026-05-26 (Pre-Launch Attempt)

| Field                  | Value                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date                   | 2026-05-26                                                                                                                                                                                                              |
| Operator               | Devin (automated)                                                                                                                                                                                                       |
| Method                 | Automated (restore-test.yml — manual trigger)                                                                                                                                                                           |
| Backup file            | N/A — R2 credentials not yet configured                                                                                                                                                                                 |
| GPG decrypt            | N/A                                                                                                                                                                                                                     |
| gunzip decompress      | N/A                                                                                                                                                                                                                     |
| PostgreSQL restore     | N/A                                                                                                                                                                                                                     |
| Total drill duration   | < 1 min (failed at fetch step)                                                                                                                                                                                          |
| Issues found           | **R2 backup secrets not configured in GitHub Actions.** The workflow requires: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `BACKUP_GPG_PRIVATE_KEY` as repository secrets. |
| GitHub Actions run URL | https://github.com/groupsmix/webs-alots/actions/runs/26469810438                                                                                                                                                        |
| Approved by            | _Pending — re-run after secrets are configured_                                                                                                                                                                         |

Notes: This is the first-ever drill attempt. The workflow infrastructure is verified (triggers correctly, steps are wired). Once the R2 and GPG secrets are added to GitHub repository secrets, re-trigger via: `gh workflow run restore-test.yml` or the Actions UI.
