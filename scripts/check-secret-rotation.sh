#!/usr/bin/env bash
# M-01: Secret rotation reminder script.
#
# Reads docs/secret-rotation-log.md and prints which secrets are overdue
# for rotation based on their cadence. Run via cron or CI schedule.
#
# Usage:
#   ./scripts/check-secret-rotation.sh
#
# Exit codes:
#   0 — all secrets within rotation window
#   1 — one or more secrets overdue

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$REPO_ROOT/docs/secret-rotation-log.md"

# Rotation cadences in days
declare -A CADENCE=(
  [BOOKING_TOKEN_SECRET]=90
  [R2_SIGNED_URL_SECRET]=90
  [PROFILE_HEADER_HMAC_KEY]=90
  [CRON_SECRET]=90
  [PHI_ENCRYPTION_KEY]=365
  [STRIPE_SECRET_KEY]=365
  [STRIPE_WEBHOOK_SECRET]=365
  [CMI_SECRET_KEY]=365
  [META_APP_SECRET]=365
  [WHATSAPP_VERIFY_TOKEN]=365
  [RESEND_API_KEY]=365
  [OPENAI_API_KEY]=365
  [CLOUDFLARE_AI_API_TOKEN]=365
  [R2_ACCESS_KEY_ID]=365
  [R2_SECRET_ACCESS_KEY]=365
)

if [ ! -f "$LOG_FILE" ]; then
  echo "ERROR: Rotation log not found at $LOG_FILE"
  echo "Create the file with rotation dates. See docs/secret-rotation-sop.md"
  exit 1
fi

TODAY=$(date +%s)
OVERDUE=0

echo "=== Secret Rotation Status ==="
echo ""

for SECRET in "${!CADENCE[@]}"; do
  MAX_AGE_DAYS=${CADENCE[$SECRET]}

  # Find the most recent rotation date for this secret in the log
  LAST_DATE=$(grep -i "$SECRET" "$LOG_FILE" 2>/dev/null | \
    grep -oP '\d{4}-\d{2}-\d{2}' | \
    sort -r | head -1 || true)

  if [ -z "$LAST_DATE" ]; then
    echo "  UNKNOWN  $SECRET — no rotation date found in log"
    OVERDUE=$((OVERDUE + 1))
    continue
  fi

  LAST_TS=$(date -d "$LAST_DATE" +%s 2>/dev/null || date -jf "%Y-%m-%d" "$LAST_DATE" +%s 2>/dev/null || echo 0)
  if [ "$LAST_TS" -eq 0 ]; then
    echo "  UNKNOWN  $SECRET — could not parse date: $LAST_DATE"
    OVERDUE=$((OVERDUE + 1))
    continue
  fi

  AGE_DAYS=$(( (TODAY - LAST_TS) / 86400 ))
  REMAINING=$((MAX_AGE_DAYS - AGE_DAYS))

  if [ "$REMAINING" -le 0 ]; then
    echo "  OVERDUE  $SECRET — last rotated $LAST_DATE ($AGE_DAYS days ago, max $MAX_AGE_DAYS)"
    OVERDUE=$((OVERDUE + 1))
  elif [ "$REMAINING" -le 14 ]; then
    echo "  WARNING  $SECRET — due in $REMAINING days (last: $LAST_DATE)"
  else
    echo "  OK       $SECRET — $REMAINING days remaining (last: $LAST_DATE)"
  fi
done

echo ""
if [ "$OVERDUE" -gt 0 ]; then
  echo "RESULT: $OVERDUE secret(s) overdue or unknown. See docs/secret-rotation-sop.md"
  exit 1
else
  echo "RESULT: All secrets within rotation window."
  exit 0
fi
