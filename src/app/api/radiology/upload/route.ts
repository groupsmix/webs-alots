/**
 * POST /api/radiology/upload — Upload radiology images to R2 + record in DB
 *
 * Accepts multipart/form-data with:
 *   - file: The image file (X-ray, MRI, CT, DICOM, etc.)
 *   - orderId: Radiology order UUID
 *   - clinicId: Clinic UUID
 *   - modality: (optional) Imaging modality
 *   - description: (optional) Image description
 *
 * Returns: { id, url, key }
 */

import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { createRadiologyImage } from "@/lib/data/server";
import { logger } from "@/lib/logger";
import { uploadToR2, isR2Configured, buildUploadKey } from "@/lib/r2";
import { withAuth } from "@/lib/with-auth";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (aligned with main upload route)

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "application/pdf",
  "application/dicom",
]);

// Magic byte signatures for server-side file content validation.
// Client-supplied MIME types are attacker-controlled and cannot be trusted.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/tiff": [
    new Uint8Array([0x49, 0x49, 0x2A, 0x00]), // Little-endian
    new Uint8Array([0x4D, 0x4D, 0x00, 0x2A]), // Big-endian
  ],
  "image/bmp": [new Uint8Array([0x42, 0x4D])],
  "application/pdf": [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  "application/dicom": [new Uint8Array([0x44, 0x49, 0x43, 0x4D])], // "DICM" at offset 128
};

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;

  // DICOM files have "DICM" at byte offset 128
  if (declaredType === "application/dicom") {
    if (buffer.length < 132) return false;
    return signatures.some((sig) =>
      sig.every((byte, i) => buffer[128 + i] === byte),
    );
  }

  return signatures.some((sig) =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
}

export const POST = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    return apiError("File storage is not configured", 503);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const orderId = formData.get("orderId") as string;
  // FIX (MED-03): Derive clinicId from the authenticated user's profile
  // instead of trusting untrusted form data, which could allow cross-tenant access.
  const clinicId = profile.clinic_id;
  const modality = (formData.get("modality") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;

  if (!file || !(file instanceof File)) {
    return apiError("No file provided");
  }

  if (!orderId || !clinicId) {
    return apiError("orderId is required and user must belong to a clinic");
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiError("File too large (max 10 MB)");
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return apiError(`File type not allowed: ${file.type}`);
  }

  const isDicom =
    file.type === "application/dicom" ||
    file.name.toLowerCase().endsWith(".dcm");

  const key = buildUploadKey(clinicId, "radiology", file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate file content matches declared MIME type via magic bytes.
  // Prevents attackers from uploading malicious files with a spoofed Content-Type.
  if (!validateFileContent(buffer, file.type)) {
    return apiError("File content does not match declared type");
  }

  const url = await uploadToR2(key, buffer, file.type);
  if (!url) {
    // A84-F3: User-friendly error with structured logging for R2 outages.
    logger.error("Radiology upload failed — R2 storage unavailable or write error", {
      context: "radiology/upload",
      clinicId,
      orderId,
      contentType: file.type,
      fileSize: file.size,
    });
    return apiError(
      "Image upload failed. Please try again later or contact support if the problem persists.",
      502,
      "STORAGE_UNAVAILABLE",
    );
  }

  const imageRecord = await createRadiologyImage({
    order_id: orderId,
    clinic_id: clinicId,
    file_url: url,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
    modality,
    is_dicom: isDicom,
    description,
  });

  if (!imageRecord) {
    return apiInternalError("Failed to save image record");
  }

  return apiSuccess({ id: imageRecord.id, url, key });
}, STAFF_ROLES);
