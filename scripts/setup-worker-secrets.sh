#!/usr/bin/env bash
#
# setup-worker-secrets.sh — guided setup of Cloudflare Worker RUNTIME secrets
# for the MAIN Worker (webs-alots / webs-alots-staging).
#
# These are the secrets that GitHub Actions does NOT inject at deploy time and
# that must already exist on the Worker (see docs/deployment.md and
# docs/production-env-matrix.md). This script:
#
#   - auto-generates the HMAC / encryption secrets (openssl rand -hex 32),
#   - prompts you to paste the externally-sourced ones (Supabase, Stripe, …),
#   - lets you skip any optional secret,
#   - never echoes secret values to the screen or shell history.
#
# Prerequisites: `wrangler login` (or CLOUDFLARE_API_TOKEN exported) and
# `npm install` so npx can find wrangler.
#
# Usage:
#   bash scripts/setup-worker-secrets.sh staging
#   bash scripts/setup-worker-secrets.sh production
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
*) fail "Usage: bash scripts/setup-worker-secrets.sh <staging|production>" ;;
esac

command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate secrets."

WRANGLER="npx --no-install wrangler"
$WRANGLER --version >/dev/null 2>&1 || WRANGLER="npx wrangler"

info "Target environment: $ENV_NAME"
warn "This sets secrets on the LIVE Cloudflare Worker. Make sure you ran 'wrangler login'."
printf 'Continue? [y/N] '
read -r CONFIRM
[ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || {
  echo "Aborted."
  exit 0
}

# put_secret NAME VALUE — pipes the value into wrangler (no shell-history leak)
put_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | $WRANGLER secret put "$name" --env "$ENV_NAME" >/dev/null
  ok "set $name"
}

# generated secret: auto-create unless one is being rotated deliberately
setup_generated() {
  local name="$1"
  printf 'Generate a new random %s? [Y/n] ' "$name"
  read -r ans
  if [ "$ans" = "n" ] || [ "$ans" = "N" ]; then
    warn "skipped $name (keeping any existing value)"
    return
  fi
  put_secret "$name" "$(openssl rand -hex 32)"
}

# pasted secret: prompt silently; empty input = skip
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
info "=== Required secrets (auto-generated HMAC / encryption keys) ==="
for s in BOOKING_TOKEN_SECRET PROFILE_HEADER_HMAC_KEY CRON_SECRET PHI_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY R2_SIGNED_URL_SECRET; do
  setup_generated "$s"
done

echo
info "=== Required secrets (paste from Supabase dashboard) ==="
setup_pasted SUPABASE_SERVICE_ROLE_KEY "Supabase → Settings → API → service_role key"
setup_pasted SUPABASE_POOLER_URL "Supabase → Settings → Database → Connection Pooling (transaction mode, port 6543)"

echo
info "=== Optional secrets (press Enter to skip any you don't use yet) ==="
setup_pasted OPENAI_API_KEY "OpenAI platform → API keys"
setup_pasted RESEND_API_KEY "Resend → API Keys (transactional email)"
setup_pasted STRIPE_SECRET_KEY "Stripe → API keys"
setup_pasted STRIPE_WEBHOOK_SECRET "Stripe → Webhooks signing secret"
setup_pasted CMI_SECRET_KEY "CMI merchant portal (Morocco payments)"
setup_pasted META_APP_SECRET "Meta Business → app secret (WhatsApp webhook HMAC)"
setup_pasted WHATSAPP_VERIFY_TOKEN "manual value used for WhatsApp webhook subscription"
setup_pasted TURNSTILE_SECRET_KEY "Cloudflare dashboard → Turnstile"
setup_pasted SENTRY_DSN "Sentry → Project Settings (runtime worker DSN)"

echo
ok "Done. Review what is set with:  $WRANGLER secret list --env $ENV_NAME"
echo
warn "Reminders:"
echo "  • PHI_ENCRYPTION_KEY rotation re-encrypts PHI files — see docs/SOP-PHI-KEY-ROTATION.md."
echo "  • In production you must also set SEED_PASSWORDS_ROTATED=true (env var in wrangler.toml or dashboard)."
echo "  • The AI Worker (workers/ai) has its OWN secrets (e.g. GROQ_API_KEY, ANTHROPIC_API_KEY):"
echo "      cd workers/ai && npx wrangler secret put GROQ_API_KEY --env $ENV_NAME"
echo "  • Public NEXT_PUBLIC_* values are injected at build time by GitHub Actions, not set here."
echo "  • Full reference: docs/production-env-matrix.md"
