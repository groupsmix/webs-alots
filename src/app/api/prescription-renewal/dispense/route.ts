import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { prescriptionRenewalDispenseSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/prescription-renewal/dispense
 *
 * Mark a prescription renewal as dispensed by the pharmacy.
 */
export const POST = withAuthValidation(
  prescriptionRenewalDispenseSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { renewalId } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const { data: existing, error: fetchError } = await untypedSupabase
        .from("prescription_renewals")
        .select("id, status")
        .eq("id", renewalId)
        .eq("clinic_id", clinicId)
        .single();

      if (fetchError || !existing) {
        return apiError("Demande de renouvellement introuvable", 404, "NOT_FOUND");
      }

      type RenewalRow = { id: string; status: string };
      const renewal = existing as RenewalRow;

      if (renewal.status !== "approved") {
        return apiError(
          "Seuls les renouvellements approuvés peuvent être marqués comme dispensés",
          400,
          "INVALID_STATUS",
        );
      }

      const { error: updateError } = await untypedSupabase
        .from("prescription_renewals")
        .update({
          status: "dispensed",
          dispensed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", renewalId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        logger.error("Failed to mark renewal as dispensed", {
          context: "api/prescription-renewal/dispense",
          error: updateError,
        });
        return apiInternalError("Échec de la mise à jour du statut de dispensation");
      }

      await logAuditEvent({
        supabase,
        action: "prescription_renewal_dispensed",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Prescription renewal ${renewalId} dispensed`,
        metadata: { renewalId },
      });

      return apiSuccess({ renewalId, status: "dispensed" });
    } catch (err) {
      logger.error("Prescription renewal dispense failed", {
        context: "api/prescription-renewal/dispense",
        error: err,
      });
      return apiInternalError("Échec du marquage comme dispensé");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
