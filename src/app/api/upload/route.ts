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
import { uploadConfirmSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // SVG removed: can contain embedded <script> tags leading to XSS
  "application/pdf",
]);

// HIGH-05: Magic byte signatures for server-side file content validation.
// Client-supplied MIME types are attacker-controlled and cannot be trusted.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/gif": [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
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

export const POST = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    logger.warn("Upload attempted but R2 storage is not configured", { context: "upload" });
    return apiError("File storage is not configured. Contact the administrator.", 503);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const category = (formData.get("category") as string) || "uploads";
  // Derive clinicId from the authenticated user's profile to prevent
  // cross-tenant file access. Fall back to "shared" only for super_admins.
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? ((formData.get("clinicId") as string) || "shared") : "shared");

  if (!file || !(file instanceof File)) {
    return apiError("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiError("File too large (max 2 MB)");
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return apiError(`File type not allowed: ${file.type}`);
  }

  const key = buildUploadKey(clinicId, category, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // HIGH-05: Validate file content matches declared MIME type via magic bytes.
  // Prevents attackers from uploading malicious HTML/JS with a spoofed Content-Type.
  if (!validateFileContent(buffer, file.type)) {
    return apiError("File content does not match declared type");
  }

  // PHI compliance (Law 09-08): encrypt patient documents at rest
  let url: string | null;
  if (requiresEncryption(category)) {
    url = await encryptAndUpload(key, buffer, file.type);
  } else {
    url = await uploadToR2(key, buffer, file.type);
  }

  if (!url) {
    return apiInternalError("Upload failed");
  }

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

  if (metadata.contentLength > MAX_FILE_SIZE) {
    logger.warn("Pre-signed upload exceeded max size, deleting", {
      context: "upload",
      key,
      contentLength: metadata.contentLength,
      maxSize: MAX_FILE_SIZE,
    });
    await deleteFromR2(key);
    return apiError("File too large (max 2 MB)");
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
  // Derive clinicId from session, not from untrusted query params
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? (searchParams.get("clinicId") || "shared") : "shared");

  if (!filename || !contentType) {
    return apiError("filename and contentType are required");
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return apiError(`File type not allowed: ${contentType}`);
  }

  const key = buildUploadKey(clinicId, category, filename);
  const presigned = await getPresignedUploadPost(key, contentType, MAX_FILE_SIZE);

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
    maxSize: MAX_FILE_SIZE,
  });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);
