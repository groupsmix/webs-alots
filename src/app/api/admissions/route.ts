import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { admissionCreateSchema } from "@/lib/validations/adt";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/admissions
 * Liste des admissions de la clinique. Supporte ?status=... &patient_id=... &page=... &limit=...
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const patientId = url.searchParams.get("patient_id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("admissions")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Échec du chargement des admissions", { context: "admissions/list", error });
    return apiError("Échec du chargement des admissions", 500);
  }

  return apiSuccess({ admissions: data, total: count ?? 0, page, limit });
}, STAFF_ROLES);

/**
 * POST /api/admissions
 * Créer une nouvelle admission (adapté du workflow ADT MedCore).
 */
export const POST = withAuthValidation(
  admissionCreateSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const { patient_id, bed_id, department_id, admitting_doctor_id, diagnosis, notes } = body;

    const { data: admission, error } = await supabase
      .from("admissions")
      .insert({
        clinic_id: clinicId,
        patient_id,
        bed_id,
        department_id: department_id ?? null,
        admitting_doctor_id: admitting_doctor_id ?? null,
        diagnosis: diagnosis ?? null,
        notes: notes ?? null,
        status: "admitted",
      })
      .select()
      .single();

    if (error) {
      logger.error("Échec de la création de l'admission", {
        context: "admissions/create",
        error,
      });
      return apiError("Échec de la création de l'admission", 500);
    }

    await logAuditEvent({
      supabase,
      action: "admission.create",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Admission du patient ${patient_id}`,
      metadata: { admission_id: admission.id, patient_id },
    });

    return apiSuccess({ admission }, 201);
  },
  STAFF_ROLES,
);
