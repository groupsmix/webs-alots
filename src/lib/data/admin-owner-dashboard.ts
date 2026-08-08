import { fromUntyped } from "@/lib/ai/untyped-tables";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { AppointmentStatus } from "@/lib/types/database";

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

interface AppointmentPreviewRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  slot_start: string;
  status: AppointmentStatus;
}

export interface OwnerAgendaPreviewItem {
  id: string;
  slotStart: string;
  status: AppointmentStatus;
  patientName: string;
  doctorName: string;
  serviceName: string;
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
  _timezone: string,
): Promise<OwnerDashboardDailyData> {
  const supabase = await createClient();

  const [appointmentsResult, briefingResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
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

export async function getOwnerDashboardAgendaPreview(
  clinicId: string,
  today: string,
): Promise<OwnerAgendaPreviewItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, service_id, slot_start, status")
    .eq("clinic_id", clinicId)
    .eq("appointment_date", today)
    .order("slot_start", { ascending: true })
    .limit(5);

  if (error) {
    logger.warn("Failed to load owner agenda preview for today", {
      context: "data/admin-owner-dashboard",
      clinicId,
      error,
    });
    return [];
  }

  const rows = (data ?? []) as AppointmentPreviewRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.flatMap((row) => [row.patient_id, row.doctor_id]))];
  const serviceIds = [
    ...new Set(
      rows
        .map((row) => row.service_id)
        .filter((serviceId): serviceId is string => Boolean(serviceId)),
    ),
  ];

  const [usersResult, servicesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, name").eq("clinic_id", clinicId).in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").eq("clinic_id", clinicId).in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) {
    logger.warn("Failed to load users for agenda preview", {
      context: "data/admin-owner-dashboard",
      clinicId,
      error: usersResult.error,
    });
    return [];
  }

  if (servicesResult.error) {
    logger.warn("Failed to load services for agenda preview", {
      context: "data/admin-owner-dashboard",
      clinicId,
      error: servicesResult.error,
    });
    return [];
  }

  const userNames = new Map(
    ((usersResult.data ?? []) as { id: string; name: string }[]).map((user) => [
      user.id,
      user.name,
    ]),
  );
  const serviceNames = new Map(
    ((servicesResult.data ?? []) as { id: string; name: string }[]).map((service) => [
      service.id,
      service.name,
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    slotStart: row.slot_start,
    status: row.status,
    patientName: userNames.get(row.patient_id) ?? "—",
    doctorName: userNames.get(row.doctor_id) ?? "—",
    serviceName: row.service_id ? (serviceNames.get(row.service_id) ?? "—") : "—",
  }));
}
