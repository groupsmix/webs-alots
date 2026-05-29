/**
 * PATCH /api/clinic-owner/insurance-claims/[id]
 *
 * Update an insurance claim (status, approval amount, etc.).
 * Also generates standard Moroccan insurance form data.
 * Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { insuranceClaimUpdateSchema } from "@/lib/validations/clinic-owner";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(insuranceClaimUpdateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { id, ...updates } = parsed.data;

    const updatePayload: Database["public"]["Tables"]["insurance_claims"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
      if (updates.status === "submitted") {
        updatePayload.submitted_at = new Date().toISOString();
      }
      if (["approved", "partially_approved", "rejected"].includes(updates.status)) {
        updatePayload.resolved_at = new Date().toISOString();
      }
    }
    if (updates.amount_approved !== undefined)
      updatePayload.amount_approved = updates.amount_approved;
    if (updates.claim_number !== undefined) updatePayload.claim_number = updates.claim_number;
    if (updates.rejection_reason !== undefined)
      updatePayload.rejection_reason = updates.rejection_reason;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;

    const { data, error } = await supabase
      .from("insurance_claims")
      .update(updatePayload)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "insurance-claims/update");

    await logAuditEvent({
      supabase,
      action: "insurance_claim_updated",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Insurance claim ${id} updated: ${updates.status ?? "fields changed"}`,
    });

    return apiSuccess({ claim: data });
  } catch (err) {
    logger.error("Failed to update insurance claim", {
      context: "clinic-owner/insurance-claims",
      error: err,
    });
    return apiInternalError("Failed to update insurance claim");
  }
}

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const id = segments[segments.length - 1];

    const { data: claim, error } = await supabase
      .from("insurance_claims")
      .select("*")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .single();

    if (error) return apiSupabaseError(error, "insurance-claims/get");
    if (!claim) return apiError("Claim not found", 404, "NOT_FOUND");

    const [patientRes, doctorRes, clinicRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, phone, email")
        .eq("id", claim.patient_id)
        .eq("clinic_id", clinicId)
        .single(),
      claim.doctor_id
        ? supabase
            .from("users")
            .select("id, name")
            .eq("id", claim.doctor_id)
            .eq("clinic_id", clinicId)
            .single()
        : Promise.resolve({ data: null }),
      supabase.from("clinics").select("id, name, address, phone").eq("id", clinicId).single(),
    ]);

    const formData = {
      claimId: claim.id,
      claimNumber: claim.claim_number,
      insuranceType: claim.insurance_type,
      policyNumber: claim.policy_number,
      patientName: patientRes.data?.name ?? "",
      patientPhone: patientRes.data?.phone ?? "",
      doctorName: doctorRes.data?.name ?? "",
      clinicName: clinicRes.data?.name ?? "",
      clinicAddress: (clinicRes.data as Record<string, unknown>)?.address ?? "",
      diagnosisCode: claim.diagnosis_code,
      treatmentDescription: claim.treatment_description,
      amountClaimed: claim.amount_claimed,
      amountApproved: claim.amount_approved,
      status: claim.status,
      submittedAt: claim.submitted_at,
      resolvedAt: claim.resolved_at,
    };

    return apiSuccess({ claim, formData });
  } catch (err) {
    logger.error("Failed to get insurance claim detail", {
      context: "clinic-owner/insurance-claims",
      error: err,
    });
    return apiInternalError("Failed to get insurance claim");
  }
}

export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
export const GET = withAuth(handleGet, ALLOWED_ROLES);
