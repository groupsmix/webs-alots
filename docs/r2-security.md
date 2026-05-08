# R2 Storage Security Configuration

This document describes the security hardening controls applied to Cloudflare R2 storage for the Oltigo Health platform. R2 stores Protected Health Information (PHI) under Moroccan Law 09-08 and must implement defense-in-depth security controls including versioning, object-lock, access logging, antivirus scanning, and public-access blocking.

## Overview

Oltigo Health uses Cloudflare R2 for:
- **Patient files** — Medical records, prescriptions, lab reports, radiology images (encrypted at rest)
- **Clinic assets** — Logos, templates, branding materials
- **Backups** — Database backups, configuration snapshots (WORM-protected)
- **Temporary uploads** — Direct-upload staging area (lifecycle-managed)

All PHI categories are encrypted server-side with AES-256-GCM before persisting to R2 (see `src/lib/encryption.ts` and `src/lib/r2-encrypted.ts`).

## Security Controls

### 1. Versioning

**Status**: MUST be enabled via Cloudflare dashboard or API

**Purpose**: Protects against accidental deletion and provides point-in-time recovery for PHI files.

**Configuration**:
```bash
# Enable versioning on the bucket
wrangler r2 bucket versioning enable "$R2_BUCKET_NAME"

# Verify versioning status
wrangler r2 bucket versioning get "$R2_BUCKET_NAME"
```

**Dashboard Configuration**:
1. Cloudflare dashboard → R2 → select the bucket
2. **Settings** → **Versioning** → **Enable**

**Lifecycle Integration**: Non-current versions are automatically expired after 30 days via the `expire-noncurrent-versions-30d` lifecycle rule (see `r2-lifecycle.json`). This prevents unbounded storage growth while preserving recent versions for recovery.

**Operational Notes**:
- Versioning MUST be enabled before object-lock can be configured
- Each object version is billed separately for storage
- Deleting an object in a versioned bucket creates a delete marker (not a permanent deletion)
- Use `wrangler r2 object get --version-id=...` to retrieve specific versions

### 2. Object-Lock / WORM (Write-Once-Read-Many)

**Status**: MUST be enabled on `backups/` prefix

**Purpose**: Prevents deletion or modification of backup files, protecting against ransomware and insider threats. Required for compliance with data retention policies.

**Configuration**:

Object-lock is configured at the **bucket level** and enforced via retention policies on individual objects or prefixes.

```bash
# Enable object-lock on bucket (MUST be done at bucket creation)
# Note: Object-lock cannot be enabled on existing buckets
# If the bucket already exists, create a new bucket with object-lock enabled
# and migrate data

# For new buckets:
wrangler r2 bucket create "$R2_BUCKET_NAME" --object-lock-enabled

# Set retention policy on backup objects (via API or SDK)
# Example using AWS SDK (R2 is S3-compatible):
aws s3api put-object-retention \
  --bucket "$R2_BUCKET_NAME" \
  --key "backups/db-backup-2024-01-15.sql.gz" \
  --retention Mode=COMPLIANCE,RetainUntilDate=2024-04-15T00:00:00Z \
  --endpoint-url "$R2_ENDPOINT_URL"
```

**Retention Modes**:
- **COMPLIANCE mode** (recommended for PHI backups): Cannot be overridden by any user, including account owner. Provides strongest protection.
- **GOVERNANCE mode**: Can be overridden by users with special permissions. Use for non-PHI backups.

**Backup Script Integration**:

Update `scripts/backup-database.sh` to apply object-lock retention when uploading backups:

```bash
# After uploading backup to R2, apply 90-day retention
RETAIN_UNTIL=$(date -u -d "+90 days" +"%Y-%m-%dT%H:%M:%SZ")
aws s3api put-object-retention \
  --bucket "$R2_BUCKET_NAME" \
  --key "$BACKUP_KEY" \
  --retention Mode=COMPLIANCE,RetainUntilDate="$RETAIN_UNTIL" \
  --endpoint-url "$R2_ENDPOINT_URL"
```

