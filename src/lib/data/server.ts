"use server";

/**
 * Server-side data fetching functions for Supabase.
 * These functions use the server Supabase client (cookie-based auth)
 * and are meant to be called from server components or server actions.
 *
 * Each function accepts optional clinicId/userId for multi-tenant filtering.
 * RLS policies provide an additional security layer.
 */

import { createClient } from "@/lib/supabase-server";

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

async function query<T>(
  table: string,
  opts?: {
    select?: string;
    filters?: Record<string, unknown>;
    eq?: [string, unknown][];
    order?: [string, { ascending: boolean }];
    limit?: number;
    inFilter?: [string, unknown[]];
  },
): Promise<T[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from as any)(table).select(opts?.select ?? "*");

  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val);
    }
  }
  if (opts?.inFilter) {
    q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);
  }
  if (opts?.order) {
    q = q.order(opts.order[0], opts.order[1]);
  }
  if (opts?.limit) {
    q = q.limit(opts.limit);
  }

  const { data, error } = await q;
  if (error) {
    console.error(`[data] Error fetching ${table}:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

async function queryOne<T>(
  table: string,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
  },
): Promise<T | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from as any)(table).select(opts?.select ?? "*");
  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val);
    }
  }
  const { data, error } = await q.single();
  if (error) return null;
  return data as T;
}

// ────────────────────────────────────────────
// Auth / current user
// ────────────────────────────────────────────

export interface CurrentUser {
  id: string;
  auth_id: string;
  clinic_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, auth_id, clinic_id, role, name, phone, email")
    .eq("auth_id", user.id)
    .single();

  return data as CurrentUser | null;
}

// ────────────────────────────────────────────
// Clinics
// ────────────────────────────────────────────

export interface ClinicRow {
  id: string;
  name: string;
  type: string;
  tier: string;
  subdomain: string | null;
  domain: string | null;
  clinic_type_key: string | null;
  config: Record<string, unknown>;
  status: string;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  city: string | null;
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export async function getClinics(): Promise<ClinicRow[]> {
  return query<ClinicRow>("clinics", {
    order: ["created_at", { ascending: false }],
  });
}

export async function getClinicById(id: string): Promise<ClinicRow | null> {
  return queryOne<ClinicRow>("clinics", { eq: [["id", id]] });
}

// ────────────────────────────────────────────
// Clinic Branding
// ────────────────────────────────────────────

export interface ClinicBrandingRow {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  hero_image_url: string | null;
}

export async function getClinicBranding(clinicId: string): Promise<ClinicBrandingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url")
    .eq("id", clinicId)
    .single();

  if (error) return null;
  return data as unknown as ClinicBrandingRow;
}

export async function updateClinicBranding(
  clinicId: string,
  branding: Partial<ClinicBrandingRow>,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update(branding)
    .eq("id", clinicId);

  if (error) {
    console.error("[data] Error updating clinic branding:", error.message);
    return false;
  }
  return true;
}

// ────────────────────────────────────────────
// Users (doctors, patients, receptionists, etc.)
// ────────────────────────────────────────────

export interface UserRow {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getClinicUsers(clinicId: string, role?: string): Promise<UserRow[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (role) eq.push(["role", role]);
  return query<UserRow>("users", {
    eq,
    order: ["created_at", { ascending: false }],
  });
}

export async function getDoctors(clinicId: string): Promise<UserRow[]> {
  return getClinicUsers(clinicId, "doctor");
}

export async function getPatients(clinicId: string): Promise<UserRow[]> {
  return getClinicUsers(clinicId, "patient");
}

export async function getReceptionists(clinicId: string): Promise<UserRow[]> {
  return getClinicUsers(clinicId, "receptionist");
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  return queryOne<UserRow>("users", { eq: [["id", userId]] });
}

// ────────────────────────────────────────────
// Services
// ────────────────────────────────────────────

export interface ServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  duration_min: number;
  price: number | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getServices(clinicId: string): Promise<ServiceRow[]> {
  return query<ServiceRow>("services", {
    eq: [["clinic_id", clinicId]],
  });
}

// ────────────────────────────────────────────
// Appointments
// ────────────────────────────────────────────

export interface AppointmentRow {
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

export async function getAppointments(clinicId: string): Promise<AppointmentRow[]> {
  return query<AppointmentRow>("appointments", {
    eq: [["clinic_id", clinicId]],
    order: ["slot_start", { ascending: true }],
  });
}

export async function getAppointmentsByDoctor(clinicId: string, doctorId: string): Promise<AppointmentRow[]> {
  return query<AppointmentRow>("appointments", {
    eq: [["clinic_id", clinicId], ["doctor_id", doctorId]],
    order: ["slot_start", { ascending: true }],
  });
}

export async function getAppointmentsByPatient(clinicId: string, patientId: string): Promise<AppointmentRow[]> {
  return query<AppointmentRow>("appointments", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["slot_start", { ascending: true }],
  });
}

export async function getTodayAppointments(clinicId: string, doctorId?: string): Promise<AppointmentRow[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  let q = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("slot_start", todayStart)
    .lte("slot_start", todayEnd)
    .order("slot_start", { ascending: true });

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[data] Error fetching today appointments:", error.message);
    return [];
  }
  return (data ?? []) as AppointmentRow[];
}

// ────────────────────────────────────────────
// Time Slots
// ────────────────────────────────────────────

export interface TimeSlotRow {
  id: string;
  clinic_id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  buffer_minutes: number;
  buffer_min: number;
  is_active: boolean;
}

export async function getTimeSlots(clinicId: string, doctorId?: string): Promise<TimeSlotRow[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  return query<TimeSlotRow>("time_slots", {
    eq,
    order: ["day_of_week", { ascending: true }],
  });
}

// ────────────────────────────────────────────
// Payments
// ────────────────────────────────────────────

export interface PaymentRow {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string;
  amount: number;
  method: string | null;
  status: string;
  reference: string | null;
  payment_type: string;
  gateway_session_id: string | null;
  refunded_amount: number;
  created_at: string;
}

export async function getPayments(clinicId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>("payments", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
}

export async function getPaymentsByPatient(clinicId: string, patientId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>("payments", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Reviews
// ────────────────────────────────────────────

export interface ReviewRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  stars: number;
  comment: string | null;
  response: string | null;
  is_visible: boolean;
  created_at: string;
}

export async function getReviews(clinicId: string): Promise<ReviewRow[]> {
  return query<ReviewRow>("reviews", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────

export interface NotificationRow {
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

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  return query<NotificationRow>("notifications", {
    eq: [["user_id", userId]],
    order: ["sent_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Documents
// ────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  clinic_id: string;
  user_id: string;
  type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export async function getDocuments(clinicId: string, userId?: string): Promise<DocumentRow[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (userId) eq.push(["user_id", userId]);
  return query<DocumentRow>("documents", {
    eq,
    order: ["uploaded_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Prescriptions
// ────────────────────────────────────────────

export interface PrescriptionRow {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  doctor_id: string;
  patient_id: string;
  items: { name: string; dosage: string; duration: string }[];
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

export async function getPrescriptions(clinicId: string, doctorId?: string): Promise<PrescriptionRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("prescriptions")
    .select("*")
    .order("created_at", { ascending: false });

  // Prescriptions table may not have clinic_id directly; filter via doctor/patient clinic
  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[data] Error fetching prescriptions:", error.message);
    return [];
  }
  return (data ?? []) as PrescriptionRow[];
}

export async function getPatientPrescriptions(patientId: string): Promise<PrescriptionRow[]> {
  return query<PrescriptionRow>("prescriptions", {
    eq: [["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Consultation Notes
// ────────────────────────────────────────────

export interface ConsultationNoteRow {
  id: string;
  clinic_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  notes: string | null;
  diagnosis: string | null;
  created_at: string;
  updated_at: string;
}

export async function getConsultationNotes(doctorId: string): Promise<ConsultationNoteRow[]> {
  return query<ConsultationNoteRow>("consultation_notes", {
    eq: [["doctor_id", doctorId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Waiting List
// ────────────────────────────────────────────

export interface WaitingListRow {
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

export async function getWaitingList(clinicId: string): Promise<WaitingListRow[]> {
  return query<WaitingListRow>("waiting_list", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: true }],
  });
}

// ────────────────────────────────────────────
// Family Members
// ────────────────────────────────────────────

export interface FamilyMemberRow {
  id: string;
  primary_user_id: string;
  member_user_id: string;
  relationship: string;
  created_at: string;
}

export async function getFamilyMembers(userId: string): Promise<FamilyMemberRow[]> {
  return query<FamilyMemberRow>("family_members", {
    eq: [["primary_user_id", userId]],
  });
}

// ────────────────────────────────────────────
// Dental: Odontogram
// ────────────────────────────────────────────

export interface OdontogramRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  status: string;
  notes: string | null;
  updated_at: string;
}

export async function getOdontogram(patientId: string): Promise<OdontogramRow[]> {
  return query<OdontogramRow>("odontogram", {
    eq: [["patient_id", patientId]],
    order: ["tooth_number", { ascending: true }],
  });
}

// ────────────────────────────────────────────
// Dental: Treatment Plans
// ────────────────────────────────────────────

export interface TreatmentPlanRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null }[];
  total_cost: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getTreatmentPlans(clinicId: string, doctorId?: string): Promise<TreatmentPlanRow[]> {
  const eq: [string, unknown][] = [];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  return query<TreatmentPlanRow>("treatment_plans", {
    eq: eq.length > 0 ? eq : undefined,
    order: ["created_at", { ascending: false }],
  });
}

export async function getPatientTreatmentPlans(patientId: string): Promise<TreatmentPlanRow[]> {
  return query<TreatmentPlanRow>("treatment_plans", {
    eq: [["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Dental: Lab Orders
// ────────────────────────────────────────────

export interface LabOrderRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lab_name: string | null;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLabOrders(clinicId: string): Promise<LabOrderRow[]> {
  return query<LabOrderRow>("lab_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Dental: Installments
// ────────────────────────────────────────────

export interface InstallmentRow {
  id: string;
  clinic_id: string;
  treatment_plan_id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  receipt_url: string | null;
  created_at: string;
}

export async function getInstallments(treatmentPlanId: string): Promise<InstallmentRow[]> {
  return query<InstallmentRow>("installments", {
    eq: [["treatment_plan_id", treatmentPlanId]],
    order: ["due_date", { ascending: true }],
  });
}

export async function getPatientInstallments(patientId: string): Promise<InstallmentRow[]> {
  return query<InstallmentRow>("installments", {
    eq: [["patient_id", patientId]],
    order: ["due_date", { ascending: true }],
  });
}

// ────────────────────────────────────────────
// Dental: Sterilization Log
// ────────────────────────────────────────────

export interface SterilizationLogRow {
  id: string;
  clinic_id: string;
  tool_name: string;
  sterilized_by: string | null;
  sterilized_at: string;
  next_due: string | null;
  method: string;
  notes: string | null;
  created_at: string;
}

export async function getSterilizationLog(clinicId: string): Promise<SterilizationLogRow[]> {
  return query<SterilizationLogRow>("sterilization_log", {
    eq: [["clinic_id", clinicId]],
    order: ["sterilized_at", { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Pharmacy: Products
// ────────────────────────────────────────────

export interface ProductRow {
  id: string;
  clinic_id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string;
  requires_prescription: boolean;
  manufacturer: string | null;
  barcode: string | null;
  dosage_form: string | null;
  strength: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getProducts(clinicId: string): Promise<ProductRow[]> {
  return query<ProductRow>("products", {
    eq: [["clinic_id", clinicId]],
  });
}

// ────────────────────────────────────────────
// Pharmacy: Stock
// ────────────────────────────────────────────

export interface StockRow {
  id: string;
  clinic_id: string;
  product_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
  updated_at: string;
}

export async function getStock(clinicId: string): Promise<StockRow[]> {
  return query<StockRow>("stock", {
    eq: [["clinic_id", clinicId]],
  });
}

// ────────────────────────────────────────────
// Pharmacy: Suppliers
// ────────────────────────────────────────────

export interface SupplierRow {
  id: string;
  clinic_id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_person: string | null;
  address: string | null;
  city: string | null;
  categories: string[];
  rating: number;
  payment_terms: string | null;
  delivery_days: number;
  is_active: boolean;
  created_at: string;
}

export async function getSuppliers(clinicId: string): Promise<SupplierRow[]> {
  return query<SupplierRow>("suppliers", {
    eq: [["clinic_id", clinicId]],
  });
}

// ────────────────────────────────────────────
// Pharmacy: Prescription Requests
// ────────────────────────────────────────────

export interface PrescriptionRequestRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  image_url: string;
  status: string;
  notes: string | null;
  delivery_requested: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPrescriptionRequests(clinicId: string): Promise<PrescriptionRequestRow[]> {
  return query<PrescriptionRequestRow>("prescription_requests", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at" as string, { ascending: false }],
  });
}

// ────────────────────────────────────────────
// Pharmacy: Loyalty Points
// ────────────────────────────────────────────

export interface LoyaltyPointsRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  points: number;
  available_points: number;
  redeemed_points: number;
  tier: string;
  referral_code: string | null;
  referred_by: string | null;
  total_purchases: number;
  date_of_birth: string | null;
  birthday_reward_claimed: boolean;
  birthday_reward_year: number | null;
  last_earned: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLoyaltyPoints(clinicId: string): Promise<LoyaltyPointsRow[]> {
  return query<LoyaltyPointsRow>("loyalty_points", {
    eq: [["clinic_id", clinicId]],
  });
}

// ────────────────────────────────────────────
// Dashboard Stats (aggregated)
// ────────────────────────────────────────────

export interface ClinicDashboardStats {
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
  completedAppointments: number;
  noShowCount: number;
  averageRating: number;
  doctorCount: number;
  activeServices: number;
}

export async function getClinicDashboardStats(clinicId: string): Promise<ClinicDashboardStats> {
  const supabase = await createClient();

  const [patientsRes, appointmentsRes, paymentsRes, reviewsRes, doctorsRes, servicesRes] = await Promise.all([
    supabase.from("users").select("id").eq("clinic_id", clinicId).eq("role", "patient"),
    supabase.from("appointments").select("id, status").eq("clinic_id", clinicId),
    supabase.from("payments").select("id, amount, status").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("id, stars").eq("clinic_id", clinicId),
    supabase.from("users").select("id").eq("clinic_id", clinicId).eq("role", "doctor"),
    supabase.from("services").select("id").eq("clinic_id", clinicId),
  ]);

  const patients = patientsRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const reviews = reviewsRes.data ?? [];
  const doctors = doctorsRes.data ?? [];
  const services = servicesRes.data ?? [];

  const totalRevenue = payments.reduce((sum, p) => sum + ((p as { amount: number }).amount ?? 0), 0);
  const completed = appointments.filter((a) => (a as { status: string }).status === "completed").length;
  const noShows = appointments.filter((a) => (a as { status: string }).status === "no_show").length;
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + ((r as { stars: number }).stars ?? 0), 0) / reviews.length
      : 0;

  return {
    totalPatients: patients.length,
    totalAppointments: appointments.length,
    totalRevenue,
    completedAppointments: completed,
    noShowCount: noShows,
    averageRating: avgRating,
    doctorCount: doctors.length,
    activeServices: services.length,
  };
}

// ────────────────────────────────────────────
// Super Admin Stats
// ────────────────────────────────────────────

export interface SuperAdminStats {
  clinics: ClinicRow[];
  totalClinics: number;
  activeClinics: number;
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
}

export async function getSuperAdminStats(): Promise<SuperAdminStats> {
  const supabase = await createClient();

  const [clinicsRes, usersRes, appointmentsRes, paymentsRes] = await Promise.all([
    supabase.from("clinics").select("*").order("created_at", { ascending: false }),
    supabase.from("users").select("id").eq("role", "patient"),
    supabase.from("appointments").select("id"),
    supabase.from("payments").select("id, amount, status").eq("status", "completed"),
  ]);

  const clinics = (clinicsRes.data ?? []) as ClinicRow[];
  const patients = usersRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const payments = (paymentsRes.data ?? []) as { id: string; amount: number; status: string }[];

  return {
    clinics,
    totalClinics: clinics.length,
    activeClinics: clinics.filter((c) => c.status === "active").length,
    totalPatients: patients.length,
    totalAppointments: appointments.length,
    totalRevenue: payments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
  };
}

// ────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
  extra?: { cancellation_reason?: string },
): Promise<boolean> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { status };
  if (status === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
    if (extra?.cancellation_reason) {
      updateData.cancellation_reason = extra.cancellation_reason;
    }
  }
  const { error } = await supabase.from("appointments").update(updateData).eq("id", appointmentId);
  if (error) {
    console.error("[data] Error updating appointment:", error.message);
    return false;
  }
  return true;
}

export async function createAppointment(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id?: string;
  slot_start: string;
  slot_end: string;
  is_first_visit?: boolean;
  insurance_flag?: boolean;
  source?: string;
  notes?: string;
}): Promise<AppointmentRow | null> {
  const supabase = await createClient();
  // Also populate the normalised date/time columns
  const startDate = new Date(data.slot_start);
  const endDate = new Date(data.slot_end);
  const enriched = {
    ...data,
    appointment_date: startDate.toISOString().split("T")[0],
    start_time: startDate.toISOString().split("T")[1]?.slice(0, 5),
    end_time: endDate.toISOString().split("T")[1]?.slice(0, 5),
  };
  const { data: row, error } = await supabase
    .from("appointments")
    .insert(enriched)
    .select()
    .single();
  if (error) {
    console.error("[data] Error creating appointment:", error.message);
    return null;
  }
  return row as AppointmentRow;
}

export async function createReview(data: {
  clinic_id: string;
  patient_id: string;
  stars: number;
  comment?: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert(data);
  if (error) {
    console.error("[data] Error creating review:", error.message);
    return false;
  }
  return true;
}

export async function updateReviewResponse(reviewId: string, response: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ response }).eq("id", reviewId);
  if (error) {
    console.error("[data] Error updating review:", error.message);
    return false;
  }
  return true;
}

export async function addToWaitingList(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id?: string;
  preferred_date?: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("waiting_list").insert({ ...data, status: "waiting" });
  if (error) {
    console.error("[data] Error adding to waiting list:", error.message);
    return false;
  }
  return true;
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) return false;
  return true;
}

// ────────────────────────────────────────────
// Radiology — Mutations
// ────────────────────────────────────────────

export async function createRadiologyOrder(data: {
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id?: string;
  modality: string;
  body_part?: string;
  clinical_indication?: string;
  priority?: string;
  scheduled_at?: string;
}): Promise<{ id: string; order_number: string } | null> {
  const supabase = await createClient();
  const orderNumber = `RAD-${Date.now().toString(36).toUpperCase()}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase.from as any)("radiology_orders")
    .insert({
      ...data,
      order_number: orderNumber,
      status: "pending",
      priority: data.priority ?? "normal",
    })
    .select("id, order_number")
    .single();
  if (error) {
    console.error("[data] Error creating radiology order:", error.message);
    return null;
  }
  return row as { id: string; order_number: string };
}

