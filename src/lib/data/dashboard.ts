"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { getLocalDateStr } from "@/lib/utils";

/** Default upper-bound limit for list queries to prevent unbounded result sets. */
const DEFAULT_QUERY_LIMIT = 1000;

// ────────────────────────────────────────────
// Dashboard Stats (aggregated)
// ────────────────────────────────────────────

/**
 * Shared base stats fetched by all dashboard variants.
 * Extracted to eliminate duplication between getClinicDashboardStats
 * (removed) and getDashboardStats (audit DRY-02).
 */
interface BaseDashboardStats {
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  noShowCount: number;
  totalRevenue: number;
  averageRating: number;
  doctorCount: number;
}

async function fetchBaseDashboardStats(clinicId: string): Promise<BaseDashboardStats> {
  const supabase = await createClient();

  const [
    patientCountRes,
    appointmentCountRes,
    completedCountRes,
    noShowCountRes,
    paymentsRes,
    reviewsRes,
    doctorCountRes,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "patient"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "completed"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "no_show"),
    supabase.from("payments").select("amount").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("stars").eq("clinic_id", clinicId),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "doctor"),
  ]);

  const payments = (paymentsRes.data ?? []) as { amount: number }[];
  const reviews = (reviewsRes.data ?? []) as { stars: number }[];
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.stars ?? 0), 0) / reviews.length : 0;

  return {
    totalPatients: patientCountRes.count ?? 0,
    totalAppointments: appointmentCountRes.count ?? 0,
    completedAppointments: completedCountRes.count ?? 0,
    noShowCount: noShowCountRes.count ?? 0,
    totalRevenue,
    averageRating: avgRating,
    doctorCount: doctorCountRes.count ?? 0,
  };
}

// ────────────────────────────────────────────
// Dashboard Stats (server-side)
// ────────────────────────────────────────────

export interface RecentActivityItem {
  type: string;
  message: string;
  time: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  noShowCount: number;
  totalRevenue: number;
  averageRating: number;
  doctorCount: number;
  insurancePatients: number;
  recentActivity: RecentActivityItem[];
}

export async function getDashboardStats(clinicId: string): Promise<DashboardStats> {
  // Reuse shared base queries (audit DRY-02)
  const [base, supabase] = await Promise.all([fetchBaseDashboardStats(clinicId), createClient()]);

  // Fetch dashboard-specific data in parallel
  const [insurancePatientsRes, recentActivity] = await Promise.all([
    supabase.from("users").select("id, metadata").eq("clinic_id", clinicId).eq("role", "patient"),
    getRecentActivity(supabase, clinicId),
  ]);

  const insurancePatients = (insurancePatientsRes.data ?? []) as {
    id: string;
    metadata: { insurance?: boolean } | null;
  }[];
  const insuranceCount = insurancePatients.filter((p) => p.metadata?.insurance).length;

  return {
    ...base,
    insurancePatients: insuranceCount,
    recentActivity,
  };
}

/**
 * Map an audit event type to a UI-friendly activity type used by the
 * dashboard badge (see `activityVariant` in admin-dashboard-view).
 */
function auditTypeToActivityType(type: string, action: string): string {
  if (type === "booking" || action.startsWith("appointment.")) return "booking";
  if (type === "payment" || action.startsWith("payment.")) return "payment";
  if (action.includes("cancel")) return "cancel";
  if (type === "admin" || type === "config") return "admin";
  if (type === "auth") return "auth";
  if (type === "security") return "security";
  return type;
}

/**
 * Fetch the most recent activity log entries for a clinic.
 * Reads from the `activity_logs` table populated by `logAuditEvent()`.
 */
async function getRecentActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  limit = 10,
): Promise<RecentActivityItem[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("action, type, description, timestamp")
    .eq("clinic_id", clinicId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error || !data) {
    logger.warn("Failed to fetch recent activity", { context: "data/dashboard", error });
    return [];
  }

  return data.map((row) => ({
    type: auditTypeToActivityType(row.type, row.action),
    message: row.description ?? row.action,
    time: row.timestamp ?? "",
  }));
}

