/**
 * Patient-level analytics for doctor dashboards.
 *
 * Provides longitudinal health trend tracking, appointment history,
 * and engagement metrics — always clinic-scoped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatientAnalyticsQuery {
  clinicId: string;
  patientId: string;
}

export interface AppointmentHistoryEntry {
  date: string;
  type: string;
  status: string;
  doctorName: string | null;
}

export interface EngagementMetrics {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  averageDaysBetweenVisits: number | null;
  lastVisitDate: string | null;
}

export interface PatientAnalyticsSummary {
  patientId: string;
  engagement: EngagementMetrics;
  appointmentHistory: AppointmentHistoryEntry[];
}

// ─── Implementation ──────────────────────────────────────────────────────────

export async function getPatientAnalytics(
  supabase: SupabaseClient<Database>,
  query: PatientAnalyticsQuery,
): Promise<PatientAnalyticsSummary> {
  const { clinicId, patientId } = query;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("slot_start, status, doctor_id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("slot_start", { ascending: false });

  const records = appointments ?? [];

  const engagement = computeEngagement(records);
  const history = records.slice(0, 20).map((a) => ({
    date: a.slot_start ?? "",
    type: "general",
    status: a.status ?? "unknown",
    doctorName: null as string | null,
  }));

  return {
    patientId,
    engagement,
    appointmentHistory: history,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface AppointmentRow {
  slot_start: string | null;
  status: string | null;
}

function computeEngagement(records: AppointmentRow[]): EngagementMetrics {
  const total = records.length;
  const completed = records.filter((r) => r.status === "completed").length;
  const cancelled = records.filter((r) => r.status === "cancelled").length;
  const noShow = records.filter((r) => r.status === "no_show").length;

  const completedDates = records
    .filter((r) => r.status === "completed" && r.slot_start)
    .map((r) => new Date(r.slot_start!).getTime())
    .sort((a, b) => a - b);

  let averageDaysBetweenVisits: number | null = null;
  if (completedDates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < completedDates.length; i++) {
      gaps.push((completedDates[i] - completedDates[i - 1]) / 86_400_000);
    }
    averageDaysBetweenVisits = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const lastVisitDate =
    completedDates.length > 0
      ? new Date(completedDates[completedDates.length - 1]).toISOString().split("T")[0]
      : null;

  return {
    totalAppointments: total,
    completedAppointments: completed,
    cancelledAppointments: cancelled,
    noShowCount: noShow,
    averageDaysBetweenVisits,
    lastVisitDate,
  };
}
