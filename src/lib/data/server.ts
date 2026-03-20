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
  let q = supabase.from(table).select(opts?.select ?? "*");

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
  let q = supabase.from(table).select(opts?.select ?? "*");
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
  config: Record<string, unknown> | null;
  tier: string | null;
  status: string | null;
  created_at: string | null;
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
  return data as ClinicBrandingRow;
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
  created_at: string | null;
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
  price: number | null;
  duration_minutes: number;
  category: string | null;
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
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  service_id: string | null;
  slot_start: string;
  slot_end: string;
  status: string;
  is_first_visit: boolean;
  insurance_flag: boolean;
  source: string | null;
  notes: string | null;
  created_at: string | null;
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
  doctor_id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_capacity: number;
  buffer_minutes: number;
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
  patient_id: string;
  appointment_id: string | null;
  amount: number;
  method: string | null;
  status: string;
  ref: string | null;
  created_at: string | null;
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
  patient_id: string;
  clinic_id: string;
  stars: number;
  comment: string | null;
  response: string | null;
  created_at: string | null;
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
  user_id: string;
  type: string;
  channel: string;
  message: string | null;
  sent_at: string | null;
  read_at: string | null;
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
  user_id: string;
  clinic_id: string;
  type: string;
  file_url: string;
  uploaded_at: string | null;
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
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  content: unknown;
  pdf_url: string | null;
  created_at: string | null;
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
  patient_id: string;
  doctor_id: string;
  appointment_id: string;
  notes: string | null;
  private: boolean;
  created_at: string | null;
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
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  service_id: string | null;
  preferred_date: string | null;
  status: string;
  created_at: string | null;
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
  name: string;
  phone: string | null;
  relationship: string;
  created_at: string | null;
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
  patient_id: string;
  tooth_number: number;
  status: string;
  notes: string | null;
  updated_at: string | null;
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
  patient_id: string;
  doctor_id: string;
  steps: unknown;
  status: string;
  total_cost: number | null;
  created_at: string | null;
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
  doctor_id: string;
  patient_id: string;
  clinic_id: string;
  details: string;
  status: string;
  created_at: string | null;
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
  treatment_plan_id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  receipt_url: string | null;
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
  sterilized_at: string;
  next_due: string | null;
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
  category: string | null;
  price: number | null;
  requires_prescription: boolean;
  barcode: string | null;
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
  product_id: string;
  clinic_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  supplier_id: string | null;
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
  phone: string | null;
  email: string | null;
  products: unknown;
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
  patient_id: string;
  clinic_id: string;
  image_url: string;
  status: string;
  notes: string | null;
  ready_at: string | null;
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
  patient_id: string;
  clinic_id: string;
  points: number;
  last_updated: string | null;
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
  const { data: row, error } = await supabase
    .from("appointments")
    .insert(data)
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
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) return false;
  return true;
}
