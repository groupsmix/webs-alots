import { fromUntyped } from "@/lib/ai/untyped-tables";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { clinicDateTime } from "@/lib/timezone";
import type { AppointmentStatus } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";

export interface OwnerTodaySummary {
  totalAppointments: number;
  unconfirmedAppointments: number;
  confirmedAppointments: number;
  checkedInAppointments: number;
  inProgressAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
}

export interface OwnerDailyBriefing {
  id: string;
  briefingDate: string;
  content: string;
  generatedAt: string;
}

export interface OwnerDashboardDailyData {
  today: OwnerTodaySummary;
  briefing: OwnerDailyBriefing | null;
}

interface AppointmentStatusRow {
  status: AppointmentStatus;
}

export function summarizeOwnerTodayAppointments(
  appointments: AppointmentStatusRow[],
): OwnerTodaySummary {
  const summary: OwnerTodaySummary = {
    totalAppointments: appointments.length,
    unconfirmedAppointments: 0,
    confirmedAppointments: 0,
    checkedInAppointments: 0,
    inProgressAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
  };

  for (const appointment of appointments) {
    switch (appointment.status) {
      case "pending":
      case "reminded":
        summary.unconfirmedAppointments++;
        break;
      case "confirmed":
      case "scheduled":
        summary.confirmedAppointments++;
        break;
      case "checked_in":
        summary.checkedInAppointments++;
        break;
      case "in_progress":
        summary.inProgressAppointments++;
        break;
      case "completed":
        summary.completedAppointments++;
        break;
      case "cancelled":
        summary.cancelledAppointments++;
        break;
      case "no_show":
        summary.noShowAppointments++;
        break;
    }
  }

  return summary;
}

export async function getOwnerDashboardDailyData(
  clinicId: string,
  today: string,
  timezone: string,
): Promise<OwnerDashboardDailyData> {
  const supabase = await createClient();
  const nextDay = new Date(clinicDateTime(today, "12:00", timezone));
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDate = getLocalDateStr(nextDay, timezone);

  const [appointmentsResult, briefingResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("clinic_id", clinicId)
      .gte("slot_start", clinicDateTime(today, "00:00", timezone).toISOString())
      .lt("slot_start", clinicDateTime(endDate, "00:00", timezone).toISOString())
      .limit(500),
    fromUntyped(supabase, "clinic_ai_briefings")
      .select("id, briefing_date, content, generated_at")
      .eq("clinic_id", clinicId)
      .eq("briefing_date", today)
      .maybeSingle(),
  ]);

  if (appointmentsResult.error) {
    logger.warn("Failed to load owner appointments for today", {
      context: "data/admin-owner-dashboard",
      clinicId,
      error: appointmentsResult.error,
    });
  }

  if (briefingResult.error) {
    logger.warn("Failed to load owner daily briefing", {
      context: "data/admin-owner-dashboard",
      clinicId,
      error: briefingResult.error,
    });
  }

  const briefingRow = briefingResult.data as {
    id: string;
    briefing_date: string;
    content: string;
    generated_at: string;
  } | null;

  return {
    today: summarizeOwnerTodayAppointments(
      (appointmentsResult.data ?? []) as AppointmentStatusRow[],
    ),
    briefing: briefingRow
      ? {
          id: briefingRow.id,
          briefingDate: briefingRow.briefing_date,
          content: briefingRow.content,
          generatedAt: briefingRow.generated_at,
        }
      : null,
  };
}
