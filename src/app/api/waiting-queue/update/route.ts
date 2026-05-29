import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { waitingQueueUpdateSchema } from "@/lib/validations/patient-experience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/waiting-queue/update
 *
 * Update a waiting queue entry status (call patient, mark in_progress, complete).
 * Staff only — receptionist, clinic_admin, or doctor.
 */
export const POST = withAuthValidation(
  waitingQueueUpdateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const updateFields: Record<string, string> = {
        status: data.status,
      };

      if (data.status === "called") {
        updateFields.called_at = new Date().toISOString();
      }
      if (data.status === "completed" || data.status === "no_show") {
        updateFields.completed_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await untypedSupabase
        .from("waiting_queue")
        .update(updateFields)
        .eq("id", data.queueEntryId)
        .eq("clinic_id", clinicId)
        .select("id, appointment_id, patient_id, doctor_id, status")
        .single();

      if (updateError || !updated) {
        logger.error("Failed to update queue entry", {
          context: "api/waiting-queue/update",
          error: updateError,
        });
        return apiError("Queue entry not found", 404, "NOT_FOUND");
      }

      type UpdatedRow = {
        id: string;
        appointment_id: string;
        patient_id: string;
        doctor_id: string;
        status: string;
      };
      const row = updated as UpdatedRow;

      if (data.status === "completed") {
        await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("id", row.appointment_id)
          .eq("clinic_id", clinicId);
      }

      if (data.status === "completed" || data.status === "no_show") {
        const { data: remaining } = await untypedSupabase
          .from("waiting_queue")
          .select("id, position")
          .eq("clinic_id", clinicId)
          .eq("doctor_id", row.doctor_id)
          .eq("status", "waiting")
          .order("position", { ascending: true });

        type RemainingRow = { id: string; position: number };
        const entries = (remaining ?? []) as RemainingRow[];
        const MINUTES_PER_PATIENT = 15;

        for (let i = 0; i < entries.length; i++) {
          await untypedSupabase
            .from("waiting_queue")
            .update({
              position: i + 1,
              estimated_wait_minutes: i * MINUTES_PER_PATIENT,
            })
            .eq("id", entries[i].id)
            .eq("clinic_id", clinicId);
        }
      }

      await logAuditEvent({
        supabase,
        action: `queue_${data.status}`,
        type: "booking",
        clinicId,
        actor: auth.user.id,
        description: `Queue entry ${data.queueEntryId} updated to ${data.status}`,
        metadata: {
          queueEntryId: data.queueEntryId,
          appointmentId: row.appointment_id,
          newStatus: data.status,
        },
      });

      return apiSuccess({ updated: row });
    } catch (err) {
      logger.error("Failed to update queue entry", {
        context: "api/waiting-queue/update",
        error: err,
      });
      return apiInternalError("Failed to update queue entry");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
