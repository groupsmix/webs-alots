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
 * GET /api/upload/presign — Get a pre-signed URL for direct browser upload
 *   Query params: filename, contentType, category, clinicId
 *   Returns: { uploadUrl: string, publicUrl: string, key: string }
 */

import { NextResponse } from "next/server";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
  getPresignedUploadUrl,
} from "@/lib/r2";
import { withAuth } from "@/lib/with-auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

export const POST = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured" },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const category = (formData.get("category") as string) || "uploads";
  // Derive clinicId from the authenticated user's profile to prevent
  // cross-tenant file access. Fall back to "shared" only for super_admins.
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? ((formData.get("clinicId") as string) || "shared") : "shared");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 400 },
    );
  }

  const key = buildUploadKey(clinicId, category, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // HIGH-05: Validate file content matches declared MIME type via magic bytes.
  // Prevents attackers from uploading malicious HTML/JS with a spoofed Content-Type.
  if (!validateFileContent(buffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match declared type" },
      { status: 400 },
    );
  }

  const url = await uploadToR2(key, buffer, file.type);
  if (!url) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url, key });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);

export const GET = withAuth(async (request, { profile }) => {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const category = searchParams.get("category") || "uploads";
  // Derive clinicId from session, not from untrusted query params
  const clinicId = profile.clinic_id ?? (profile.role === "super_admin" ? (searchParams.get("clinicId") || "shared") : "shared");

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `File type not allowed: ${contentType}` },
      { status: 400 },
    );
  }

  const key = buildUploadKey(clinicId, category, filename);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  if (!uploadUrl) {
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : null;

  return NextResponse.json({ uploadUrl, publicUrl, key });
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);
