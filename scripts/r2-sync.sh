#!/usr/bin/env bash
# ============================================================
# r2-sync.sh — Replicate R2 primary bucket to secondary bucket
#
# Syncs all objects from the primary R2 bucket to a replica
# bucket in a different region for disaster recovery.
#
# Required environment variables:
#   R2_ACCOUNT_ID              — Primary Cloudflare account ID
#   R2_ACCESS_KEY_ID           — Primary R2 access key
#   R2_SECRET_ACCESS_KEY       — Primary R2 secret key
#   R2_BUCKET_NAME             — Primary bucket name
#   R2_REPLICA_ACCOUNT_ID      — Replica Cloudflare account ID
#   R2_REPLICA_ACCESS_KEY_ID   — Replica R2 access key
#   R2_REPLICA_SECRET_ACCESS_KEY — Replica R2 secret key
#   R2_REPLICA_BUCKET_NAME     — Replica bucket name
#
# Usage:
#   ./scripts/r2-sync.sh           # Full sync
#   ./scripts/r2-sync.sh --verify  # Verify only (no sync)
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
for VAR in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME \
           R2_REPLICA_ACCOUNT_ID R2_REPLICA_ACCESS_KEY_ID R2_REPLICA_SECRET_ACCESS_KEY R2_REPLICA_BUCKET_NAME; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Missing required env var: ${VAR}"
    exit 1
  fi
done

PRIMARY_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
REPLICA_ENDPOINT="https://${R2_REPLICA_ACCOUNT_ID}.r2.cloudflarestorage.com"

# ---- Configure AWS profiles ----
mkdir -p ~/.aws
cat > ~/.aws/credentials << EOF
[primary]
aws_access_key_id=${R2_ACCESS_KEY_ID}
aws_secret_access_key=${R2_SECRET_ACCESS_KEY}
[replica]
aws_access_key_id=${R2_REPLICA_ACCESS_KEY_ID}
aws_secret_access_key=${R2_REPLICA_SECRET_ACCESS_KEY}
EOF

# ---- Verify Mode ----
if [[ "${1:-}" == "--verify" ]]; then
  log_info "Verifying replication integrity..."

  PRIMARY_COUNT=$(aws s3 ls "s3://${R2_BUCKET_NAME}" --recursive \
    --profile primary --endpoint-url "${PRIMARY_ENDPOINT}" | wc -l)

  REPLICA_COUNT=$(aws s3 ls "s3://${R2_REPLICA_BUCKET_NAME}" --recursive \
    --profile replica --endpoint-url "${REPLICA_ENDPOINT}" | wc -l)

  log_info "Primary bucket objects: ${PRIMARY_COUNT}"
  log_info "Replica bucket objects: ${REPLICA_COUNT}"

  if [[ "${PRIMARY_COUNT}" -ne "${REPLICA_COUNT}" ]]; then
    log_error "Object count mismatch! Primary=${PRIMARY_COUNT}, Replica=${REPLICA_COUNT}"
    exit 1
  fi

  log_info "Replication verification PASSED"
  exit 0
fi

# ---- Sync Mode ----
log_info "=== R2 Replication Sync ==="
log_info "Source: s3://${R2_BUCKET_NAME} (${PRIMARY_ENDPOINT})"
log_info "Target: s3://${R2_REPLICA_BUCKET_NAME} (${REPLICA_ENDPOINT})"
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Download from primary
log_info "Downloading from primary bucket..."
aws s3 sync "s3://${R2_BUCKET_NAME}" "${TEMP_DIR}/" \
  --profile primary \
  --endpoint-url "${PRIMARY_ENDPOINT}"

FILE_COUNT=$(find "${TEMP_DIR}" -type f | wc -l)
log_info "Downloaded ${FILE_COUNT} files"

# Upload to replica
log_info "Uploading to replica bucket..."
aws s3 sync "${TEMP_DIR}/" "s3://${R2_REPLICA_BUCKET_NAME}" \
  --profile replica \
  --endpoint-url "${REPLICA_ENDPOINT}"

log_info "Replication complete: ${FILE_COUNT} files synced"
log_info "Run with --verify to check integrity"
