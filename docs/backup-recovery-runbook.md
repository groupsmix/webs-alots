# Backup & Recovery Operational Runbook

> **Audience:** Platform operators, clinic admins, on-call engineers
> **Last updated:** April 2026

---

## 1. Backup Architecture Overview

Oltigo Health uses a **three-layer backup strategy**:

| Layer | What | Where | Frequency | Retention |
|-------|------|-------|-----------|-----------|
| **Supabase Automated** | Full PostgreSQL snapshot | Supabase infrastructure | Daily (Pro plan) / Point-in-time (Team/Enterprise) | 7 days (Pro) / 30 days (Enterprise) |
| **GitHub Actions pg_dump** | Logical SQL dump (gzipped) | Cloudflare R2 bucket (`R2_BACKUP_BUCKET`) | Nightly at 02:00 UTC | 7 daily, 4 weekly, 3 monthly |
| **Application-level export** | Per-clinic JSON export | Downloaded by clinic admin | On-demand via admin panel | Managed by clinic |

### Storage Replication

An optional **R2 replication workflow** (`.github/workflows/r2-replication.yml`) syncs the primary R2 bucket to a secondary bucket every 6 hours. This provides geographic redundancy for both backups and uploaded files (patient documents, clinic logos, etc.).

---

## 2. Recovery Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | **< 24 hours** | Nightly pg_dump; Supabase PITR can reduce to minutes on Team/Enterprise plans |
| **RTO** (Recovery Time Objective) | **< 2 hours** | Restore from R2 dump + re-deploy Workers |

---

## 3. Automated Backup (GitHub Actions)

### How it works

The workflow at `.github/workflows/backup.yml` runs nightly and:

