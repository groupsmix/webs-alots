#!/usr/bin/env bash
# ============================================================
# staging-swap.sh — One-click staging-to-production swap
#
# Promotes the current staging Worker to production by:
# 1. Creating a backup of the current production
# 2. Deploying the staging build to the production worker
# 3. Optionally rolling back if something goes wrong
#
# Prerequisites:
#   - wrangler CLI authenticated (CLOUDFLARE_API_TOKEN set)
#   - Both production and staging workers deployed
#
# Usage:
#   ./scripts/staging-swap.sh              # Promote staging to production
#   ./scripts/staging-swap.sh --rollback   # Rollback to previous production
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PRODUCTION_NAME="webs-alots"
STAGING_NAME="webs-alots-staging"
BACKUP_DIR=".deploy-backups"

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---- Rollback Mode ----
# Audit 8.5 — Use `wrangler rollback` for instant rollback instead of
# rebuilding from main branch (which is slow and error-prone).
if [[ "${1:-}" == "--rollback" ]]; then
  log_warn "Rolling back to previous production deployment..."
  log_info "Using wrangler rollback for instant revert..."

  npx wrangler rollback --name "${PRODUCTION_NAME}"

  log_info "Rollback complete. Production has been reverted to the previous deployment."
  log_info "Verify at: https://oltigo.com"
  exit 0
fi

# ---- Swap Mode ----
log_info "=== Staging to Production Swap ==="
log_info "Production worker: ${PRODUCTION_NAME}"
log_info "Staging worker:    ${STAGING_NAME}"
echo ""

# Step 1: Confirm
read -rp "Are you sure you want to promote staging to production? (y/N) " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  log_warn "Aborted."
  exit 0
fi

# Step 2: Create backup timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"

# Step 3: Record current production git SHA
CURRENT_SHA=$(git rev-parse HEAD)
echo "${CURRENT_SHA}" > "${BACKUP_DIR}/production_${TIMESTAMP}.sha"
log_info "Backed up current production SHA: ${CURRENT_SHA}"

# Step 4: Check staging branch exists and switch to it
log_info "Switching to staging branch..."
if ! git show-ref --verify --quiet refs/heads/staging 2>/dev/null; then
  if ! git show-ref --verify --quiet refs/remotes/origin/staging 2>/dev/null; then
    log_error "No 'staging' branch found locally or remotely."
    log_error "Create a staging branch first: git checkout -b staging"
    exit 1
  fi
  git checkout -b staging origin/staging
else
  git checkout staging
fi

git pull origin staging 2>/dev/null || true

# Step 5: Build the staging code for production
log_info "Building staging code for production deployment..."
npm ci
npm run build:cf

# Step 6: Deploy to production
log_info "Deploying to production worker (${PRODUCTION_NAME})..."
npx wrangler deploy

log_info ""
log_info "=== Swap Complete ==="
log_info "Staging has been promoted to production."
log_info "Backup SHA saved to: ${BACKUP_DIR}/production_${TIMESTAMP}.sha"
log_info ""
log_info "To rollback: ./scripts/staging-swap.sh --rollback"
log_info "To update staging: git checkout staging && git merge main"
