"use client";

/**
 * Client-side Supabase data fetching helpers.
 *
 * These functions use the browser Supabase client (cookie-based auth + RLS)
 * and return data shaped to match the existing UI types from demo-data.ts.
 *
 * Pattern in pages:
 *   const [data, setData] = useState<X[]>([]);
 *   useEffect(() => { fetchX(clinicId).then(setData); }, [clinicId]);
 */

import { createClient } from "@/lib/supabase-client";
import { clinicConfig } from "@/config/clinic.config";

// ── re-export the browser client for direct use ──
export { createClient };

// ── current user helpers ──

export interface ClinicUser {
  id: string;
  auth_id: string;
  clinic_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
}

let _cachedUser: ClinicUser | null | undefined;

export async function getCurrentUser(): Promise<ClinicUser | null> {
  if (_cachedUser !== undefined) return _cachedUser;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    _cachedUser = null;
    return null;
  }
  const { data } = await supabase
    .from("users")
    .select("id, auth_id, clinic_id, role, name, phone, email")
    .eq("auth_id", user.id)
    .single();
  _cachedUser = (data as ClinicUser) ?? null;
  return _cachedUser;
}

export function clearUserCache() {
  _cachedUser = undefined;
}

// ── Generic fetch helper ──

async function fetchRows<T>(
  table: string,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
    order?: [string, { ascending: boolean }];
    limit?: number;
    gte?: [string, unknown];
    lte?: [string, unknown];
    inFilter?: [string, unknown[]];
  },
): Promise<T[]> {
  const supabase = createClient();
  let q = supabase.from(table).select(opts?.select ?? "*");
  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val);
    }
  }
  if (opts?.inFilter) {
    q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);
  }
  if (opts?.gte) q = q.gte(opts.gte[0] as string, opts.gte[1]);
  if (opts?.lte) q = q.lte(opts.lte[0] as string, opts.lte[1]);
  if (opts?.order) q = q.order(opts.order[0], opts.order[1]);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.error(`[data] ${table}:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

// ─────────────────────────────────────────────
// Appointments  (maps to demo-data Appointment)
// ─────────────────────────────────────────────

export interface AppointmentView {
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
  cancelledAt?: string;
  cancellationReason?: string;
  rescheduledFrom?: string;
  isEmergency?: boolean;
  notes?: string;
}

interface AppointmentRaw {
  id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_first_visit: boolean;
  insurance_flag: boolean;
  booking_source: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rescheduled_from: string | null;
  is_emergency: boolean;
  created_at: string;
}

// lookup maps built lazily
let _userMap: Map<string, { name: string; phone: string; email: string }> | null = null;
let _serviceMap: Map<string, { name: string; price: number }> | null = null;

async function ensureLookups(clinicId: string) {
  if (_userMap && _serviceMap) return;
  const supabase = createClient();
  const [usersRes, servicesRes] = await Promise.all([
    supabase.from("users").select("id, name, phone, email").eq("clinic_id", clinicId),
    supabase.from("services").select("id, name, price").eq("clinic_id", clinicId),
  ]);
  _userMap = new Map(
    ((usersRes.data ?? []) as { id: string; name: string; phone: string; email: string }[]).map((u) => [
      u.id,
      u,
    ]),
  );
  _serviceMap = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string; price: number }[]).map((s) => [
      s.id,
      s,
    ]),
  );
}

export function clearLookupCache() {
  _userMap = null;
  _serviceMap = null;
}

function mapAppointment(raw: AppointmentRaw): AppointmentView {
  const patient = _userMap?.get(raw.patient_id);
  const doctor = _userMap?.get(raw.doctor_id);
  const service = raw.service_id ? _serviceMap?.get(raw.service_id) : null;
  return {
    id: raw.id,
    patientId: raw.patient_id,
    patientName: patient?.name ?? "Unknown",
    doctorId: raw.doctor_id,
    doctorName: doctor?.name ?? "Unknown",
    serviceId: raw.service_id ?? "",
    serviceName: service?.name ?? "Consultation",
    date: raw.appointment_date,
    time: raw.start_time?.slice(0, 5) ?? "",
    status: raw.status?.replace("_", "-") ?? "scheduled",
    isFirstVisit: raw.is_first_visit ?? false,
    hasInsurance: raw.insurance_flag ?? false,
    cancelledAt: raw.cancelled_at ?? undefined,
    cancellationReason: raw.cancellation_reason ?? undefined,
    rescheduledFrom: raw.rescheduled_from ?? undefined,
    isEmergency: raw.is_emergency ?? false,
    notes: raw.notes ?? undefined,
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
  const today = new Date().toISOString().split("T")[0];
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

// ─────────────────────────────────────────────
// Users / Doctors / Patients
// ─────────────────────────────────────────────

export interface DoctorView {
  id: string;
  name: string;
  specialtyId: string;
  specialty: string;
  phone: string;
  email: string;
  avatar?: string;
  consultationFee: number;
  languages: string[];
}

export interface PatientView {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: "M" | "F";
  dateOfBirth: string;
  allergies?: string[];
  insurance?: string;
  registeredAt: string;
}

interface UserRaw {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function mapDoctor(raw: UserRaw): DoctorView {
  const meta = raw.metadata ?? {};
  return {
    id: raw.id,
    name: raw.name,
    specialtyId: (meta.specialty_id as string) ?? "",
    specialty: (meta.specialty as string) ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    avatar: raw.avatar_url ?? undefined,
    consultationFee: (meta.consultation_fee as number) ?? 0,
    languages: (meta.languages as string[]) ?? [],
  };
}

function mapPatient(raw: UserRaw): PatientView {
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
}

export async function fetchDoctors(clinicId: string): Promise<DoctorView[]> {
  const rows = await fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "doctor"]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapDoctor);
}

export async function fetchPatients(clinicId: string): Promise<PatientView[]> {
  const rows = await fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "patient"]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapPatient);
}

export async function fetchReceptionists(clinicId: string): Promise<UserRaw[]> {
  return fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "receptionist"]],
    order: ["name", { ascending: true }],
  });
}

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

export interface ServiceView {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  currency: string;
  active: boolean;
  category?: string;
}

interface ServiceRaw {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number | null;
  is_active: boolean;
  category: string | null;
}

function mapService(raw: ServiceRaw): ServiceView {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    duration: raw.duration_min ?? 30,
    price: raw.price ?? 0,
    currency: "MAD",
    active: raw.is_active ?? true,
    category: raw.category ?? undefined,
  };
}

export async function fetchServices(clinicId: string): Promise<ServiceView[]> {
  const rows = await fetchRows<ServiceRaw>("services", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map(mapService);
}

// ─────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────

export interface ReviewView {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  replied: boolean;
  response?: string;
}

interface ReviewRaw {
  id: string;
  patient_id: string;
  clinic_id: string;
  stars: number;
  comment: string | null;
  response: string | null;
  is_visible: boolean;
  created_at: string;
}

export async function fetchReviews(clinicId: string): Promise<ReviewView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ReviewRaw>("reviews", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    rating: r.stars,
    comment: r.comment ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    replied: !!r.response,
    response: r.response ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Prescriptions
// ─────────────────────────────────────────────

export interface PrescriptionView {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
  notes?: string;
}

interface PrescriptionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  items: { name: string; dosage: string; duration: string }[] | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

export async function fetchPrescriptions(clinicId: string, doctorId?: string): Promise<PrescriptionView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<PrescriptionRaw>("prescriptions", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _userMap?.get(r.doctor_id)?.name ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    medications: r.items ?? [],
    notes: r.notes ?? undefined,
  }));
}

export async function fetchPatientPrescriptions(clinicId: string, patientId: string): Promise<PrescriptionView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PrescriptionRaw>("prescriptions", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _userMap?.get(r.doctor_id)?.name ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    medications: r.items ?? [],
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Invoices / Payments
// ─────────────────────────────────────────────

export interface InvoiceView {
  id: string;
  patientName: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  date: string;
}

interface PaymentRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  amount: number;
  method: string | null;
  status: string;
  reference: string | null;
  payment_type: string;
  refunded_amount: number;
  created_at: string;
}

export async function fetchInvoices(clinicId: string): Promise<InvoiceView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PaymentRaw>("payments", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    appointmentId: r.appointment_id ?? undefined,
    amount: r.amount,
    currency: "MAD",
    method: r.method ?? "cash",
    status: r.status === "completed" ? "paid" : r.status,
    date: r.created_at?.split("T")[0] ?? "",
  }));
}

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
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _userMap?.get(r.doctor_id)?.name ?? "Doctor",
    preferredDate: r.preferred_date ?? "",
    preferredTime: r.preferred_time ?? undefined,
    serviceId: r.service_id ?? undefined,
    serviceName: r.service_id ? _serviceMap?.get(r.service_id)?.name : undefined,
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
  date: string;
  diagnosis: string;
  notes: string;
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
  created_at: string;
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
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    date: r.created_at?.split("T")[0] ?? "",
    diagnosis: r.diagnosis ?? "",
    notes: r.notes ?? "",
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
  doctor_id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_capacity: number;
  buffer_minutes: number;
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
    doctorName: _userMap?.get(r.doctor_id)?.name ?? "Doctor",
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    maxCapacity: r.max_capacity,
    bufferMinutes: r.buffer_minutes,
    isAvailable: r.is_available,
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
  const [patientsRes, appointmentsRes, paymentsRes, reviewsRes, doctorsRes] = await Promise.all([
    supabase.from("users").select("id, metadata").eq("clinic_id", clinicId).eq("role", "patient"),
    supabase.from("appointments").select("id, status").eq("clinic_id", clinicId),
    supabase.from("payments").select("id, amount").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("id, stars").eq("clinic_id", clinicId),
    supabase.from("users").select("id").eq("clinic_id", clinicId).eq("role", "doctor"),
  ]);
  const patients = (patientsRes.data ?? []) as { id: string; metadata: Record<string, unknown> | null }[];
  const appts = (appointmentsRes.data ?? []) as { id: string; status: string }[];
  const payments = (paymentsRes.data ?? []) as { id: string; amount: number }[];
  const reviews = (reviewsRes.data ?? []) as { id: string; stars: number }[];

  const totalRevenue = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;
  const insuranceCount = patients.filter((p) => p.metadata && (p.metadata as Record<string, unknown>).insurance).length;

  return {
    totalPatients: patients.length,
    totalAppointments: appts.length,
    completedAppointments: appts.filter((a) => a.status === "completed").length,
    noShowCount: appts.filter((a) => a.status === "no_show" || a.status === "no-show").length,
    totalRevenue,
    averageRating: avgRating,
    doctorCount: (doctorsRes.data ?? []).length,
    insurancePatients: insuranceCount,
  };
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
): Promise<boolean> {
  const supabase = createClient();
  // Map UI status names to DB status names
  const dbStatus = status.replace("-", "_");
  const updateData: Record<string, unknown> = { status: dbStatus };
  if (dbStatus === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }
  const { error } = await supabase.from("appointments").update(updateData).eq("id", appointmentId);
  if (error) {
    console.error("[data] update appointment:", error.message);
    return false;
  }
  return true;
}

export async function createPayment(data: {
  clinic_id: string;
  patient_id: string;
  appointment_id?: string;
  amount: number;
  method?: string;
  status?: string;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("payments").insert({
    ...data,
    status: data.status ?? "completed",
    payment_type: "full",
    refunded_amount: 0,
  });
  if (error) {
    console.error("[data] create payment:", error.message);
    return false;
  }
  return true;
}

export async function upsertReview(data: {
  clinic_id: string;
  patient_id: string;
  stars: number;
  comment?: string;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("reviews").insert(data);
  if (error) {
    console.error("[data] create review:", error.message);
    return false;
  }
  return true;
}

export async function updateReviewResponse(reviewId: string, response: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("reviews").update({ response }).eq("id", reviewId);
  return !error;
}

export async function createPrescription(data: {
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  items: { name: string; dosage: string; duration: string }[];
  notes?: string;
  appointment_id?: string;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("prescriptions").insert(data);
  if (error) {
    console.error("[data] create prescription:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Dental: Odontogram
// ─────────────────────────────────────────────

export interface OdontogramView {
  toothNumber: number;
  status: string;
  notes?: string;
}

export async function fetchOdontogram(clinicId: string, patientId: string): Promise<OdontogramView[]> {
  const rows = await fetchRows<{ tooth_number: number; status: string; notes: string | null }>("odontogram", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["tooth_number", { ascending: true }],
  });
  return rows.map((r) => ({
    toothNumber: r.tooth_number,
    status: r.status,
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Dental: Treatment Plans
// ─────────────────────────────────────────────

export interface TreatmentPlanView {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null }[];
  totalCost: number;
  status: string;
  createdAt: string;
}

interface TreatmentPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null }[] | null;
  total_cost: number | null;
  status: string;
  created_at: string;
}

export async function fetchTreatmentPlans(clinicId: string, doctorId?: string): Promise<TreatmentPlanView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<TreatmentPlanRaw>("treatment_plans", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    title: r.title,
    steps: r.steps ?? [],
    totalCost: r.total_cost ?? 0,
    status: r.status,
    createdAt: r.created_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Dental: Lab Orders
// ─────────────────────────────────────────────

export interface LabOrderView {
  id: string;
  patientName: string;
  labName: string;
  description: string;
  status: string;
  dueDate: string;
  createdAt: string;
}

interface LabOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lab_name: string | null;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export async function fetchLabOrders(clinicId: string): Promise<LabOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabOrderRaw>("lab_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    labName: r.lab_name ?? "",
    description: r.description,
    status: r.status,
    dueDate: r.due_date ?? "",
    createdAt: r.created_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Dental: Sterilization Log
// ─────────────────────────────────────────────

export interface SterilizationView {
  id: string;
  toolName: string;
  sterilizedAt: string;
  nextDue: string;
  notes?: string;
}

export async function fetchSterilizationLog(clinicId: string): Promise<SterilizationView[]> {
  const rows = await fetchRows<{
    id: string;
    tool_name: string;
    sterilized_at: string;
    next_due: string | null;
    notes: string | null;
  }>("sterilization_log", {
    eq: [["clinic_id", clinicId]],
    order: ["sterilized_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    toolName: r.tool_name,
    sterilizedAt: r.sterilized_at,
    nextDue: r.next_due ?? "",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Dental: Installments
// ─────────────────────────────────────────────

export interface InstallmentView {
  id: string;
  treatmentPlanId: string;
  patientName: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: string;
}

interface InstallmentRaw {
  id: string;
  clinic_id: string;
  treatment_plan_id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

export async function fetchInstallments(clinicId: string): Promise<InstallmentView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<InstallmentRaw>("installments", {
    eq: [["clinic_id", clinicId]],
    order: ["due_date", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    treatmentPlanId: r.treatment_plan_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    amount: r.amount,
    dueDate: r.due_date,
    paidDate: r.paid_date ?? undefined,
    status: r.status,
  }));
}

// ─────────────────────────────────────────────
// Dental: Before/After Photos
// ─────────────────────────────────────────────

export interface BeforeAfterPhotoView {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  description: string;
  beforeDate: string;
  afterDate: string | null;
  category: string;
}

export async function fetchBeforeAfterPhotos(clinicId: string, patientId?: string): Promise<BeforeAfterPhotoView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string;
    patient_id: string;
    treatment_plan_id: string | null;
    description: string | null;
    before_date: string | null;
    after_date: string | null;
    category: string | null;
  }>("before_after_photos", {
    eq,
    order: ["before_date", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    treatmentPlanId: r.treatment_plan_id ?? "",
    description: r.description ?? "",
    beforeDate: r.before_date ?? "",
    afterDate: r.after_date ?? null,
    category: r.category ?? "General",
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Products / Stock
// ─────────────────────────────────────────────

export interface ProductView {
  id: string;
  name: string;
  category: string;
  price: number;
  requiresPrescription: boolean;
  stockQuantity: number;
  minimumStock: number;
  expiryDate: string;
  barcode?: string;
  manufacturer?: string;
}

interface ProductRaw {
  id: string;
  clinic_id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  requires_prescription: boolean;
  is_active: boolean;
}

interface StockRaw {
  id: string;
  product_id: string;
  clinic_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
}

export async function fetchProducts(clinicId: string): Promise<ProductView[]> {
  const [products, stock] = await Promise.all([
    fetchRows<ProductRaw>("products", { eq: [["clinic_id", clinicId]] }),
    fetchRows<StockRaw>("stock", { eq: [["clinic_id", clinicId]] }),
  ]);
  const stockMap = new Map(stock.map((s) => [s.product_id, s]));
  return products.map((p) => {
    const s = stockMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      category: p.category ?? "General",
      price: p.price ?? 0,
      requiresPrescription: p.requires_prescription,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      barcode: s?.batch_number ?? undefined,
    };
  });
}

export function getLowStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity <= p.minimumStock && p.stockQuantity > 0);
}

export function getOutOfStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity === 0);
}

export function getExpiringProducts(products: ProductView[], days: number = 90): ProductView[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= cutoff);
}

// ─────────────────────────────────────────────
// Pharmacy: Suppliers
// ─────────────────────────────────────────────

export interface SupplierView {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export async function fetchSuppliers(clinicId: string): Promise<SupplierView[]> {
  const rows = await fetchRows<{
    id: string;
    name: string;
    contact_phone: string | null;
    contact_email: string | null;
  }>("suppliers", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.contact_phone ?? "",
    email: r.contact_email ?? "",
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Prescription Requests
// ─────────────────────────────────────────────

export interface PharmacyPrescriptionView {
  id: string;
  patientName: string;
  imageUrl: string;
  status: string;
  items: { productName: string; quantity: number }[];
  uploadedAt: string;
  notes?: string;
}

interface PrescriptionRequestRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  image_url: string;
  status: string;
  notes: string | null;
  delivery_requested: boolean;
  created_at: string;
}

export async function fetchPrescriptionRequests(clinicId: string): Promise<PharmacyPrescriptionView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PrescriptionRequestRaw>("prescription_requests", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    imageUrl: r.image_url,
    status: r.status,
    items: [],
    uploadedAt: r.created_at ?? "",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Loyalty
// ─────────────────────────────────────────────

export interface LoyaltyMemberView {
  id: string;
  patientName: string;
  points: number;
  tier: string;
  lastUpdated: string;
}

export async function fetchLoyaltyMembers(clinicId: string): Promise<LoyaltyMemberView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<{
    id: string;
    patient_id: string;
    clinic_id: string;
    points: number;
    updated_at: string;
  }>("loyalty_points", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Member",
    points: r.points,
    tier: r.points >= 1000 ? "Gold" : r.points >= 500 ? "Silver" : "Bronze",
    lastUpdated: r.updated_at ?? "",
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Purchase Orders
// ─────────────────────────────────────────────

export interface PurchaseOrderView {
  id: string;
  supplierName: string;
  status: string;
  totalAmount: number;
  items: { productName: string; quantity: number }[];
  expectedDelivery: string;
  orderedAt: string;
}

interface PurchaseOrderRaw {
  id: string;
  clinic_id: string;
  supplier_id: string;
  status: string;
  total_amount: number | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
}

export async function fetchPurchaseOrders(clinicId: string): Promise<PurchaseOrderView[]> {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) return [];

  // Get supplier names
  const supplierIds = [...new Set((orders as PurchaseOrderRaw[]).map((o) => o.supplier_id))];
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .in("id", supplierIds);
  const supplierMap = new Map(
    ((suppliers ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  return (orders as PurchaseOrderRaw[]).map((o) => ({
    id: o.id,
    supplierName: supplierMap.get(o.supplier_id) ?? "Supplier",
    status: o.status,
    totalAmount: o.total_amount ?? 0,
    items: [],
    expectedDelivery: o.ordered_at ?? "",
    orderedAt: o.ordered_at ?? o.created_at ?? "",
  }));
}

// ─────────────────────────────────────────────
// Clinic Holidays
// ─────────────────────────────────────────────

export interface HolidayView {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export async function fetchHolidays(clinicId: string): Promise<HolidayView[]> {
  const rows = await fetchRows<{
    id: string;
    title: string;
    start_date: string;
    end_date: string;
  }>("clinic_holidays", {
    eq: [["clinic_id", clinicId]],
    order: ["start_date", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

// ─────────────────────────────────────────────
// Blog Posts (stored in clinic config or static)
// ─────────────────────────────────────────────

export interface BlogPostView {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

// Blog posts aren't in the DB schema — they may be stored in clinic config
// For now we return empty; pages will fall back to demo data if empty
export async function fetchBlogPosts(_clinicId: string): Promise<BlogPostView[]> {
  return [];
}

// ─────────────────────────────────────────────
// Waiting Room (derived from today's appointments)
// ─────────────────────────────────────────────

export interface WaitingRoomEntry {
  id: string;
  patientName: string;
  scheduledTime: string;
  serviceName: string;
  status: string;
  priority: string;
  checkedInAt?: string;
}

export async function fetchWaitingRoom(clinicId: string): Promise<WaitingRoomEntry[]> {
  const todayAppts = await fetchTodayAppointments(clinicId);
  return todayAppts
    .filter((a) => a.status === "confirmed" || a.status === "checked-in" || a.status === "checked_in")
    .map((a) => ({
      id: a.id,
      patientName: a.patientName,
      scheduledTime: a.time,
      serviceName: a.serviceName,
      status: "waiting",
      priority: a.isEmergency ? "urgent" : "normal",
    }));
}

// ─────────────────────────────────────────────
// Emergency Slots
// ─────────────────────────────────────────────

export interface EmergencySlotView {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isBooked: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Installment Plans (grouped view)
// ─────────────────────────────────────────────

export interface InstallmentPaymentView {
  id: string;
  installmentPlanId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "pending" | "paid" | "overdue";
  receiptId: string | null;
}

export interface InstallmentPlanView {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  treatmentTitle: string;
  totalAmount: number;
  currency: string;
  downPayment: number;
  numberOfInstallments: number;
  installments: InstallmentPaymentView[];
  createdAt: string;
  status: "active" | "completed" | "defaulted";
  whatsappReminderEnabled: boolean;
}

interface InstallmentPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  treatment_plan_id: string;
  total_amount: number;
  currency: string | null;
  down_payment: number | null;
  status: string;
  whatsapp_reminder: boolean;
  created_at: string;
}

interface InstallmentItemRaw {
  id: string;
  plan_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  receipt_id: string | null;
}

export async function fetchInstallmentPlans(clinicId: string): Promise<InstallmentPlanView[]> {
  await ensureLookups(clinicId);

  const plans = await fetchRows<InstallmentPlanRaw>("installment_plans", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });

  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const items = await fetchRows<InstallmentItemRaw>("installments", {
    inFilter: ["plan_id", planIds],
    order: ["due_date", { ascending: true }],
  });

  const itemsByPlan = new Map<string, InstallmentItemRaw[]>();
  for (const item of items) {
    const arr = itemsByPlan.get(item.plan_id) ?? [];
    arr.push(item);
    itemsByPlan.set(item.plan_id, arr);
  }

  // Fetch treatment plan titles
  const tpIds = [...new Set(plans.map((p) => p.treatment_plan_id))];
  const tpRows = await fetchRows<{ id: string; title: string }>("treatment_plans", {
    select: "id, title",
    inFilter: ["id", tpIds],
  });
  const tpMap = new Map(tpRows.map((t) => [t.id, t.title]));

  return plans.map((p) => {
    const planItems = itemsByPlan.get(p.id) ?? [];
    return {
      id: p.id,
      patientId: p.patient_id,
      patientName: _userMap?.get(p.patient_id)?.name ?? "Patient",
      treatmentPlanId: p.treatment_plan_id,
      treatmentTitle: tpMap.get(p.treatment_plan_id) ?? "Treatment Plan",
      totalAmount: p.total_amount,
      currency: p.currency ?? "MAD",
      downPayment: p.down_payment ?? 0,
      numberOfInstallments: planItems.length,
      installments: planItems.map((i) => ({
        id: i.id,
        installmentPlanId: i.plan_id,
        amount: i.amount,
        dueDate: i.due_date,
        paidDate: i.paid_date,
        status: i.status as "pending" | "paid" | "overdue",
        receiptId: i.receipt_id,
      })),
      createdAt: p.created_at?.split("T")[0] ?? "",
      status: p.status as "active" | "completed" | "defaulted",
      whatsappReminderEnabled: p.whatsapp_reminder ?? false,
    };
  });
}

// ─────────────────────────────────────────────
// Analytics (computed from real data)
// ─────────────────────────────────────────────

export interface DailyAnalyticsView {
  date: string;
  patientCount: number;
  revenue: number;
  appointments: number;
  noShows: number;
  walkIns: number;
  onlineBookings: number;
}

export interface WeeklyRevenueView {
  week: string;
  revenue: number;
  patients: number;
}

export interface MonthlyRevenueView {
  month: string;
  revenue: number;
  patients: number;
  appointments: number;
}

export interface ServicePopularityView {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface HourlyHeatmapView {
  day: string;
  hours: { hour: number; count: number }[];
}

export interface ReviewTrendView {
  month: string;
  averageScore: number;
  count: number;
}

export interface PatientRetentionView {
  month: string;
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}

export interface AnalyticsData {
  dailyAnalytics: DailyAnalyticsView[];
  weeklyRevenue: WeeklyRevenueView[];
  monthlyRevenue: MonthlyRevenueView[];
  servicePopularity: ServicePopularityView[];
  hourlyHeatmap: HourlyHeatmapView[];
  reviewTrends: ReviewTrendView[];
  patientRetention: PatientRetentionView[];
  totalPatients: number;
  totalAppointments: number;
}

export async function fetchAnalytics(clinicId: string): Promise<AnalyticsData> {
  const supabase = createClient();

  const [apptsRes, paymentsRes, reviewsRes, patientsRes] = await Promise.all([
    supabase.from("appointments").select("*").eq("clinic_id", clinicId),
    supabase.from("payments").select("*").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("*").eq("clinic_id", clinicId),
    supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
  ]);

  type ApptRow = { id: string; appointment_date: string; start_time: string; status: string; patient_id: string; service_id: string | null; booking_source: string | null };
  type PaymentRow = { id: string; amount: number; created_at: string };
  type ReviewRow = { id: string; stars: number; created_at: string };
  type PatientRow = { id: string; created_at: string };

  const appts = (apptsRes.data ?? []) as ApptRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const allPatients = (patientsRes.data ?? []) as PatientRow[];

  await ensureLookups(clinicId);

  // Daily analytics (last 20 days)
  const dailyMap = new Map<string, DailyAnalyticsView>();
  const now = new Date();
  for (let i = 19; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    dailyMap.set(dateStr, { date: dateStr, patientCount: 0, revenue: 0, appointments: 0, noShows: 0, walkIns: 0, onlineBookings: 0 });
  }
  for (const a of appts) {
    const day = dailyMap.get(a.appointment_date);
    if (!day) continue;
    day.appointments++;
    day.patientCount++;
    if (a.status === "no_show" || a.status === "no-show") day.noShows++;
    if (a.booking_source === "walk-in" || a.booking_source === "walk_in") day.walkIns++;
    if (a.booking_source === "online" || a.booking_source === "website") day.onlineBookings++;
  }
  for (const p of payments) {
    const dateStr = p.created_at?.split("T")[0];
    const day = dailyMap.get(dateStr);
    if (day) day.revenue += p.amount;
  }
  const dailyAnalytics = [...dailyMap.values()];

  // Weekly revenue (group daily into weeks)
  const weeklyRevenue: WeeklyRevenueView[] = [];
  for (let i = 0; i < dailyAnalytics.length; i += 7) {
    const chunk = dailyAnalytics.slice(i, i + 7);
    if (chunk.length === 0) break;
    const weekNum = Math.floor(i / 7) + 1;
    weeklyRevenue.push({
      week: `Week ${weekNum} (${chunk[0].date.slice(5)} - ${chunk[chunk.length - 1].date.slice(5)})`,
      revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      patients: chunk.reduce((s, d) => s + d.patientCount, 0),
    });
  }

  // Monthly revenue (last 6 months)
  const monthlyRevenue: MonthlyRevenueView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthAppts = appts.filter((a) => a.appointment_date?.startsWith(monthStr));
    const monthPayments = payments.filter((p) => p.created_at?.startsWith(monthStr));
    const uniquePatients = new Set(monthAppts.map((a) => a.patient_id));
    monthlyRevenue.push({
      month: label,
      revenue: monthPayments.reduce((s, p) => s + p.amount, 0),
      patients: uniquePatients.size,
      appointments: monthAppts.length,
    });
  }

  // Service popularity
  const serviceCount = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const svcName = a.service_id ? (_serviceMap?.get(a.service_id)?.name ?? "Other") : "Consultation";
    const entry = serviceCount.get(svcName) ?? { count: 0, revenue: 0 };
    entry.count++;
    if (a.service_id) {
      entry.revenue += _serviceMap?.get(a.service_id)?.price ?? 0;
    }
    serviceCount.set(svcName, entry);
  }
  const totalSvcCount = appts.length || 1;
  const servicePopularity: ServicePopularityView[] = [...serviceCount.entries()]
    .map(([name, val]) => ({
      serviceName: name,
      count: val.count,
      revenue: val.revenue,
      percentage: Math.round((val.count / totalSvcCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Hourly heatmap
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmap = new Map<string, Map<number, number>>();
  for (const name of dayNames) heatmap.set(name, new Map());
  for (const a of appts) {
    const date = new Date(a.appointment_date);
    const dayName = dayNames[date.getDay()];
    const hour = parseInt(a.start_time?.slice(0, 2) ?? "0", 10);
    const dayMap = heatmap.get(dayName)!;
    dayMap.set(hour, (dayMap.get(hour) ?? 0) + 1);
  }
  const hourlyHeatmap: HourlyHeatmapView[] = dayNames.slice(1, 7).map((day) => ({
    day,
    hours: [9, 10, 11, 12, 14, 15, 16, 17]
      .map((hour) => ({ hour, count: heatmap.get(day)?.get(hour) ?? 0 })),
  }));

  // Review trends (last 6 months)
  const reviewTrends: ReviewTrendView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthReviews = reviews.filter((r) => r.created_at?.startsWith(monthStr));
    const avg = monthReviews.length > 0
      ? monthReviews.reduce((s, r) => s + r.stars, 0) / monthReviews.length
      : 0;
    reviewTrends.push({ month: label, averageScore: Math.round(avg * 10) / 10, count: monthReviews.length });
  }

  // Patient retention (last 6 months)
  const patientRetention: PatientRetentionView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const newPts = allPatients.filter((p) => p.created_at?.startsWith(monthStr)).length;
    const monthAppts = appts.filter((a) => a.appointment_date?.startsWith(monthStr));
    const returningIds = new Set(monthAppts.map((a) => a.patient_id));
    const returning = returningIds.size;
    const total = newPts + returning || 1;
    patientRetention.push({
      month: label,
      newPatients: newPts,
      returningPatients: returning,
      retentionRate: Math.round((returning / total) * 100),
    });
  }

  return {
    dailyAnalytics,
    weeklyRevenue,
    monthlyRevenue,
    servicePopularity,
    hourlyHeatmap,
    reviewTrends,
    patientRetention,
    totalPatients: allPatients.length,
    totalAppointments: appts.length,
  };
}

// ─────────────────────────────────────────────
// Booking Slot Helpers (client-side via Supabase)
// ─────────────────────────────────────────────

/**
 * Generate time-slot strings for a given date and doctor
 * based on the doctor's configured time_slots for that day of week.
 */
export async function fetchGeneratedSlots(
  clinicId: string,
  date: string,
  doctorId: string,
): Promise<string[]> {
  const dayOfWeek = new Date(date).getDay();
  const slots = await fetchTimeSlots(clinicId, doctorId);
  const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek && s.isAvailable);

  const result: string[] = [];
  const duration = clinicConfig.booking.slotDuration;
  const buffer = clinicConfig.booking.bufferTime;

  for (const config of daySlots) {
    const [startH, startM] = config.startTime.split(":").map(Number);
    const [endH, endM] = config.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let current = startMinutes;
    while (current + duration <= endMinutes) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      result.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += duration + buffer;
    }
  }

  return result.sort();
}

/**
 * Get existing appointment counts per time slot for a given date and doctor.
 */
export async function fetchSlotBookingCounts(
  clinicId: string,
  date: string,
  doctorId: string,
): Promise<Record<string, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("start_time, status")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date)
    .not("status", "in", '("cancelled","no_show")');

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const appt of data) {
    const time = (appt.start_time as string)?.slice(0, 5) ?? "";
    if (time) {
      counts[time] = (counts[time] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Get available (non-fully-booked) slots for a date and doctor.
 */
export async function fetchAvailableSlots(
  clinicId: string,
  date: string,
  doctorId: string,
): Promise<string[]> {
  const [allSlots, bookingCounts] = await Promise.all([
    fetchGeneratedSlots(clinicId, date, doctorId),
    fetchSlotBookingCounts(clinicId, date, doctorId),
  ]);

  const maxPerSlot = clinicConfig.booking.maxPerSlot;
  return allSlots.filter((slot) => (bookingCounts[slot] ?? 0) < maxPerSlot);
}

// ─────────────────────────────────────────────
// Waiting List Mutations
// ─────────────────────────────────────────────

export async function addToWaitingList(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  preferred_date: string;
  preferred_time?: string;
  service_id?: string;
}): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const supabase = createClient();
  const { data: entry, error } = await supabase
    .from("waiting_list")
    .insert({
      ...data,
      status: "waiting",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data] addToWaitingList:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, entryId: entry?.id };
}

// ─────────────────────────────────────────────
// Appointment Creation
// ─────────────────────────────────────────────

export async function createAppointment(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id?: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  is_first_visit?: boolean;
  insurance_flag?: boolean;
  booking_source?: string;
  notes?: string;
  is_emergency?: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = createClient();
  const { data: appt, error } = await supabase
    .from("appointments")
    .insert({
      ...data,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data] createAppointment:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, id: appt?.id };
}

// ─────────────────────────────────────────────
// Dental: Treatment Types (from services with category)
// ─────────────────────────────────────────────

export interface DentalTreatmentTypeView {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  description: string;
}

export async function fetchDentalTreatmentTypes(clinicId: string): Promise<DentalTreatmentTypeView[]> {
  const services = await fetchServices(clinicId);
  return services
    .filter((s) => s.active && s.category)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? "General",
      durationMinutes: s.duration,
      price: s.price,
      currency: s.currency,
      description: s.description,
    }));
}