1. Connects to Supabase PostgreSQL via `SUPABASE_DB_URL`
2. Runs `pg_dump` with `--no-owner --no-acl --clean --if-exists`
3. Gzips the dump and uploads to `s3://R2_BACKUP_BUCKET/backups/{type}/`
4. Rotates old backups (keeps 7 daily, 4 weekly, 3 monthly)
5. Verifies the latest backup by restoring into a temporary PostgreSQL instance
6. Sends Slack/email alerts on failure

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `SUPABASE_DB_URL` | PostgreSQL connection string (e.g., `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BACKUP_BUCKET` | Dedicated R2 bucket for backups (separate from uploads) |
| `RESEND_API_KEY` | (Optional) For email failure alerts |

### GitHub Actions Variables

| Variable | Description |
|----------|-------------|
| `SLACK_BACKUP_WEBHOOK_URL` | (Optional) Slack incoming webhook for failure alerts |
| `BACKUP_ALERT_EMAIL` | (Optional) Email address for failure alerts |
| `BACKUP_ALERT_FROM` | (Optional) Sender email for alerts (default: `noreply@yourdomain.com`) |

### Manual trigger

Run a backup manually via GitHub Actions:

1. Go to **Actions > Automated Database Backups > Run workflow**
2. Select backup type: `daily`, `weekly`, `monthly`, or `verify`

---

## 4. Recovery Procedures

### 4.1 Restore from R2 backup (full database)

Use this when Supabase data is lost or corrupted and you need to restore from the nightly pg_dump.

```bash
# 1. Install prerequisites
sudo apt-get install -y postgresql-client awscli

# 2. Configure R2 credentials
export R2_ACCOUNT_ID="your-account-id"
export R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws configure  # Enter R2 access key and secret

# 3. List available backups
aws s3 ls "s3://YOUR_BACKUP_BUCKET/backups/daily/" \
  --endpoint-url "${R2_ENDPOINT}" | sort -r | head -10

# 4. Download the desired backup
aws s3 cp "s3://YOUR_BACKUP_BUCKET/backups/daily/backup_daily_YYYYMMDD_HHMMSS.sql.gz" \
  /tmp/restore.sql.gz --endpoint-url "${R2_ENDPOINT}"

# 5. Restore to Supabase (CAUTION: destructive operation)
gunzip -c /tmp/restore.sql.gz | psql "${SUPABASE_DB_URL}"

# 6. Verify key tables
psql "${SUPABASE_DB_URL}" -c \
  "SELECT table_name, (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as cols
   FROM information_schema.tables t
   WHERE table_schema = 'public'
   ORDER BY table_name;"

# 7. Clean up
rm /tmp/restore.sql.gz
```

**Post-restore checklist:**
- [ ] Verify RLS policies are intact: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
- [ ] Test login for each role (super_admin, clinic_admin, doctor, receptionist, patient)
- [ ] Verify tenant isolation by querying from two different clinic contexts
- [ ] Check that seed-guard is still active (seed users cannot log in with default password)
- [ ] Run the application health check endpoint

### 4.2 Restore from Supabase Dashboard (Point-in-Time)

For Supabase Pro/Team/Enterprise plans:

1. Go to **Supabase Dashboard > Project Settings > Database > Backups**
2. Select the desired point-in-time or daily snapshot
3. Click **Restore** and confirm
4. Wait for the restore to complete (typically 5-15 minutes)

> **Note:** This restores the entire database. All data after the restore point will be lost.

### 4.3 Restore a single clinic (application-level)

Use this when a single clinic's data is corrupted but the rest of the platform is fine.

```bash
# The application-level backup/restore uses src/lib/backup.ts

# 1. Create a backup first (always before restoring)
# Via the admin panel or API:
curl -X POST https://your-domain.com/api/backup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clinicId": "CLINIC_UUID", "clinicName": "Clinic Name"}'

# 2. Restore from a previously downloaded JSON backup
curl -X POST https://your-domain.com/api/backup/restore \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @backup-file.json
```

**Important notes:**
- Only `clinic_admin` and `super_admin` roles can perform restores
- Maximum restore payload: 50 MB
- Maximum rows per table: 10,000
- All restored users are reset to `patient` role for security — re-assign roles manually
- Foreign key references are remapped to new UUIDs automatically
- If the `restore_backup_transaction` RPC is deployed, the restore is atomic (all-or-nothing)

### 4.4 Restore uploaded files (R2)

If the primary R2 bucket is lost:

```bash
# If R2 replication is configured, sync from replica to primary
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
REPLICA_ENDPOINT="https://${R2_REPLICA_ACCOUNT_ID}.r2.cloudflarestorage.com"

aws s3 sync "s3://${R2_REPLICA_BUCKET_NAME}" "s3://${R2_BUCKET_NAME}" \
  --source-region auto --region auto \
  --endpoint-url "${R2_ENDPOINT}"
```

If no replica exists, uploaded files cannot be recovered. Enable replication by configuring:
- `R2_REPLICA_ACCOUNT_ID`
- `R2_REPLICA_ACCESS_KEY_ID`
- `R2_REPLICA_SECRET_ACCESS_KEY`
- `R2_REPLICA_BUCKET_NAME`

---

## 5. Testing Backup Integrity

### Automated verification

The nightly backup workflow includes a `verify` job that:
1. Downloads the latest daily backup from R2
2. Starts a temporary PostgreSQL instance
3. Restores the backup
4. Verifies at least 5 tables exist in the `public` schema
5. Cleans up the temporary database

### Manual verification

Run the verify workflow manually:
1. Go to **Actions > Automated Database Backups > Run workflow**
2. Select `verify` as the backup type

### Quarterly DR drill (recommended)

1. Download the latest monthly backup from R2
2. Restore to a **separate Supabase project** (staging or a throwaway project)
3. Deploy the application pointed at the restored database
4. Verify:
   - [ ] All clinics are accessible via subdomains
   - [ ] Patient records are intact
   - [ ] Appointments and invoices are present
   - [ ] File uploads (R2 URLs) still resolve
   - [ ] WhatsApp notification templates are configured
5. Document the drill results and time-to-recovery

---

## 6. Monitoring & Alerting

| What to monitor | How | Alert channel |
|-----------------|-----|---------------|
| Backup workflow failures | GitHub Actions status | Slack (`SLACK_BACKUP_WEBHOOK_URL`) + Email (`BACKUP_ALERT_EMAIL`) |
| Backup file size anomalies | Compare daily backup sizes (a sudden drop may indicate data loss) | Manual review of R2 bucket |
| R2 replication drift | `r2-replication.yml` object count mismatch | Workflow failure alert |
| Supabase disk usage | Supabase Dashboard > Database > Disk | Supabase built-in alerts |

---

## 7. Incident Response Checklist

When data loss or corruption is suspected:

1. **Stop writes immediately** — Enable maintenance mode or restrict API access
2. **Assess scope** — Is it one clinic or all clinics? One table or many?
3. **Determine the restore point** — When was the last known good state?
4. **Choose the restore strategy:**
   - Single clinic → Application-level restore (Section 4.3)
   - Single table → Selective pg_dump restore with `--table` flag
   - Full database → R2 backup restore (Section 4.1) or Supabase PITR (Section 4.2)
5. **Perform the restore** — Follow the appropriate procedure above
6. **Verify data integrity** — Run the post-restore checklist
7. **Notify affected clinics** — Use the notification system to inform clinic admins
8. **Post-incident review** — Document what happened, timeline, and prevention measures

---

## 8A. Cloudflare Queues & DLQ Drain Procedure (R-14 Fix)

### Queue Architecture

The platform uses Cloudflare Queues for reliable async processing:

| Queue | Purpose | DLQ |
|-------|---------|-----|
| `reminders-queue` | Appointment reminder notifications | `reminders-dlq` |
| `notifications-queue` | WhatsApp/email notifications | `notifications-dlq` |

### DLQ Drain Procedure

When messages fail after 5 retries, they are moved to the DLQ. Follow this procedure to drain and reprocess:

```bash
# 1. List messages in the DLQ (dry run - count only)
wrangler queues list messages reminders-dlq --json | jq length

# 2. View DLQ messages (first 10)
wrangler queues list messages reminders-dlq --max 10

# 3. Manually reprocess DLQ messages
# Option A: Re-enqueue to main queue with delay
wrangler queues consume reminders-dlq --wrangler-json | while read msg; do
  echo "$msg" | wrangler queues send reminders-queue --message -
done

# Option B: Bulk reprocess via admin API
# Replace YOUR_ADMIN_TOKEN with a super_admin session token (do NOT commit it).
curl -X POST https://your-domain.com/api/admin/dlq/reprocess \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"queue": "reminders-dlq", "limit": 100}'

# 4. Monitor DLQ depth
wrangler queues list queues | grep -E "(reminders-dlq|notifications-dlq)"
```

**Automated DLQ monitoring** (recommended):
- Set up a cron job to check DLQ depth every hour
- Alert to Slack if DLQ depth > 100 messages
- Auto-drain if DLQ depth < 10 messages

### Queue Consumer Worker

The `worker-cron-handler.ts` acts as the queue consumer. It processes messages in batches:
- `max_batch_size`: 10 messages
- `max_batch_timeout`: 30 seconds
- `max_retries`: 5

If the consumer fails to process a message 5 times, it's moved to the DLQ automatically by Cloudflare.

---

## 8B. Encryption & Compliance

- Database backups via pg_dump include all data, including PHI
- R2 buckets should have **encryption at rest** enabled (Cloudflare R2 default)
- The `SUPABASE_DB_URL` secret must be rotated if compromised
- Patient documents uploaded via the platform are encrypted with AES-256-GCM (see `src/lib/r2-encrypted.ts`)
- Moroccan Law 09-08 requires PHI to be handled with appropriate safeguards — ensure backup storage complies with your data residency requirements
