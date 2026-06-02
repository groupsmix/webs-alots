#!/usr/bin/env bash
# ============================================================
# backup-database.sh — Manual Supabase backup to R2
#
# Creates a pg_dump of the Supabase database and uploads to R2.
# Can be used standalone or called by the GitHub Actions workflow.
#
# Required environment variables:
#   SUPABASE_DB_URL          — PostgreSQL connection string
#   R2_ACCOUNT_ID            — Cloudflare account ID
#   R2_ACCESS_KEY_ID         — R2 API token access key
#   R2_SECRET_ACCESS_KEY     — R2 API token secret key
#   R2_BACKUP_BUCKET         — R2 bucket name for backups
#
# Usage:
#   ./scripts/backup-database.sh                 # Daily backup
#   ./scripts/backup-database.sh weekly          # Weekly backup
#   ./scripts/backup-database.sh monthly         # Monthly backup
#   ./scripts/backup-database.sh verify          # Verify latest backup
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---- Validate environment ----
for VAR in SUPABASE_DB_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_BUCKET; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Missing required env var: ${VAR}"
    exit 1
  fi
done

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
FILEPATH="/tmp/${FILENAME}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# ---- Configure AWS CLI for R2 ----
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

# ---- Verify subcommand ----
if [[ "${BACKUP_TYPE}" == "verify" ]]; then
  log_info "Verifying latest backup..."

  # Find the most recent daily backup; fall back to weekly
  LATEST=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/daily/" \
    --endpoint-url "${R2_ENDPOINT}" 2>/dev/null \
    | sort -r | head -1 | awk '{print $4}')
  PREFIX="daily"

  if [[ -z "${LATEST}" ]]; then
    log_warn "No daily backup found, checking weekly..."
    LATEST=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/weekly/" \
      --endpoint-url "${R2_ENDPOINT}" 2>/dev/null \
      | sort -r | head -1 | awk '{print $4}')
    PREFIX="weekly"
  fi

  if [[ -z "${LATEST}" ]]; then
    log_error "No backups found in R2 bucket."
    exit 1
  fi

  VERIFY_FILE="/tmp/verify_backup_${TIMESTAMP}.sql.gz"
  log_info "Downloading: backups/${PREFIX}/${LATEST}"
  aws s3 cp "s3://${R2_BACKUP_BUCKET}/backups/${PREFIX}/${LATEST}" \
    "${VERIFY_FILE}" --endpoint-url "${R2_ENDPOINT}"

  # Basic integrity checks
  FILESIZE=$(stat -c%s "${VERIFY_FILE}" 2>/dev/null || stat -f%z "${VERIFY_FILE}" 2>/dev/null)
  if [[ "${FILESIZE}" -lt 1024 ]]; then
    log_error "Backup file is suspiciously small (${FILESIZE} bytes). Possibly corrupt."
    rm -f "${VERIFY_FILE}"
    exit 1
  fi

  # Verify gzip integrity
  if ! gunzip -t "${VERIFY_FILE}" 2>/dev/null; then
    log_error "Backup file failed gzip integrity check."
    rm -f "${VERIFY_FILE}"
    exit 1
  fi

  # Verify SQL content contains expected table references
  TABLE_COUNT=$(gunzip -c "${VERIFY_FILE}" | grep -c "CREATE TABLE" || true)
  if [[ "${TABLE_COUNT}" -lt 5 ]]; then
    log_error "Backup contains only ${TABLE_COUNT} CREATE TABLE statements. Possibly incomplete."
    rm -f "${VERIFY_FILE}"
    exit 1
  fi

  rm -f "${VERIFY_FILE}"
  log_info "Backup verification PASSED — ${LATEST} (${PREFIX}, ${TABLE_COUNT} tables, ${FILESIZE} bytes)"
  exit 0
fi

# ---- Create backup ----
log_info "Creating ${BACKUP_TYPE} backup: ${FILENAME}"

pg_dump "${SUPABASE_DB_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  | gzip > "${FILEPATH}"

SIZE=$(du -h "${FILEPATH}" | cut -f1)
log_info "Backup created: ${SIZE}"

# Audit 8.7 — Encrypt the backup before uploading to R2.
# Uses AES-256-CBC symmetric encryption with the BACKUP_ENCRYPTION_KEY env var.
# To restore: openssl enc -aes-256-cbc -d -pbkdf2 -in backup.sql.gz.enc -out backup.sql.gz
if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  ENC_FILEPATH="${FILEPATH}.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${FILEPATH}" \
    -out "${ENC_FILEPATH}" \
    -pass "env:BACKUP_ENCRYPTION_KEY"
  rm -f "${FILEPATH}"
  FILEPATH="${ENC_FILEPATH}"
  FILENAME="${FILENAME}.enc"
  log_info "Backup encrypted with AES-256-CBC"
else
  log_warn "BACKUP_ENCRYPTION_KEY not set — backup will be stored unencrypted. Set this env var for production use."
fi

# ---- Upload to R2 ----
log_info "Uploading to R2: backups/${BACKUP_TYPE}/${FILENAME}"

aws s3 cp "${FILEPATH}" \
  "s3://${R2_BACKUP_BUCKET}/backups/${BACKUP_TYPE}/${FILENAME}" \
  --endpoint-url "${R2_ENDPOINT}"

log_info "Upload complete."

# ---- Rotate old backups ----
rotate_backups() {
  local TYPE=$1
  local KEEP=$2

  log_info "Rotating ${TYPE} backups (keeping last ${KEEP})..."

  aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/" \
    --endpoint-url "${R2_ENDPOINT}" 2>/dev/null \
    | sort -r \
    | tail -n +$((KEEP + 1)) \
    | while read -r _ _ _ KEY; do
        if [[ -n "${KEY}" ]]; then
          log_warn "Deleting old backup: ${KEY}"
          aws s3 rm "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/${KEY}" \
            --endpoint-url "${R2_ENDPOINT}"
        fi
      done
}

# Keep last 7 daily, 4 weekly, 3 monthly
rotate_backups "daily" 7
rotate_backups "weekly" 4
rotate_backups "monthly" 3

# ---- Cleanup ----
rm -f "${FILEPATH}"
log_info "Backup complete: backups/${BACKUP_TYPE}/${FILENAME}"
