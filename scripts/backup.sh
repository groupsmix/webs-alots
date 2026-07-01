#!/usr/bin/env bash
# ============================================================
# backup.sh — Automated Database Backup with R2 Upload
# ============================================================
#
# Exports the Supabase database via pg_dump, optionally encrypts
# the dump, uploads to Cloudflare R2 with a timestamp, and
# rotates old backups to keep the last 30 days.
#
# Can be run manually or as a cron job:
#   # Daily at 2am UTC
#   0 2 * * * /path/to/scripts/backup.sh >> /var/log/oltigo-backup.log 2>&1
#
# Required environment variables:
#   SUPABASE_DB_URL          — PostgreSQL connection string
#   R2_ACCOUNT_ID            — Cloudflare account ID (or CLOUDFLARE_ACCOUNT_ID)
#   R2_ACCESS_KEY_ID         — R2 API token access key
#   R2_SECRET_ACCESS_KEY     — R2 API token secret key
#   R2_BACKUP_BUCKET         — R2 bucket name for backups
#
# Optional environment variables:
#   BACKUP_ENCRYPTION_KEY    — passphrase to encrypt backups. The dump is
#                              encrypted with AES-256-CBC (openssl enc +
#                              PBKDF2) and authenticated with an HMAC-SHA256
#                              sidecar (Encrypt-then-MAC), since openssl's
#                              `enc` does not support AEAD modes. The HMAC is
#                              verified before decryption, so corrupt/tampered
#                              backups are rejected rather than restored.
#                              Backups created before this change have no
#                              sidecar and fall back to a gzip integrity check.
#   BACKUP_RETENTION_DAYS    — Number of days to retain (default: 30)
#   SLACK_BACKUP_WEBHOOK_URL — Slack webhook for failure alerts
#   BACKUP_ALERT_EMAIL       — Email address for failure alerts
#   RESEND_API_KEY           — Resend API key for email alerts
#
# Usage:
#   ./scripts/backup.sh                 # Daily backup
#   ./scripts/backup.sh weekly          # Weekly backup
#   ./scripts/backup.sh monthly         # Monthly backup
#   ./scripts/backup.sh verify          # Verify latest backup
#   ./scripts/backup.sh list            # List available backups
#   ./scripts/backup.sh restore <file>  # Restore a specific backup
#
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ${RED}[ERROR]${NC} $1"; }

# ── Authenticated encryption (Encrypt-then-MAC) ──────────────
#
# openssl's `enc` cannot do AEAD (GCM/CCM), so we authenticate the AES-256-CBC
# ciphertext ourselves with an HMAC-SHA256 sidecar (<file>.hmac). The MAC is
# verified BEFORE decryption (the correct Encrypt-then-MAC order), so a
# corrupt or tampered backup is rejected without ever being decrypted/loaded.
#
# The MAC key is derived from BACKUP_ENCRYPTION_KEY via HMAC over a fixed,
# public domain-separation label. The passphrase is fed to openssl on STDIN
# (never as a command-line argument), so it does not leak via the process list.

derive_mac_key() {
  printf '%s' "${BACKUP_ENCRYPTION_KEY}" \
    | openssl dgst -sha256 -hmac "oltigo-backup-hmac-v1" \
    | awk '{print $NF}'
}

# hmac_file <path> — print the hex HMAC-SHA256 of a file.
hmac_file() {
  local key
  key="$(derive_mac_key)"
  openssl dgst -sha256 -hmac "${key}" "$1" | awk '{print $NF}'
}

# write_hmac <ciphertext> — write <ciphertext>.hmac alongside the ciphertext.
write_hmac() {
  hmac_file "$1" > "$1.hmac"
}

# authenticate_ciphertext <ciphertext> <sidecar|""> — verify integrity.
# Returns 0 if authenticated (or if the file is a legacy backup with no
# sidecar, in which case it warns and lets the caller fall back to the gzip
# integrity check so old backups stay restorable during a DR).
authenticate_ciphertext() {
  local enc="$1" sidecar="$2"
  if [[ -z "${sidecar}" || ! -s "${sidecar}" ]]; then
    log_warn "No HMAC sidecar found — legacy unauthenticated backup. Falling back to gzip integrity check only."
    return 0
  fi
  local expected actual
  expected="$(tr -d '[:space:]' < "${sidecar}")"
  actual="$(hmac_file "${enc}")"
  if [[ -z "${actual}" || "${expected}" != "${actual}" ]]; then
    log_error "HMAC authentication FAILED — backup is corrupt or tampered. Refusing to decrypt."
    return 1
  fi
  log_info "HMAC-SHA256 authentication passed."
  return 0
}

