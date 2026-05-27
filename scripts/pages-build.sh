#!/usr/bin/env bash
# =============================================================================
# Cloudflare Pages Build Script
# =============================================================================
#
# This script is the build command for the Cloudflare Pages project.
# It short-circuits non-production builds so PR preview deployments
# complete in seconds instead of ~1 hour.
#
# WHY: Cloudflare Pages free-tier builds are serial (1 concurrent build
# per project), start with a cold npm cache, and run heavy OpenNext +
# Next.js 16 compilation on resource-constrained runners. PR builds
# routinely take 45–60 minutes, blocking the "Cloudflare Pages" GitHub
# status check and stalling PR reviews.
#
# Production deploys go through deploy.yml (Cloudflare Workers via
# wrangler), not Pages. The pr-preview.yml workflow validates the
# Workers build on GitHub Actions in ~10 minutes. Pages PR builds
# are therefore redundant.
#
# SETUP (one-time, in Cloudflare Dashboard):
#   1. Go to: Cloudflare Dashboard → Pages → webs-alots → Settings →
#      Builds & deployments
#   2. Set Build command to: bash scripts/pages-build.sh
#   3. Set Build output directory to: .open-next/assets
#
# Alternatively, disable preview deployments entirely:
#   • Set "Preview deployments" → Branch control → None
#   This is the recommended approach since PR builds are fully covered
#   by pr-preview.yml on GitHub Actions.
# =============================================================================

set -euo pipefail

# CF_PAGES_BRANCH is set by Cloudflare Pages build environment.
# If it's not "main" or "staging", this is a PR preview build — skip it.
BRANCH="${CF_PAGES_BRANCH:-}"

if [ -z "$BRANCH" ]; then
  echo "Not running in Cloudflare Pages environment. Running full build."
  npm run build:cf
  exit 0
fi

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "staging" ]; then
  echo "Production/staging branch detected ($BRANCH). Running full build."
  npm run build:cf
  exit 0
fi

# PR preview branch — skip the expensive build.
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Skipping Pages build for branch: $BRANCH                  ║"
echo "║                                                            ║"
echo "║  PR builds are validated by the 'Cloudflare Workers Build' ║"
echo "║  GitHub Actions check (pr-preview.yml), which completes    ║"
echo "║  in ~10 minutes instead of ~1 hour.                        ║"
echo "║                                                            ║"
echo "║  To disable PR preview builds entirely, go to:             ║"
echo "║  Cloudflare Dashboard → Pages → Settings →                 ║"
echo "║  Builds & deployments → Preview deployments → None         ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Create a minimal build output so Pages doesn't fail on missing directory.
mkdir -p .open-next/assets
echo "<!DOCTYPE html><html><body>PR preview skipped. See GitHub Actions.</body></html>" > .open-next/assets/index.html

exit 0