**Operational Notes**:
- Object-lock requires versioning to be enabled
- COMPLIANCE mode retention cannot be shortened or removed until expiry
- Legal hold can be placed on objects for indefinite retention (use for audit/litigation)
- Object-lock protects against `DeleteObject` API calls but not bucket deletion (use IAM policies to prevent bucket deletion)

### 3. Access Logging

**Status**: MUST be enabled via Cloudflare Logpush

**Purpose**: Creates audit trail of all R2 access for security monitoring, compliance, and forensic investigation.

**Configuration**:

Cloudflare R2 access logs are delivered via **Logpush** to a destination of your choice (R2 bucket, S3, HTTP endpoint, or Cloudflare Logs).

**Option A: R2 SQL Analytics (Recommended)**

Cloudflare provides built-in SQL analytics for R2 access logs:

1. Cloudflare dashboard → Analytics & Logs → R2 Analytics
2. Query access logs using SQL:
   ```sql
   SELECT
     datetime,
     bucketName,
     objectKey,
     action,
     statusCode,
     requestId,
     clientIP
   FROM r2_access_logs
   WHERE bucketName = 'webs-alots-uploads'
     AND datetime > NOW() - INTERVAL '7' DAY
   ORDER BY datetime DESC
   LIMIT 100
   ```

**Option B: Logpush to Separate R2 Bucket**

For long-term retention (7 years for PHI audit logs):

```bash
# Create a dedicated logs bucket
wrangler r2 bucket create webs-alots-r2-logs

# Create Logpush job via API
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/logpush/jobs" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r2-access-logs",
    "logpull_options": "fields=BucketName,ObjectKey,Action,StatusCode,RequestId,ClientIP,Datetime",
    "destination_conf": "r2://webs-alots-r2-logs/r2-access-logs/{DATE}",
    "dataset": "r2_requests",
    "enabled": true
  }'
```

**Option C: Logpush to HTTP Endpoint**

For real-time SIEM integration:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/logpush/jobs" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r2-access-logs-siem",
    "destination_conf": "https://siem.example.com/ingest?header_Authorization=Bearer%20SECRET",
    "dataset": "r2_requests",
    "enabled": true
  }'
