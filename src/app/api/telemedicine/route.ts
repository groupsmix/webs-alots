import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { telemedicineCreateSchema } from "@/lib/validations/telemedicine";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/telemedicine
 * Liste des sessions de télémédecine. Supporte ?status=... &doctor_id=... &patient_id=...
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const doctorId = url.searchParams.get("doctor_id");
  const patientId = url.searchParams.get("patient_id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("telemedicine_sessions")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Échec du chargement des sessions", { context: "telemedicine/list", error });
    return apiError("Échec du chargement des sessions", 500);
  }

  return apiSuccess({ sessions: data, total: count ?? 0, page, limit });
}, STAFF_ROLES);

/**
 * POST /api/telemedicine
 * Créer une session de télémédecine (adapté de MedCore).
 */
export const POST = withAuthValidation(
  telemedicineCreateSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const { patient_id, doctor_id, appointment_id, scheduled_at, consultation_notes } = body;

    const roomUrl = `https://meet.oltigo.com/${crypto.randomUUID()}`;

    const { data: session, error } = await supabase
      .from("telemedicine_sessions")
      .insert({
        clinic_id: clinicId,
        patient_id,
        doctor_id,
        appointment_id: appointment_id ?? null,
        scheduled_at,
        status: "scheduled",
        room_url: roomUrl,
        consultation_notes: consultation_notes ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Échec de la création de la session", {
        context: "telemedicine/create",
        error,
      });
      return apiError("Échec de la création de la session", 500);
    }

    await logAuditEvent({
      supabase,
      action: "telemedicine.create",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Consultation vidéo planifiée pour le patient ${patient_id}`,
      metadata: { session_id: session.id, doctor_id, scheduled_at },
    });

    return apiSuccess({ session }, 201);
  },
  STAFF_ROLES,
);
