import { NextRequest } from "next/server";
import { withAuthValidation } from "@/lib/api-validate";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase-server";
import { patientProfileUpdateSchema } from "@/lib/validations";
import type { AuthContext } from "@/lib/with-auth";

/**
 * Update patient profile with Art.16 Rectification Audit Trail.
 * 
 * Replaces direct client-side Supabase updates to guarantee that an audit log
 * with before/after diff is correctly inserted into `activity_logs`.
 */
async function handleUpdateProfile(
  body: Record<string, unknown>,
  request: NextRequest,
  auth: AuthContext
) {
  const profile = auth.profile;
  const clinicId = profile.clinic_id;
  const userId = profile.id;
  
  if (!clinicId) {
    return apiError("Missing clinic context", 400);
  }

  const adminClient = createAdminClient();

  // 1. Fetch current profile state for "before" diff
  const { data: currentProfile, error: fetchError } = await adminClient
    .from("users")
    .select("full_name, email, phone, date_of_birth, gender, insurance_type, address")
    .eq("id", userId)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !currentProfile) {
    return apiError("Patient not found", 404);
  }

  // 2. Perform the update
  const { data: updatedProfile, error: updateError } = await adminClient
    .from("users")
    .update({
      full_name: body.full_name,
      email: body.email,
      phone: body.phone,
      date_of_birth: body.date_of_birth,
      gender: body.gender,
      insurance_type: body.insurance_type,
      address: body.address,
    })
    .eq("id", userId)
    .eq("clinic_id", clinicId)
    .select("full_name, email, phone, date_of_birth, gender, insurance_type, address")
    .single();

  if (updateError) {
    return apiError("Failed to update profile", 500);
  }

  // 3. Log the Art.16 Rectification audit event with before/after state
  await logAuditEvent({
    supabase: adminClient,
    action: "patient_profile_updated",
    type: "patient",
    clinicId,
    actor: userId,
    description: "Patient updated their profile details",
    metadata: {
      before: currentProfile,
      after: updatedProfile,
    },
  });

  return apiSuccess({ profile: updatedProfile });
}

export const POST = withAuthValidation(
  patientProfileUpdateSchema,
  handleUpdateProfile,
  ["patient"] // only patients can update their own profile via this route
);
