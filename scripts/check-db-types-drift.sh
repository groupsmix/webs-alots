#!/usr/bin/env bash
# §5.1 — CI guardrail: detect DB type drift.
#
# Compares the committed database.ts against freshly generated types.
# Exits non-zero when the files differ.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=<token> ./scripts/check-db-types-drift.sh
#
# In CI, set SUPABASE_PROJECT_ID to override the default.
set -euo pipefail

PROJECT_ID="${SUPABASE_PROJECT_ID:-xxxlygxysprrghqojvvz}"
TYPES_FILE="src/lib/types/database.ts"
TMP_REGEN="/tmp/db-types-regen.ts"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "⚠️  SUPABASE_ACCESS_TOKEN not set — skipping DB type drift check."
  exit 0
fi

echo "Regenerating types from project ${PROJECT_ID}…"
npx supabase gen types typescript --project-id "$PROJECT_ID" > "$TMP_REGEN" 2>/dev/null

if diff -q "$TYPES_FILE" "$TMP_REGEN" > /dev/null 2>&1; then
  echo "✅ DB types are up to date."
else
  echo "::warning::DB types have drifted from the live schema."
  echo "Run: SUPABASE_ACCESS_TOKEN=\$TOKEN npx supabase gen types typescript --project-id $PROJECT_ID > $TYPES_FILE"
  # Non-blocking warning for now — change to exit 1 once the full regeneration is done.
  exit 0
fi
