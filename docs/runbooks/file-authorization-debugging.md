# Runbook: File Download Authorization Debugging

## Overview

This runbook provides procedures for debugging file download authorization issues in the Oltigo Health platform.

**Related Vulnerability:** A7-01 (Patient File Enumeration / IDOR)  
**Fix Deployed:** Phase 1 Critical Security Fixes  
**Alert:** `file_authorization_failure_spike`

---

## Background

### What Changed?

**Old Authorization (INSECURE):**
- Only checked if file key starts with `clinics/{clinicId}/`
- Patient could access ANY file under their clinic prefix
- No verification of file ownership

**New Authorization (SECURE):**
- Checks `patient_files` table for ownership
- Patient can only access files where `patient_id = requesting_user_id`
- Staff (doctor, receptionist, admin) can access all clinic files
- Enforced at both application and database (RLS) levels

### Database Schema

```sql
CREATE TABLE patient_files (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  content_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  
  CONSTRAINT patient_files_clinic_key UNIQUE (clinic_id, r2_key)
);
```

### Authorization Logic

```typescript
// Patient role: Can only access own files
if (profile.role === 'patient') {
  const { data: fileRecord } = await supabase
    .from("patient_files")
    .select("patient_id")
    .eq("clinic_id", profile.clinic_id)
    .eq("r2_key", key)
    .single();

  if (!fileRecord || fileRecord.patient_id !== profile.id) {
    return apiError("Unauthorized", 403, "UNAUTHORIZED");
  }
}

// Staff roles: Can access all clinic files
// (verified by clinic_id match)
```

---

## Alert Triggers

### Alert 1: Authorization Failure Spike

