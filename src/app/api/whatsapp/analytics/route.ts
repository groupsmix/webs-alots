import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { UserRole } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";

// notification_queue is not in the generated database types; use an untyped client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export const GET = withAuth(
  async (_request: NextRequest, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("Clinic context required", 403);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const supabaseUntyped = supabase as unknown as SupabaseUntyped;

    // Delivery rate from notification_queue
    const { data: queueStats, error: queueError } = await supabaseUntyped
      .from("notification_queue")
      .select("status", { count: "exact" })
      .eq("clinic_id", clinicId)
      .in("channel", ["whatsapp", "sms"])
      .gte("created_at", thirtyDaysAgo);

    if (queueError) {
      return apiError("Failed to fetch notification queue stats", 500);
    }

    const counts = (queueStats ?? []).reduce(
      (acc: { sent: number; failed: number }, row: { status: string }) => {
        if (row.status === "sent") acc.sent++;
        if (row.status === "failed" || row.status === "dead_letter") acc.failed++;
        return acc;
      },
      { sent: 0, failed: 0 },
    );

    // No-show rate from no_show_stats
    const { data: noShowStats, error: noShowError } = await supabase
      .from("no_show_stats")
      .select("total_no_shows, total_appointments")
      .eq("clinic_id", clinicId);

    if (noShowError) {
      return apiError("Failed to fetch no-show stats", 500);
    }

    const totalNoShows = (noShowStats ?? []).reduce((sum, s) => sum + (s.total_no_shows ?? 0), 0);
    const totalAppointments = (noShowStats ?? []).reduce(
      (sum, s) => sum + (s.total_appointments ?? 0),
      0,
    );

    const deliveryRate =
      counts.sent + counts.failed > 0 ? counts.sent / (counts.sent + counts.failed) : 1;
    const noShowRate = totalAppointments > 0 ? totalNoShows / totalAppointments : 0;

    return apiSuccess({
      clinic_id: clinicId,
      period_days: 30,
      delivery_rate: Math.round(deliveryRate * 1000) / 1000,
      sent_count: counts.sent,
      failed_count: counts.failed,
      no_show_rate: Math.round(noShowRate * 1000) / 1000,
      total_no_shows: totalNoShows,
      total_appointments: totalAppointments,
    });
  },
  ["clinic_admin", "receptionist", "doctor"] as UserRole[],
);
