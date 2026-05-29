import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { safeParse } from "@/lib/validations/helpers";
import { insuranceClaimUpdateSchema } from "@/lib/validations/insurance-claims";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/insurance-claims/[id]
 * Détails d'une réclamation d'assurance.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const { data, error } = await supabase
    .from("insurance_claims")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .single();

  if (error || !data) {
    return apiError("Réclamation non trouvée", 404, "NOT_FOUND");
  }

  return apiSuccess({ claim: data });
}, STAFF_ROLES);

/**
 * PATCH /api/insurance-claims/[id]
 * Mettre à jour une réclamation (revue, approbation, rejet).
 */
export const PATCH = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) return apiError("ID requis", 400);

  const rawBody = await request.json();
  const parsed = safeParse(insuranceClaimUpdateSchema, rawBody);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const {
    status,
    approved_amount_centimes,
    patient_share_centimes,
    rejection_reason,
    reviewer_notes,
  } = parsed.data;

  const isReviewed =
    status === "approved" || status === "partially_approved" || status === "rejected";

  const { data, error } = await supabase
    .from("insurance_claims")
    .update({
      updated_at: new Date().toISOString(),
      ...(status !== undefined ? { status } : {}),
      ...(approved_amount_centimes !== undefined ? { approved_amount_centimes } : {}),
      ...(patient_share_centimes !== undefined ? { patient_share_centimes } : {}),
      ...(rejection_reason !== undefined ? { rejection_reason } : {}),
      ...(reviewer_notes !== undefined ? { reviewer_notes } : {}),
      ...(status === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
      ...(isReviewed ? { reviewed_at: new Date().toISOString() } : {}),
    })
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    logger.error("Échec de la mise à jour de la réclamation", {
      context: "insurance-claims/update",
      error,
    });
    return apiError("Échec de la mise à jour", 500);
  }

  await logAuditEvent({
    supabase,
    action: "insurance_claim.update",
    type: "payment",
    clinicId,
    actor: profile.id,
    description: `Réclamation ${id} mise à jour — statut: ${status ?? "inchangé"}`,
    metadata: { claim_id: id, status },
  });

  return apiSuccess({ claim: data });
}, STAFF_ROLES);
