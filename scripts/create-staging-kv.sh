#!/usr/bin/env bash
# Creates a dedicated staging KV namespace for RATE_LIMIT_KV and prints the IDs
# to paste into wrangler.toml.
#
# Resolves A-09 / A31-A60 Top Finding #1 (CRIT): until this is run, staging
# shares the production KV namespace ID and a staging k6 load test would
# burn through production rate-limit token buckets, 429-ing real users.
#
# Pre-requisites:
#   * wrangler installed and authenticated (`wrangler whoami` works)
#   * permission to create KV namespaces on the target Cloudflare account
#
# After running, copy the printed `id` and `preview_id` values into
# wrangler.toml under [[env.staging.kv_namespaces]], replacing the
# REPLACE_BEFORE_STAGING_DEPLOY_* placeholders.

set -euo pipefail

WRANGLER="${WRANGLER:-wrangler}"

if ! command -v "$WRANGLER" >/dev/null 2>&1; then
  echo "error: '$WRANGLER' not found. Install with 'npm i -g wrangler' or set WRANGLER=." >&2
  exit 1
fi

echo "Creating staging RATE_LIMIT_KV namespace..."
LIVE_JSON=$("$WRANGLER" kv:namespace create RATE_LIMIT_KV_STAGING --json 2>/dev/null) || {
  echo "Falling back to non-JSON output (older wrangler)." >&2
  LIVE_JSON=$("$WRANGLER" kv:namespace create RATE_LIMIT_KV_STAGING 2>&1)
}
echo "$LIVE_JSON"

echo "Creating staging RATE_LIMIT_KV preview namespace..."
PREVIEW_JSON=$("$WRANGLER" kv:namespace create RATE_LIMIT_KV_STAGING --preview --json 2>/dev/null) || {
  PREVIEW_JSON=$("$WRANGLER" kv:namespace create RATE_LIMIT_KV_STAGING --preview 2>&1)
}
echo "$PREVIEW_JSON"

cat <<'EOF'

──────────────────────────────────────────────────────────────────────
NEXT STEPS
──────────────────────────────────────────────────────────────────────
1. Open wrangler.toml and find:

       [[env.staging.kv_namespaces]]
       binding = "RATE_LIMIT_KV"
       id = "REPLACE_BEFORE_STAGING_DEPLOY_RUN_CREATE_STAGING_KV"
       preview_id = "REPLACE_BEFORE_STAGING_DEPLOY_RUN_CREATE_STAGING_KV"

2. Replace the placeholders with the IDs printed above.
3. Run:

       bun run scripts/check-kv-namespace-collision.mjs

   to confirm prod and staging IDs differ.
4. Commit and merge. Staging deploys will succeed again.
──────────────────────────────────────────────────────────────────────
EOF
