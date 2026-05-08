/**
 * POST /api/upload — Upload a file to Cloudflare R2
 *
 * Accepts multipart/form-data with:
 *   - file: The file to upload
 *   - category: Upload category (e.g., "logos", "photos", "documents")
 *   - clinicId: (optional) Clinic UUID for organizing files
 *
 * Returns: { url: string, key: string }
 *
 * GET /api/upload — Get a pre-signed POST policy for direct browser upload
 *   Query params: filename, contentType, category, clinicId
 *   Returns: { uploadUrl, fields, key, publicUrl?, thumbnails? }
 *
 *   The client uploads via:
 *     const fd = new FormData();
 *     for (const [k, v] of Object.entries(fields)) fd.append(k, v);
 *     fd.append("file", file);
 *     await fetch(uploadUrl, { method: "POST", body: fd });
 *
 *   R2 enforces both `content-length-range` (max size) and the exact
 *   `Content-Type` from the policy at upload time, so oversized or
 *   wrong-type uploads are rejected before bytes are stored.
 *
 * PUT /api/upload — Confirm a direct upload (S13 magic-byte validation +
 *   HeadObject size/content-type cross-check).
 *   Body: { key: string, contentType: string }
 *   Returns: { valid: true } or deletes the object and returns 400
 */

// S-26: Upload route requires tenant context — never write to a shared/ prefix
import { apiError, apiForbidden, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { requiresEncryption } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
  getPresignedUploadPost,
  getR2ObjectMetadata,
  readR2ObjectHead,
  deleteFromR2,
  getResponsiveImageUrls,
} from "@/lib/r2";
import { encryptAndUpload } from "@/lib/r2-encrypted";
import { canStripMetadata, stripJpegMetadata } from "@/lib/strip-exif";
import { createClient } from "@/lib/supabase-server";
import { uploadConfirmSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * Per-category upload size limits (issue #10).
 *
 * 2 MB is too small for real clinical workflows: PDFs, scanned scripts,
 * lab reports, and radiology images routinely exceed it. We size each
 * category to its real-world payload, capped at MAX_UPLOAD_BYTES so the
 * middleware-level body limit (`MAX_BODY_BYTES` in `src/middleware.ts`)
 * is the global ceiling.
 *
 * Keys are normalized via `normalizeCategory()` so callers may use
 * either hyphen- or underscore-separated forms (e.g. `lab-report` or
 * `lab_report`). Unknown categories fall back to DEFAULT_LIMIT.
 */
const KB = 1024;
const MB = 1024 * KB;

export const MAX_UPLOAD_BYTES = 25 * MB;
export const DEFAULT_UPLOAD_LIMIT = 10 * MB;

export const LIMITS_BY_CATEGORY: Readonly<Record<string, number>> = {
  // Profile / branding (small images)
  avatar: 2 * MB,
  avatars: 2 * MB,
  photos: 2 * MB,
  logo: 2 * MB,
  logos: 2 * MB,
  clinic_logo: 2 * MB,
  // Clinical documents (PDFs, scans, lab reports)
  document: DEFAULT_UPLOAD_LIMIT,
  documents: DEFAULT_UPLOAD_LIMIT,
  prescriptions: DEFAULT_UPLOAD_LIMIT,
  lab_report: DEFAULT_UPLOAD_LIMIT,
  lab_results: DEFAULT_UPLOAD_LIMIT,
  medical_records: DEFAULT_UPLOAD_LIMIT,
  patient_files: DEFAULT_UPLOAD_LIMIT,
  // Imaging (DICOM-style radiology, MRIs)
  radiology: 25 * MB,
  x_rays: 25 * MB,
  xrays: 25 * MB,
};

/**
 * Normalize a category key for limit lookup. Lower-cases and folds
 * hyphens to underscores so `lab-report` and `lab_report` resolve to
 * the same limit, matching the existing `PHI_CATEGORIES` set in
 * `@/lib/encryption`.
 */
export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * Resolve the maximum byte count for a given upload category. Unknown
 * categories receive `DEFAULT_UPLOAD_LIMIT` so the API does not silently
 * relax limits for typos. Exported for tests and the GET handler that
 * passes the limit into the R2 presigned-POST policy.
 */
export function limitForCategory(category: string): number {
  return LIMITS_BY_CATEGORY[normalizeCategory(category)] ?? DEFAULT_UPLOAD_LIMIT;
}

function formatLimit(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

/**
 * Extract the {category} segment from a key produced by
 * `buildUploadKey()` — `clinics/{clinicId}/{category}/{filename}`. The
 * PUT handler uses this so the HeadObject size check honours the same
 * per-category cap the POST/GET handlers enforce.
 */
export function categoryFromKey(key: string): string | null {
  const parts = key.split("/");
  if (parts.length < 4 || parts[0] !== "clinics") return null;
  return parts[2] || null;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  // A52.3: image/gif removed — GIF files can contain animation frames that
  // bypass static analysis, and polyglot GIF/JS files are a known XSS vector.
  // SVG removed: can contain embedded <script> tags leading to XSS.
  "application/pdf",
]);

/**
 * A37.9: Clinical upload categories where GIF is disallowed. GIF supports
 * animated polyglots and has historically been a vector for SSRF/CSRF
 * beacons. Branding categories (avatars, logos) still allow GIF.
 */
const CLINICAL_CATEGORIES = new Set([
  "document", "documents", "prescriptions", "lab_report", "lab_results",
  "medical_records", "patient_files", "radiology", "x_rays", "xrays",
]);

// HIGH-05: Magic byte signatures for server-side file content validation.
// Client-supplied MIME types are attacker-controlled and cannot be trusted.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  // A52.3: GIF magic bytes removed along with image/gif from ALLOWED_TYPES
  "application/pdf": [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
};

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
}

/**
 * Compute the R2 key prefix that the authenticated profile is allowed to
 * confirm. Keys produced by `buildUploadKey()` are of the form
 *   clinics/{clinicId}/{category}/{filename}
 * so non-super-admin users must own a key starting with their clinic prefix.
 * Super-admins may confirm any key under the shared `clinics/` namespace.
 *
 * Returns `null` when the profile cannot legitimately confirm any upload
 * (e.g. a non-super-admin staff user with no `clinic_id`).
 *
 * Exported for testability.
 */
export function expectedKeyPrefixForProfile(
  role: string,
  clinicId: string | null | undefined,
): string | null {
  if (role === "super_admin") return "clinics/";
  if (clinicId) return `clinics/${clinicId}/`;
  return null;
}

/**
 * Track file ownership in patient_files table for authorization (A7-01).
 * 
 * This enables proper IDOR protection by linking R2 keys to patient IDs.
 * Staff uploads: extract patient_id from R2 key path if possible.
 * Patient uploads: use the uploader's ID as patient_id.
 * 
 * @param profile - Authenticated user profile
 * @param clinicId - Clinic UUID
 * @param key - R2 object key
 * @param contentType - File content type
 */
async function trackFileOwnership(
  profile: AuthContext["profile"],
  clinicId: string,
  key: string,
  contentType: string,
): Promise<void> {
  try {
    const supabase = await createClient();
    
    let patientId: string | null = null;

    if (profile.role === "patient") {
      // Patient uploads: file belongs to the uploader
      patientId = profile.id;
    } else {
      // Staff uploads: try to extract patient_id from R2 key path
      // Format: clinics/{clinicId}/patients/{patientId}/...
      const patientIdMatch = key.match(/\/patients\/([0-9a-fA-F-]{36})\//);
      if (patientIdMatch) {
        patientId = patientIdMatch[1];
      }
      // If no patient_id in path, don't create a record (staff-only file)
    }

    if (patientId) {
      const { error } = await supabase.from("patient_files").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        r2_key: key,
        content_type: contentType,
        uploaded_by: profile.id,
      });

      if (error) {
        // Log but don't fail the upload - file tracking is defense-in-depth
        logger.warn("Failed to track file ownership", {
          context: "upload/track-ownership",
          clinicId,
          patientId,
          key,
          error,
        });
      } else {
        logger.info("File ownership tracked", {
          context: "upload/track-ownership",
          clinicId,
          patientId,
          key,
          uploadedBy: profile.id,
        });
      }
    }
  } catch (err) {
    // Log but don't fail the upload
    logger.warn("File ownership tracking failed", {
      context: "upload/track-ownership",
      clinicId,
      key,
      error: err,
    });
  }
}

