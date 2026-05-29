/**
 * Lab Results Integration API
 *
 * GET    /api/lab/results — List lab results for the clinic
 * POST   /api/lab/results — Upload a lab result (auto-notify patient via WhatsApp)
 * PATCH  /api/lab/results — Update lab result status (reviewed/shared)
 *
 * Integrates with existing lab invoice/materials pages.
 * Requires doctor, receptionist, clinic_admin, or super_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notification-queue";
import type { NotificationTrigger } from "@/lib/notifications";
import { buildUploadKey, uploadToR2, isR2Configured } from "@/lib/r2";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["super_admin", "clinic_admin", "doctor", "receptionist"];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
]);

// ── GET — list lab results ──

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    const status = url.searchParams.get("status");

    let query = supabase
      .from("lab_results")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (patientId) {
      query = query.eq("patient_id", patientId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch lab results", { clinicId, error });
      return apiInternalError();
    }

    return apiSuccess({ results: data ?? [] });
  } catch (error) {
    logger.error("Lab results GET failed", { error });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);

// ── POST — upload a lab result ──

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const title = formData.get("title") as string | null;
    const doctorId = formData.get("doctorId") as string | null;
    const orderId = formData.get("orderId") as string | null;
    const notes = formData.get("notes") as string | null;
    const notifyPatient = formData.get("notifyPatient") !== "false";

    if (!patientId || !title) {
      return apiError("patientId and title are required", 400, "VALIDATION_ERROR");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      return apiError("Invalid patientId format", 400, "VALIDATION_ERROR");
    }

    const { data: patient } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (!patient) {
      return apiError("Patient not found in this clinic", 404, "PATIENT_NOT_FOUND");
    }

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return apiError("File too large (max 10 MB)", 400, "FILE_TOO_LARGE");
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return apiError("Unsupported file type", 400, "INVALID_FILE_TYPE");
      }

      if (isR2Configured()) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = buildUploadKey(clinicId, "lab-results", file.name);
        const uploadResult = await uploadToR2(key, buffer, file.type);
        if (uploadResult) {
          fileKey = key;
        }
      }

      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type;
    }

    const { data: labResult, error: insertError } = await supabase
      .from("lab_results")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: doctorId ?? auth.profile.id,
        order_id: orderId ?? null,
        title,
        file_key: fileKey,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        notes: notes ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert lab result", { clinicId, error: insertError });
      return apiInternalError();
    }

    if (notifyPatient && patient.phone) {
      try {
        await enqueueNotification({
          clinicId,
          channel: "whatsapp",
          recipient: patient.phone,
          body: `Your lab results "${title}" are now available. Please contact your clinic for details.`,
          trigger: "prescription_ready" as NotificationTrigger,
          metadata: {
            lab_result_id: labResult.id,
            patient_name: patient.name,
          },
        });

        await supabase
          .from("lab_results")
          .update({ whatsapp_notified: true })
          .eq("id", labResult.id)
          .eq("clinic_id", clinicId);
      } catch (notifError) {
        logger.warn("Failed to send lab result notification", {
          labResultId: labResult.id,
          error: notifError,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "lab_result_uploaded",
      type: "patient",
      clinicId,
      actor: auth.profile.id,
      description: `Lab result "${title}" uploaded for patient ${patient.name}`,
      metadata: {
        lab_result_id: labResult.id,
        patient_id: patientId,
        file_name: fileName,
      },
    });

    return apiSuccess({ result: labResult });
  } catch (error) {
    logger.error("Lab results POST failed", { error });
    return apiInternalError();
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);

// ── PATCH — update lab result status ──

const updateLabResultSchema = z.object({
  resultId: z.string().uuid(),
  status: z.enum(["reviewed", "shared"]),
  notes: z.string().max(2000).optional(),
});

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const body = await request.json();
    const parsed = updateLabResultSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
    }

    const { resultId, status, notes } = parsed.data;

    const { data: existing } = await supabase
      .from("lab_results")
      .select("id, patient_id, title")
      .eq("id", resultId)
      .eq("clinic_id", clinicId)
      .single();

    if (!existing) {
      return apiError("Lab result not found", 404, "NOT_FOUND");
    }

    let whatsappNotified = false;

    if (status === "shared") {
      const { data: patient } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("id", existing.patient_id)
        .eq("clinic_id", clinicId)
        .single();

      if (patient?.phone) {
        try {
          await enqueueNotification({
            clinicId,
            channel: "whatsapp",
            recipient: patient.phone,
            body: `Your lab results "${existing.title}" have been shared with you. Contact your clinic for access.`,
            trigger: "prescription_ready" as NotificationTrigger,
            metadata: {
              lab_result_id: resultId,
              patient_name: patient.name,
            },
          });
          whatsappNotified = true;
        } catch (notifError) {
          logger.warn("Failed to send lab result share notification", {
            resultId,
            error: notifError,
          });
        }
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("lab_results")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(notes ? { notes } : {}),
        ...(status === "shared" ? { shared_at: new Date().toISOString() } : {}),
        ...(whatsappNotified ? { whatsapp_notified: true } : {}),
      })
      .eq("id", resultId)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to update lab result", { clinicId, resultId, error: updateError });
      return apiInternalError();
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: `lab_result_${status}`,
      type: "patient",
      clinicId,
      actor: auth.profile.id,
      description: `Lab result "${existing.title}" marked as ${status}`,
      metadata: { lab_result_id: resultId, new_status: status },
    });

    return apiSuccess({ result: updated });
  } catch (error) {
    logger.error("Lab results PATCH failed", { error });
    return apiInternalError();
  }
}

export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
