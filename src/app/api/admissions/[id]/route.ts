import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { assertScopeGate } from "@/lib/scope-gate";
import { dischargeSchema, transferSchema } from "@/lib/validations/adt";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/admissions/[id]
 * Détails d'une admission spécifique.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  // ADR 0013: Scope gate — admissions is an ADT vertical
  const denied = await assertScopeGate(supabase, clinicId, "admissions");
  if (denied) return denied;

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const { data, error } = await supabase
    .from("admissions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .single();

  if (error || !data) {
    return apiError("Admission non trouvée", 404, "NOT_FOUND");
  }

  return apiSuccess({ admission: data });
}, STAFF_ROLES);

/**
 * PATCH /api/admissions/[id]
 * Mettre à jour une admission: sortie (discharge) ou transfert.
 */
export const PATCH = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  // ADR 0013: Scope gate — admissions is an ADT vertical
  const denied = await assertScopeGate(supabase, clinicId, "admissions");
  if (denied) return denied;

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const rawBody = await request.json();
  const action = rawBody.action as string | undefined;

  if (action === "discharge") {
    const parsed = safeParse(dischargeSchema, rawBody);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { notes } = parsed.data;

    const { data, error } = await supabase
      .from("admissions")
      .update({
        status: "discharged",
        discharge_date: new Date().toISOString(),
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId)
      .eq("id", id)
      .eq("status", "admitted")
      .select()
      .single();

    if (error || !data) {
      logger.error("Échec de la sortie du patient", { context: "admissions/discharge", error });
      return apiError("Échec de la sortie du patient", 500);
    }

    await logAuditEvent({
      supabase,
      action: "admission.discharge",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Sortie du patient — admission ${id}`,
      metadata: { admission_id: id },
    });

    return apiSuccess({ admission: data });
  }

  if (action === "transfer") {
    const parsed = safeParse(transferSchema, rawBody);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { department_id, bed_id, notes } = parsed.data;

    const { data, error } = await supabase
      .from("admissions")
      .update({
        status: "transferred",
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
        ...(department_id ? { department_id } : {}),
        ...(bed_id ? { bed_id } : {}),
      })
      .eq("clinic_id", clinicId)
      .eq("id", id)
      .eq("status", "admitted")
      .select()
      .single();

    if (error || !data) {
      logger.error("Échec du transfert", { context: "admissions/transfer", error });
      return apiError("Échec du transfert", 500);
    }

    await logAuditEvent({
      supabase,
      action: "admission.transfer",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Transfert du patient — admission ${id}`,
      metadata: { admission_id: id, department_id },
    });

    return apiSuccess({ admission: data });
  }

  return apiError("Action non reconnue. Utilisez 'discharge' ou 'transfer'.", 400);
}, STAFF_ROLES);
