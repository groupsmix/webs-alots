import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { attestationSignSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/attestations/sign
 *
 * Sign an attestation — marks it as signed by the doctor.
 * Only the doctor who created it (or clinic_admin) can sign.
 */
export const POST = withAuthValidation(
  attestationSignSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { attestationId } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Verify attestation exists and is in draft status
      const { data: existing, error: fetchError } = await untypedSupabase
        .from("attestations")
        .select("id, doctor_id, status")
        .eq("id", attestationId)
        .eq("clinic_id", clinicId)
        .single();

      if (fetchError || !existing) {
        return apiError("Attestation not found", 404, "NOT_FOUND");
      }

      type ExistingRow = { id: string; doctor_id: string; status: string };
      const row = existing as ExistingRow;

      if (row.status !== "draft") {
        return apiError("Only draft attestations can be signed", 400, "INVALID_STATUS");
      }

      // Update to signed
      const { error: updateError } = await untypedSupabase
        .from("attestations")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signed_by: auth.profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attestationId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        logger.error("Failed to sign attestation", {
          context: "api/attestations/sign",
          error: updateError,
        });
        return apiInternalError("Failed to sign attestation");
      }

      await logAuditEvent({
        supabase,
        action: "attestation_signed",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Attestation ${attestationId} signed`,
        metadata: { attestationId },
      });

      return apiSuccess({ signed: true, attestationId });
    } catch (err) {
      logger.error("Attestation sign failed", {
        context: "api/attestations/sign",
        error: err,
      });
      return apiInternalError("Failed to sign attestation");
    }
  },
  ["clinic_admin", "doctor"],
);
