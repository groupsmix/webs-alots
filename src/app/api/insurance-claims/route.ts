import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { assertScopeGate } from "@/lib/scope-gate";
import { insuranceClaimCreateSchema } from "@/lib/validations/insurance-claims";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/insurance-claims
 * Liste des réclamations d'assurance. Supporte ?status=... &insurance_type=... &patient_id=...
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  // ADR 0013: Scope gate — insurance-claims is a clinical vertical
  const denied = await assertScopeGate(supabase, clinicId, "insurance-claims");
  if (denied) return denied;

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const insuranceType = url.searchParams.get("insurance_type");
  const patientId = url.searchParams.get("patient_id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("insurance_claims")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (insuranceType) query = query.eq("insurance_type", insuranceType);
  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Échec du chargement des réclamations", {
      context: "insurance-claims/list",
      error,
    });
    return apiError("Échec du chargement des réclamations", 500);
  }

  return apiSuccess({ claims: data, total: count ?? 0, page, limit });
}, STAFF_ROLES);

/**
 * POST /api/insurance-claims
 * Créer une réclamation d'assurance (adapté de Health-Pay).
 */
export const POST = withAuthValidation(
  insuranceClaimCreateSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    // ADR 0013: Scope gate — insurance-claims is a clinical vertical
    const denied = await assertScopeGate(supabase, clinicId, "insurance-claims");
    if (denied) return denied;

    const { patient_id, insurance_type, amount_claimed, line_items, notes } = body;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    const { count: existingCount } = await supabase
      .from("insurance_claims")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    const seqNum = ((existingCount ?? 0) + 1).toString().padStart(4, "0");
    const claimNumber = `CLM-${insurance_type}-${dateStr}-${seqNum}`;

    const { data: claim, error } = await supabase
      .from("insurance_claims")
      .insert({
        clinic_id: clinicId,
        patient_id,
        claim_number: claimNumber,
        insurance_type,
        status: "draft",
        amount_claimed,
        line_items: line_items ? JSON.parse(JSON.stringify(line_items)) : [],
        notes: notes ?? null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Échec de la création de la réclamation", {
        context: "insurance-claims/create",
        error,
      });
      return apiError("Échec de la création de la réclamation", 500);
    }

    await logAuditEvent({
      supabase,
      action: "insurance_claim.create",
      type: "payment",
      clinicId,
      actor: profile.id,
      description: `Réclamation ${claimNumber} créée (${insurance_type})`,
      metadata: {
        claim_id: claim.id,
        claim_number: claimNumber,
        insurance_type,
        amount_claimed,
      },
    });

    return apiSuccess({ claim }, 201);
  },
  STAFF_ROLES,
);
