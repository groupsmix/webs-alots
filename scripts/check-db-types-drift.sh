#!/usr/bin/env bash
# §5.1 — CI guardrail: detect DB type drift.
#
# Compares the committed database.ts against freshly generated types.
#
# Required environment:
#   SUPABASE_ACCESS_TOKEN  — Supabase access token (check is skipped if unset)
#   SUPABASE_PROJECT_ID    — Supabase project ref to generate types from
#
# Optional environment:
#   DB_TYPES_DRIFT_STRICT  — set to "true" to fail (exit 1) on drift.
#                            Defaults to warn-only (exit 0) so the check can be
#                            adopted incrementally without breaking CI.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=<token> SUPABASE_PROJECT_ID=<ref> ./scripts/check-db-types-drift.sh
set -euo pipefail

TYPES_FILE="src/lib/types/database.ts"
TMP_REGEN="/tmp/db-types-regen.ts"
trap 'rm -f "$TMP_REGEN"' EXIT

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "⚠️  SUPABASE_ACCESS_TOKEN not set — skipping DB type drift check."
  exit 0
fi

# No hardcoded fallback: the project ref must be supplied explicitly so we never
# accidentally generate types against the wrong (e.g. production) project.
PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
if [ -z "${PROJECT_ID}" ]; then
  echo "::error::SUPABASE_PROJECT_ID is required (no default). Set it to the target project ref."
  exit 1
fi

echo "Regenerating types from project ${PROJECT_ID}…"
# Surface generation errors instead of swallowing them — a silent failure here
# previously produced an empty file that looked like "drift".
if ! npx supabase gen types typescript --project-id "$PROJECT_ID" > "$TMP_REGEN"; then
  echo "::error::Failed to generate types from project ${PROJECT_ID}."
  exit 1
fi

if diff -q "$TYPES_FILE" "$TMP_REGEN" > /dev/null 2>&1; then
  echo "✅ DB types are up to date."
else
  echo "::warning::DB types have drifted from the live schema."
  echo "Run: SUPABASE_ACCESS_TOKEN=\$TOKEN npx supabase gen types typescript --project-id $PROJECT_ID > $TYPES_FILE"
  diff "$TYPES_FILE" "$TMP_REGEN" || true
  if [ "${DB_TYPES_DRIFT_STRICT:-false}" = "true" ]; then
    exit 1
  fi
  echo "(warn-only mode; set DB_TYPES_DRIFT_STRICT=true to make this blocking)"
  exit 0
fi
