# Cloudflare R2 EU Jurisdiction Configuration

**Audit finding:** A71-F1 (🔴 CRITICAL) — R2 PHI bucket had no geographic constraint.

## Problem

Cloudflare R2 with "Auto" placement stores objects in whichever region is closest to the
upload origin. For PHI files, this could place encrypted patient data outside the EU/EEA,
conflicting with Law 09-08 data residency expectations and CNDP authorization requirements.

## Solution

R2 offers a **jurisdiction** parameter that constrains object storage to a specific
regulatory zone. The `eu` jurisdiction ensures data stays within the EU/EEA.

## Implementation

### Bucket Creation (operator action required)

Create or re-create the PHI bucket with the EU jurisdiction flag:

```bash
# Using wrangler CLI
wrangler r2 bucket create oltigo-phi-files --jurisdiction eu

# Verify
wrangler r2 bucket list | grep oltigo-phi-files
```

The Cloudflare dashboard equivalent: R2 → Create bucket → Location → Jurisdiction: European Union.

### API Calls

When creating objects via the R2 Workers binding, no code change is needed — the
jurisdiction is enforced at the bucket level, not per-object.

When calling the Cloudflare API directly (e.g. scripts/backup.sh), use:

```
PUT /client/v4/accounts/{account_id}/r2/buckets/{bucket_name}
Headers:
  cf-r2-jurisdiction: eu
```

### Verification

```bash
# Check bucket jurisdiction
curl -s "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/oltigo-phi-files" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'].get('jurisdiction','none'))"
# Expected output: eu
```

Add this check to `scripts/pre-deploy-check.sh`:

```bash
BUCKET_JURISDICTION=$(curl -sf "..." | python3 -c "...")
if [[ "$BUCKET_JURISDICTION" != "eu" ]]; then
  echo "ERROR: PHI bucket jurisdiction is not EU — abort deployment"
  exit 1
fi
```

## Data Migration

If the existing bucket was created without the EU jurisdiction, existing objects cannot
be migrated by jurisdiction change alone — they must be:

1. Copied to a new EU-jurisdiction bucket (using `rclone` or `aws s3 sync`)
2. Verified (object count + spot-check decryption)
3. Old bucket removed after confirmation

Estimated effort: 2-4 hours depending on data volume. Coordinate with DPO before migration.

## References

- [Cloudflare R2 Jurisdictions](https://developers.cloudflare.com/r2/reference/data-location/#jurisdictional-restrictions)
- Law 09-08, Article 43-44 (cross-border transfers)
- `docs/data-residency.md` — updated to reflect EU jurisdiction
- `r2-lifecycle.json` — lifecycle rules (separate from jurisdiction config)