# ── Alert helpers ────────────────────────────────────────────

send_failure_alert() {
  local MESSAGE="$1"

  # Slack alert
  if [[ -n "${SLACK_BACKUP_WEBHOOK_URL:-}" ]]; then
    curl -s -X POST "${SLACK_BACKUP_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"🚨 Oltigo Backup FAILED: ${MESSAGE}\"}" \
      >/dev/null 2>&1 || true
  fi

  # Email alert via Resend
  if [[ -n "${BACKUP_ALERT_EMAIL:-}" && -n "${RESEND_API_KEY:-}" ]]; then
    local FROM="${BACKUP_ALERT_FROM:-noreply@oltigo.com}"
    curl -s -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer ${RESEND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"from\": \"${FROM}\",
        \"to\": \"${BACKUP_ALERT_EMAIL}\",
        \"subject\": \"[ALERT] Oltigo Database Backup Failed\",
        \"text\": \"Backup failed at $(date -u '+%Y-%m-%d %H:%M:%S UTC').\n\nError: ${MESSAGE}\n\nPlease investigate immediately.\"
      }" >/dev/null 2>&1 || true
  fi
}

# ── Trap: send alert on failure ──────────────────────────────

trap_handler() {
  local EXIT_CODE=$?
  if [[ ${EXIT_CODE} -ne 0 ]]; then
    send_failure_alert "Script exited with code ${EXIT_CODE}"
  fi
  # Clean up temp files
  rm -f "/tmp/backup_"*.sql.gz "/tmp/backup_"*.sql.gz.enc "/tmp/backup_"*.sql.gz.enc.hmac \
        "/tmp/verify_backup_"*.sql.gz "/tmp/verify_backup_"*.hmac "/tmp/restore_"* 2>/dev/null || true
}
trap trap_handler EXIT

