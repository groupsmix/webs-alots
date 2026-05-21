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
if grep -E '^id ?= ?"(PLACEHOLDER|0+|2d3e4f5a|8f9e0d1c)' wrangler.toml; then
  echo "::error::Suspicious KV namespace ID detected in wrangler.toml"
  exit 1
fi

# F-01: Assert all KV namespace IDs are valid 32-char hex strings
python3 -c "
import re, sys
lines = open('wrangler.toml').read()
# Find all id and preview_id values in kv_namespaces blocks
ids = re.findall(r'(?:^|\n)\s*(?:preview_)?id\s*=\s*\"([^\"]+)\"', lines)
hex_re = re.compile(r'^[0-9a-f]{32}$')
errors = []
for val in ids:
    # Skip non-KV IDs (e.g. R2 bucket names, worker names)
    if not val.replace('-', '').replace('_', '').isalnum():
        continue
    if len(val) == 32 and not hex_re.match(val):
        errors.append(val)
if errors:
    for val in errors:
        print(f'::error::KV namespace ID is not valid hex: \"{val}\". Only 0-9a-f allowed.')
    sys.exit(1)
"

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

# F-02: Assert SEED_PASSWORDS_ROTATED is NOT committed in wrangler.toml
if grep -q 'SEED_PASSWORDS_ROTATED' wrangler.toml; then
  echo "::error::SEED_PASSWORDS_ROTATED must not be committed in wrangler.toml. Use 'wrangler secret put' per environment instead."
  exit 1
fi

# F-12: Assert staging deploys have their own Supabase URL
if [ "${GITHUB_REF_NAME:-}" = "staging" ]; then
  if [ -z "${STAGING_SUPABASE_URL:-}" ]; then
    echo "::error::Staging deploy requires STAGING_SUPABASE_URL secret. Cannot fall back to production Supabase."
    exit 1
  fi
fi

# F-22: Ensure cacheTag() calls in data/public.ts include ${clinicId}
if grep -n 'cacheTag(' src/lib/data/public.ts 2>/dev/null | grep -v 'clinicId' | grep -v '^\s*//' > /dev/null 2>&1; then
  echo "::error::Found cacheTag() call in data/public.ts without clinicId — tenant-scoped cache tags are required."
  exit 1
fi

echo "Configuration check passed."
