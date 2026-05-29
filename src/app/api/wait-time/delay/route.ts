import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { doctorDelayUpdateSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/wait-time/delay
 *
 * Update a doctor's current delay status.
 * Used by staff to indicate "Dr. X is running 20 min behind".
 */
export const POST = withAuthValidation(
  doctorDelayUpdateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { doctorId, delayMinutes, reason } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Upsert the delay status
      const { data: delayRecord, error: upsertError } = await untypedSupabase
        .from("doctor_delay_status")
        .upsert(
          {
            clinic_id: clinicId,
            doctor_id: doctorId,
            current_delay_minutes: delayMinutes,
            last_updated_at: new Date().toISOString(),
            updated_by: auth.profile.id,
            reason: reason ?? null,
          },
          { onConflict: "clinic_id,doctor_id" },
        )
        .select("id, current_delay_minutes, last_updated_at, reason")
        .single();

      if (upsertError) {
        logger.error("Failed to update doctor delay", {
          context: "api/wait-time/delay",
          error: upsertError,
        });
        return apiInternalError("Échec de la mise à jour du statut de retard");
      }

      await logAuditEvent({
        supabase,
        action: "doctor_delay_updated",
        type: "admin",
        clinicId,
        actor: auth.user.id,
        description: `Doctor ${doctorId} delay updated to ${delayMinutes} min`,
        metadata: {
          doctorId,
          delayMinutes,
          reason: reason ?? null,
        },
      });

      return apiSuccess({ delay: delayRecord });
    } catch (err) {
      logger.error("Doctor delay update failed", {
        context: "api/wait-time/delay",
        error: err,
      });
      return apiInternalError("Échec de la mise à jour du retard");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
