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

export async function updatePrescription(
  id: string,
  data: {
    items?: { name: string; dosage: string; duration: string }[];
    notes?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("prescriptions").update(data).eq("id", id);
  if (error) {
    console.error("[data] update prescription:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Consultation Notes Mutations
// ─────────────────────────────────────────────

export async function createConsultationNote(data: {
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_id: string;
  diagnosis?: string;
  notes?: string;
  content?: Record<string, unknown>;
  is_private?: boolean;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("consultation_notes")
    .insert(data)
    .select("id")
    .single();
  if (error) {
    console.error("[data] create consultation note:", error.message);
    return null;
  }
  return result?.id ?? null;
}

export async function updateConsultationNote(
  id: string,
  data: {
    diagnosis?: string;
    notes?: string;
    content?: Record<string, unknown>;
    is_private?: boolean;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("consultation_notes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[data] update consultation note:", error.message);
    return false;
  }
  return true;
}

export async function deleteConsultationNote(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("consultation_notes").delete().eq("id", id);
  if (error) {
    console.error("[data] delete consultation note:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Odontogram Mutations
// ─────────────────────────────────────────────

export async function upsertOdontogramEntry(data: {
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  status: string;
  notes?: string;
  dentition?: "adult" | "child";
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("odontogram").upsert(data, {
    onConflict: "clinic_id,patient_id,tooth_number",
  });
  if (error) {
    console.error("[data] upsert odontogram:", error.message);
    return false;
  }
  return true;
}

export async function deleteOdontogramEntry(
  clinicId: string,
  patientId: string,
  toothNumber: number,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("odontogram")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("tooth_number", toothNumber);
  if (error) {
    console.error("[data] delete odontogram entry:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Treatment Plan Mutations
// ─────────────────────────────────────────────

export async function createTreatmentPlan(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null; cost: number; toothNumbers?: number[] }[];
  total_cost: number;
  status?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("treatment_plans")
    .insert({ ...data, status: data.status ?? "planned" })
    .select("id")
    .single();
  if (error) {
    console.error("[data] create treatment plan:", error.message);
    return null;
  }
  return result?.id ?? null;
}

export async function updateTreatmentPlan(
  id: string,
  data: {
    title?: string;
    steps?: { step: number; description: string; status: string; date: string | null; cost: number; toothNumbers?: number[] }[];
    total_cost?: number;
    status?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("treatment_plans")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[data] update treatment plan:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Sterilization Log Mutations
// ─────────────────────────────────────────────

export async function createSterilizationEntry(data: {
  clinic_id: string;
  tool_name: string;
  sterilized_by?: string;
  method?: string;
  notes?: string;
  next_due?: string;
  batch_number?: string;
  cycle_number?: number;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("sterilization_log")
    .insert({ ...data, sterilized_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) {
    console.error("[data] create sterilization entry:", error.message);
    return null;
  }
  return result?.id ?? null;
}

export async function updateSterilizationEntry(
  id: string,
  data: {
    tool_name?: string;
    method?: string;
    notes?: string;
    next_due?: string;
    batch_number?: string;
    cycle_number?: number;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("sterilization_log").update(data).eq("id", id);
  if (error) {
    console.error("[data] update sterilization entry:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Before/After Photo Mutations
// ─────────────────────────────────────────────

export async function createBeforeAfterPhoto(data: {
  clinic_id: string;
  patient_id: string;
  treatment_plan_id?: string;
  description?: string;
  category?: string;
  before_image_url?: string;
  after_image_url?: string;
  before_date?: string;
  after_date?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("before_after_photos")
    .insert(data)
    .select("id")
    .single();
  if (error) {
    console.error("[data] create before/after photo:", error.message);
    return null;
  }
  return result?.id ?? null;
}

export async function updateBeforeAfterPhoto(
  id: string,
  data: {
    description?: string;
    category?: string;
    before_image_url?: string;
    after_image_url?: string;
    after_date?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("before_after_photos")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[data] update before/after photo:", error.message);
    return false;
  }
  return true;
}

export async function deleteBeforeAfterPhoto(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("before_after_photos").delete().eq("id", id);
  if (error) {
    console.error("[data] delete before/after photo:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Medical Certificates
// ─────────────────────────────────────────────

export interface MedicalCertificateView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  type: "sick_leave" | "fitness" | "medical_report" | "disability" | "custom";
  content: Record<string, unknown>;
  pdfUrl?: string;
  issuedDate: string;
  createdAt: string;
}

interface MedicalCertificateRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  type: string;
  content: Record<string, unknown>;
  pdf_url: string | null;
  issued_date: string;
  created_at: string;
}

export async function fetchMedicalCertificates(
  clinicId: string,
  doctorId?: string,
): Promise<MedicalCertificateView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<MedicalCertificateRaw>("medical_certificates", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _userMap?.get(r.doctor_id)?.name ?? "Doctor",
    type: r.type as MedicalCertificateView["type"],
    content: r.content ?? {},
    pdfUrl: r.pdf_url ?? undefined,
    issuedDate: r.issued_date,
    createdAt: r.created_at?.split("T")[0] ?? "",
  }));
}

export async function createMedicalCertificate(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  type: string;
  content: Record<string, unknown>;
  issued_date?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("medical_certificates")
    .insert(data)
    .select("id")
    .single();
  if (error) {
    console.error("[data] create medical certificate:", error.message);
    return null;
  }
  return result?.id ?? null;
}

export async function updateMedicalCertificate(
  id: string,
  data: {
    type?: string;
    content?: Record<string, unknown>;
    pdf_url?: string;
    issued_date?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("medical_certificates").update(data).eq("id", id);
  if (error) {
    console.error("[data] update medical certificate:", error.message);
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
  lastUpdated?: string;
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
  genericName?: string;
  category: string;
  description?: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  minimumStock: number;
  expiryDate: string;
  barcode?: string;
  manufacturer?: string;
  supplierId?: string;
  dosageForm?: string;
  strength?: string;
  active: boolean;
}

interface ProductRaw {
  id: string;
  clinic_id: string;
  name: string;
  generic_name?: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  requires_prescription: boolean;
  is_active: boolean;
  dosage_form?: string | null;
  strength?: string | null;
  manufacturer?: string | null;
}

interface StockRaw {
  id: string;
  product_id: string;
  clinic_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
  supplier_id?: string | null;
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
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "General",
      description: p.description ?? undefined,
      price: p.price ?? 0,
      currency: "MAD",
      requiresPrescription: p.requires_prescription,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      barcode: s?.batch_number ?? undefined,
      manufacturer: p.manufacturer ?? undefined,
      supplierId: s?.supplier_id ?? undefined,
      dosageForm: p.dosage_form ?? undefined,
      strength: p.strength ?? undefined,
      active: p.is_active ?? true,
    };
  });
}

export function getLowStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity <= p.minimumStock && p.active);
}

export function getOutOfStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity === 0 && p.active);
}

export function getExpiringProducts(products: ProductView[], days: number = 90): ProductView[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= cutoff && p.active);
}

export function getStockStatus(product: ProductView): "ok" | "low" | "out" {
  if (product.stockQuantity === 0) return "out";
  if (product.stockQuantity <= product.minimumStock) return "low";
  return "ok";
}

export function getExpiryStatus(expiryDate: string): "red" | "yellow" | "green" {
  if (!expiryDate) return "green";
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return "red";
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return "yellow";
  return "green";
}

export function searchProductsLocal(products: ProductView[], query: string): ProductView[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.genericName?.toLowerCase().includes(q) ?? false) ||
      p.category.toLowerCase().includes(q) ||
      (p.barcode?.includes(q) ?? false) ||
      (p.manufacturer?.toLowerCase().includes(q) ?? false)
  );
}

export function getPointsValue(points: number): number {
  return Math.floor(points / 10);
}

// ─────────────────────────────────────────────
// Pharmacy: Suppliers
// ─────────────────────────────────────────────

export interface SupplierView {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  categories: string[];
  rating: number;
  paymentTerms: string;
  deliveryDays: number;
  active: boolean;
}

interface SupplierRaw {
  id: string;
  clinic_id: string;
  name: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  city?: string | null;
  categories?: string[] | null;
  rating?: number | null;
  payment_terms?: string | null;
  delivery_days?: number | null;
  is_active?: boolean;
}

export async function fetchSuppliers(clinicId: string): Promise<SupplierView[]> {
  const rows = await fetchRows<SupplierRaw>("suppliers", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contactPerson: r.contact_person ?? "",
    phone: r.contact_phone ?? "",
    email: r.contact_email ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    categories: r.categories ?? [],
    rating: r.rating ?? 0,
    paymentTerms: r.payment_terms ?? "N/A",
    deliveryDays: r.delivery_days ?? 0,
    active: r.is_active ?? true,
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Prescription Requests
// ─────────────────────────────────────────────

export interface PharmacyPrescriptionItemView {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  available: boolean;
  price: number;
  notes?: string;
}

export interface PharmacyPrescriptionView {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  imageUrl: string;
  uploadedAt: string;
  status: string;
  pharmacistNotes?: string;
  items: PharmacyPrescriptionItemView[];
  totalPrice: number;
  currency: string;
  deliveryOption: string;
  deliveryAddress?: string;
  isChronic: boolean;
  refillReminderDate?: string;
  whatsappNotified: boolean;
}

interface PrescriptionRequestRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  image_url: string;
  status: string;
  notes: string | null;
  pharmacist_notes?: string | null;
  items?: PharmacyPrescriptionItemView[] | null;
  total_price?: number | null;
  delivery_requested: boolean;
  delivery_address?: string | null;
  is_chronic?: boolean;
  refill_reminder_date?: string | null;
  whatsapp_notified?: boolean;
  created_at: string;
}

export async function fetchPrescriptionRequests(clinicId: string): Promise<PharmacyPrescriptionView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PrescriptionRequestRaw>("prescription_requests", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => {
    const patient = _userMap?.get(r.patient_id);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.name ?? "Patient",
      patientPhone: patient?.phone ?? "",
      imageUrl: r.image_url,
      uploadedAt: r.created_at ?? "",
      status: r.status,
      pharmacistNotes: r.pharmacist_notes ?? r.notes ?? undefined,
      items: r.items ?? [],
      totalPrice: r.total_price ?? 0,
      currency: "MAD",
      deliveryOption: r.delivery_requested ? "delivery" : "pickup",
      deliveryAddress: r.delivery_address ?? undefined,
      isChronic: r.is_chronic ?? false,
      refillReminderDate: r.refill_reminder_date ?? undefined,
      whatsappNotified: r.whatsapp_notified ?? false,
    };
  });
}

// ─────────────────────────────────────────────
// Pharmacy: Loyalty
// ─────────────────────────────────────────────

export interface LoyaltyMemberView {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  email: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  joinedAt: string;
  dateOfBirth: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  referralCode: string;
  referredBy?: string;
  totalPurchases: number;
  birthdayRewardClaimed: boolean;
  birthdayRewardYear?: number;
}

interface LoyaltyPointsRaw {
  id: string;
  patient_id: string;
  clinic_id: string;
  points: number;
  available_points?: number | null;
  redeemed_points?: number | null;
  total_purchases?: number | null;
  referral_code?: string | null;
  referred_by?: string | null;
  date_of_birth?: string | null;
  birthday_reward_claimed?: boolean;
  birthday_reward_year?: number | null;
  updated_at: string;
  created_at?: string | null;
}

function computeLoyaltyTier(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 5000) return "platinum";
  if (points >= 3000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

export async function fetchLoyaltyMembers(clinicId: string): Promise<LoyaltyMemberView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LoyaltyPointsRaw>("loyalty_points", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => {
    const patient = _userMap?.get(r.patient_id);
    const totalPts = r.points ?? 0;
    const redeemed = r.redeemed_points ?? 0;
    const available = r.available_points ?? (totalPts - redeemed);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.name ?? "Member",
      phone: patient?.phone ?? "",
      email: patient?.email ?? "",
      totalPoints: totalPts,
      availablePoints: available,
      redeemedPoints: redeemed,
      joinedAt: r.created_at ?? r.updated_at ?? "",
      dateOfBirth: r.date_of_birth ?? "",
      tier: computeLoyaltyTier(totalPts),
      referralCode: r.referral_code ?? "",
      referredBy: r.referred_by ?? undefined,
      totalPurchases: r.total_purchases ?? totalPts,
      birthdayRewardClaimed: r.birthday_reward_claimed ?? false,
      birthdayRewardYear: r.birthday_reward_year ?? undefined,
    };
  });
}

// ─────────────────────────────────────────────
// Pharmacy: Purchase Orders
// ─────────────────────────────────────────────

export interface PurchaseOrderItemView {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderView {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItemView[];
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  expectedDelivery: string;
  deliveredAt?: string;
  notes?: string;
}

interface PurchaseOrderRaw {
  id: string;
  clinic_id: string;
  supplier_id: string;
  status: string;
  total_amount: number | null;
  notes: string | null;
  items?: PurchaseOrderItemView[] | null;
  ordered_at: string | null;
  expected_delivery?: string | null;
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
  const { data: suppliersData } = await supabase
    .from("suppliers")
    .select("id, name")
    .in("id", supplierIds);
  const supplierMap = new Map(
    ((suppliersData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  return (orders as PurchaseOrderRaw[]).map((o) => ({
    id: o.id,
    supplierId: o.supplier_id,
    supplierName: supplierMap.get(o.supplier_id) ?? "Supplier",
    items: o.items ?? [],
    totalAmount: o.total_amount ?? 0,
    currency: "MAD",
    status: o.status,
    createdAt: o.ordered_at ?? o.created_at ?? "",
    expectedDelivery: o.expected_delivery ?? o.ordered_at ?? "",
    deliveredAt: o.received_at ?? undefined,
    notes: o.notes ?? undefined,
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

// ─────────────────────────────────────────────
// Pharmacy: Daily Sales
// ─────────────────────────────────────────────

export interface DailySaleItemView {
  productName: string;
  quantity: number;
  price: number;
}

export interface DailySaleView {
  id: string;
  date: string;
  time: string;
  patientName: string;
  items: DailySaleItemView[];
  total: number;
  currency: string;
  paymentMethod: "cash" | "card" | "insurance";
  hasPrescription: boolean;
  loyaltyPointsEarned: number;
}

interface PharmacySaleRaw {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  items: DailySaleItemView[] | null;
  total: number | null;
  payment_method: string | null;
  has_prescription?: boolean;
  loyalty_points_earned?: number | null;
  created_at: string;
}

export async function fetchDailySales(clinicId: string): Promise<DailySaleView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PharmacySaleRaw>("pharmacy_sales", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => {
    const dt = r.created_at ?? "";
    return {
      id: r.id,
      date: dt.split("T")[0] ?? "",
      time: dt.split("T")[1]?.slice(0, 5) ?? "",
      patientName: r.patient_id ? (_userMap?.get(r.patient_id)?.name ?? "Patient") : "Walk-in",
      items: r.items ?? [],
      total: r.total ?? 0,
      currency: "MAD",
      paymentMethod: (r.payment_method as "cash" | "card" | "insurance") ?? "cash",
      hasPrescription: r.has_prescription ?? false,
      loyaltyPointsEarned: r.loyalty_points_earned ?? 0,
    };
  });
}

// ─────────────────────────────────────────────
// Pharmacy: Loyalty Transactions
// ─────────────────────────────────────────────

export interface LoyaltyTransactionView {
  id: string;
  memberId: string;
  type: "earned" | "redeemed" | "birthday_bonus" | "referral_bonus" | "expired";
  points: number;
  description: string;
  date: string;
  saleId?: string;
}

interface LoyaltyTransactionRaw {
  id: string;
  member_id: string;
  clinic_id: string;
  type: string;
  points: number;
  description: string | null;
  sale_id?: string | null;
  created_at: string;
}

export async function fetchLoyaltyTransactions(clinicId: string): Promise<LoyaltyTransactionView[]> {
  const rows = await fetchRows<LoyaltyTransactionRaw>("loyalty_transactions", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    type: (r.type as LoyaltyTransactionView["type"]) ?? "earned",
    points: r.points,
    description: r.description ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    saleId: r.sale_id ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Clinic Subscription (for admin billing page)
// ─────────────────────────────────────────────

export interface ClinicSubscriptionView {
  id: string;
  clinicId: string;
  tierSlug: string;
  tierName: string;
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  systemType: string;
  invoices: {
    id: string;
    date: string;
    amount: number;
    status: "paid" | "pending" | "overdue" | "refunded";
    paidDate?: string;
  }[];
  tier: {
    slug: string;
    name: string;
    description: string;
    features: { key: string; label: string; included: boolean; limit?: string }[];
    limits: {
      maxDoctors: number;
      maxPatients: number;
      maxAppointmentsPerMonth: number;
      storageGB: number;
      customDomain: boolean;
      apiAccess: boolean;
      whiteLabel: boolean;
    };
    pricing: Record<string, { monthly: number; yearly: number }>;
  } | null;
}

const TIER_NAMES: Record<string, string> = {
  vitrine: "Vitrine",
  cabinet: "Cabinet",
  pro: "Pro",
  premium: "Premium",
  "saas-monthly": "SaaS Mensuel",
};

export async function fetchClinicSubscription(clinicId: string): Promise<ClinicSubscriptionView | null> {
  const supabase = createClient();

  // Fetch the clinic to get tier and type info
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name, type, tier, status")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) return null;

  const c = clinic as Record<string, unknown>;
  const tierSlug = (c.tier as string) ?? "vitrine";
  const systemType = (c.type as string) ?? "doctor";

  // Fetch pricing tier details
  const { data: tierData } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("slug", tierSlug)
    .single();

  // Fetch recent payments as invoices
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, amount, status, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(10);

  const payments = (paymentsData ?? []) as { id: string; amount: number; status: string; created_at: string }[];
  const invoices = payments.map((p) => ({
    id: p.id,
    date: p.created_at?.split("T")[0] ?? "",
    amount: p.amount ?? 0,
    status: (p.status === "completed" ? "paid" : p.status === "pending" ? "pending" : "overdue") as "paid" | "pending" | "overdue" | "refunded",
    paidDate: p.status === "completed" ? p.created_at?.split("T")[0] : undefined,
  }));

  const subStatus: ClinicSubscriptionView["status"] =
    c.status === "active" ? "active"
      : c.status === "suspended" ? "suspended"
      : c.status === "trial" ? "trial"
      : "cancelled";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const latestPayment = payments[0];
  const amount = latestPayment?.amount ?? 0;

  const t = tierData as Record<string, unknown> | null;

  return {
    id: `sub-${c.id as string}`,
    clinicId: c.id as string,
    tierSlug,
    tierName: TIER_NAMES[tierSlug] ?? tierSlug,
    status: subStatus,
    currentPeriodStart: monthStart,
    currentPeriodEnd: monthEnd,
    billingCycle: "monthly",
    amount,
    currency: "MAD",
    paymentMethod: "Carte bancaire",
    autoRenew: c.status === "active",
    systemType,
    invoices,
    tier: t ? {
      slug: (t.slug as string) ?? "",
      name: (t.name as string) ?? "",
      description: (t.description as string) ?? "",
      features: (t.features as { key: string; label: string; included: boolean; limit?: string }[]) ?? [],
      limits: (t.limits as NonNullable<ClinicSubscriptionView["tier"]>["limits"]) ?? {
        maxDoctors: 1, maxPatients: 0, maxAppointmentsPerMonth: 0,
        storageGB: 1, customDomain: false, apiAccess: false, whiteLabel: false,
      },
      pricing: (t.pricing as Record<string, { monthly: number; yearly: number }>) ?? {},
    } : null,
  };
}

// ─────────────────────────────────────────────
// Analysis Lab — Test Catalog
// ─────────────────────────────────────────────

export interface LabTestCatalogView {
  id: string;
  name: string;
  nameAr?: string;
  code?: string;
  category: string;
  sampleType: string;
  description?: string;
  price: number;
  currency: string;
  turnaroundHours: number;
  referenceRanges: { parameter: string; unit: string; min: number | null; max: number | null }[];
  isActive: boolean;
  sortOrder: number;
}

interface LabTestCatalogRaw {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  category: string;
  sample_type: string;
  description: string | null;
  price: number | null;
  currency: string;
  turnaround_hours: number;
  reference_ranges: { parameter: string; unit: string; min: number | null; max: number | null }[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

function mapLabTestCatalog(raw: LabTestCatalogRaw): LabTestCatalogView {
  return {
    id: raw.id,
    name: raw.name,
    nameAr: raw.name_ar ?? undefined,
    code: raw.code ?? undefined,
    category: raw.category,
    sampleType: raw.sample_type ?? "blood",
    description: raw.description ?? undefined,
    price: raw.price ?? 0,
    currency: raw.currency ?? "MAD",
    turnaroundHours: raw.turnaround_hours ?? 24,
    referenceRanges: raw.reference_ranges ?? [],
    isActive: raw.is_active ?? true,
    sortOrder: raw.sort_order ?? 0,
  };
}

export async function fetchLabTestCatalog(clinicId: string): Promise<LabTestCatalogView[]> {
  const rows = await fetchRows<LabTestCatalogRaw>("lab_test_catalog", {
    eq: [["clinic_id", clinicId]],
    order: ["sort_order", { ascending: true }],
  });
  return rows.map(mapLabTestCatalog);
}

// ─────────────────────────────────────────────
// Analysis Lab — Test Orders
// ─────────────────────────────────────────────

export interface LabTestOrderView {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorName?: string;
  assignedTechnicianName?: string;
  orderNumber: string;
  status: string;
  priority: string;
  clinicalNotes?: string;
  fastingRequired: boolean;
  sampleCollectedAt?: string;
  completedAt?: string;
  validatedAt?: string;
  pdfUrl?: string;
  tests: { id: string; testId: string; testName: string; status: string }[];
  testCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LabTestOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  assigned_technician_id: string | null;
  order_number: string;
  status: string;
  priority: string;
  clinical_notes: string | null;
  fasting_required: boolean;
  sample_collected_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

interface LabTestItemRaw {
  id: string;
  order_id: string;
  test_id: string;
  test_name: string;
  status: string;
}

export async function fetchLabTestOrders(clinicId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let items: LabTestItemRaw[] = [];
  if (orderIds.length > 0) {
    items = await fetchRows<LabTestItemRaw>("lab_test_items", {
      inFilter: ["order_id", orderIds],
    });
  }
  const itemsByOrder = new Map<string, LabTestItemRaw[]>();
  for (const item of items) {
    const arr = itemsByOrder.get(item.order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_userMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    assignedTechnicianName: r.assigned_technician_id ? (_userMap?.get(r.assigned_technician_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    status: r.status,
    priority: r.priority,
    clinicalNotes: r.clinical_notes ?? undefined,
    fastingRequired: r.fasting_required ?? false,
    sampleCollectedAt: r.sample_collected_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    validatedAt: r.validated_at ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    tests: (itemsByOrder.get(r.id) ?? []).map((ti) => ({
      id: ti.id,
      testId: ti.test_id,
      testName: ti.test_name,
      status: ti.status,
    })),
    testCount: (itemsByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

export async function fetchPatientLabOrders(clinicId: string, patientId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let items: LabTestItemRaw[] = [];
  if (orderIds.length > 0) {
    items = await fetchRows<LabTestItemRaw>("lab_test_items", {
      inFilter: ["order_id", orderIds],
    });
  }
  const itemsByOrder = new Map<string, LabTestItemRaw[]>();
  for (const item of items) {
    const arr = itemsByOrder.get(item.order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_userMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    assignedTechnicianName: r.assigned_technician_id ? (_userMap?.get(r.assigned_technician_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    status: r.status,
    priority: r.priority,
    clinicalNotes: r.clinical_notes ?? undefined,
    fastingRequired: r.fasting_required ?? false,
    sampleCollectedAt: r.sample_collected_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    validatedAt: r.validated_at ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    tests: (itemsByOrder.get(r.id) ?? []).map((ti) => ({
      id: ti.id,
      testId: ti.test_id,
      testName: ti.test_name,
      status: ti.status,
    })),
    testCount: (itemsByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Analysis Lab — Test Results
// ─────────────────────────────────────────────

export interface LabTestResultView {
  id: string;
  orderId: string;
  testItemId: string;
  testName: string;
  parameterName: string;
  value: string;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: string | null;
  notes?: string;
  enteredBy?: string;
  enteredAt: string;
}

interface LabTestResultRaw {
  id: string;
  order_id: string;
  test_item_id: string;
  parameter_name: string;
  value: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  flag: string | null;
  notes: string | null;
  entered_by: string | null;
  entered_at: string;
}

export async function fetchLabTestResults(orderId: string): Promise<LabTestResultView[]> {
  const rows = await fetchRows<LabTestResultRaw>("lab_test_results", {
    eq: [["order_id", orderId]],
    order: ["entered_at", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    testItemId: r.test_item_id,
    testName: r.parameter_name,
    parameterName: r.parameter_name,
    value: r.value ?? "",
    unit: r.unit ?? "",
    referenceMin: r.reference_min,
    referenceMax: r.reference_max,
    flag: r.flag,
    notes: r.notes ?? undefined,
    enteredBy: r.entered_by ?? undefined,
    enteredAt: r.entered_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Radiology — Orders
// ─────────────────────────────────────────────

export interface RadiologyOrderView {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorName?: string;
  radiologistName?: string;
  orderNumber: string;
  modality: string;
  bodyPart?: string;
  clinicalIndication?: string;
  status: string;
  priority: string;
  scheduledAt?: string;
  performedAt?: string;
  reportedAt?: string;
  reportText?: string;
  findings?: string;
  impression?: string;
  pdfUrl?: string;
  images: RadiologyImageView[];
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyImageView {
  id: string;
  orderId: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  modality?: string;
  isDicom: boolean;
  dicomStudyUid?: string;
  thumbnailUrl?: string;
  description?: string;
  uploadedAt: string;
}

interface RadiologyOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  radiologist_id: string | null;
  order_number: string;
  modality: string;
  body_part: string | null;
  clinical_indication: string | null;
  status: string;
  priority: string;
  scheduled_at: string | null;
  performed_at: string | null;
  reported_at: string | null;
  report_text: string | null;
  findings: string | null;
  impression: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

interface RadiologyImageRaw {
  id: string;
  order_id: string;
  clinic_id: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  modality: string | null;
  is_dicom: boolean;
  dicom_metadata: { study_uid?: string } | null;
  thumbnail_url: string | null;
  description: string | null;
  uploaded_at: string;
}

export async function fetchRadiologyOrders(clinicId: string): Promise<RadiologyOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<RadiologyOrderRaw>("radiology_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let images: RadiologyImageRaw[] = [];
  if (orderIds.length > 0) {
    images = await fetchRows<RadiologyImageRaw>("radiology_images", {
      eq: [["clinic_id", clinicId]],
      inFilter: ["order_id", orderIds],
    });
  }
  const imagesByOrder = new Map<string, RadiologyImageRaw[]>();
  for (const img of images) {
    const arr = imagesByOrder.get(img.order_id) ?? [];
    arr.push(img);
    imagesByOrder.set(img.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _userMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_userMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    radiologistName: r.radiologist_id ? (_userMap?.get(r.radiologist_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    modality: r.modality,
    bodyPart: r.body_part ?? undefined,
    clinicalIndication: r.clinical_indication ?? undefined,
    status: r.status,
    priority: r.priority ?? "normal",
    scheduledAt: r.scheduled_at ?? undefined,
    performedAt: r.performed_at ?? undefined,
    reportedAt: r.reported_at ?? undefined,
    reportText: r.report_text ?? undefined,
    findings: r.findings ?? undefined,
    impression: r.impression ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    images: (imagesByOrder.get(r.id) ?? []).map((img) => ({
      id: img.id,
      orderId: img.order_id,
      fileUrl: img.file_url,
      fileName: img.file_name ?? undefined,
      fileSize: img.file_size ?? undefined,
      contentType: img.content_type ?? undefined,
      modality: img.modality ?? undefined,
      isDicom: img.is_dicom ?? false,
      dicomStudyUid: img.dicom_metadata?.study_uid ?? undefined,
      thumbnailUrl: img.thumbnail_url ?? undefined,
      description: img.description ?? undefined,
      uploadedAt: img.uploaded_at?.split("T")[0] ?? "",
    })),
    imageCount: (imagesByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Radiology — Report Templates
// ─────────────────────────────────────────────

export interface RadiologyTemplateView {
  id: string;
  name: string;
  modality?: string;
  bodyPart?: string;
  templateText: string;
  fields: { key: string; label: string; type: string; options?: string[] }[];
  sections: { title: string; defaultContent: string }[];
  language: string;
  isDefault: boolean;
  isActive: boolean;
}

interface RadiologyTemplateRaw {
  id: string;
  clinic_id: string;
  name: string;
  modality: string | null;
  body_part: string | null;
  template_text: string;
  fields: { key: string; label: string; type: string; options?: string[] }[] | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export async function fetchRadiologyTemplates(clinicId: string): Promise<RadiologyTemplateView[]> {
  const rows = await fetchRows<RadiologyTemplateRaw>("radiology_report_templates", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
  });
  return rows.map((r) => {
    // Parse template_text into sections (split by markdown-style headers)
    const sectionRegex = /^##\s+(.+)$/gm;
    const sections: { title: string; defaultContent: string }[] = [];
    const text = r.template_text ?? "";
    let lastIndex = 0;
    let lastTitle = "";
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(text)) !== null) {
      if (lastTitle) {
        sections.push({ title: lastTitle, defaultContent: text.slice(lastIndex, match.index).trim() });
      }
      lastTitle = match[1];
      lastIndex = match.index + match[0].length;
    }
    if (lastTitle) {
      sections.push({ title: lastTitle, defaultContent: text.slice(lastIndex).trim() });
    }
    if (sections.length === 0 && text) {
      sections.push({ title: "Report", defaultContent: text });
    }

    return {
      id: r.id,
      name: r.name,
      modality: r.modality ?? undefined,
      bodyPart: r.body_part ?? undefined,
      templateText: r.template_text,
      fields: r.fields ?? [],
      sections,
      language: "en",
      isDefault: r.is_default ?? false,
      isActive: r.is_active ?? true,
    };
  });
}

// ─────────────────────────────────────────────
// Medical Equipment — Inventory
// ─────────────────────────────────────────────

export interface EquipmentItemView {
  id: string;
  name: string;
  description?: string;
  category: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency: string;
  condition: string;
  isAvailable: boolean;
  isRentable: boolean;
  rentalPriceDaily?: number;
  rentalPriceWeekly?: number;
  rentalPriceMonthly?: number;
  imageUrl?: string;
  notes?: string;
}

interface EquipmentItemRaw {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: string;
  condition: string;
  is_available: boolean;
  is_rentable: boolean;
  rental_price_daily: number | null;
  rental_price_weekly: number | null;
  rental_price_monthly: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapEquipmentItem(raw: EquipmentItemRaw): EquipmentItemView {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    category: raw.category,
    serialNumber: raw.serial_number ?? undefined,
    model: raw.model ?? undefined,
    manufacturer: raw.manufacturer ?? undefined,
    purchaseDate: raw.purchase_date ?? undefined,
    purchasePrice: raw.purchase_price ?? undefined,
    currency: raw.currency ?? "MAD",
    condition: raw.condition ?? "good",
    isAvailable: raw.is_available ?? true,
    isRentable: raw.is_rentable ?? true,
    rentalPriceDaily: raw.rental_price_daily ?? undefined,
    rentalPriceWeekly: raw.rental_price_weekly ?? undefined,
    rentalPriceMonthly: raw.rental_price_monthly ?? undefined,
    imageUrl: raw.image_url ?? undefined,
    notes: raw.notes ?? undefined,
  };
}

export async function fetchEquipmentInventory(clinicId: string): Promise<EquipmentItemView[]> {
  const rows = await fetchRows<EquipmentItemRaw>("equipment_inventory", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapEquipmentItem);
}

// ─────────────────────────────────────────────
// Medical Equipment — Rentals
// ─────────────────────────────────────────────

export interface EquipmentRentalView {
  id: string;
  equipmentId: string;
  equipmentName: string;
  clientName: string;
  clientPhone?: string;
  clientIdNumber?: string;
  rentalStart: string;
  rentalEnd?: string;
  actualReturn?: string;
  status: string;
  conditionOut: string;
  conditionIn?: string;
  depositAmount?: number;
  rentalAmount?: number;
  currency: string;
  paymentStatus: string;
  notes?: string;
}

interface EquipmentRentalRaw {
  id: string;
  clinic_id: string;
  equipment_id: string;
  client_name: string;
  client_phone: string | null;
  client_id_number: string | null;
  rental_start: string;
  rental_end: string | null;
  actual_return: string | null;
  status: string;
  condition_out: string;
  condition_in: string | null;
  deposit_amount: number | null;
  rental_amount: number | null;
  currency: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchEquipmentRentals(clinicId: string): Promise<EquipmentRentalView[]> {
  const equipment = await fetchEquipmentInventory(clinicId);
  const equipMap = new Map(equipment.map((e) => [e.id, e.name]));
  const rows = await fetchRows<EquipmentRentalRaw>("equipment_rentals", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: equipMap.get(r.equipment_id) ?? "Equipment",
    clientName: r.client_name,
    clientPhone: r.client_phone ?? undefined,
    clientIdNumber: r.client_id_number ?? undefined,
    rentalStart: r.rental_start,
    rentalEnd: r.rental_end ?? undefined,
    actualReturn: r.actual_return ?? undefined,
    status: r.status,
    conditionOut: r.condition_out ?? "good",
    conditionIn: r.condition_in ?? undefined,
    depositAmount: r.deposit_amount ?? undefined,
    rentalAmount: r.rental_amount ?? undefined,
    currency: r.currency ?? "MAD",
    paymentStatus: r.payment_status ?? "pending",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Medical Equipment — Maintenance
// ─────────────────────────────────────────────

export interface EquipmentMaintenanceView {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: string;
  description?: string;
  performedBy?: string;
  performedAt: string;
  nextDue?: string;
  cost?: number;
  currency: string;
  status: string;
  notes?: string;
}

interface EquipmentMaintenanceRaw {
  id: string;
  clinic_id: string;
  equipment_id: string;
  type: string;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  next_due: string | null;
  cost: number | null;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchEquipmentMaintenance(clinicId: string): Promise<EquipmentMaintenanceView[]> {
  const equipment = await fetchEquipmentInventory(clinicId);
  const equipMap = new Map(equipment.map((e) => [e.id, e.name]));
  const rows = await fetchRows<EquipmentMaintenanceRaw>("equipment_maintenance", {
    eq: [["clinic_id", clinicId]],
    order: ["performed_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: equipMap.get(r.equipment_id) ?? "Equipment",
    type: r.type,
    description: r.description ?? undefined,
    performedBy: r.performed_by ?? undefined,
    performedAt: r.performed_at,
    nextDue: r.next_due ?? undefined,
    cost: r.cost ?? undefined,
    currency: r.currency ?? "MAD",
    status: r.status ?? "completed",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Parapharmacy — Categories
// ─────────────────────────────────────────────

export interface ParapharmacyCategoryView {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  slug: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
}

interface ParapharmacyCategoryRaw {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export async function fetchParapharmacyCategories(clinicId: string): Promise<ParapharmacyCategoryView[]> {
  const rows = await fetchRows<ParapharmacyCategoryRaw>("parapharmacy_categories", {
    eq: [["clinic_id", clinicId]],
    order: ["sort_order", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameAr: r.name_ar ?? undefined,
    slug: r.slug,
    icon: r.icon ?? undefined,
    parentId: r.parent_id ?? undefined,
    sortOrder: r.sort_order ?? 0,
    isActive: r.is_active ?? true,
  }));
}

// Parapharmacy products reuse the existing Product / stock tables
// with is_parapharmacy=true and requires_prescription=false
export async function fetchParapharmacyProducts(clinicId: string): Promise<ProductView[]> {
  const [products, stock] = await Promise.all([
    fetchRows<ProductRaw>("products", {
      eq: [["clinic_id", clinicId], ["is_parapharmacy", true]],
      order: ["name", { ascending: true }],
    }),
    fetchRows<StockRaw>("stock", { eq: [["clinic_id", clinicId]] }),
  ]);
  const stockMap = new Map(stock.map((s) => [s.product_id, s]));
  return products.map((p) => {
    const s = stockMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "General",
      description: p.description ?? undefined,
      price: p.price ?? 0,
      currency: "MAD",
      requiresPrescription: false,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      barcode: s?.batch_number ?? undefined,
      manufacturer: p.manufacturer ?? undefined,
      supplierId: s?.supplier_id ?? undefined,
      dosageForm: p.dosage_form ?? undefined,
      strength: p.strength ?? undefined,
      active: p.is_active ?? true,
    };
  });
}
