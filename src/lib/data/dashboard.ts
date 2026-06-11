"use server";

import type { AppointmentView } from "@/lib/data/client/appointments";
import type { PatientView } from "@/lib/data/client/users";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { getLocalDateStr } from "@/lib/utils";
// Type-only imports from the client data layer (erased at compile time, so
// no "use client" module is pulled into this server module). The receptionist
// view components consume these exact shapes.

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
  const supabase = await createClient();

  // PERF-LAT-06: Single-round-trip aggregates via RPC (migration 00180).
  // The legacy path below issues 9 queries — five head-only counts plus
  // three UNBOUNDED row fetches (every completed payment, every review,
  // every patient row) just to compute sums/averages the database can
  // produce itself. The RPC returns one row of aggregates; RLS still
  // applies (SECURITY INVOKER). Falls back to the legacy multi-query path
  // until the migration is applied (same pattern as avg_clinic_rating).
  try {
    // get_clinic_dashboard_stats is a DB function not yet in the generated
    // Supabase types. Use a targeted cast instead of blanket `as any`.
    type UntypedRpc = (
      fn: string,
      args: Record<string, unknown>,
    ) => ReturnType<typeof supabase.rpc>;
    const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
    const [rpcRes, rpcRecentActivity] = await Promise.all([
      rpc("get_clinic_dashboard_stats", { cid: clinicId }),
      getRecentActivity(supabase, clinicId),
    ]);
    const row = (Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data) as Record<
      string,
      unknown
    > | null;
    if (!rpcRes.error && row) {
      return {
        totalPatients: Number(row.total_patients ?? 0),
        totalAppointments: Number(row.total_appointments ?? 0),
        completedAppointments: Number(row.completed_appointments ?? 0),
        noShowCount: Number(row.no_show_count ?? 0),
        totalRevenue: Number(row.total_revenue ?? 0),
        averageRating: Number(row.average_rating ?? 0),
        doctorCount: Number(row.doctor_count ?? 0),
        insurancePatients: Number(row.insurance_patients ?? 0),
        recentActivity: rpcRecentActivity,
      };
    }
    logger.warn("get_clinic_dashboard_stats RPC unavailable, using fallback", {
      context: "data/dashboard",
      error: rpcRes.error,
    });
  } catch (err) {
    logger.warn("get_clinic_dashboard_stats RPC failed, using fallback", {
      context: "data/dashboard",
      error: err,
    });
  }

  // Fallback: legacy multi-query path (audit DRY-02). Remove once
  // migration 00180 is deployed everywhere.
  const [base, insurancePatientsRes, recentActivity] = await Promise.all([
    fetchBaseDashboardStats(clinicId),
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

export interface PatientAppointmentView {
  id: string;
  serviceName: string;
  doctorName: string;
  date: string;
  time: string;
  status: string;
}

export interface PatientPrescriptionView {
  id: string;
  patientId: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
}

export interface PatientInvoiceView {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}

export interface PatientNotificationView {
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

  const [apptsRes, rxRes, invoicesRes, notifsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, doctor_id, service_id, appointment_date, start_time, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
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

// ────────────────────────────────────────────
// Receptionist Dashboard Data (server-side)
// ────────────────────────────────────────────

export interface ReceptionistDashboardData {
  appointments: AppointmentView[];
  patients: PatientView[];
  /** Sum of completed payments within the lookback window ("Revenue (Month)"). */
  totalRevenue: number;
}

/**
 * PERF-LAT-07: Server-side loader for the receptionist dashboard.
 *
 * The page was previously a Client Component that rendered a spinner, then
 * after hydration ran getCurrentUser() (a browser→Supabase auth round trip)
 * followed by three more fetches — a full client-side waterfall on every
 * visit. This loader runs during the server render (auth context already
 * resolved by middleware/requireAuth), issues all queries in one parallel
 * batch over the server's connection, and streams the finished HTML.
 *
 * Scoped to a 30-day lookback + future rows: the dashboard renders
 * today/tomorrow lists, recent status tabs and monthly revenue — never
 * deep history.
 */
export async function getReceptionistDashboardData(
  clinicId: string,
): Promise<ReceptionistDashboardData> {
  const supabase = await createClient();

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 30);
  const sinceDate = getLocalDateStr(lookbackDate);

  const [apptsRes, patientsRes, doctorsRes, servicesRes, paymentsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, patient_id, doctor_id, service_id, appointment_date, start_time, status, is_first_visit, insurance_flag, is_emergency, notes, cancelled_at, cancellation_reason, rescheduled_from, recurrence_group_id, recurrence_pattern",
      )
      .eq("clinic_id", clinicId)
      .gte("appointment_date", sinceDate)
      .order("appointment_date", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("users")
      .select("id, name, phone, email, metadata, created_at")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .order("name", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("services")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .limit(DEFAULT_QUERY_LIMIT),
    supabase
      .from("payments")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte("created_at", lookbackDate.toISOString())
      .limit(DEFAULT_QUERY_LIMIT),
  ]);

  type PatientRaw = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string | null;
  };
  const patientRows = (patientsRes.data ?? []) as PatientRaw[];

  // Mirrors mapPatient() in src/lib/data/client/users.ts so the client view
  // receives identical shapes whether data came from server or browser.
  const patients: PatientView[] = patientRows.map((raw) => {
    const meta = raw.metadata ?? {};
    const dob = (meta.date_of_birth as string) ?? "";
    let age = 0;
    if (dob) {
      const diff = Date.now() - new Date(dob).getTime();
      age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }
    return {
      id: raw.id,
      name: raw.name,
      phone: raw.phone ?? "",
      email: raw.email ?? "",
      age: (meta.age as number) ?? age,
      gender: ((meta.gender as string) ?? "M") as "M" | "F",
      dateOfBirth: dob,
      allergies: (meta.allergies as string[]) ?? undefined,
      insurance: (meta.insurance as string) ?? undefined,
      registeredAt: raw.created_at?.split("T")[0] ?? "",
    };
  });

  const nameMap = new Map<string, { name: string; phone: string }>();
  for (const p of patientRows) nameMap.set(p.id, { name: p.name, phone: p.phone ?? "" });
  for (const d of (doctorsRes.data ?? []) as { id: string; name: string }[]) {
    nameMap.set(d.id, { name: d.name, phone: "" });
  }
  const serviceMap = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  type ApptRaw = {
    id: string;
    patient_id: string;
    doctor_id: string;
    service_id: string | null;
    appointment_date: string;
    start_time: string | null;
    status: string | null;
    is_first_visit: boolean | null;
    insurance_flag: boolean | null;
    is_emergency: boolean | null;
    notes: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    rescheduled_from: string | null;
    recurrence_group_id: string | null;
    recurrence_pattern: string | null;
  };
  // Mirrors mapAppointment() in src/lib/data/client/appointments.ts.
  const appointments: AppointmentView[] = ((apptsRes.data ?? []) as ApptRaw[]).map((raw) => ({
    id: raw.id,
    patientId: raw.patient_id,
    patientName: nameMap.get(raw.patient_id)?.name ?? "Unknown",
    patientPhone: nameMap.get(raw.patient_id)?.phone || undefined,
    doctorId: raw.doctor_id,
    doctorName: nameMap.get(raw.doctor_id)?.name ?? "Unknown",
    serviceId: raw.service_id ?? "",
    serviceName: (raw.service_id ? serviceMap.get(raw.service_id) : null) ?? "Consultation",
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
  }));

  const totalRevenue = ((paymentsRes.data ?? []) as { amount: number }[]).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  );

  return { appointments, patients, totalRevenue };
}