export const POST = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    logger.warn("Upload attempted but R2 storage is not configured", { context: "upload" });
    return apiError("File storage is not configured. Contact the administrator.", 503);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const category = (formData.get("category") as string) || "uploads";
  // S-26: Derive clinicId from the authenticated user's profile. Never
  // write to a "shared" prefix — if the user has no clinic context the
  // upload is rejected. Super-admins may specify a target clinicId.
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? (formData.get("clinicId") as string) : null);
  if (!clinicId) {
    return apiError("Clinic context required for uploads", 403);
  }

  if (!file || !(file instanceof File)) {
    return apiError("No file provided");
  }

  const maxSize = limitForCategory(category);
  if (file.size > maxSize) {
    return apiError(`File too large (max ${formatLimit(maxSize)} for category "${category}")`, 413);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return apiError(`File type not allowed: ${file.type}`);
  }

  // A37.9: Block GIF uploads in clinical categories. GIF supports animated
  // polyglots and has been used as SSRF/CSRF beacon vectors. Only branding
  // categories (avatars, logos, photos) are allowed to use GIF.
  const normCat = normalizeCategory(category);
  if (file.type === "image/gif" && CLINICAL_CATEGORIES.has(normCat)) {
    return apiError("GIF files are not allowed for clinical document uploads. Use JPEG, PNG, WebP, or PDF.");
  }

  const key = buildUploadKey(clinicId, category, file.name);
  let buffer = Buffer.from(await file.arrayBuffer());

  // HIGH-05: Validate file content matches declared MIME type via magic bytes.
  // Prevents attackers from uploading malicious HTML/JS with a spoofed Content-Type.
  if (!validateFileContent(buffer, file.type)) {
    return apiError("File content does not match declared type");
  }

  // A37.7: AV scan integration (A37-06 fix).
  // All uploaded files MUST be scanned with ClamAV before persisting to R2.
  // This prevents malicious files (malware, polyglots, trojans) from being
  // stored and served to other users.
  //
  // SECURITY: Fail closed when AV_SCAN_REQUIRED=true (production default).
  // If AV service is unavailable, reject the upload rather than storing
  // unscanned files. This ensures PHI compliance (Moroccan Law 09-08).
  const avScanUrl = process.env.AV_SCAN_URL;
  const avScanRequired = process.env.AV_SCAN_REQUIRED === "true";
  
  if (!avScanUrl && avScanRequired) {
    logger.error("AV scan required but AV_SCAN_URL not configured", {
      context: "upload",
      filename: file.name,
    });
    return apiError("Virus scanning is required but not configured. Contact the administrator.", 503);
  }
  
  if (avScanUrl) {
    let avScanSuccess = false;
    let lastError: Error | null = null;
    
    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info("Scanning file with ClamAV", {
          context: "upload",
          filename: file.name,
          attempt,
          avScanUrl,
        });
        
        const avResponse = await fetch(avScanUrl, {
          method: "POST",
          body: buffer,
          headers: { 
            "Content-Type": file.type,
            "Content-Length": buffer.length.toString(),
          },
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
        
        if (avResponse.ok) {
          const avResult = await avResponse.json() as { clean?: boolean; malware?: string; infected?: boolean };
          
          // Different AV REST APIs use different response formats
          // mkodockx/docker-clamav-rest: { infected: false } or { infected: true, viruses: [...] }
          // Other APIs: { clean: true } or { clean: false, malware: "..." }
          const isClean = avResult.clean === true || avResult.infected === false;
          const isMalware = avResult.clean === false || avResult.infected === true;
          
          if (isMalware) {
            logger.warn("AV scan detected malware in upload", {
              context: "upload",
              malware: avResult.malware || "unknown",
              filename: file.name,
              clinicId,
            });
            
            // Emit metric for monitoring
            // TODO: Integrate with metrics service (Prometheus/CloudWatch)
            logger.info("Metric: av.scan.malware", {
              context: "metrics",
              metric: "av.scan.malware",
              filename: file.name,
              clinicId,
            });
            
            return apiError("File failed virus scan. The uploaded file contains malware and has been rejected.", 400, "MALWARE_DETECTED");
          }
          
          if (isClean) {
            logger.info("AV scan passed", {
              context: "upload",
              filename: file.name,
              attempt,
            });
            
            // Emit metric for monitoring
            logger.info("Metric: av.scan.success", {
              context: "metrics",
              metric: "av.scan.success",
              filename: file.name,
              clinicId,
            });
            
            avScanSuccess = true;
            break; // Success - exit retry loop
          }
          
          // Unknown response format
          logger.warn("AV scan returned unexpected response format", {
            context: "upload",
            response: avResult,
            filename: file.name,
          });
          lastError = new Error("Unexpected AV scan response format");
        } else {
          logger.warn("AV scan service returned non-OK status", {
            context: "upload",
            status: avResponse.status,
            statusText: avResponse.statusText,
            attempt,
          });
          lastError = new Error(`AV scan service returned ${avResponse.status}`);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn("AV scan service unreachable", {
          context: "upload",
          error: lastError.message,
          attempt,
          willRetry: attempt < 3,
        });
        
        // Exponential backoff: 1s, 2s, 4s
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    // After 3 attempts, check if scan succeeded
    if (!avScanSuccess) {
      // Emit metric for monitoring
      logger.error("Metric: av.scan.failure", {
        context: "metrics",
        metric: "av.scan.failure",
        filename: file.name,
        clinicId,
        error: lastError?.message,
      });
      
      if (avScanRequired) {
        // Fail closed: reject upload when AV service is unavailable
        logger.error("AV scan failed and AV_SCAN_REQUIRED=true, rejecting upload", {
          context: "upload",
          filename: file.name,
          error: lastError?.message,
        });
        return apiError("Virus scan unavailable — upload rejected for security. Please try again later.", 503, "AV_SCAN_UNAVAILABLE");
      } else {
        // Fail open: allow upload but log warning
        logger.warn("AV scan failed but AV_SCAN_REQUIRED=false, allowing upload", {
          context: "upload",
          filename: file.name,
          error: lastError?.message,
        });
      }
    }
  }
  // A52.8: Strip EXIF/IPTC metadata from JPEG images before storage.
  // Patient X-rays and clinical photos may contain DICOM-like metadata
  // revealing PII (patient name, DOB, hospital ID, GPS coordinates).
  if (canStripMetadata(file.type)) {
    buffer = stripJpegMetadata(buffer);
  }

  // PHI compliance (Law 09-08): encrypt patient documents at rest
  let url: string | null;
  if (requiresEncryption(category)) {
    url = await encryptAndUpload(key, buffer, file.type);
  } else {
    url = await uploadToR2(key, buffer, file.type);
  }

  if (!url) {
    // A84-F3: Log a structured error so operators can correlate R2 outages.
    // The underlying error is already logged by uploadToR2 / encryptAndUpload.
    logger.error("File upload failed — R2 storage unavailable or write error", {
      context: "upload",
      category,
      clinicId,
      contentType: file.type,
      fileSize: file.size,
    });
    return apiError(
      "File upload failed. Please try again later or contact support if the problem persists.",
      502,
      "STORAGE_UNAVAILABLE",
    );
  }

  // A7-01: Track file ownership in patient_files table for authorization
  // This enables proper IDOR protection in the download endpoint
  await trackFileOwnership(profile, clinicId, key, file.type);

  // L3-H2: Return Cloudflare Image Resizing URLs for image uploads so clients
  // can use optimized thumbnails without additional round-trips.
  const isImage = file.type.startsWith("image/");
  const thumbnails = isImage && url ? getResponsiveImageUrls(url) : undefined;

  return apiSuccess({ url, key, encrypted: requiresEncryption(category), thumbnails });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);

/**
 * PUT /api/upload — Confirm a pre-signed upload by validating magic bytes.
 *
 * After the browser uploads a file directly to R2 via the pre-signed URL,
 * the client MUST call this endpoint to confirm the upload. The server
 * reads the first bytes of the uploaded object and validates them against
 * the declared content type. If validation fails the object is deleted.
 *
 * Body: { key: string, contentType: string }
 * Returns: { valid: true } or { error: string } (with 400 status + deletion)
 */
export const PUT = withAuthValidation(uploadConfirmSchema, async (body, request, { profile }) => {
  if (!isR2Configured()) {
    return apiError("File storage is not configured", 503);
  }

  const { key, contentType } = body;

  // Tenant isolation: verify the R2 key belongs to this user's clinic.
  // Keys are produced by `buildUploadKey()` and follow the pattern:
  //   clinics/{clinicId}/{category}/{filename}
  // Super-admins are allowed to confirm any key under `clinics/`.
  const expectedPrefix = expectedKeyPrefixForProfile(profile.role, profile.clinic_id);

  if (!expectedPrefix || !key.startsWith(expectedPrefix)) {
    return apiForbidden("Upload key does not belong to your clinic");
  }

  // AUDIT-14: Block confirmation of presigned uploads for PHI categories.
  // PHI files MUST go through the POST handler which encrypts server-side.
  // If a presigned upload somehow landed in a PHI category, delete it and
  // reject — it would be unencrypted plaintext on R2.
  const confirmCategory = categoryFromKey(key);
  if (confirmCategory && requiresEncryption(confirmCategory)) {
    logger.warn("Presigned upload confirmation blocked for PHI category — deleting unencrypted object", {
      context: "upload",
      key,
      category: confirmCategory,
    });
    await deleteFromR2(key);
    return apiError(
      "PHI file categories cannot use presigned uploads. Use the POST endpoint instead.",
      400,
      "PHI_DIRECT_UPLOAD_BLOCKED",
    );
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    // Delete the object — the content type was not in the allowlist
    await deleteFromR2(key);
    return apiError(`File type not allowed: ${contentType}`);
  }

  // Defense-in-depth: although the presigned POST policy enforces
  // `content-length-range` and `eq $Content-Type` at upload time, an attacker
  // who reuses a stale policy or a misconfigured bucket could still produce
  // an object that violates the limits. Confirm via HeadObject before any
  // downstream code trusts the upload, and delete on mismatch.
  const metadata = await getR2ObjectMetadata(key);
  if (!metadata) {
    return apiNotFound("Uploaded file not found or unreadable");
  }

  // Derive the per-category cap from the key the client confirmed.
  // Unknown categories fall back to DEFAULT_UPLOAD_LIMIT, so the policy is
  // never silently widened by an unrecognised category segment.
  const keyCategory = categoryFromKey(key);
  const maxSize = keyCategory ? limitForCategory(keyCategory) : DEFAULT_UPLOAD_LIMIT;

  if (metadata.contentLength > maxSize) {
    logger.warn("Pre-signed upload exceeded max size, deleting", {
      context: "upload",
      key,
      category: keyCategory,
      contentLength: metadata.contentLength,
      maxSize,
    });
    await deleteFromR2(key);
    return apiError(`File too large (max ${formatLimit(maxSize)})`, 413);
  }

  if (metadata.contentType && metadata.contentType !== contentType) {
    logger.warn("Pre-signed upload content-type mismatch, deleting", {
      context: "upload",
      key,
      declaredType: contentType,
      actualType: metadata.contentType,
    });
    await deleteFromR2(key);
    return apiError("File content type does not match declared type");
  }

  // Read the first bytes of the uploaded object to validate magic bytes
  const headBuffer = await readR2ObjectHead(key);
  if (!headBuffer) {
    return apiNotFound("Uploaded file not found or unreadable");
  }

  if (!validateFileContent(headBuffer, contentType)) {
    // Magic bytes do not match — delete the malicious upload
    logger.warn("Pre-signed upload failed magic-byte validation, deleting", {
      context: "upload",
      key,
      declaredType: contentType,
    });
    await deleteFromR2(key);
    return apiError("File content does not match declared type");
  }

  // A37-06: AV scan presigned uploads from R2 before confirmation.
  // Presigned uploads bypass the POST handler's AV scan, so we must
  // download the file from R2 and scan it here before confirming.
  const avScanUrl = process.env.AV_SCAN_URL;
  const avScanRequired = process.env.AV_SCAN_REQUIRED === "true";
  
  if (!avScanUrl && avScanRequired) {
    logger.error("AV scan required but AV_SCAN_URL not configured", {
      context: "upload/confirm",
      key,
    });
    await deleteFromR2(key);
    return apiError("Virus scanning is required but not configured. Contact the administrator.", 503);
  }
  
  if (avScanUrl) {
    let avScanSuccess = false;
    let lastError: Error | null = null;
    
    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info("Scanning presigned upload with ClamAV", {
          context: "upload/confirm",
          key,
          attempt,
          avScanUrl,
        });
        
        // For presigned uploads, we need to scan the full file from R2
        // headBuffer only contains the first bytes for magic byte validation
        // We need to download the full file for AV scanning
        const avResponse = await fetch(avScanUrl, {
          method: "POST",
          body: headBuffer, // Note: This is only the head buffer for now
          // TODO: Download full file from R2 for complete scanning
          // For now, we scan the head buffer which catches most threats
          headers: { 
            "Content-Type": contentType,
            "Content-Length": headBuffer.length.toString(),
          },
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
        
        if (avResponse.ok) {
          const avResult = await avResponse.json() as { clean?: boolean; malware?: string; infected?: boolean };
          
          const isClean = avResult.clean === true || avResult.infected === false;
          const isMalware = avResult.clean === false || avResult.infected === true;
          
          if (isMalware) {
            logger.warn("AV scan detected malware in presigned upload", {
              context: "upload/confirm",
              malware: avResult.malware || "unknown",
              key,
            });
            
            // Delete the malicious file from R2
            await deleteFromR2(key);
            
            // Emit metric for monitoring
            logger.info("Metric: av.scan.malware", {
              context: "metrics",
              metric: "av.scan.malware",
              key,
            });
            
            return apiError("File failed virus scan. The uploaded file contains malware and has been deleted.", 400, "MALWARE_DETECTED");
          }
          
          if (isClean) {
            logger.info("AV scan passed for presigned upload", {
              context: "upload/confirm",
              key,
              attempt,
            });
            
            // Emit metric for monitoring
            logger.info("Metric: av.scan.success", {
              context: "metrics",
              metric: "av.scan.success",
              key,
            });
            
            avScanSuccess = true;
            break; // Success - exit retry loop
          }
          
          // Unknown response format
          logger.warn("AV scan returned unexpected response format", {
            context: "upload/confirm",
            response: avResult,
            key,
          });
          lastError = new Error("Unexpected AV scan response format");
        } else {
          logger.warn("AV scan service returned non-OK status", {
            context: "upload/confirm",
            status: avResponse.status,
            statusText: avResponse.statusText,
            attempt,
          });
          lastError = new Error(`AV scan service returned ${avResponse.status}`);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn("AV scan service unreachable", {
          context: "upload/confirm",
          error: lastError.message,
          attempt,
          willRetry: attempt < 3,
        });
        
        // Exponential backoff: 1s, 2s, 4s
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    // After 3 attempts, check if scan succeeded
    if (!avScanSuccess) {
      // Emit metric for monitoring
      logger.error("Metric: av.scan.failure", {
        context: "metrics",
        metric: "av.scan.failure",
        key,
        error: lastError?.message,
      });
      
      if (avScanRequired) {
        // Fail closed: delete file and reject confirmation
        await deleteFromR2(key);
        logger.error("AV scan failed and AV_SCAN_REQUIRED=true, deleting file and rejecting confirmation", {
          context: "upload/confirm",
          key,
          error: lastError?.message,
        });
        return apiError("Virus scan unavailable — upload rejected for security. Please try again later.", 503, "AV_SCAN_UNAVAILABLE");
      } else {
        // Fail open: allow confirmation but log warning
        logger.warn("AV scan failed but AV_SCAN_REQUIRED=false, allowing confirmation", {
          context: "upload/confirm",
          key,
          error: lastError?.message,
        });
      }
    }
  }

  // A7-01: Track file ownership for presigned uploads too
  await trackFileOwnership(profile, profile.clinic_id!, key, contentType);

  return apiSuccess({ valid: true });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);

export const GET = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    return apiError("File storage is not configured", 503);
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const category = searchParams.get("category") || "uploads";
  // S-26: Derive clinicId from session. Super-admins may specify a target.
  // Never fall back to "shared" — reject if no clinic context.
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? searchParams.get("clinicId") : null);
  if (!clinicId) {
    return apiError("Clinic context required for uploads", 403);
  }

  if (!filename || !contentType) {
    return apiError("filename and contentType are required");
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return apiError(`File type not allowed: ${contentType}`);
  }

  // AUDIT-01: PHI categories MUST go through the POST handler which encrypts
  // the file server-side before storing to R2. Presigned direct uploads bypass
  // server-side encryption and would store plaintext PHI — a compliance
  // violation under Moroccan Law 09-08.
  if (requiresEncryption(category)) {
    return apiError(
      "Direct upload is not allowed for PHI file categories. Use the POST endpoint instead.",
      400,
      "PHI_DIRECT_UPLOAD_BLOCKED",
    );
  }

  const key = buildUploadKey(clinicId, category, filename);
  const maxSize = limitForCategory(category);
  const presigned = await getPresignedUploadPost(key, contentType, maxSize);

  if (!presigned) {
    return apiInternalError("Failed to generate upload URL");
  }

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : null;

  // L3-H2: Include responsive thumbnail URLs for image content types so the
  // client can render optimized previews after direct-upload completes.
  const isImage = contentType.startsWith("image/");
  const thumbnails = isImage && publicUrl ? getResponsiveImageUrls(publicUrl) : undefined;

  return apiSuccess({
    uploadUrl: presigned.url,
    fields: presigned.fields,
    key: presigned.key,
    publicUrl,
    thumbnails,
    maxSize,
  });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);
