import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { safeParse } from "@/lib/validations/helpers";
import { telemedicineUpdateSchema } from "@/lib/validations/telemedicine";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/telemedicine/[id]
 * Détails d'une session de télémédecine.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const { data, error } = await supabase
    .from("telemedicine_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .single();

  if (error || !data) {
    return apiError("Session non trouvée", 404, "NOT_FOUND");
  }

  return apiSuccess({ session: data });
}, STAFF_ROLES);

/**
 * PATCH /api/telemedicine/[id]
 * Mettre à jour une session de télémédecine (statut, notes, etc.).
 */
export const PATCH = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const rawBody = await request.json();
  const parsed = safeParse(telemedicineUpdateSchema, rawBody);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const { status, consultation_notes, room_url, duration_minutes } = parsed.data;

  const { data, error } = await supabase
    .from("telemedicine_sessions")
    .update({
      updated_at: new Date().toISOString(),
      ...(status !== undefined ? { status } : {}),
      ...(consultation_notes !== undefined ? { consultation_notes } : {}),
      ...(room_url !== undefined ? { room_url } : {}),
      ...(duration_minutes !== undefined ? { duration_minutes } : {}),
      ...(status === "in_progress" ? { started_at: new Date().toISOString() } : {}),
      ...(status === "completed" ? { ended_at: new Date().toISOString() } : {}),
    })
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    logger.error("Échec de la mise à jour de la session", {
      context: "telemedicine/update",
      error,
    });
    return apiError("Échec de la mise à jour", 500);
  }

  await logAuditEvent({
    supabase,
    action: "telemedicine.update",
    type: "patient",
    clinicId,
    actor: profile.id,
    description: `Session de télémédecine ${id} mise à jour`,
    metadata: { session_id: id, status },
  });

  return apiSuccess({ session: data });
}, STAFF_ROLES);