// ────────────────────────────────────────────
// Doctor Dashboard Data (server-side)
// ────────────────────────────────────────────

export interface DoctorAppointmentView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  isFirstVisit: boolean;
  hasInsurance: boolean;
  isEmergency: boolean;
  notes?: string;
  recurrenceGroupId?: string;
  recurrencePattern?: string;
}

export interface DoctorPatientView {
  id: string;
  name: string;
  phone: string;
}

export interface DoctorWaitingRoomEntry {
  id: string;
  patientName: string;
  scheduledTime: string;
  serviceName: string;
  status: string;
  priority: string;
}

export interface DoctorInvoiceView {
  id: string;
  appointmentId?: string;
  amount: number;
  status: string;
  date: string;
}

export interface DoctorDashboardData {
  appointments: DoctorAppointmentView[];
  patients: DoctorPatientView[];
  waitingRoom: DoctorWaitingRoomEntry[];
  invoices: DoctorInvoiceView[];
}

export async function getDoctorDashboardData(
  clinicId: string,
  doctorId: string,
): Promise<DoctorDashboardData> {
  const supabase = await createClient();

  // Fetch doctor's appointments, patients, waiting room, invoices in parallel
  const today = getLocalDateStr();

  // PERF-LAT-03: The dashboard view only renders current week/month stats,
  // today's schedule, upcoming appointments and recent-history follow-ups.
  // Previously this pulled the doctor's ENTIRE appointment history ordered
  // ASCENDING with limit 1000 — so a busy clinic shipped its 1000 OLDEST
  // rows over the wire (slow) and could miss today's schedule entirely
  // once history exceeded the limit (wrong). Scope to a 90-day lookback
  // (covers the week/month windows and follow-up detection) plus all
  // future appointments.
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 90);
  const recentCutoff = getLocalDateStr(lookbackDate);

  const [apptsRes, patientsRes, waitingRes, invoicesRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, status, is_first_visit, insurance_flag, is_emergency, notes, recurrence_group_id, recurrence_pattern",
      )
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .gte("appointment_date", recentCutoff)
      .order("appointment_date", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("users")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .order("name", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("appointments")
      .select("id, patient_id, service_id, start_time, status, is_emergency")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
      .in("status", ["confirmed", "checked_in", "checked-in"])
      .order("start_time", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("payments")
      .select("id, appointment_id, amount, status, created_at")
      .eq("clinic_id", clinicId)
      // PERF-LAT-03: the view only aggregates week/month revenue, so only
      // payments within the lookback window can ever match.
      .gte("created_at", lookbackDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
  ]);

  type ApptRaw = {
    id: string;
    patient_id: string;
    doctor_id: string;
    service_id: string | null;
    appointment_date: string;
    start_time: string;
    status: string;
    is_first_visit: boolean;
    insurance_flag: boolean;
    is_emergency: boolean;
    notes: string | null;
    recurrence_group_id: string | null;
    recurrence_pattern: string | null;
  };
  const apptRows = (apptsRes.data ?? []) as ApptRaw[];

  type WaitRaw = {
    id: string;
    patient_id: string;
    service_id: string | null;
    start_time: string;
    status: string;
    is_emergency: boolean;
  };
  const waitRows = (waitingRes.data ?? []) as WaitRaw[];

  // DAL-03: Only fetch the users & services actually referenced by appointments
  const referencedUserIds = new Set<string>();
  const referencedServiceIds = new Set<string>();
  for (const a of apptRows) {
    referencedUserIds.add(a.patient_id);
    referencedUserIds.add(a.doctor_id);
    if (a.service_id) referencedServiceIds.add(a.service_id);
  }
  for (const w of waitRows) {
    referencedUserIds.add(w.patient_id);
    if (w.service_id) referencedServiceIds.add(w.service_id);
  }

  const userIds = [...referencedUserIds];
  const serviceIds = [...referencedServiceIds];

  const [usersRes, servicesRes] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("users")
          .select("id, name, phone, email")
          .eq("clinic_id", clinicId)
          .in("id", userIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; phone: string; email: string }[],
        }),
    serviceIds.length > 0
      ? supabase
          .from("services")
          .select("id, name, price")
          .eq("clinic_id", clinicId)
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number }[] }),
  ]);
  const userMap = new Map(
    ((usersRes.data ?? []) as { id: string; name: string; phone: string; email: string }[]).map(
      (u) => [u.id, { name: u.name, phone: u.phone ?? "", email: u.email ?? "" }],
    ),
  );
  const serviceMap = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string; price: number }[]).map((s) => [
      s.id,
      { name: s.name, price: s.price },
    ]),
  );

  const appointments: DoctorAppointmentView[] = apptRows.map((raw) => ({
    id: raw.id,
    patientId: raw.patient_id,
    patientName: userMap.get(raw.patient_id)?.name ?? "Unknown",
    doctorId: raw.doctor_id,
    doctorName: userMap.get(raw.doctor_id)?.name ?? "Unknown",
    serviceId: raw.service_id ?? "",
    serviceName: raw.service_id
      ? (serviceMap.get(raw.service_id)?.name ?? "Consultation")
      : "Consultation",
    date: raw.appointment_date,
    time: raw.start_time?.slice(0, 5) ?? "",
    status: raw.status?.replaceAll("_", "-") ?? "scheduled",
    isFirstVisit: raw.is_first_visit ?? false,
    hasInsurance: raw.insurance_flag ?? false,
    isEmergency: raw.is_emergency ?? false,
    notes: raw.notes ?? undefined,
    recurrenceGroupId: raw.recurrence_group_id ?? undefined,
    recurrencePattern: raw.recurrence_pattern ?? undefined,
  }));

  const patients: DoctorPatientView[] = (
    (patientsRes.data ?? []) as { id: string; name: string; phone: string | null }[]
  ).map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? "",
  }));

  const waitingRoom: DoctorWaitingRoomEntry[] = waitRows.map((r) => ({
    id: r.id,
    patientName: userMap.get(r.patient_id)?.name ?? "Patient",
    scheduledTime: r.start_time?.slice(0, 5) ?? "",
    serviceName: r.service_id
      ? (serviceMap.get(r.service_id)?.name ?? "Consultation")
      : "Consultation",
    status: "waiting",
    priority: r.is_emergency ? "urgent" : "normal",
  }));

  type InvRaw = {
    id: string;
    appointment_id: string | null;
    amount: number;
    status: string;
    created_at: string;
  };
  const invoices: DoctorInvoiceView[] = ((invoicesRes.data ?? []) as InvRaw[]).map((r) => ({
    id: r.id,
    appointmentId: r.appointment_id ?? undefined,
    amount: r.amount,
    status: r.status === "completed" ? "paid" : r.status,
    date: r.created_at?.split("T")[0] ?? "",
  }));

  return { appointments, patients, waitingRoom, invoices };
}