**Condition:** Authorization failures > 2x baseline  
**Severity:** MEDIUM  
**Notification:** Slack (#ops-alerts)

**Expected Baseline:**
- Patient unauthorized attempts: 1-5 per hour (users trying to access others' files)
- Staff unauthorized attempts: 0-1 per hour (should be rare)

### Alert 2: Orphaned Files Detected

**Condition:** Files in R2 without `patient_files` records  
**Severity:** LOW  
**Notification:** Slack (#ops-alerts)

**Expected:**
- Should be 0 after backfill script runs
- May increase if upload confirmation fails

---

## Diagnosis Procedures

### Step 1: Identify Authorization Failures

```sql
-- Get authorization failures by role
SELECT 
  u.role,
  COUNT(*) as failure_count,
  COUNT(DISTINCT u.id) as unique_users,
  COUNT(DISTINCT al.metadata->>'r2_key') as unique_files
FROM audit_log al
JOIN users u ON u.id = al.user_id
WHERE al.action = 'file_download'
  AND al.status = 'denied'
  AND al.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY u.role
ORDER BY failure_count DESC;
```

### Step 2: Analyze Failure Patterns

```sql
-- Get detailed failure information
SELECT 
  al.timestamp,
  u.id as user_id,
  u.email,
  u.role,
  al.metadata->>'r2_key' as attempted_key,
  al.metadata->>'reason' as failure_reason
FROM audit_log al
JOIN users u ON u.id = al.user_id
WHERE al.action = 'file_download'
  AND al.status = 'denied'
  AND al.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY al.timestamp DESC
LIMIT 50;
```

### Step 3: Check Patient Files Table

```sql
-- Verify patient_files table has records
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT clinic_id) as clinics_with_files,
  COUNT(DISTINCT patient_id) as patients_with_files,
  MIN(uploaded_at) as oldest_file,
  MAX(uploaded_at) as newest_file
FROM patient_files;

-- Check for specific file
SELECT 
  pf.id,
  pf.clinic_id,
  pf.patient_id,
  pf.r2_key,
  pf.uploaded_at,
  pf.uploaded_by,
  u.email as patient_email
FROM patient_files pf
JOIN users u ON u.id = pf.patient_id
WHERE pf.r2_key = '<r2-key>';
```

### Step 4: Check RLS Policies

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'patient_files';

-- Expected: rowsecurity = true

-- List RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'patient_files';

-- Expected policies:
-- patient_files_select_own (SELECT)
-- patient_files_insert_staff (INSERT)
```

### Step 5: Check for Orphaned Files

```bash
# List files in R2 for a clinic
cloudflare-r2 list --prefix "clinics/<clinic-id>/" --limit 100

# Compare with patient_files table
psql $DATABASE_URL -c "
  SELECT r2_key 
  FROM patient_files 
  WHERE clinic_id = '<clinic-id>' 
  LIMIT 100;
"

# Identify orphaned files (in R2 but not in patient_files)
```

---

## Resolution Procedures

### Scenario 1: Patient Cannot Access Own File

**Symptoms:**
- Patient gets 403 error when downloading their own file
- File exists in R2
- Patient is authenticated correctly

**Resolution:**

1. **Verify file ownership record exists:**
   ```sql
   -- Check if file has ownership record
   SELECT * FROM patient_files
   WHERE r2_key = '<r2-key>'
     AND clinic_id = '<clinic-id>';
   ```

2. **If record missing, create it:**
   ```sql
   -- Insert ownership record
   INSERT INTO patient_files (
     clinic_id,
     patient_id,
     r2_key,
     content_type,
     uploaded_at,
     uploaded_by
   ) VALUES (
     '<clinic-id>',
     '<patient-id>',
     '<r2-key>',
     'application/pdf',  -- or appropriate type
     NOW(),
     NULL  -- Unknown uploader
   );
   ```

3. **Verify patient can now access:**
   ```bash
   # Test download
   curl -X GET "https://oltigo.com/api/files/download?key=<r2-key>" \
     -H "Authorization: Bearer <patient-token>"

   # Expected: 200 OK with file content
   ```

4. **Investigate why record was missing:**
   - Check upload confirmation logs
   - Verify upload-confirm endpoint working
   - Run backfill script if many files affected

---

### Scenario 2: Staff Cannot Access Clinic Files

**Symptoms:**
- Doctor/receptionist gets 403 error
- File belongs to their clinic
- Should have access based on role

**Resolution:**

1. **Verify user's clinic_id matches file's clinic_id:**
   ```sql
   -- Check user's clinic
   SELECT id, email, role, clinic_id
   FROM users
   WHERE id = '<user-id>';

   -- Check file's clinic
   SELECT clinic_id, patient_id, r2_key
   FROM patient_files
   WHERE r2_key = '<r2-key>';
   ```

2. **If clinic_id mismatch:**
   ```sql
   -- This is correct behavior - staff can only access own clinic files
   -- Verify user is accessing correct subdomain
   ```

3. **If clinic_id matches but still denied:**
   ```bash
   # Check authorization logic in code
   git show HEAD:src/app/api/files/download/route.ts | grep -A 30 "role === 'patient'"

   # Verify staff bypass logic is correct
   ```

4. **Check RLS policies:**
   ```sql
   -- Test RLS policy as staff user
   SET ROLE authenticated;
   SET request.jwt.claims.sub = '<staff-user-id>';
   
   SELECT * FROM patient_files
   WHERE clinic_id = '<clinic-id>'
     AND r2_key = '<r2-key>';

   -- Should return the record
   ```

---

### Scenario 3: Orphaned Files (No Ownership Records)

**Symptoms:**
- Files exist in R2
- No corresponding records in `patient_files` table
- All downloads fail with 403

**Resolution:**

1. **Identify orphaned files:**
   ```bash
   # List R2 files for clinic
   cloudflare-r2 list --prefix "clinics/<clinic-id>/" > r2_files.txt

   # Export patient_files records
   psql $DATABASE_URL -c "
     COPY (
       SELECT r2_key 
       FROM patient_files 
       WHERE clinic_id = '<clinic-id>'
     ) TO STDOUT
   " > db_files.txt

   # Find orphaned files
   comm -23 <(sort r2_files.txt) <(sort db_files.txt) > orphaned_files.txt
   ```

2. **Run backfill script:**
   ```bash
   # Backfill ownership records for orphaned files
   npm run backfill:patient-files -- --clinic-id <clinic-id> --dry-run

   # Review output, then run actual backfill
   npm run backfill:patient-files -- --clinic-id <clinic-id>
   ```

3. **Verify backfill success:**
   ```sql
   -- Check if orphaned files now have records
   SELECT COUNT(*) FROM patient_files
   WHERE clinic_id = '<clinic-id>'
     AND uploaded_by IS NULL;  -- Backfilled records have NULL uploaded_by
   ```

4. **If backfill script unavailable, manual insert:**
   ```sql
   -- Extract patient_id from R2 key
   -- Format: clinics/{clinicId}/patients/{patientId}/filename.ext
   
   INSERT INTO patient_files (clinic_id, patient_id, r2_key, uploaded_at)
   SELECT 
     '<clinic-id>',
     substring(r2_key from 'patients/([0-9a-f-]+)/'),
     r2_key,
     NOW()
   FROM (
     VALUES 
       ('clinics/<clinic-id>/patients/<patient-id>/file1.pdf'),
       ('clinics/<clinic-id>/patients/<patient-id>/file2.pdf')
   ) AS files(r2_key);
   ```

---

### Scenario 4: Patient Attempting to Access Other Patient's File

**Symptoms:**
- Patient gets 403 error
- File belongs to different patient in same clinic
- This is CORRECT behavior (not a bug)

**Resolution:**

1. **Verify this is expected:**
   ```sql
   -- Check file ownership
   SELECT 
     pf.patient_id as file_owner,
     u.email as owner_email,
     pf.r2_key
   FROM patient_files pf
   JOIN users u ON u.id = pf.patient_id
   WHERE pf.r2_key = '<r2-key>';

   -- Check requesting user
   SELECT id, email, role
   FROM users
   WHERE id = '<requesting-user-id>';

   -- If patient_id != requesting_user_id, denial is correct
   ```

2. **Log as security event (potential enumeration attack):**
   ```sql
   -- Check if user is attempting multiple unauthorized accesses
   SELECT 
     COUNT(*) as attempt_count,
     COUNT(DISTINCT metadata->>'r2_key') as unique_files_attempted
   FROM audit_log
   WHERE user_id = '<user-id>'
     AND action = 'file_download'
     AND status = 'denied'
     AND timestamp >= NOW() - INTERVAL '1 hour';

   -- If attempt_count > 10, potential attack
   ```

3. **If attack pattern detected:**
   ```bash
   # Alert security team
   slack-notify --channel security-alerts \
     --message "🚨 Potential file enumeration attack by user <user-id>. ${attempt_count} unauthorized attempts in 1 hour."

   # Consider rate limiting or temporary suspension
   ```

4. **No action needed if:**
   - Single attempt (user clicked wrong link)
   - No pattern of abuse
   - Audit log shows legitimate mistake

---

### Scenario 5: Upload Confirmation Failing

**Symptoms:**
- Files uploaded to R2 successfully
- No records created in `patient_files` table
- Subsequent downloads fail

**Resolution:**

1. **Check upload-confirm endpoint logs:**
   ```bash
   # Find upload-confirm errors
   cloudflare-logs fetch --filter "upload-confirm" --level error --limit 50
   ```

2. **Verify upload-confirm code:**
   ```bash
   # Review upload-confirm implementation
   git show HEAD:src/app/api/files/upload-confirm/route.ts | grep -A 50 "patient_files"
   ```

3. **Test upload-confirm endpoint:**
   ```bash
   # Simulate upload confirmation
   curl -X POST https://oltigo.com/api/files/upload-confirm \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "key": "clinics/<clinic-id>/patients/<patient-id>/test.pdf",
       "contentType": "application/pdf"
     }'

   # Expected: 200 OK
   ```

4. **Check database permissions:**
   ```sql
   -- Verify authenticated role can insert into patient_files
   SELECT grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_name = 'patient_files'
     AND grantee = 'authenticated';

   -- Should include INSERT privilege
   ```

5. **If permissions missing:**
   ```sql
   -- Grant INSERT permission
   GRANT INSERT ON patient_files TO authenticated;
   ```

---

## Preventive Measures

### 1. Automated Orphaned File Detection

Create cron job to detect orphaned files:

```typescript
// src/app/api/cron/check-orphaned-files/route.ts

export async function GET(request: Request) {
  // List R2 files
  const r2Files = await listR2Files();

  // Query patient_files table
  const { data: dbFiles } = await supabase
    .from("patient_files")
    .select("r2_key");

  // Find orphaned files
  const orphaned = r2Files.filter(
    (r2Key) => !dbFiles.some((db) => db.r2_key === r2Key)
  );

  if (orphaned.length > 0) {
    logger.warn("Orphaned files detected", {
      context: "cron/check-orphaned-files",
      count: orphaned.length,
      sample: orphaned.slice(0, 10),
    });

    // Alert ops team
    await sendSlackAlert({
      channel: "#ops-alerts",
      message: `⚠️ ${orphaned.length} orphaned files detected. Run backfill script.`,
    });
  }

  return apiSuccess({ orphaned: orphaned.length });
}
```

### 2. Upload Confirmation Retry Logic

Add retry logic to upload confirmation:

```typescript
// src/app/api/files/upload-confirm/route.ts

async function createOwnershipRecord(data: UploadConfirmData, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { error } = await supabase.from("patient_files").insert({
        clinic_id: data.clinicId,
        patient_id: data.patientId,
        r2_key: data.key,
        content_type: data.contentType,
        uploaded_by: data.uploadedBy,
      });

      if (!error) return { success: true };

      logger.warn("Failed to create ownership record, retrying", {
        context: "upload-confirm",
        attempt: i + 1,
        error: error.message,
      });

      await sleep(1000 * (i + 1)); // Exponential backoff
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }

  return { success: false };
}
```

### 3. Authorization Failure Monitoring

Add detailed logging for authorization failures:

```typescript
// src/app/api/files/download/route.ts

if (profile.role === 'patient') {
  const { data: fileRecord } = await supabase
    .from("patient_files")
    .select("patient_id, clinic_id")
    .eq("clinic_id", profile.clinic_id)
    .eq("r2_key", key)
    .single();

  if (!fileRecord) {
    logger.warn("File ownership record not found", {
      context: "file/download",
      userId: profile.id,
      clinicId: profile.clinic_id,
      r2Key: key,
      reason: "NO_OWNERSHIP_RECORD",
    });
    return apiError("File not found", 404, "FILE_NOT_FOUND");
  }

  if (fileRecord.patient_id !== profile.id) {
    logger.warn("Unauthorized file access attempt", {
      context: "file/download",
      userId: profile.id,
      fileOwnerId: fileRecord.patient_id,
      r2Key: key,
      reason: "WRONG_PATIENT",
    });
    return apiError("Unauthorized", 403, "UNAUTHORIZED");
  }
}
```

### 4. RLS Policy Testing

Add automated tests for RLS policies:

```typescript
// src/lib/__tests__/patient-files-rls.test.ts

describe("Patient Files RLS Policies", () => {
  it("patient can select own files", async () => {
    const { data, error } = await supabaseAsPatient
      .from("patient_files")
      .select("*")
      .eq("patient_id", patientId);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("patient cannot select other patient files", async () => {
    const { data, error } = await supabaseAsPatient
      .from("patient_files")
      .select("*")
      .eq("patient_id", otherPatientId);

    expect(data).toHaveLength(0); // RLS filters out
  });

  it("doctor can select all clinic files", async () => {
    const { data, error } = await supabaseAsDoctor
      .from("patient_files")
      .select("*")
      .eq("clinic_id", clinicId);

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });
});
```

---

## Escalation Path

### Level 1: On-Call Engineer (Immediate)
- Review alert
- Run diagnosis queries
- Identify if legitimate issue or expected behavior
- Apply quick fixes (create missing records)

### Level 2: Engineering Manager (< 30 min)
- Review for systemic issues
- Approve backfill script execution
- Coordinate with database team

### Level 3: Security Team (Security Incidents)
- Investigate enumeration attacks
- Review access patterns
- Recommend security improvements

### Level 4: Database Team (RLS Issues)
- Review RLS policies
- Fix policy bugs
- Optimize query performance

---

## Related Documentation

- [Deployment Guide](../deployment-phase1-security-fixes.md)
- [Monitoring Guide](../monitoring-phase1-security-fixes.md)
- [Design Document](.kiro/specs/phase-1-critical-security-fixes/design.md)
- [Backfill Script](../../scripts/backfill-patient-files.ts)

---

## Appendix: Useful SQL Queries

### Check File Ownership

```sql
SELECT 
  pf.id,
  pf.r2_key,
  pf.clinic_id,
  c.name as clinic_name,
  pf.patient_id,
  u.email as patient_email,
  pf.uploaded_at,
  pf.uploaded_by
FROM patient_files pf
JOIN clinics c ON c.id = pf.clinic_id
JOIN users u ON u.id = pf.patient_id
WHERE pf.r2_key = '<r2-key>';
```

### Find Files for Patient

```sql
SELECT 
  r2_key,
  content_type,
  uploaded_at,
  uploaded_by
FROM patient_files
WHERE patient_id = '<patient-id>'
  AND clinic_id = '<clinic-id>'
ORDER BY uploaded_at DESC;
```

### Authorization Failure Statistics

```sql
SELECT 
  DATE_TRUNC('hour', al.timestamp) as hour,
  u.role,
  COUNT(*) as failure_count
FROM audit_log al
JOIN users u ON u.id = al.user_id
WHERE al.action = 'file_download'
  AND al.status = 'denied'
  AND al.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour, u.role
ORDER BY hour DESC, failure_count DESC;
```

---

**Runbook Version:** 1.0  
**Last Updated:** 2026-05-01  
**Owner:** Engineering Team  
**Next Review:** After 1 month of production use
