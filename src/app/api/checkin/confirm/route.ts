import { NextRequest } from "next/server";
import { createTenantClient } from "@/lib/supabase-server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * POST /api/checkin/confirm
 *
 * Confirm patient arrival: update appointment status to "checked_in"
 * and calculate queue position / estimated wait.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, clinicId } = body as { appointmentId?: string; clinicId?: string };

    if (!appointmentId || !clinicId) {
      return apiError("Missing appointmentId or clinicId", 400);
    }

    const supabase = await createTenantClient(clinicId);

    // Update appointment status to "checked_in"
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "checked_in" })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to update appointment status", {
        context: "api/checkin/confirm",
        error: updateError,
      });
      return apiInternalError("Failed to check in");
    }

    // Calculate queue position: count how many people checked in today
    // before this patient (same clinic, status = checked_in, today)
    const today = new Date().toISOString().split("T")[0];

    const { data: checkedInToday } = await supabase
      .from("appointments")
      .select("id, start_time")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
      .eq("status", "checked_in")
      .order("start_time", { ascending: true });

    const queue = checkedInToday ?? [];
    const position = queue.findIndex((a) => a.id === appointmentId) + 1;
    const queuePosition = position > 0 ? position : queue.length;

    // Estimate wait: ~15 minutes per person ahead in queue
    const MINUTES_PER_PATIENT = 15;
    const estimatedWait = Math.max(0, (queuePosition - 1) * MINUTES_PER_PATIENT);

    return apiSuccess({
      queuePosition,
      estimatedWait,
      checkedIn: true,
    });
  } catch (err) {
    logger.error("Failed to confirm check-in", { context: "api/checkin/confirm", error: err });
    return apiInternalError("Failed to confirm check-in");
  }
}