```

**Log Fields**:
- `BucketName` — R2 bucket name
- `ObjectKey` — Object key (path)
- `Action` — API action (GetObject, PutObject, DeleteObject, etc.)
- `StatusCode` — HTTP status code
- `RequestId` — Unique request identifier for correlation
- `ClientIP` — Source IP address (Cloudflare edge IP, not end-user IP)
- `Datetime` — Timestamp (UTC)

**Retention Policy**:
- **Operational logs**: 30 days (sufficient for incident response)
- **Audit logs** (PHI access): 7 years (compliance requirement under Moroccan Law 09-08)

**Operational Notes**:
- Logpush jobs are billed per GB of logs delivered
- Use sampling (`sample=0.1`) for high-volume buckets to reduce costs
- Access logs do NOT contain request/response bodies (PHI is not logged)
- Correlate `RequestId` with application logs for end-to-end tracing

### 4. Antivirus Scanning

**Status**: Placeholder implemented in `src/app/api/upload/route.ts` (lines ~200-230)

**Purpose**: Prevents malicious files (malware, ransomware, trojans) from being stored in R2 and served to users.

**Current Implementation**:

The upload route includes an AV scan integration point that checks for the `AV_SCAN_URL` environment variable:

```typescript
// src/app/api/upload/route.ts (lines ~200-230)
if (process.env.AV_SCAN_URL) {
  try {
    const avResponse = await fetch(process.env.AV_SCAN_URL, {
      method: "POST",
      body: buffer,
      headers: { "Content-Type": file.type },
    });
    if (avResponse.ok) {
      const avResult = await avResponse.json() as { clean?: boolean; malware?: string };
      if (avResult.clean === false) {
        logger.warn("AV scan detected malware in upload", {
          context: "upload",
          malware: avResult.malware,
          filename: file.name,
        });
        return apiError("File failed virus scan", 400);
      }
    }
  } catch (err) {
    logger.warn("AV scan service unreachable", { context: "upload", error: err });
    if (process.env.AV_SCAN_REQUIRED === "true") {
      return apiError("Virus scan unavailable — upload rejected", 503);
    }
  }
}
```

**Future Integration Options**:

**Option A: ClamAV REST Service**

Deploy a ClamAV REST API (e.g., `clamav-rest` or `clamav-api`) as a Cloudflare Worker or external service:

```bash
# Environment variables
AV_SCAN_URL=https://clamav.example.com/scan
AV_SCAN_REQUIRED=true  # Fail closed if AV service is down
```

**Option B: AWS Lambda with ClamAV**

Use AWS Lambda with ClamAV layer for S3-compatible scanning:

```bash
AV_SCAN_URL=https://lambda-clamav.us-east-1.amazonaws.com/scan
AV_SCAN_REQUIRED=true
```

**Option C: Cloudflare Workers with WASM ClamAV**

Compile ClamAV to WebAssembly and run in-Worker (experimental):

```typescript
// Future implementation
import { scanFile } from '@cloudflare/clamav-wasm';
const result = await scanFile(buffer);
if (!result.clean) {
  return apiError("File failed virus scan", 400);
}
```

**Operational Notes**:
- AV scanning adds latency to uploads (typically 100-500ms per file)
- Set `AV_SCAN_REQUIRED=true` in production to fail closed (reject uploads if AV service is down)
- Update ClamAV virus definitions daily via cron job
- Monitor AV scan failures and false positives
- Consider async scanning for large files (accept upload, scan in background, quarantine if malicious)

### 5. Public-Access Block

**Status**: MUST be enabled via bucket policy

**Purpose**: Prevents accidental public exposure of PHI files. All R2 access must be authenticated and authorized via the application.

**Configuration**:

Cloudflare R2 does not have a native "block public access" setting like AWS S3. Instead, use IAM policies and bucket configuration:

**Step 1: Disable Public URL Access**

Do NOT configure `R2_PUBLIC_URL` for buckets containing PHI. Public URLs bypass application-level authorization.

```bash
# .env.production (PHI buckets)
R2_PUBLIC_URL=  # Leave empty or unset

# .env.production (public assets bucket, if separate)
R2_PUBLIC_ASSETS_URL=https://assets.oltigo.health
```

**Step 2: Restrict Bucket Access via API Tokens**

Create scoped R2 API tokens that only allow access from Workers:

1. Cloudflare dashboard → R2 → API Tokens → Create Token
2. **Permissions**: Read & Write (not Admin)
3. **Bucket scope**: Specific bucket only (e.g., `webs-alots-uploads`)
4. **IP restrictions**: Cloudflare Worker IP ranges only (if available)
5. **Expiry**: 90 days (enforce rotation)

**Step 3: Application-Level Authorization**

All file downloads MUST go through `/api/download` which enforces:
- Authentication (valid session)
- Authorization (user can access the file based on role and clinic_id)
- Audit logging (track who accessed what)

```typescript
// src/app/api/download/route.ts
export const GET = withAuth(async (request, { profile }) => {
  const key = searchParams.get("key");
  
  // Verify user can access this file
  const { data: file } = await supabase
    .from("patient_files")
    .select("*")
    .eq("r2_key", key)
    .eq("clinic_id", profile.clinic_id)
    .single();
  
  if (!file) return apiNotFound("File not found");
  
  // Patient can only access own files
  if (profile.role === "patient" && file.patient_id !== profile.id) {
    return apiForbidden("Access denied");
  }
  
  // Fetch from R2 and stream to client
  const object = await getR2Object(key);
  return new Response(object.body, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
});
```

**Operational Notes**:
- Never expose R2 bucket URLs directly to clients
- Use signed URLs with short expiry (5 minutes) for temporary access
- Monitor for unauthorized access attempts in R2 access logs
- Regularly audit IAM policies and API token scopes

### 6. Cross-Region Replication

**Status**: Native replication recommended (replace cron job)

**Purpose**: Provides disaster recovery and reduces Recovery Point Objective (RPO) from 6 hours (cron-based) to near-real-time.

**Current Implementation** (Cron-Based):

The platform currently uses a cron job (`scripts/r2-sync.sh`) that runs every 6 hours to replicate data between regions:

```bash
# scripts/r2-sync.sh
aws s3 sync \
  s3://"$R2_BUCKET_NAME" \
  s3://"$R2_BUCKET_NAME_REPLICA" \
  --endpoint-url "$R2_ENDPOINT_URL" \
  --endpoint-url "$R2_ENDPOINT_URL_REPLICA"
```

**Limitations**:
- **6-hour RPO**: Data loss window if primary region fails
- **Cron reliability**: Depends on Worker uptime and cron execution
- **Bandwidth costs**: Full bucket scan every 6 hours
- **Consistency**: No transactional guarantees

**Recommended Implementation** (Native Replication):

Cloudflare R2 supports **native cross-region replication** via bucket replication rules:

```bash
# Enable replication on source bucket
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/buckets/$SOURCE_BUCKET/replication" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "replicate-to-eu",
        "status": "Enabled",
        "priority": 1,
        "destination": {
          "bucket": "webs-alots-uploads-eu",
          "account": "'$ACCOUNT_ID'"
        },
        "filter": {
          "prefix": ""
        }
      }
    ]
  }'
