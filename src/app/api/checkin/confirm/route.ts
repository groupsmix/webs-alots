import { createTenantClient } from "@/lib/supabase-server";
import { apiSuccess, apiInternalError, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withValidation } from "@/lib/api-validate";
import { checkinConfirmSchema } from "@/lib/validations";
import { requireTenant } from "@/lib/tenant";

/**
 * POST /api/checkin/confirm
 *
 * Confirm patient arrival: update appointment status to "checked_in"
 * and calculate queue position / estimated wait.
 */
export const POST = withValidation(checkinConfirmSchema, async (body) => {
    const { appointmentId, clinicId } = body;

    // HIGH-08: Validate that the clinicId in the request body matches the
    // tenant derived from the subdomain. The body is attacker-controlled —
    // without this check a request to clinic-a.example.com with
    // clinicId=clinic-b-uuid would operate on the wrong tenant's data.
    const tenant = await requireTenant();
    if (tenant.clinicId !== clinicId) {
      logger.warn("Check-in tenant mismatch", {
        context: "api/checkin/confirm",
        requestClinicId: clinicId,
        tenantClinicId: tenant.clinicId,
      });
      return apiError("Invalid clinic context", 403);
    }

    const supabase = await createTenantClient(clinicId);

    // Update appointment status to "checked_in"
    // The .eq("clinic_id", clinicId) clause is defense-in-depth on top of
    // the tenant validation above and the RLS policy on the appointments table.
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
});
