import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/waiting-queue?doctorId=...
 *
 * Fetch the current waiting queue for the clinic. Optionally filter by doctor.
 * Used by the live queue display with Supabase realtime subscriptions.
 *
 * Requires authentication with at least 'receptionist' role — this endpoint
 * exposes patient_id, doctor_id, and check-in timestamps (PHI).
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const clinicId = auth.profile.clinic_id!;
    const doctorId = request.nextUrl.searchParams.get("doctorId");

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      let query = untypedSupabase
        .from("waiting_queue")
        .select(
          `
          id,
          appointment_id,
          patient_id,
          doctor_id,
          position,
          estimated_wait_minutes,
          checked_in_at,
          called_at,
          status
        `,
        )
        .eq("clinic_id", clinicId)
        .in("status", ["waiting", "called", "in_progress"]);

      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data: queueEntries, error } = await query.order("position", { ascending: true });

      if (error) {
        logger.error("Failed to fetch waiting queue", {
          context: "api/waiting-queue",
          error,
        });
        return apiInternalError("Failed to fetch waiting queue");
      }

      type QueueEntry = {
        id: string;
        appointment_id: string;
        patient_id: string;
        doctor_id: string;
        position: number;
        estimated_wait_minutes: number;
        checked_in_at: string;
        called_at: string | null;
        status: string;
      };

      const entries = (queueEntries ?? []) as QueueEntry[];

      return apiSuccess({
        queue: entries,
        totalWaiting: entries.filter((e) => e.status === "waiting").length,
      });
    } catch (err) {
      logger.error("Failed to fetch waiting queue", {
        context: "api/waiting-queue",
        error: err,
      });
      return apiInternalError("Failed to fetch waiting queue");
    }
  },
  ["receptionist", "doctor", "clinic_admin", "super_admin"],
);