```

**Benefits**:
- **Near-real-time RPO**: Objects replicated within seconds of upload
- **Automatic**: No cron job maintenance
- **Efficient**: Only changed objects are replicated
- **Consistent**: Replication is transactional

**Migration Plan**:

1. **Create replica bucket** in target region:
   ```bash
   wrangler r2 bucket create webs-alots-uploads-eu --jurisdiction eu
   ```

2. **Enable versioning** on both source and destination buckets (required for replication):
   ```bash
   wrangler r2 bucket versioning enable webs-alots-uploads
   wrangler r2 bucket versioning enable webs-alots-uploads-eu
   ```

3. **Configure replication rule** via API (see above)

4. **Verify replication**:
   ```bash
   # Upload test file to source bucket
   echo "test" | wrangler r2 object put webs-alots-uploads/replication-test.txt
   
   # Check if replicated to destination
   wrangler r2 object get webs-alots-uploads-eu/replication-test.txt
   ```

5. **Disable cron job** in `wrangler.toml`:
   ```toml
   # Remove or comment out:
   # [[triggers]]
   # crons = ["0 */6 * * *"]  # r2-sync.sh
   ```

6. **Monitor replication lag** via Cloudflare dashboard or API

**Operational Notes**:
- Replication is **one-way** (source → destination). Writes to destination are not replicated back.
- Replication rules can filter by prefix (e.g., only replicate `backups/`)
- Replication does NOT copy delete markers by default (configure `DeleteMarkerReplication: Enabled` if needed)
- Replication is billed as Class-A operations on destination bucket

## Compliance Mapping

| Control | Moroccan Law 09-08 | GDPR | HIPAA Equivalent |
|---------|-------------------|------|------------------|
| Versioning | Art. 25 (Data integrity) | Art. 32 (Security) | §164.312(c)(1) (Integrity) |
| Object-Lock | Art. 26 (Retention) | Art. 17 (Right to erasure limitations) | §164.316(b)(2)(i) (Retention) |
| Access Logging | Art. 27 (Audit trail) | Art. 30 (Records of processing) | §164.312(b) (Audit controls) |
| Antivirus Scanning | Art. 25 (Security measures) | Art. 32 (Security) | §164.308(a)(5)(ii)(B) (Malware protection) |
| Public-Access Block | Art. 24 (Confidentiality) | Art. 32 (Confidentiality) | §164.312(a)(1) (Access control) |
| Replication | Art. 28 (Business continuity) | Art. 32 (Availability) | §164.308(a)(7)(ii)(B) (Disaster recovery) |

## Operational Runbooks

### Recovering a Deleted File

If versioning is enabled:

```bash
# List all versions of the object
wrangler r2 object list "$R2_BUCKET_NAME" --prefix "clinics/abc-123/documents/report.pdf" --versions

