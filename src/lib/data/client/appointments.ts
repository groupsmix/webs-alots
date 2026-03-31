"use client";

import { fetchRows, ensureLookups, _activeUserMap, _activeServiceMap } from "./_core";
import { getLocalDateStr } from "@/lib/utils";

// ─────────────────────────────────────────────
// Appointments  (maps to demo-data Appointment)
// ─────────────────────────────────────────────

export interface AppointmentView {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  isFirstVisit: boolean;
  hasInsurance: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  rescheduledFrom?: string;
  isEmergency?: boolean;
  notes?: string;
  recurrenceGroupId?: string;
  recurrencePattern?: string;
}

interface AppointmentRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  slot_start: string;
  slot_end: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_first_visit: boolean;
  is_walk_in: boolean;
  insurance_flag: boolean;
  booking_source: string;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rescheduled_from: string | null;
  is_emergency: boolean;
  recurrence_group_id: string | null;
  recurrence_pattern: string | null;
  recurrence_index: number | null;
  created_at: string;
  updated_at: string;
}

function mapAppointment(raw: AppointmentRaw): AppointmentView {
  const patient = _activeUserMap?.get(raw.patient_id);
  const doctor = _activeUserMap?.get(raw.doctor_id);
  const service = raw.service_id ? _activeServiceMap?.get(raw.service_id) : null;
  return {
    id: raw.id,
    patientId: raw.patient_id,
    patientName: patient?.name ?? "Unknown",
    patientPhone: patient?.phone || undefined,
    doctorId: raw.doctor_id,
    doctorName: doctor?.name ?? "Unknown",
    serviceId: raw.service_id ?? "",
    serviceName: service?.name ?? "Consultation",
    date: raw.appointment_date,
    time: raw.start_time?.slice(0, 5) ?? "",
    status: raw.status?.replaceAll("_", "-") ?? "scheduled",
    isFirstVisit: raw.is_first_visit ?? false,
    hasInsurance: raw.insurance_flag ?? false,
    cancelledAt: raw.cancelled_at ?? undefined,
    cancellationReason: raw.cancellation_reason ?? undefined,
    rescheduledFrom: raw.rescheduled_from ?? undefined,
    isEmergency: raw.is_emergency ?? false,
    notes: raw.notes ?? undefined,
    recurrenceGroupId: raw.recurrence_group_id ?? undefined,
    recurrencePattern: raw.recurrence_pattern ?? undefined,
  };
}

export async function fetchAppointments(clinicId: string): Promise<AppointmentView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<AppointmentRaw>("appointments", {
    eq: [["clinic_id", clinicId]],
    order: ["appointment_date", { ascending: true }],
  });
  return rows.map(mapAppointment);
}

export async function fetchTodayAppointments(clinicId: string, doctorId?: string): Promise<AppointmentView[]> {
  await ensureLookups(clinicId);
  const today = getLocalDateStr();
  const eq: [string, unknown][] = [["clinic_id", clinicId], ["appointment_date", today]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<AppointmentRaw>("appointments", {
    eq,
    order: ["start_time", { ascending: true }],
  });
  return rows.map(mapAppointment);
}

export async function fetchDoctorAppointments(clinicId: string, doctorId: string): Promise<AppointmentView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<AppointmentRaw>("appointments", {
    eq: [["clinic_id", clinicId], ["doctor_id", doctorId]],
    order: ["appointment_date", { ascending: true }],
  });
  return rows.map(mapAppointment);
}

export async function fetchPatientAppointments(clinicId: string, patientId: string): Promise<AppointmentView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<AppointmentRaw>("appointments", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["appointment_date", { ascending: true }],
  });
  return rows.map(mapAppointment);
}

