import { NextRequest } from "next/server";
import { z } from "zod";
import { createTenantClient } from "@/lib/supabase-server";
import { apiSuccess, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * Zod schema for check-in confirmation requests (VAL-01).
 */
const checkinConfirmSchema = z.object({
  appointmentId: z.string().uuid(),
  clinicId: z.string().uuid(),
});

/**
 * POST /api/checkin/confirm
 *
 * Confirm patient arrival: update appointment status to "checked_in"
 * and calculate queue position / estimated wait.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = checkinConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error.issues.map((e: { message: string }) => e.message).join("; "));
    }

    const { appointmentId, clinicId } = parsed.data;

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
