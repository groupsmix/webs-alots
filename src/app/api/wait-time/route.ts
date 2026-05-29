import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/wait-time?doctorId=...
 *
 * Get real-time wait time estimate for a doctor.
 * Calculates from current queue length + any manual delay set by staff.
 * Public endpoint — patients can check before leaving home.
 */
export async function GET(request: NextRequest) {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Clinic context required — use a clinic subdomain", 400);
  }
  const clinicId = tenant.clinicId;
  const doctorId = request.nextUrl.searchParams.get("doctorId");

  if (!doctorId) {
    return apiError("doctorId query parameter required", 400, "MISSING_PARAM");
  }

  try {
    const supabase = await createTenantClient(clinicId);
    const untypedSupabase = supabase as unknown as SupabaseUntyped;

    // Get current queue for this doctor
    const { data: queueEntries, error: queueError } = await untypedSupabase
      .from("waiting_queue")
      .select("id, position, estimated_wait_minutes, status")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("status", "waiting")
      .order("position", { ascending: true });

    if (queueError) {
      logger.error("Failed to fetch queue for wait time", {
        context: "api/wait-time",
        error: queueError,
      });
      return apiInternalError("Failed to calculate wait time");
    }

    type QueueRow = {
      id: string;
      position: number;
      estimated_wait_minutes: number;
      status: string;
    };
    const queue = (queueEntries ?? []) as QueueRow[];

    // Get doctor's manual delay status
    const { data: delayStatus } = await untypedSupabase
      .from("doctor_delay_status")
      .select("current_delay_minutes, last_updated_at, reason")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .single();

    type DelayRow = {
      current_delay_minutes: number;
      last_updated_at: string;
      reason: string | null;
    };
    const delay = delayStatus as DelayRow | null;

    const MINUTES_PER_PATIENT = 15;
    const queueWaitMinutes = queue.length * MINUTES_PER_PATIENT;
    const manualDelayMinutes = delay?.current_delay_minutes ?? 0;
    const totalEstimatedWait = queueWaitMinutes + manualDelayMinutes;

    return apiSuccess({
      doctorId,
      queueLength: queue.length,
      queueWaitMinutes,
      manualDelayMinutes,
      totalEstimatedWait,
      delayReason: delay?.reason ?? null,
      delayUpdatedAt: delay?.last_updated_at ?? null,
      message:
        totalEstimatedWait > 0
          ? `Dr. est en retard d'environ ${totalEstimatedWait} min`
          : "Pas d'attente estimée",
    });
  } catch (err) {
    logger.error("Wait time estimate failed", {
      context: "api/wait-time",
      error: err,
    });
    return apiInternalError("Failed to calculate wait time");
  }
}
