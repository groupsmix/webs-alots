/**
 * PATCH /api/appointments/:id/cancel
 *
 * Cancels a confirmed/pending/scheduled appointment and triggers
 * waitlist promotion for the freed slot.
 */

import { type NextRequest } from "next/server";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { promoteWaitlist } from "@/lib/waitlist";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const CANCELLABLE = new Set(["confirmed", "pending", "scheduled"]);

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, { supabase, profile }: AuthContext, routeCtx) => {
    const { id } = await routeCtx!.params;
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiNotFound();

    const { data: appt, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, clinic_id, doctor_id, slot_start, status, patient_id")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (fetchErr || !appt) return apiNotFound("Appointment not found");

    // Patients may only cancel their own appointments
    if (profile.role === "patient" && appt.patient_id !== profile.id) {
      return apiError("Cannot cancel another patient's appointment", 403, "FORBIDDEN");
    }

    if (!CANCELLABLE.has(appt.status)) {
      return apiError(
        `Cannot cancel appointment with status: ${appt.status}`,
        409,
        "NOT_CANCELLABLE",
      );
    }

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("clinic_id", clinicId);

    if (updateErr) return apiError("Failed to cancel appointment", 500);

    await logAuditEvent({
      supabase,
      action: "appointment_cancelled",
      type: "booking",
      clinicId,
      description: `Appointment ${id} cancelled by ${profile.role} ${profile.id}`,
      metadata: { appointmentId: id, cancelledBy: profile.id, role: profile.role },
    });

    // Fire-and-forget waitlist promotion — failure must not block the response
    promoteWaitlist({
      doctorId: appt.doctor_id,
      clinicId,
      cancelledSlot: appt.slot_start,
    }).catch((err) =>
      logger.warn("promoteWaitlist failed after cancellation", {
        context: "appointments/cancel",
        appointmentId: id,
        error: err,
      }),
    );

    return apiSuccess({ cancelled: true });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"],
);
