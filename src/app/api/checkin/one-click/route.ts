import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { getLocalDateStr } from "@/lib/utils";
import { oneClickCheckinSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/checkin/one-click
 *
 * One-click patient check-in: patient arrives, taps their name on the
 * receptionist screen or kiosk, and is immediately added to the doctor's queue.
 *
 * If no appointmentId is provided, finds today's appointment for the patient+doctor.
 * Creates a waiting_queue entry and updates appointment status to "checked_in".
 */
export const POST = withAuthValidation(
  oneClickCheckinSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { patientId, doctorId, appointmentId } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;
      const today = getLocalDateStr();

      let resolvedAppointmentId = appointmentId;

      if (!resolvedAppointmentId) {
        const { data: todayAppt } = await supabase
          .from("appointments")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("patient_id", patientId)
          .eq("doctor_id", doctorId)
          .eq("appointment_date", today)
          .in("status", ["confirmed", "scheduled"])
          .order("start_time", { ascending: true })
          .limit(1)
          .single();

        if (!todayAppt) {
          return apiError("No appointment found for today", 404, "NO_APPOINTMENT");
        }
        resolvedAppointmentId = todayAppt.id;
      }

      // Update appointment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "checked_in" })
        .eq("id", resolvedAppointmentId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        logger.error("Failed to update appointment for one-click check-in", {
          context: "api/checkin/one-click",
          error: updateError,
        });
        return apiInternalError("Failed to check in");
      }

      // Calculate queue position
      const { data: existingQueue } = await untypedSupabase
        .from("waiting_queue")
        .select("id, position")
        .eq("clinic_id", clinicId)
        .eq("doctor_id", doctorId)
        .eq("status", "waiting")
        .order("position", { ascending: false })
        .limit(1);

      type QueueRow = { id: string; position: number };
      const lastEntry = (existingQueue as QueueRow[] | null)?.[0];
      const newPosition = (lastEntry?.position ?? 0) + 1;
      const MINUTES_PER_PATIENT = 15;
      const estimatedWait = (newPosition - 1) * MINUTES_PER_PATIENT;

      // Insert into waiting queue
      const { data: queueEntry, error: insertError } = await untypedSupabase
        .from("waiting_queue")
        .insert({
          clinic_id: clinicId,
          appointment_id: resolvedAppointmentId,
          patient_id: patientId,
          doctor_id: doctorId,
          position: newPosition,
          estimated_wait_minutes: estimatedWait,
          checked_in_at: new Date().toISOString(),
          status: "waiting",
          checkin_method: "one_click",
        })
        .select("id, position, estimated_wait_minutes")
        .single();

      if (insertError) {
        logger.error("Failed to add to waiting queue", {
          context: "api/checkin/one-click",
          error: insertError,
        });
        return apiInternalError("Failed to add to queue");
      }

      await logAuditEvent({
        supabase,
        action: "one_click_checkin",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Patient ${patientId} checked in via one-click`,
        metadata: {
          patientId,
          doctorId,
          appointmentId: resolvedAppointmentId,
          queuePosition: newPosition,
        },
      });

      return apiSuccess({
        checkedIn: true,
        appointmentId: resolvedAppointmentId,
        queuePosition: newPosition,
        estimatedWaitMinutes: estimatedWait,
        queueEntryId: (queueEntry as { id: string }).id,
      });
    } catch (err) {
      logger.error("One-click check-in failed", {
        context: "api/checkin/one-click",
        error: err,
      });
      return apiInternalError("Check-in failed");
    }
  },
  ["clinic_admin", "receptionist", "doctor", "patient"],
);