export async function updateRadiologyOrderStatus(
  orderId: string,
  status: string,
): Promise<boolean> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "in_progress") {
    updateData.performed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("radiology_orders")
    .update(updateData)
    .eq("id", orderId);
  if (error) {
    console.error("[data] Error updating radiology order status:", error.message);
    return false;
  }
  return true;
}

export async function saveRadiologyReport(
  orderId: string,
  report: {
    findings: string;
    impression: string;
    report_text: string;
    report_template_id?: string;
    radiologist_id?: string;
  },
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("radiology_orders")
    .update({
      findings: report.findings,
      impression: report.impression,
      report_text: report.report_text,
      report_template_id: report.report_template_id ?? null,
      radiologist_id: report.radiologist_id ?? null,
      reported_at: new Date().toISOString(),
      status: "reported",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) {
    console.error("[data] Error saving radiology report:", error.message);
    return false;
  }
  return true;
}

export async function createRadiologyImage(data: {
  order_id: string;
  clinic_id: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  modality?: string;
  is_dicom?: boolean;
  dicom_metadata?: Record<string, unknown>;
  thumbnail_url?: string;
  description?: string;
  uploaded_by?: string;
}): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("radiology_images")
    .insert({
      ...data,
      is_dicom: data.is_dicom ?? false,
      dicom_metadata: data.dicom_metadata ?? {},
    })
    .select("id")
    .single();
  if (error) {
    console.error("[data] Error creating radiology image:", error.message);
    return null;
  }
  return row as { id: string };
}

export async function updateRadiologyOrderPdfUrl(
  orderId: string,
  pdfUrl: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("radiology_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("[data] Error updating radiology PDF URL:", error.message);
    return false;
  }
  return true;
}
