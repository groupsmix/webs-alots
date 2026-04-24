#!/usr/bin/env bash

set -e

echo "Checking for PLACEHOLDER values in configuration..."

if grep -q "PLACEHOLDER" wrangler.toml; then
  echo "::error::Found PLACEHOLDER values in wrangler.toml. Please update with actual IDs before deploying."
  exit 1
fi

if [ -f .env.production ] && grep -q "PLACEHOLDER" .env.production; then
  echo "::error::Found PLACEHOLDER values in .env.production. Please update with actual values before deploying."
  exit 1
fi

echo "Configuration check passed."
