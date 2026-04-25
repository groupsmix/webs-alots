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

# Detect suspicious KV namespace IDs (sequential nibble patterns that look like fakes)
if grep -E '^id ?= ?"(0+|2d3e4f5a|8f9e0d1c)' wrangler.toml; then
  echo "::error::Suspicious KV namespace ID detected in wrangler.toml"
  exit 1
fi

# Detect preview_id == id (preview writing to production KV)
python3 -c "
import re, sys
lines = open('wrangler.toml').read()
# Find all kv_namespaces blocks and check id vs preview_id
ids = re.findall(r'id\s*=\s*\"([^\"]+)\"', lines)
preview_ids = re.findall(r'preview_id\s*=\s*\"([^\"]+)\"', lines)
for i, (kid, pid) in enumerate(zip(ids, preview_ids)):
    if kid == pid and 'PLACEHOLDER' not in pid:
        print(f'::error::KV namespace #{i+1}: preview_id matches production id ({kid}). Create a separate preview namespace.')
        sys.exit(1)
"

echo "Configuration check passed."
