"use client";

import { fetchRows, ensureLookups, _activeUserMap, _activeServiceMap } from "./_core";
import { createClient } from "@/lib/supabase-client";

// ─────────────────────────────────────────────
// Waiting List
// ─────────────────────────────────────────────

export interface WaitingListView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  preferredDate: string;
  preferredTime?: string;
  serviceId?: string;
  serviceName?: string;
  status: string;
  createdAt: string;
}

interface WaitingListRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  preferred_date: string | null;
  preferred_time: string | null;
  service_id: string | null;
  status: string;
  notified_at: string | null;
  created_at: string;
}

export async function fetchWaitingList(clinicId: string): Promise<WaitingListView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<WaitingListRaw>("waiting_list", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    preferredDate: r.preferred_date ?? "",
    preferredTime: r.preferred_time ?? undefined,
    serviceId: r.service_id ?? undefined,
    serviceName: r.service_id ? _activeServiceMap?.get(r.service_id)?.name : undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
}

// ─────────────────────────────────────────────
// Consultation Notes
// ─────────────────────────────────────────────

export interface ConsultationNoteView {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  notes: string;
  content?: Record<string, string>;
  prescriptionId?: string;
  followUpDate?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
  };
}

interface ConsultationNoteRaw {
  id: string;
  clinic_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  notes: string | null;
  diagnosis: string | null;
  content: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export async function fetchConsultationNotes(clinicId: string, doctorId?: string): Promise<ConsultationNoteView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<ConsultationNoteRaw>("consultation_notes", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    diagnosis: r.diagnosis ?? "",
    notes: r.notes ?? "",
    content: r.content ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Time Slots
// ─────────────────────────────────────────────

export interface TimeSlotView {
  id: string;
  doctorId: string;
  doctorName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bufferMinutes: number;
  isAvailable: boolean;
}

interface TimeSlotRaw {
  id: string;
  clinic_id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  buffer_minutes: number;
  buffer_min: number | null;
  is_available: boolean;
  is_active: boolean;
}

export async function fetchTimeSlots(clinicId: string, doctorId?: string): Promise<TimeSlotView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<TimeSlotRaw>("time_slots", {
    eq,
    order: ["day_of_week", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    doctorId: r.doctor_id,
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    maxCapacity: r.max_capacity,
    bufferMinutes: r.buffer_minutes,
    isAvailable: r.is_active,
  }));
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export interface NotificationView {
  id: string;
  userId: string;
  trigger: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  priority: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotificationRaw {
  id: string;
  clinic_id: string;
  user_id: string;
  type: string;
  channel: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
  sent_at: string;
}

export async function fetchNotifications(userId: string): Promise<NotificationView[]> {
  const rows = await fetchRows<NotificationRaw>("notifications", {
    eq: [["user_id", userId]],
    order: ["sent_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    trigger: r.type ?? "general",
    title: r.title ?? "",
    message: r.body ?? "",
    channel: r.channel ?? "in_app",
    status: r.is_read ? "read" : "delivered",
    priority: "normal",
    read: r.is_read ?? false,
    createdAt: r.sent_at ?? "",
    readAt: r.is_read ? r.sent_at : undefined,
  }));
}

// ─────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────

export interface DocumentView {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

interface DocumentRaw {
  id: string;
  clinic_id: string;
  user_id: string;
  type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export async function fetchDocuments(clinicId: string, userId?: string): Promise<DocumentView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (userId) eq.push(["user_id", userId]);
  const rows = await fetchRows<DocumentRaw>("documents", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    fileName: r.file_name ?? "document",
    fileUrl: r.file_url,
    uploadedAt: r.created_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Family Members
// ─────────────────────────────────────────────

export interface FamilyMemberView {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
}

interface FamilyMemberRaw {
  id: string;
  primary_user_id: string;
  member_user_id: string;
  relationship: string;
  created_at: string;
}

export async function fetchFamilyMembers(userId: string): Promise<FamilyMemberView[]> {
  const rows = await fetchRows<FamilyMemberRaw>("family_members", {
    eq: [["primary_user_id", userId]],
  });
  // Look up the member user for each
  const supabase = createClient();
  const memberIds = rows.map((r) => r.member_user_id);
  if (memberIds.length === 0) return [];
  const { data: members } = await supabase
    .from("users")
    .select("id, name, phone")
    .in("id", memberIds);
  const memberMap = new Map(
    ((members ?? []) as { id: string; name: string; phone: string | null }[]).map((m) => [m.id, m]),
  );
  return rows.map((r) => ({
    id: r.id,
    name: memberMap.get(r.member_user_id)?.name ?? "Family Member",
    relationship: r.relationship,
    phone: memberMap.get(r.member_user_id)?.phone ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Clinic Dashboard Stats
// ─────────────────────────────────────────────

export interface DashboardStats {
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  noShowCount: number;
  totalRevenue: number;
  averageRating: number;
  doctorCount: number;
  insurancePatients: number;
}

export async function fetchDashboardStats(clinicId: string): Promise<DashboardStats> {
  const supabase = createClient();
  const [
    patientCountRes,
    appointmentCountRes,
    completedCountRes,
    noShowCountRes,
    paymentsRes,
    reviewsRes,
    doctorCountRes,
    insurancePatientsRes,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("role", "patient"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "no_show"),
    supabase.from("payments").select("amount").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("stars").eq("clinic_id", clinicId),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("role", "doctor"),
    supabase.from("users").select("id, metadata").eq("clinic_id", clinicId).eq("role", "patient"),
  ]);
  const payments = (paymentsRes.data ?? []) as { amount: number }[];
  const reviews = (reviewsRes.data ?? []) as { stars: number }[];
  const insurancePatients = (insurancePatientsRes.data ?? []) as { id: string; metadata: Record<string, unknown> | null }[];

  const totalRevenue = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;
  const insuranceCount = insurancePatients.filter((p) => p.metadata && (p.metadata as Record<string, unknown>).insurance).length;

  return {
    totalPatients: patientCountRes.count ?? 0,
    totalAppointments: appointmentCountRes.count ?? 0,
    completedAppointments: completedCountRes.count ?? 0,
    noShowCount: noShowCountRes.count ?? 0,
    totalRevenue,
    averageRating: avgRating,
    doctorCount: doctorCountRes.count ?? 0,
    insurancePatients: insuranceCount,
  };
}
