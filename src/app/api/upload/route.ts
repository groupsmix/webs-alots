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

import { NextResponse, type NextRequest } from "next/server";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
  getPresignedUploadUrl,
} from "@/lib/r2";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured" },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const category = (formData.get("category") as string) || "uploads";
  const clinicId = (formData.get("clinicId") as string) || "shared";

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

  const url = await uploadToR2(key, buffer, file.type);
  if (!url) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url, key });
}

export async function GET(request: NextRequest) {
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
  const clinicId = searchParams.get("clinicId") || "shared";

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
}