# Restore a specific version
wrangler r2 object get "$R2_BUCKET_NAME/clinics/abc-123/documents/report.pdf" \
  --version-id "version-id-here" \
  --file report.pdf

# Re-upload as current version
wrangler r2 object put "$R2_BUCKET_NAME/clinics/abc-123/documents/report.pdf" \
  --file report.pdf
```

### Investigating Unauthorized Access

```sql
-- Query R2 access logs for suspicious activity
SELECT
  datetime,
  objectKey,
  action,
  statusCode,
  clientIP,
  requestId
FROM r2_access_logs
WHERE bucketName = 'webs-alots-uploads'
  AND action = 'GetObject'
  AND objectKey LIKE '%patient-123%'
  AND datetime > NOW() - INTERVAL '24' HOUR
ORDER BY datetime DESC;
```

Correlate `requestId` with application logs to identify the user:

```bash
# Search application logs for the requestId
grep "requestId-from-r2-logs" /var/log/workers/*.log
```

### Rotating R2 API Tokens

```bash
# 1. Create new token with same permissions
# (via Cloudflare dashboard or API)

# 2. Update environment variables
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY

# 3. Deploy with new secrets
npm run deploy

# 4. Verify new token works
wrangler r2 object list "$R2_BUCKET_NAME" --limit 1

# 5. Revoke old token
# (via Cloudflare dashboard or API)
```

### Testing Object-Lock

```bash
# Upload a test backup with 90-day retention
echo "test backup" > test-backup.txt
aws s3 cp test-backup.txt s3://"$R2_BUCKET_NAME"/backups/test-backup.txt \
  --endpoint-url "$R2_ENDPOINT_URL"

# Apply object-lock retention
RETAIN_UNTIL=$(date -u -d "+90 days" +"%Y-%m-%dT%H:%M:%SZ")
aws s3api put-object-retention \
  --bucket "$R2_BUCKET_NAME" \
  --key "backups/test-backup.txt" \
  --retention Mode=COMPLIANCE,RetainUntilDate="$RETAIN_UNTIL" \
  --endpoint-url "$R2_ENDPOINT_URL"

# Attempt to delete (should fail)
aws s3 rm s3://"$R2_BUCKET_NAME"/backups/test-backup.txt \
  --endpoint-url "$R2_ENDPOINT_URL"
# Expected: AccessDenied error

# Verify retention policy
aws s3api get-object-retention \
  --bucket "$R2_BUCKET_NAME" \
  --key "backups/test-backup.txt" \
  --endpoint-url "$R2_ENDPOINT_URL"
```

## Security Checklist

- [ ] Versioning enabled on all buckets
- [ ] Object-lock enabled on `backups/` prefix with COMPLIANCE mode
- [ ] Access logging configured via Logpush (7-year retention for PHI)
- [ ] Antivirus scanning integrated (AV_SCAN_URL configured)
- [ ] Public-access blocked (no R2_PUBLIC_URL for PHI buckets)
- [ ] Native cross-region replication enabled (cron job disabled)
- [ ] Lifecycle rules applied (backups expire after 90 days, non-current versions after 30 days)
- [ ] IAM policies restrict bucket access to Workers only
- [ ] R2 API tokens scoped to specific buckets with 90-day expiry
- [ ] Application-level authorization enforced in `/api/download`
- [ ] Audit logging enabled for all R2 access
- [ ] Incident response runbooks documented and tested

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 Lifecycle API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/)
- [R2 Versioning](https://developers.cloudflare.com/r2/buckets/versioning/)
- [Cloudflare Logpush](https://developers.cloudflare.com/logs/get-started/)
- [Moroccan Law 09-08](https://www.cndp.ma/fr/loi-09-08.html)
- [GDPR Article 32 (Security)](https://gdpr-info.eu/art-32-gdpr/)
- [AGENTS.md](../AGENTS.md) — Platform security requirements
- [docs/r2-lifecycle.md](./r2-lifecycle.md) — Lifecycle rule details
- [docs/SOP-PHI-KEY-ROTATION.md](./SOP-PHI-KEY-ROTATION.md) — PHI encryption key rotation
