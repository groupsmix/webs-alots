/**
 * GET/POST /api/clinic-owner/insurance-claims
 *
 * CRUD for insurance claims. Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { insuranceClaimCreateSchema } from "@/lib/validations/clinic-owner";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const insuranceType = searchParams.get("insurance_type");

    let query = supabase
      .from("insurance_claims")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (insuranceType) {
      query = query.eq("insurance_type", insuranceType);
    }

    const { data, error } = await query.limit(500);
    if (error) return apiSupabaseError(error, "insurance-claims/list");

    const claims = data ?? [];

    const summary = {
      total: claims.length,
      draft: claims.filter((c) => c.status === "draft").length,
      submitted: claims.filter((c) => c.status === "submitted").length,
      pending: claims.filter((c) => c.status === "pending").length,
      approved: claims.filter((c) => c.status === "approved").length,
      partiallyApproved: claims.filter((c) => c.status === "partially_approved").length,
      rejected: claims.filter((c) => c.status === "rejected").length,
      totalClaimed: claims.reduce(
        (sum, c) => sum + (typeof c.amount_claimed === "number" ? c.amount_claimed : 0),
        0,
      ),
      totalApproved: claims.reduce(
        (sum, c) => sum + (typeof c.amount_approved === "number" ? c.amount_approved : 0),
        0,
      ),
    };

    return apiSuccess({ claims, summary });
  } catch (err) {
    logger.error("Failed to fetch insurance claims", {
      context: "clinic-owner/insurance-claims",
      error: err,
    });
    return apiInternalError("Failed to fetch insurance claims");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(insuranceClaimCreateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const {
      patient_id,
      doctor_id,
      appointment_id,
      insurance_type,
      policy_number,
      amount_claimed,
      diagnosis_code,
      treatment_description,
      notes,
    } = parsed.data;

    const { data, error } = await supabase
      .from("insurance_claims")
      .insert({
        clinic_id: clinicId,
        patient_id,
        doctor_id: doctor_id ?? null,
        appointment_id: appointment_id ?? null,
        insurance_type,
        policy_number: policy_number ?? null,
        amount_claimed,
        diagnosis_code: diagnosis_code ?? null,
        treatment_description: treatment_description ?? null,
        notes: notes ?? null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "insurance-claims/create");

    await logAuditEvent({
      supabase,
      action: "insurance_claim_created",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Insurance claim created: ${insurance_type} for patient ${patient_id}`,
    });

    return apiSuccess({ claim: data }, 201);
  } catch (err) {
    logger.error("Failed to create insurance claim", {
      context: "clinic-owner/insurance-claims",
      error: err,
    });
    return apiInternalError("Failed to create insurance claim");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