# ── Load .env if present ─────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  # Load .env to fill gaps ONLY — values already present in the environment
  # (e.g. CI secrets or values passed on the command line) take precedence and
  # must not be clobbered by a stale .env on the backup host.
  set -a
  # shellcheck disable=SC1090,SC1091
  source <(
    while IFS= read -r line; do
      case "${line}" in
        ''|\#*) continue ;;
      esac
      key="${line%%=*}"
      key="${key#export }"
      key="${key// /}"
      [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      # Skip keys that are already set in the environment.
      [[ -n "${!key:-}" ]] && continue
      printf '%s\n' "${line}"
    done < "${PROJECT_ROOT}/.env"
  )
  set +a
fi

# ── Validate environment ─────────────────────────────────────

# Support both R2_ACCOUNT_ID and CLOUDFLARE_ACCOUNT_ID
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"

for VAR in SUPABASE_DB_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_BUCKET; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Missing required env var: ${VAR}"
    exit 1
  fi
done

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Configure AWS CLI for R2
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

# ── List subcommand ──────────────────────────────────────────

if [[ "${BACKUP_TYPE}" == "list" ]]; then
  log_info "Available backups in R2:"
  echo ""
  for TYPE in daily weekly monthly; do
    ITEMS=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/" \
      --endpoint-url "${R2_ENDPOINT}" 2>/dev/null || true)
    if [[ -n "${ITEMS}" ]]; then
      echo "  === ${TYPE} ==="
      echo "${ITEMS}" | sort -r | head -20 | while read -r LINE; do
        echo "    ${LINE}"
      done
      echo ""
    fi
  done
  exit 0
fi

# ── Verify subcommand ───────────────────────────────────────

if [[ "${BACKUP_TYPE}" == "verify" ]]; then
  log_info "Verifying latest backup..."

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

  # Handle encrypted backups
  if [[ "${LATEST}" == *.enc ]]; then
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
      log_error "Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set."
      rm -f "${VERIFY_FILE}"
      exit 1
    fi
    # Download the HMAC sidecar (if any) and authenticate the ciphertext
    # BEFORE decrypting.
    SIDECAR_FILE="${VERIFY_FILE}.hmac"
    aws s3 cp "s3://${R2_BACKUP_BUCKET}/backups/${PREFIX}/${LATEST}.hmac" \
      "${SIDECAR_FILE}" --endpoint-url "${R2_ENDPOINT}" 2>/dev/null || SIDECAR_FILE=""
    if ! authenticate_ciphertext "${VERIFY_FILE}" "${SIDECAR_FILE}"; then
      rm -f "${VERIFY_FILE}" "${SIDECAR_FILE:-}"
      exit 1
    fi
    DECRYPTED_FILE="${VERIFY_FILE}.dec"
    openssl enc -aes-256-cbc -d -pbkdf2 \
      -in "${VERIFY_FILE}" \
      -out "${DECRYPTED_FILE}" \
      -pass "env:BACKUP_ENCRYPTION_KEY"
    rm -f "${VERIFY_FILE}" "${SIDECAR_FILE:-}"
    VERIFY_FILE="${DECRYPTED_FILE}"
  fi

  # Basic integrity checks
  FILESIZE=$(stat -c%s "${VERIFY_FILE}" 2>/dev/null || stat -f%z "${VERIFY_FILE}" 2>/dev/null)
  if [[ "${FILESIZE}" -lt 1024 ]]; then
    log_error "Backup file is suspiciously small (${FILESIZE} bytes). Possibly corrupt."
    rm -f "${VERIFY_FILE}"
    exit 1
  fi

  if ! gunzip -t "${VERIFY_FILE}" 2>/dev/null; then
    log_error "Backup file failed gzip integrity check."
    rm -f "${VERIFY_FILE}"
    exit 1
  fi

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

# ── Restore subcommand ──────────────────────────────────────

if [[ "${BACKUP_TYPE}" == "restore" ]]; then
  RESTORE_TARGET="${2:-}"
  if [[ -z "${RESTORE_TARGET}" ]]; then
    log_error "Usage: ./scripts/backup.sh restore <backup_filename>"
    log_error "Run './scripts/backup.sh list' to see available backups."
    exit 1
  fi

  # Determine which prefix the file is under
  for PREFIX in daily weekly monthly; do
    EXISTS=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/${PREFIX}/${RESTORE_TARGET}" \
      --endpoint-url "${R2_ENDPOINT}" 2>/dev/null || true)
    if [[ -n "${EXISTS}" ]]; then
      break
    fi
  done

  if [[ -z "${EXISTS:-}" ]]; then
    log_error "Backup file not found: ${RESTORE_TARGET}"
    exit 1
  fi

  log_info "Downloading backup: backups/${PREFIX}/${RESTORE_TARGET}"
  RESTORE_FILE="/tmp/restore_${TIMESTAMP}"
  aws s3 cp "s3://${R2_BACKUP_BUCKET}/backups/${PREFIX}/${RESTORE_TARGET}" \
    "${RESTORE_FILE}" --endpoint-url "${R2_ENDPOINT}"

  # Handle encrypted backups
  if [[ "${RESTORE_TARGET}" == *.enc ]]; then
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
      log_error "Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set."
      rm -f "${RESTORE_FILE}"
      exit 1
    fi
    # Download the HMAC sidecar (if any) and authenticate the ciphertext
    # BEFORE decrypting.
    SIDECAR_FILE="${RESTORE_FILE}.hmac"
    aws s3 cp "s3://${R2_BACKUP_BUCKET}/backups/${PREFIX}/${RESTORE_TARGET}.hmac" \
      "${SIDECAR_FILE}" --endpoint-url "${R2_ENDPOINT}" 2>/dev/null || SIDECAR_FILE=""
    if ! authenticate_ciphertext "${RESTORE_FILE}" "${SIDECAR_FILE}"; then
      rm -f "${RESTORE_FILE}" "${SIDECAR_FILE:-}"
      exit 1
    fi
    DECRYPTED_FILE="${RESTORE_FILE}.dec"
    openssl enc -aes-256-cbc -d -pbkdf2 \
      -in "${RESTORE_FILE}" \
      -out "${DECRYPTED_FILE}" \
      -pass "env:BACKUP_ENCRYPTION_KEY"
    rm -f "${RESTORE_FILE}" "${SIDECAR_FILE:-}"
    RESTORE_FILE="${DECRYPTED_FILE}"
  fi

  log_warn "This will OVERWRITE your current database. Are you sure? (yes/no)"
  read -r CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    log_info "Restore cancelled."
    rm -f "${RESTORE_FILE}"
    exit 0
  fi

  # Integrity gate: never load a corrupt/truncated/tampered dump into the DB.
  if ! gunzip -t "${RESTORE_FILE}" 2>/dev/null; then
    log_error "Backup failed gzip integrity check — refusing to restore a corrupt backup."
    rm -f "${RESTORE_FILE}"
    exit 1
  fi

  log_info "Restoring database..."
  gunzip -c "${RESTORE_FILE}" | psql "${SUPABASE_DB_URL}"

  rm -f "${RESTORE_FILE}"
  log_info "Database restored from ${RESTORE_TARGET}"
  exit 0
fi

# ── Create backup ────────────────────────────────────────────

FILENAME="backup_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
FILEPATH="/tmp/${FILENAME}"

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

# ── Encrypt (if key is set) ─────────────────────────────────

if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  ENC_FILEPATH="${FILEPATH}.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${FILEPATH}" \
    -out "${ENC_FILEPATH}" \
    -pass "env:BACKUP_ENCRYPTION_KEY"
  rm -f "${FILEPATH}"
  # Encrypt-then-MAC: authenticate the ciphertext with an HMAC-SHA256 sidecar.
  write_hmac "${ENC_FILEPATH}"
  FILEPATH="${ENC_FILEPATH}"
  FILENAME="${FILENAME}.enc"
  log_info "Backup encrypted (AES-256-CBC) and authenticated (HMAC-SHA256 sidecar)"
else
  log_warn "BACKUP_ENCRYPTION_KEY not set — backup stored unencrypted."
fi

# ── Upload to R2 ────────────────────────────────────────────

log_info "Uploading to R2: backups/${BACKUP_TYPE}/${FILENAME}"

aws s3 cp "${FILEPATH}" \
  "s3://${R2_BACKUP_BUCKET}/backups/${BACKUP_TYPE}/${FILENAME}" \
  --endpoint-url "${R2_ENDPOINT}"

# Upload the HMAC sidecar alongside an encrypted backup.
if [[ -f "${FILEPATH}.hmac" ]]; then
  aws s3 cp "${FILEPATH}.hmac" \
    "s3://${R2_BACKUP_BUCKET}/backups/${BACKUP_TYPE}/${FILENAME}.hmac" \
    --endpoint-url "${R2_ENDPOINT}"
fi

log_info "Upload complete."

# ── Rotate old backups ──────────────────────────────────────

rotate_backups() {
  local TYPE=$1
  local KEEP=$2

  log_info "Rotating ${TYPE} backups (keeping last ${KEEP})..."

  # Count only primary backup objects (ignore .hmac sidecars), then delete
  # each rotated-out backup together with its sidecar.
  aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/" \
    --endpoint-url "${R2_ENDPOINT}" 2>/dev/null \
    | awk '{print $4}' \
    | grep -v '\.hmac$' \
    | grep -v '^$' \
    | sort -r \
    | tail -n +$((KEEP + 1)) \
    | while read -r KEY; do
        if [[ -n "${KEY}" ]]; then
          log_warn "Deleting old backup: ${KEY}"
          aws s3 rm "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/${KEY}" \
            --endpoint-url "${R2_ENDPOINT}"
          # Remove the HMAC sidecar too, if present.
          aws s3 rm "s3://${R2_BACKUP_BUCKET}/backups/${TYPE}/${KEY}.hmac" \
            --endpoint-url "${R2_ENDPOINT}" 2>/dev/null || true
        fi
      done
}

# Retention: 30 daily, 8 weekly, 6 monthly
rotate_backups "daily" 30
rotate_backups "weekly" 8
rotate_backups "monthly" 6

# ── Cleanup ──────────────────────────────────────────────────

rm -f "${FILEPATH}" "${FILEPATH}.hmac"
log_info "Backup complete: backups/${BACKUP_TYPE}/${FILENAME}"
