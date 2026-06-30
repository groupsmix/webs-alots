/**
 * Patient documents API — list / create / delete the authenticated
 * patient's own uploaded documents.
 *
 * The file bytes are uploaded separately via POST /api/upload (category
 * "patient_files"), which handles magic-byte validation, AV scanning,
 * EXIF stripping and PHI encryption. This route owns the `patient_files`
 * rows that link those R2 objects to the patient and is the
 * system-of-record the `patient/documents` page reads from.
 *
 * Security
 *   - Every operation is scoped to the authenticated patient: rows are
 *     filtered by `patient_id = profile.id`, and any submitted R2 key is
 *     validated to live under the caller's own clinic prefix. This mirrors
 *     the patient-level access check in /api/files/download.
 *   - patient_files RLS (migration 00180) is clinic-scoped via
 *     get_request_clinic_id(), which `withAuth` sets from the session, so
 *     cross-clinic access is also blocked at the database layer.
 *
 * NOTE: patient_files is not yet in the generated Database types (see the
 * matching note in api/files/download). Reads/writes go through small
 * helpers typed against an untyped SupabaseClient at the boundary.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, type NextResponse } from "next/server";
import { apiError, apiForbidden, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { deleteFromR2 } from "@/lib/r2";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const DOC_TYPES = new Set(["analysis", "radiology", "insurance", "other"]);
const MAX_NAME_LENGTH = 200;

interface PatientFileRow {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  r2_key: string;
  metadata: { doc_type?: string } | null;
  created_at: string;
}

/** Normalize the doc_type stored in metadata, defaulting unknown values. */
export function normalizeDocType(value: unknown): string {
  return typeof value === "string" && DOC_TYPES.has(value) ? value : "other";
}

/**
 * Reject keys with traversal segments, control characters, or anything
 * outside the conservative R2-key alphabet. Mirrors `isSafeKey` in the
 * download route (defense-in-depth for caller-supplied keys).
 */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.startsWith("/") || key.includes("..") || key.includes("\\")) return false;
  if (key.includes("\0") || /%00/i.test(key)) return false;
  if (/[\u0000-\u001f\u007f]/.test(key)) return false;
  return /^[A-Za-z0-9._/-]+$/.test(key);
}

/**
 * The cross-tenant guard: a caller-supplied R2 key may only be claimed if it
 * lives under that patient's own `clinics/{clinicId}/` prefix. This is the
 * primary defense against a patient registering a row that points at another
 * clinic's object, and mirrors the prefix scoping in /api/files/download.
 *
 * Returns false for an absent clinicId so a patient with no clinic context
 * can never claim a key.
 */
export function keyBelongsToClinic(key: string, clinicId: string | null | undefined): boolean {
  if (!clinicId) return false;
  return isSafeKey(key) && key.startsWith(`clinics/${clinicId}/`);
}

async function listDocuments(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
): Promise<PatientFileRow[]> {
  const { data, error } = await supabase
    .from("patient_files")
    .select("id, file_name, file_type, file_size, r2_key, metadata, created_at")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as PatientFileRow[];
}

async function insertDocument(
  supabase: SupabaseClient,
  row: {
    clinic_id: string;
    patient_id: string;
    uploaded_by: string;
    file_name: string;
    file_type: string;
    file_size: number;
    r2_key: string;
    metadata: Record<string, unknown>;
  },
): Promise<PatientFileRow | null> {
  // `row` carries clinic_id (see the typed parameter above) and patient_files
  // is clinic-keyed; every read path filters .eq("clinic_id", ...). The insert
  // passes a variable, not an inline { clinic_id, ... } literal, so the
  // tenant-scoping matcher can't see the key, so suppress that false positive.
  // nosemgrep: semgrep.tenant-scoping
  const { data, error } = await supabase
    .from("patient_files")
    .insert(row)
    .select("id, file_name, file_type, file_size, r2_key, metadata, created_at")
    .single();
  if (error) throw error;
  return (data as PatientFileRow) ?? null;
}

async function findDocument(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  id: string,
): Promise<{ r2_key: string } | null> {
  const { data } = await supabase
    .from("patient_files")
    .select("r2_key")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("id", id)
    .maybeSingle<{ r2_key: string }>();
  return data;
}

