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

import { NextResponse, type NextRequest } from "next/server";
import { uploadToR2, isR2Configured, buildUploadKey } from "@/lib/r2";
import { createRadiologyImage } from "@/lib/data/server";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";

const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB for medical images

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "application/pdf",
  "application/dicom",
  "application/octet-stream", // DICOM files often have this type
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured" },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const orderId = formData.get("orderId") as string;
  const clinicId = formData.get("clinicId") as string;
  const modality = (formData.get("modality") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!orderId || !clinicId) {
    return NextResponse.json(
      { error: "orderId and clinicId are required" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 50 MB)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 400 },
    );
  }

  const isDicom =
    file.type === "application/dicom" ||
    file.name.toLowerCase().endsWith(".dcm");

  const key = buildUploadKey(clinicId, "radiology", file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadToR2(key, buffer, file.type);
  if (!url) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
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
    return NextResponse.json(
      { error: "Failed to save image record" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: imageRecord.id, url, key });
}
