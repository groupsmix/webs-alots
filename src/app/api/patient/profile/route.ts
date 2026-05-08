import { apiSuccess, apiInternalError, apiBadRequest } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { patientProfileUpdateSchema } from "@/lib/validations";

/**
 * PATCH /api/patient/profile
 *
 * A62-F1: Audited patient profile self-update endpoint.
 *
 * Moroccan Law 09-08 Art.16 (rectification right) and Art.24 (audit trail)
 * require that profile edits by data subjects are:
 *   1. Validated before persistence (Zod schema with .strict())
 *   2. Logged with before/after diff for audit purposes
 *   3. Scoped to the authenticated patient's own record
 *
 * Immutable fields (clinic_id, role, auth_id, email) are not accepted —
 * the schema uses .strict() to reject unknown fields.
 *
 * Previous pattern: client-side direct Supabase call with no audit trail.
 * This route replaces that pattern and guarantees audit event emission.
 */
export const PATCH = withAuthValidation(
  patientProfileUpdateSchema,
  async (body, _request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Ensure the patient can only update their own profile
    const userId = profile.id;

    // Fetch current state for before/after diff (audit trail)
    const { data: currentProfile, error: fetchError } = await supabase
      .from("users")
      .select("name, phone, date_of_birth, address, blood_type")
      .eq("id", userId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !currentProfile) {
      logger.error("Failed to fetch patient profile for update", {
        context: "patient/profile",
        userId,
        clinicId,
        error: fetchError,
      });
      return apiInternalError("Failed to fetch current profile");
    }

    // Build update payload — only include fields provided in the request
    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.date_of_birth !== undefined) updatePayload.date_of_birth = body.date_of_birth;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.blood_type !== undefined) updatePayload.blood_type = body.blood_type;

    if (Object.keys(updatePayload).length === 0) {
      return apiBadRequest("No fields to update");
    }

    // Apply the update
    const { error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to update patient profile", {
        context: "patient/profile",
        userId,
        clinicId,
        error: updateError,
      });
      return apiInternalError("Failed to update profile");
    }

    // A62-F1: Emit audit event with changed fields (no PII values, only field names)
    // Law 09-08 Art.24 requires audit trail; never log PII values in audit description.
    const changedFields = Object.keys(updatePayload);
    await logAuditEvent({
      supabase,
      action: "patient_profile_updated",
      type: "user",
      clinicId,
      description: `Patient updated profile fields: ${changedFields.join(", ")}`,
      // Record before state for immutable audit diff (field names + whether they changed)
      metadata: {
        userId,
        changedFields,
        hadPreviousValues: changedFields.map((f) => ({
          field: f,
          hadValue: currentProfile[f as keyof typeof currentProfile] != null,
        })),
      },
    });

    return apiSuccess({ updated: true, changedFields });
  },
  // Only patients can update their own profile via this route
  ["patient"],
);