async function deleteDocumentRow(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("patient_files")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("id", id);
  if (error) throw error;
}

/** Map a stored row to the shape the patient/documents page consumes. */
function toDocumentView(row: PatientFileRow) {
  return {
    id: row.id,
    name: row.file_name,
    type: normalizeDocType(row.metadata?.doc_type),
    fileType: row.file_type,
    size: row.file_size,
    key: row.r2_key,
    date: row.created_at.slice(0, 10),
  };
}

async function getHandler(
  _request: NextRequest,
  { supabase, profile }: AuthContext,
): Promise<NextResponse> {
  if (!profile.clinic_id) return apiForbidden("Clinic context required");
  try {
    const rows = await listDocuments(supabase, profile.clinic_id, profile.id);
    return apiSuccess({ documents: rows.map(toDocumentView) });
  } catch (err) {
    logger.warn("Failed to list patient documents", {
      context: "api/patient/documents",
      error: err,
    });
    return apiError("Failed to load documents", 500);
  }
}

async function postHandler(
  request: NextRequest,
  { supabase, profile }: AuthContext,
): Promise<NextResponse> {
  if (!profile.clinic_id) return apiForbidden("Clinic context required");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const input = body as Record<string, unknown>;
  const r2Key = typeof input.r2Key === "string" ? input.r2Key : "";
  const rawName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const fileType = typeof input.fileType === "string" ? input.fileType : "application/octet-stream";
  const fileSize = typeof input.fileSize === "number" ? Math.floor(input.fileSize) : 0;
  const docType = normalizeDocType(input.docType);

  if (!r2Key || !isSafeKey(r2Key)) {
    return apiError("A valid uploaded file key is required");
  }
  // The R2 key must live under the caller's own clinic prefix — this is the
  // primary cross-tenant guard, identical to the download-side check.
  if (!keyBelongsToClinic(r2Key, profile.clinic_id)) {
    logger.warn("Patient document key outside caller clinic prefix", {
      context: "api/patient/documents",
      patientId: profile.id,
    });
    return apiForbidden("File key does not belong to your clinic");
  }
  if (!rawName) return apiError("A document name is required");
  if (fileSize <= 0) return apiError("A valid file size is required");

  const fileName = rawName.slice(0, MAX_NAME_LENGTH);
  const originalName =
    typeof input.originalName === "string" ? input.originalName.slice(0, MAX_NAME_LENGTH) : null;

  try {
    const row = await insertDocument(supabase, {
      clinic_id: profile.clinic_id,
      patient_id: profile.id,
      uploaded_by: profile.id,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      r2_key: r2Key,
      metadata: { doc_type: docType, original_name: originalName },
    });
    if (!row) return apiError("Failed to save document", 500);
    return apiSuccess({ document: toDocumentView(row) }, 201);
  } catch (err) {
    logger.warn("Failed to save patient document", {
      context: "api/patient/documents",
      error: err,
    });
    return apiError("Failed to save document", 500);
  }
}

async function deleteHandler(
  request: NextRequest,
  { supabase, profile }: AuthContext,
): Promise<NextResponse> {
  if (!profile.clinic_id) return apiForbidden("Clinic context required");

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return apiError("Missing document id");

  try {
    const existing = await findDocument(supabase, profile.clinic_id, profile.id, id);
    if (!existing) return apiError("Document not found", 404);

    await deleteDocumentRow(supabase, profile.clinic_id, profile.id, id);

    // Best-effort removal of the underlying R2 object(s). Encrypted PHI is
    // stored at `${r2_key}.enc`; non-encrypted objects at the bare key. A
    // missing key is a no-op, so deleting both variants is safe.
    await Promise.allSettled([
      deleteFromR2(existing.r2_key),
      deleteFromR2(`${existing.r2_key}.enc`),
    ]);

    return apiSuccess({ id });
  } catch (err) {
    logger.warn("Failed to delete patient document", {
      context: "api/patient/documents",
      error: err,
    });
    return apiError("Failed to delete document", 500);
  }
}

export const GET = withAuth(getHandler, ["patient"]);
export const POST = withAuth(postHandler, ["patient"]);
export const DELETE = withAuth(deleteHandler, ["patient"]);
