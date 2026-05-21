#!/usr/bin/env bash
# ============================================================
# Oltigo Platform — One-Click Disaster Recovery
# ============================================================
#
# Rebuilds the entire platform from scratch using a single command.
#
# Prerequisites:
#   1. Copy secrets-template.env → .env and fill in your secrets
#   2. Node.js 22+ installed
#   3. Supabase CLI installed (npx supabase)
#   4. Wrangler CLI installed (npx wrangler)
#   5. AWS CLI installed (for R2 backup restore)
#
# Usage:
#   ./scripts/recover.sh              # Full recovery
#   ./scripts/recover.sh --skip-db    # Skip database push (schema already up)
#   ./scripts/recover.sh --skip-seed  # Skip seed data
#   ./scripts/recover.sh --restore    # Restore DB from latest R2 backup
#   ./scripts/recover.sh --dry-run    # Validate secrets only, don't execute
#
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}══════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════════${NC}"; }

SKIP_DB=false
SKIP_SEED=false
RESTORE_DB=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-db)    SKIP_DB=true ;;
    --skip-seed)  SKIP_SEED=true ;;
    --restore)    RESTORE_DB=true ;;
    --dry-run)    DRY_RUN=true ;;
    --help|-h)
      echo "Usage: ./scripts/recover.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-db     Skip database schema push"
      echo "  --skip-seed   Skip seed data insertion"
      echo "  --restore     Restore database from latest R2 backup"
      echo "  --dry-run     Validate secrets only, don't execute"
      echo "  --help        Show this help message"
      exit 0
      ;;
    *) log_error "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── Step 1: Load and validate secrets ────────────────────────

log_step "Step 1/8: Validating secrets..."

if [[ ! -f ".env" ]]; then
  log_error ".env file not found!"
  log_error "Copy secrets-template.env to .env and fill in your values:"
  log_error "  cp secrets-template.env .env"
  exit 1
fi

# shellcheck disable=SC1091
source .env

REQUIRED_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_PROJECT_REF
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  NEXT_PUBLIC_SITE_URL
)

RECOMMENDED_VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  WHATSAPP_ACCESS_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  META_APP_SECRET
  RESEND_API_KEY
  PHI_ENCRYPTION_KEY
  CRON_SECRET
  BOOKING_TOKEN_SECRET
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
)

MISSING_REQUIRED=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Missing REQUIRED secret: ${VAR}"
    MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
  else
    log_info "  ${VAR} ✓"
  fi
done

if [[ ${MISSING_REQUIRED} -gt 0 ]]; then
  log_error "${MISSING_REQUIRED} required secret(s) missing. Cannot continue."
  exit 1
fi

MISSING_RECOMMENDED=0
for VAR in "${RECOMMENDED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    log_warn "  Missing optional secret: ${VAR} (some features will be disabled)"
    MISSING_RECOMMENDED=$((MISSING_RECOMMENDED + 1))
  else
    log_info "  ${VAR} ✓"
  fi
done

if [[ ${MISSING_RECOMMENDED} -gt 0 ]]; then
  log_warn "${MISSING_RECOMMENDED} optional secret(s) missing — non-critical features may be unavailable."
fi

log_info "All required secrets validated."

if [[ "${DRY_RUN}" == "true" ]]; then
  log_info "Dry run complete. All required secrets are present."
  exit 0
fi

# ── Step 2: Install dependencies ─────────────────────────────

log_step "Step 2/8: Installing dependencies..."

npm ci

log_info "Dependencies installed."

# ── Step 3: Database ─────────────────────────────────────────

if [[ "${RESTORE_DB}" == "true" ]]; then
  log_step "Step 3/8: Restoring database from latest R2 backup..."

  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    log_error "SUPABASE_DB_URL is required for database restore."
    exit 1
  fi

  if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_BACKUP_BUCKET:-}" ]]; then
    log_error "R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET) are required for restore."
    exit 1
  fi

  R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
  export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
  export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
  export AWS_DEFAULT_REGION="auto"

  # Find the latest backup
  LATEST=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/daily/" \
    --endpoint-url "${R2_ENDPOINT}" 2>/dev/null \
    | sort -r | head -1 | awk '{print $4}')

  if [[ -z "${LATEST}" ]]; then
    log_error "No backups found in R2 bucket."
    exit 1
  fi

  log_info "Found latest backup: ${LATEST}"
  RESTORE_FILE="/tmp/restore_${LATEST}"

  aws s3 cp "s3://${R2_BACKUP_BUCKET}/backups/daily/${LATEST}" \
    "${RESTORE_FILE}" --endpoint-url "${R2_ENDPOINT}"

  # Check if backup is encrypted
  if [[ "${LATEST}" == *.enc ]]; then
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
      log_error "Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set."
      rm -f "${RESTORE_FILE}"
      exit 1
    fi
    log_info "Decrypting backup..."
    DECRYPTED_FILE="${RESTORE_FILE%.enc}"
    openssl enc -aes-256-cbc -d -pbkdf2 \
      -in "${RESTORE_FILE}" \
      -out "${DECRYPTED_FILE}" \
      -pass "env:BACKUP_ENCRYPTION_KEY"
    rm -f "${RESTORE_FILE}"
    RESTORE_FILE="${DECRYPTED_FILE}"
  fi

  log_info "Restoring database (this may take a few minutes)..."
  gunzip -c "${RESTORE_FILE}" | psql "${SUPABASE_DB_URL}"

  rm -f "${RESTORE_FILE}"
  log_info "Database restored from backup."

elif [[ "${SKIP_DB}" == "true" ]]; then
  log_step "Step 3/8: Skipping database push (--skip-db)"

