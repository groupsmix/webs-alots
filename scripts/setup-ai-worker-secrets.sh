#!/usr/bin/env bash
#
# setup-ai-worker-secrets.sh — guided setup of runtime secrets for the
# SEPARATE AI Worker (webs-alots-ai / webs-alots-ai-staging).
#
# The AI Worker lives in workers/ai/ and is deployed by deploy.yml, but its
# secrets are NOT pushed by CI — they must be set on the Worker via wrangler
# (see workers/ai/README.md and the Env interface in
# workers/ai/src/lib/supabase.ts).
#
# Required for the CopilotKit endpoint to work:
#   - NEXT_PUBLIC_SUPABASE_URL     (public value, read at runtime by the worker)
#   - NEXT_PUBLIC_SUPABASE_ANON_KEY(public value)
#   - At least ONE AI provider config:
#       * OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_MODEL) for any
#         OpenAI-compatible endpoint, OR
#       * ANTHROPIC_API_KEY for the Anthropic adapter.
#
# Prerequisites: `wrangler login` (or CLOUDFLARE_API_TOKEN exported) and
# `npm install` inside workers/ai.
#
# Usage:
#   bash scripts/setup-ai-worker-secrets.sh staging
#   bash scripts/setup-ai-worker-secrets.sh production
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_DIR="$ROOT_DIR/workers/ai"

info() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail() {
  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

ENV_NAME="${1:-}"
case "$ENV_NAME" in
staging | production) ;;
*) fail "Usage: bash scripts/setup-ai-worker-secrets.sh <staging|production>" ;;
esac

[ -d "$AI_DIR" ] || fail "workers/ai not found at $AI_DIR"
cd "$AI_DIR"

WRANGLER="npx --no-install wrangler"
$WRANGLER --version >/dev/null 2>&1 || WRANGLER="npx wrangler"

info "AI Worker target environment: $ENV_NAME (cwd: workers/ai)"
warn "This sets secrets on the LIVE AI Worker. Make sure you ran 'wrangler login'."
printf 'Continue? [y/N] '
read -r CONFIRM
[ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || {
  echo "Aborted."
  exit 0
}

put_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | $WRANGLER secret put "$name" --env "$ENV_NAME" >/dev/null
  ok "set $name"
}

setup_pasted() {
  local name="$1" hint="$2"
  printf 'Paste %s (%s), or press Enter to skip: ' "$name" "$hint"
  read -rs value
  echo
  if [ -z "$value" ]; then
    warn "skipped $name"
    return
  fi
  put_secret "$name" "$value"
}

echo
info "=== Required: Supabase auth (super_admin validation) ==="
setup_pasted NEXT_PUBLIC_SUPABASE_URL "Supabase → Settings → API → Project URL (public value)"
setup_pasted NEXT_PUBLIC_SUPABASE_ANON_KEY "Supabase → Settings → API → anon key (public value)"

echo
info "=== AI provider — set at least ONE (press Enter to skip) ==="
setup_pasted OPENAI_API_KEY "OpenAI or any OpenAI-compatible endpoint"
setup_pasted OPENAI_BASE_URL "OPTIONAL: base URL for a non-OpenAI compatible host"
setup_pasted OPENAI_MODEL "OPTIONAL: model id for the OpenAI-compatible provider"
setup_pasted ANTHROPIC_API_KEY "alternative to OPENAI_API_KEY (Anthropic / Claude)"

echo
ok "Done. Review what is set with:  (cd workers/ai && $WRANGLER secret list --env $ENV_NAME)"
warn "Set at least one AI provider (OPENAI_API_KEY or ANTHROPIC_API_KEY) or the CopilotKit endpoint will return 500."
