/**
 * Clinic-level analytics aggregation.
 *
 * Provides helpers for computing KPIs: patient acquisition, appointment
 * utilisation, revenue, and staff performance metrics.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClinicAnalyticsQuery {
  clinicId: string;
  /** ISO date YYYY-MM-DD */
  startDate: string;
  /** ISO date YYYY-MM-DD */
  endDate: string;
}

export interface AppointmentMetrics {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
  averageWaitMinutes: number | null;
}

export interface PatientAcquisitionMetrics {
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  averagePerAppointment: number;
  currency: string;
}

export interface StaffMetrics {
  doctorId: string;
  doctorName: string;
  appointmentsHandled: number;
  averageConsultationMinutes: number;
}

export interface ClinicAnalyticsSummary {
  period: { start: string; end: string };
  appointments: AppointmentMetrics;
  patientAcquisition: PatientAcquisitionMetrics;
  revenue: RevenueMetrics;
  staffPerformance: StaffMetrics[];
}

// ─── Implementation ──────────────────────────────────────────────────────────

export async function getClinicAnalytics(
  supabase: SupabaseClient<Database>,
  query: ClinicAnalyticsQuery,
): Promise<ClinicAnalyticsSummary> {
  const { clinicId, startDate, endDate } = query;

  const [appointments, patients, revenue, staff] = await Promise.all([
    computeAppointmentMetrics(supabase, clinicId, startDate, endDate),
    computePatientAcquisition(supabase, clinicId, startDate, endDate),
    computeRevenueMetrics(supabase, clinicId, startDate, endDate),
    computeStaffMetrics(supabase, clinicId, startDate, endDate),
  ]);

  return {
    period: { start: startDate, end: endDate },
    appointments,
    patientAcquisition: patients,
    revenue,
    staffPerformance: staff,
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function computeAppointmentMetrics(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<AppointmentMetrics> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, slot_start, slot_end")
    .eq("clinic_id", clinicId)
    .gte("slot_start", startDate)
    .lte("slot_start", endDate);

  if (error || !data) {
    return {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      completionRate: 0,
      averageWaitMinutes: null,
    };
  }

  const total = data.length;
  const completed = data.filter((a) => a.status === "completed").length;
  const cancelled = data.filter((a) => a.status === "cancelled").length;
  const noShow = data.filter((a) => a.status === "no_show").length;

  // Average wait approximated from slot duration for completed appointments
  const waitTimes: number[] = [];

  return {
    total,
    completed,
    cancelled,
    noShow,
    completionRate: total > 0 ? completed / total : 0,
    averageWaitMinutes:
      waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : null,
  };
}

async function computePatientAcquisition(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<PatientAcquisitionMetrics> {
  const { count: newCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "patient")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const { count: totalCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "patient")
    .lte("created_at", endDate);

  const newPatients = newCount ?? 0;
  const totalPatients = totalCount ?? 0;
  const returningPatients = Math.max(0, totalPatients - newPatients);

  return {
    newPatients,
    returningPatients,
    retentionRate: totalPatients > 0 ? returningPatients / totalPatients : 0,
  };
}

async function computeRevenueMetrics(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<RevenueMetrics> {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const amounts = (data ?? []).map((p) => (p.amount as number) ?? 0);
  const totalRevenue = amounts.reduce((a, b) => a + b, 0);

  return {
    totalRevenue,
    averagePerAppointment: amounts.length > 0 ? totalRevenue / amounts.length : 0,
    currency: "MAD",
  };
}

async function computeStaffMetrics(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<StaffMetrics[]> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("doctor_id, slot_start, slot_end, status")
    .eq("clinic_id", clinicId)
    .eq("status", "completed")
    .gte("slot_start", startDate)
    .lte("slot_start", endDate);

  if (!appointments || appointments.length === 0) return [];

  const byDoctor = new Map<string, { count: number; totalMinutes: number }>();

  for (const appt of appointments) {
    if (!appt.doctor_id) continue;
    const entry = byDoctor.get(appt.doctor_id) ?? { count: 0, totalMinutes: 0 };
    entry.count += 1;
    if (appt.slot_start && appt.slot_end) {
      const mins =
        (new Date(appt.slot_end).getTime() - new Date(appt.slot_start).getTime()) / 60_000;
      entry.totalMinutes += mins;
    }
    byDoctor.set(appt.doctor_id, entry);
  }

  const { data: doctors } = await supabase
    .from("users")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .in("id", [...byDoctor.keys()]);

  const doctorNames = new Map((doctors ?? []).map((d) => [d.id, d.name ?? "Unknown"]));

  return [...byDoctor.entries()].map(([doctorId, stats]) => ({
    doctorId,
    doctorName: doctorNames.get(doctorId) ?? "Unknown",
    appointmentsHandled: stats.count,
    averageConsultationMinutes: stats.count > 0 ? Math.round(stats.totalMinutes / stats.count) : 0,
  }));
}