else
  log_step "Step 3/8: Pushing database schema..."

  npx supabase db push --project-ref "${SUPABASE_PROJECT_REF}"

  log_info "Database schema pushed."
fi

# ── Step 4: Seed data ────────────────────────────────────────

if [[ "${SKIP_SEED}" == "true" || "${RESTORE_DB}" == "true" ]]; then
  log_step "Step 4/8: Skipping seed data"
else
  log_step "Step 4/8: Seeding initial data..."

  if [[ -f "supabase/seed.sql" ]]; then
    if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
      psql "${SUPABASE_DB_URL}" -f supabase/seed.sql
    else
      log_warn "SUPABASE_DB_URL not set — skipping seed. Run manually with:"
      log_warn "  psql \$SUPABASE_DB_URL -f supabase/seed.sql"
    fi
  elif [[ -f "scripts/seed-data.sql" ]]; then
    if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
      psql "${SUPABASE_DB_URL}" -f scripts/seed-data.sql
    else
      log_warn "SUPABASE_DB_URL not set — skipping seed."
    fi
  else
    log_warn "No seed file found — skipping."
  fi

  log_info "Seed data complete."
fi

# ── Step 5: Deploy Cloudflare Workers ────────────────────────

log_step "Step 5/8: Deploying Cloudflare Workers..."

npm run build:cf
npx wrangler deploy --config wrangler.toml

log_info "Workers deployed."

# ── Step 6: Set worker secrets ───────────────────────────────

log_step "Step 6/8: Setting Cloudflare Worker secrets..."

# Map of env var names to Wrangler secret names
declare -A WORKER_SECRETS=(
  [SUPABASE_SERVICE_ROLE_KEY]="SUPABASE_SERVICE_ROLE_KEY"
  [CRON_SECRET]="CRON_SECRET"
  [BOOKING_TOKEN_SECRET]="BOOKING_TOKEN_SECRET"
  [PHI_ENCRYPTION_KEY]="PHI_ENCRYPTION_KEY"
  [STRIPE_SECRET_KEY]="STRIPE_SECRET_KEY"
  [STRIPE_WEBHOOK_SECRET]="STRIPE_WEBHOOK_SECRET"
  [CMI_MERCHANT_ID]="CMI_MERCHANT_ID"
  [CMI_SECRET_KEY]="CMI_SECRET_KEY"
  [WHATSAPP_ACCESS_TOKEN]="WHATSAPP_ACCESS_TOKEN"
  [META_APP_SECRET]="META_APP_SECRET"
  [RESEND_API_KEY]="RESEND_API_KEY"
  [OPENAI_API_KEY]="OPENAI_API_KEY"
  [CLOUDFLARE_AI_API_TOKEN]="CLOUDFLARE_AI_API_TOKEN"
  [R2_ACCESS_KEY_ID]="R2_ACCESS_KEY_ID"
  [R2_SECRET_ACCESS_KEY]="R2_SECRET_ACCESS_KEY"
)

SECRETS_SET=0
for ENV_VAR in "${!WORKER_SECRETS[@]}"; do
  WRANGLER_NAME="${WORKER_SECRETS[$ENV_VAR]}"
  if [[ -n "${!ENV_VAR:-}" ]]; then
    echo "${!ENV_VAR}" | npx wrangler secret put "${WRANGLER_NAME}" 2>/dev/null && \
      log_info "  Set ${WRANGLER_NAME}" || \
      log_warn "  Failed to set ${WRANGLER_NAME} (may already exist)"
    SECRETS_SET=$((SECRETS_SET + 1))
  fi
done

log_info "${SECRETS_SET} worker secrets configured."

# ── Step 7: Build and deploy main app ────────────────────────

log_step "Step 7/8: Building application..."

# The build was already done in Step 5 (build:cf builds the OpenNext bundle).
# If a separate Cloudflare Pages deployment is needed, it uses the same assets.
log_info "Application built and deployed in Step 5."

# ── Step 8: Verify ───────────────────────────────────────────

log_step "Step 8/8: Verifying deployment..."

APP_URL="${APP_URL:-${NEXT_PUBLIC_SITE_URL}}"

HEALTH_URL="${APP_URL}/api/health"
log_info "Checking health endpoint: ${HEALTH_URL}"

# Retry health check up to 5 times with 10-second intervals
RETRIES=5
for i in $(seq 1 ${RETRIES}); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_info "Health check PASSED (HTTP ${HTTP_CODE})"
    break
  fi
  if [[ $i -eq ${RETRIES} ]]; then
    log_error "Health check FAILED after ${RETRIES} attempts (HTTP ${HTTP_CODE})"
    log_error "The app may still be starting up. Check manually: curl ${HEALTH_URL}"
  else
    log_warn "Health check attempt ${i}/${RETRIES} returned HTTP ${HTTP_CODE}. Retrying in 10s..."
    sleep 10
  fi
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         RECOVERY COMPLETE                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  App URL:  ${APP_URL}${NC}"
echo -e "${GREEN}║  Health:   ${HEALTH_URL}${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Post-recovery checklist:                        ║${NC}"
echo -e "${GREEN}║  □ Verify login for each role                    ║${NC}"
echo -e "${GREEN}║  □ Test subdomain routing (clinic.oltigo.com)    ║${NC}"
echo -e "${GREEN}║  □ Verify RLS tenant isolation                   ║${NC}"
echo -e "${GREEN}║  □ Check WhatsApp webhook connectivity           ║${NC}"
echo -e "${GREEN}║  □ Test payment flow (Stripe / CMI)              ║${NC}"
echo -e "${GREEN}║  □ Verify file uploads (R2)                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
