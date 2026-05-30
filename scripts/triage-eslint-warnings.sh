#!/usr/bin/env bash
# ============================================================
# triage-eslint-warnings.sh
# ------------------------------------------------------------
# Produces a per-rule breakdown of ESLint warnings so the
# 4,045-warning baseline (FR-01 in the cleanup audit) can be
# attacked rule by rule instead of file by file.
#
# Usage:
#   ./scripts/triage-eslint-warnings.sh           # console table
#   ./scripts/triage-eslint-warnings.sh --json    # raw JSON
#   ./scripts/triage-eslint-warnings.sh --md      # markdown table
#   ./scripts/triage-eslint-warnings.sh --top 10  # top-N only
#
# Requires: node, npm, jq
# ============================================================
set -euo pipefail

FORMAT="table"
TOP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) FORMAT="json"; shift ;;
    --md)   FORMAT="md";   shift ;;
    --top)  TOP="$2";      shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v jq  >/dev/null 2>&1 || { echo "jq is required"  >&2; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx is required" >&2; exit 1; }

TMP="$(mktemp -t eslint-triage-XXXXXX.json)"
trap 'rm -f "$TMP"' EXIT

echo "→ Running ESLint with JSON formatter (this may take a minute)..." >&2
# `|| true` keeps the pipe alive even when ESLint exits non-zero (warnings present).
npx --no-install eslint . --format json > "$TMP" || true

if [[ ! -s "$TMP" ]]; then
  echo "ESLint produced no output. Is ESLint installed? Try: npm install" >&2
  exit 1
fi

# Build a {rule, count, severity} array, sorted by descending count.
BREAKDOWN_FILTER='
  [ .[] | .messages[] | {rule: (.ruleId // "<no-rule>"), severity: .severity} ]
  | group_by(.rule)
  | map({
      rule:     .[0].rule,
      severity: (if .[0].severity == 2 then "error" else "warn" end),
      count:    length
    })
  | sort_by(-.count)
'

BREAKDOWN="$(jq "$BREAKDOWN_FILTER" "$TMP")"

if [[ -n "$TOP" ]]; then
  BREAKDOWN="$(echo "$BREAKDOWN" | jq ".[0:${TOP}]")"
fi

TOTAL_WARN="$(jq '[.[] | .messages[] | select(.severity == 1)] | length' "$TMP")"
TOTAL_ERR="$(jq  '[.[] | .messages[] | select(.severity == 2)] | length' "$TMP")"

case "$FORMAT" in
  json)
    echo "$BREAKDOWN"
    ;;
  md)
    printf '## ESLint triage\n\nTotal: **%s** warnings, **%s** errors.\n\n' "$TOTAL_WARN" "$TOTAL_ERR"
    printf '| Rule | Severity | Count |\n|---|---|---:|\n'
    echo "$BREAKDOWN" \
      | jq -r '.[] | "| `\(.rule)` | \(.severity) | \(.count) |"'
    ;;
  table|*)
    printf '\nESLint triage — total: %s warnings, %s errors\n\n' "$TOTAL_WARN" "$TOTAL_ERR"
    printf '%-60s  %-8s  %6s\n' "RULE" "SEVERITY" "COUNT"
    printf '%-60s  %-8s  %6s\n' "----" "--------" "-----"
    echo "$BREAKDOWN" \
      | jq -r '.[] | "\(.rule)\t\(.severity)\t\(.count)"' \
      | awk -F'\t' '{ printf "%-60s  %-8s  %6d\n", $1, $2, $3 }'
    ;;
esac