// ────────────────────────────────────────────
// Patient Dashboard Data (server-side)
// ────────────────────────────────────────────

interface PatientAppointmentView {
  id: string;
  serviceName: string;
  doctorName: string;
  date: string;
  time: string;
  status: string;
}

interface PatientPrescriptionView {
  id: string;
  patientId: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
}

interface PatientInvoiceView {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}

interface PatientNotificationView {
  id: string;
  read: boolean;
}

export interface PatientDashboardData {
  userName: string;
  appointments: PatientAppointmentView[];
  prescriptions: PatientPrescriptionView[];
  invoices: PatientInvoiceView[];
  notifications: PatientNotificationView[];
}

export async function getPatientDashboardData(
  clinicId: string,
  userId: string,
  userName: string,
): Promise<PatientDashboardData> {
  const supabase = await createClient();

  // Resolve clinic currency from DB config (DAL-04: was hardcoded to "MAD")
  // PERF-LAT-04: kick off the config lookup without awaiting so it runs in
  // parallel with the dashboard queries below instead of serially before
  // them (saves one full DB round trip per patient dashboard render).
  const { getClinicConfig } = await import("@/lib/tenant");
  const clinicCfgPromise = getClinicConfig(clinicId);

  // PERF-LAT-03: The patient dashboard only renders current/upcoming appointments
  // and recent-history. A 90-day lookback plus all future appointments bounds the
  // payload and prevents the 1000-row ascending cap from dropping recent rows.
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 90);
  const recentCutoff = getLocalDateStr(lookbackDate);

  const [apptsRes, rxRes, invoicesRes, notifsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, doctor_id, service_id, appointment_date, start_time, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .gte("appointment_date", recentCutoff)
      .order("appointment_date", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("prescriptions")
      .select("id, patient_id, doctor_id, items, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("payments")
      .select("id, amount, status, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("notifications")
      .select("id, is_read")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
  ]);

  type ApptRaw = {
    id: string;
    doctor_id: string;
    service_id: string | null;
    appointment_date: string;
    start_time: string;
    status: string;
  };
  type RxRaw = {
    id: string;
    patient_id: string;
    doctor_id: string;
    items: { name: string; dosage: string; duration: string }[] | null;
    created_at: string;
  };
  const apptRows = (apptsRes.data ?? []) as ApptRaw[];
  const rxRows = (rxRes.data ?? []) as RxRaw[];

  // DAL-02: Only fetch users & services actually referenced by patient data
  const referencedUserIds = new Set<string>();
  const referencedServiceIds = new Set<string>();
  for (const a of apptRows) {
    referencedUserIds.add(a.doctor_id);
    if (a.service_id) referencedServiceIds.add(a.service_id);
  }
  for (const rx of rxRows) {
    referencedUserIds.add(rx.doctor_id);
  }

  const userIds = [...referencedUserIds];
  const serviceIds = [...referencedServiceIds];

  const [usersRes, servicesRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, name").eq("clinic_id", clinicId).in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").eq("clinic_id", clinicId).in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const userMap = new Map(
    ((usersRes.data ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]),
  );
  const serviceMap = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  const appointments: PatientAppointmentView[] = apptRows.map((r) => ({
    id: r.id,
    serviceName: r.service_id ? (serviceMap.get(r.service_id) ?? "Consultation") : "Consultation",
    doctorName: userMap.get(r.doctor_id) ?? "Doctor",
    date: r.appointment_date,
    time: r.start_time?.slice(0, 5) ?? "",
    status: r.status?.replaceAll("_", "-") ?? "scheduled",
  }));

  const prescriptions: PatientPrescriptionView[] = rxRows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    doctorName: userMap.get(r.doctor_id) ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    medications: Array.isArray(r.items) ? r.items : [],
  }));

  const clinicCfg = await clinicCfgPromise;

  type InvRaw = { id: string; amount: number; status: string; created_at: string };
  const invoices: PatientInvoiceView[] = ((invoicesRes.data ?? []) as InvRaw[]).map((r) => ({
    id: r.id,
    amount: r.amount,
    currency: clinicCfg.currency,
    status: r.status === "completed" ? "paid" : r.status,
    date: r.created_at?.split("T")[0] ?? "",
  }));

  type NotifRaw = { id: string; is_read: boolean };
  const notifications: PatientNotificationView[] = ((notifsRes.data ?? []) as NotifRaw[]).map(
    (r) => ({
      id: r.id,
      read: r.is_read ?? false,
    }),
  );

  return { userName, appointments, prescriptions, invoices, notifications };
}
