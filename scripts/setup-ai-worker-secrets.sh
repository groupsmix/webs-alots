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
# Required for the AI Builder to work:
#   - GROQ_API_KEY                 (builder runs on Groq Llama 3.3 70B; free tier)
#   - NEXT_PUBLIC_SUPABASE_URL     (public value, read at runtime by the worker)
#   - NEXT_PUBLIC_SUPABASE_ANON_KEY(public value)
# Optional extra model providers / sandbox:
#   - ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY,
#     DEEPSEEK_API_KEY, MISTRAL_API_KEY, XAI_API_KEY, E2B_API_KEY
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
info "=== Required for the AI Builder ==="
setup_pasted GROQ_API_KEY "free key from https://console.groq.com"
setup_pasted NEXT_PUBLIC_SUPABASE_URL "Supabase → Settings → API → Project URL (public value)"
setup_pasted NEXT_PUBLIC_SUPABASE_ANON_KEY "Supabase → Settings → API → anon key (public value)"

echo
info "=== Optional model providers / sandbox (press Enter to skip) ==="
setup_pasted ANTHROPIC_API_KEY "Anthropic console (Claude)"
setup_pasted GOOGLE_GENERATIVE_AI_API_KEY "Google AI Studio (Gemini)"
setup_pasted OPENAI_API_KEY "OpenAI platform"
setup_pasted DEEPSEEK_API_KEY "DeepSeek platform"
setup_pasted MISTRAL_API_KEY "Mistral platform"
setup_pasted XAI_API_KEY "xAI platform (Grok)"
setup_pasted E2B_API_KEY "E2B (server-side code sandbox; optional)"

echo
ok "Done. Review what is set with:  (cd workers/ai && $WRANGLER secret list --env $ENV_NAME)"
warn "Only providers you have ACTIVATED in /admin/ai-config will appear in the builder model picker."
