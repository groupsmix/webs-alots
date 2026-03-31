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
import type { Database } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { invalidateAllSubdomainCaches } from "@/lib/subdomain-cache";
import { getLocalDateStr } from "@/lib/utils";

type TableName = keyof Database["public"]["Tables"];

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** Default upper-bound limit for list queries to prevent unbounded result sets. */
const DEFAULT_QUERY_LIMIT = 1000;

/** Paginated result envelope returned by `queryPaginated`. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

async function query<T>(
  table: TableName,
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
      q = q.eq(col, val as string);
    }
  }
  if (opts?.inFilter) {
    q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);
  }
  if (opts?.order) {
    q = q.order(opts.order[0], opts.order[1]);
  }
  // Always apply an upper-bound limit to prevent unbounded result sets.
  // Callers can override with a smaller value via opts.limit.
  q = q.limit(opts?.limit ?? DEFAULT_QUERY_LIMIT);

  const { data, error } = await q;
  if (error) {
    logger.error("Query failed", { context: "data/server", table, error });
    return [];
  }
  return (data ?? []) as T[];
}

/**
 * Paginated query helper. Returns a page of results along with total count
 * and a `hasMore` flag so callers can implement pagination UIs.
 */
async function _queryPaginated<T>(
  table: TableName,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
    order?: [string, { ascending: boolean }];
    page?: number;
    pageSize?: number;
    inFilter?: [string, unknown[]];
  },
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(opts?.pageSize ?? 50, DEFAULT_QUERY_LIMIT);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let q = supabase.from(table).select(opts?.select ?? "*", { count: "exact" });

  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val as string);
    }
  }
  if (opts?.inFilter) {
    q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);
  }
  if (opts?.order) {
    q = q.order(opts.order[0], opts.order[1]);
  }
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) {
    logger.error("Paginated query failed", { context: "data/server", table, error });
    return { data: [], total: 0, hasMore: false, page, pageSize };
  }
  const total = count ?? 0;
  return {
    data: (data ?? []) as T[],
    total,
    hasMore: from + pageSize < total,
    page,
    pageSize,
  };
}

async function queryOne<T>(
  table: TableName,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
  },
): Promise<T | null> {
  const supabase = await createClient();
  let q = supabase.from(table).select(opts?.select ?? "*");
  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val as string);
    }
  }
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return data as T | null;
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
  return {
    logo_url: data.logo_url ?? null,
    favicon_url: data.favicon_url ?? null,
    primary_color: data.primary_color ?? null,
    secondary_color: data.secondary_color ?? null,
    heading_font: data.heading_font ?? null,
    body_font: data.body_font ?? null,
    hero_image_url: data.hero_image_url ?? null,
  };
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
    logger.warn("Mutation failed", { context: "data/server", error });
    return false;
  }

  // Invalidate subdomain cache so middleware picks up branding changes
  invalidateAllSubdomainCaches();

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
  duration_min: number | null;
  price: number | null;
  currency: string | null;
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
  const today = getLocalDateStr();
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  let q = supabase
    .from("appointments")
    .select("id, clinic_id, patient_id, doctor_id, service_id, slot_start, slot_end, appointment_date, start_time, end_time, status, booking_source, is_first_visit, insurance_flag, notes, cancellation_reason, cancelled_at, source, is_walk_in, is_emergency, rescheduled_from, recurrence_group_id, recurrence_index, recurrence_pattern, updated_at, created_at")
    .eq("clinic_id", clinicId)
    .gte("slot_start", todayStart)
    .lte("slot_start", todayEnd)
    .order("slot_start", { ascending: true })
    .limit(DEFAULT_QUERY_LIMIT);

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }

  const { data, error } = await q;
  if (error) {
    logger.warn("Query failed", { context: "data/server", error });
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

export async function getNotifications(clinicId: string, userId: string): Promise<NotificationRow[]> {
  return query<NotificationRow>("notifications", {
    eq: [["clinic_id", clinicId], ["user_id", userId]],
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
    .select("id, clinic_id, appointment_id, doctor_id, patient_id, items, notes, pdf_url, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_QUERY_LIMIT);

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }

  const { data, error } = await q;
  if (error) {
    logger.warn("Query failed", { context: "data/server", error });
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    clinic_id: r.clinic_id ?? "",
    appointment_id: r.appointment_id,
    doctor_id: r.doctor_id,
    patient_id: r.patient_id,
    items: Array.isArray(r.items) ? (r.items as PrescriptionRow["items"]) : [],
    notes: r.notes,
    pdf_url: r.pdf_url,
    created_at: r.created_at ?? "",
  }));
}

export async function getPatientPrescriptions(clinicId: string, patientId: string): Promise<PrescriptionRow[]> {
  return query<PrescriptionRow>("prescriptions", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
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

export async function getConsultationNotes(clinicId: string, doctorId: string): Promise<ConsultationNoteRow[]> {
  return query<ConsultationNoteRow>("consultation_notes", {
    eq: [["clinic_id", clinicId], ["doctor_id", doctorId]],
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

export async function getFamilyMembers(clinicId: string, userId: string): Promise<FamilyMemberRow[]> {
  return query<FamilyMemberRow>("family_members", {
    eq: [["clinic_id", clinicId], ["primary_user_id", userId]],
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

export async function getOdontogram(clinicId: string, patientId: string): Promise<OdontogramRow[]> {
  return query<OdontogramRow>("odontogram", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
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
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  return query<TreatmentPlanRow>("treatment_plans", {
    eq,
    order: ["created_at", { ascending: false }],
  });
}

export async function getPatientTreatmentPlans(clinicId: string, patientId: string): Promise<TreatmentPlanRow[]> {
  return query<TreatmentPlanRow>("treatment_plans", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
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

export async function getInstallments(clinicId: string, treatmentPlanId: string): Promise<InstallmentRow[]> {
  return query<InstallmentRow>("installments", {
    eq: [["clinic_id", clinicId], ["treatment_plan_id", treatmentPlanId]],
    order: ["due_date", { ascending: true }],
  });
}

export async function getPatientInstallments(clinicId: string, patientId: string): Promise<InstallmentRow[]> {
  return query<InstallmentRow>("installments", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
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
    supabase.from("users").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("role", "patient"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "no_show"),
    supabase.from("payments").select("amount").eq("clinic_id", clinicId).eq("status", "completed"),
    supabase.from("reviews").select("stars").eq("clinic_id", clinicId),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("role", "doctor"),
  ]);

  const payments = (paymentsRes.data ?? []) as { amount: number }[];
  const reviews = (reviewsRes.data ?? []) as { stars: number }[];
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.stars ?? 0), 0) / reviews.length
      : 0;

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

  // DAL-01 (HIGH): Verify the caller is a super_admin before returning
  // platform-wide statistics. Without this guard, any authenticated user
  // could call this function and see cross-tenant aggregated data.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    throw new Error("Forbidden: super_admin role required");
  }

  const [clinicsRes, patientCountRes, appointmentCountRes, revenueRes] = await Promise.all([
    supabase.from("clinics").select("id, name, type, config, tier, status, subdomain, created_at").order("created_at", { ascending: false }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "patient"),
    supabase.from("appointments").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount").eq("status", "completed"),
  ]);

  const clinics = (clinicsRes.data ?? []) as ClinicRow[];
  const totalRevenue = (revenueRes.data ?? []).reduce(
    (sum, p) => sum + ((p as { amount: number }).amount ?? 0),
    0,
  );

  return {
    clinics,
    totalClinics: clinics.length,
    activeClinics: clinics.filter((c) => c.status === "active").length,
    totalPatients: patientCountRes.count ?? 0,
    totalAppointments: appointmentCountRes.count ?? 0,
    totalRevenue,
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
    logger.warn("Mutation failed", { context: "data/server", error });
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
    appointment_date: getLocalDateStr(startDate),
    start_time: startDate.toISOString().split("T")[1]?.slice(0, 5),
    end_time: endDate.toISOString().split("T")[1]?.slice(0, 5),
  };
  const { data: row, error } = await supabase
    .from("appointments")
    .insert(enriched)
    .select()
    .single();
  if (error) {
    logger.warn("Mutation failed", { context: "data/server", error });
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
    logger.warn("Mutation failed", { context: "data/server", error });
    return false;
  }
  return true;
}

export async function updateReviewResponse(reviewId: string, response: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ response }).eq("id", reviewId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/server", error });
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
    logger.warn("Mutation failed", { context: "data/server", error });
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
  const { data: row, error } = await supabase.from("radiology_orders")
    .insert({
      ...data,
      order_number: orderNumber,
      status: "pending",
      priority: data.priority ?? "normal",
    })
    .select("id, order_number")
    .single();
  if (error) {
    logger.warn("Mutation failed", { context: "data/server", error });
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
    logger.warn("Mutation failed", { context: "data/server", error });
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
    logger.warn("Mutation failed", { context: "data/server", error });
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
    } as Database["public"]["Tables"]["radiology_images"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Mutation failed", { context: "data/server", error });
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
    logger.warn("Mutation failed", { context: "data/server", error });
    return false;
  }
  return true;
}

// ────────────────────────────────────────────
// Lab — Mutations (server-side)
// ────────────────────────────────────────────

export async function updateLabOrderPdfUrl(
  orderId: string,
  pdfUrl: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_test_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/server", error });
    return false;
  }
  return true;
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
  const [base, supabase] = await Promise.all([
    fetchBaseDashboardStats(clinicId),
    createClient(),
  ]);

  // Fetch dashboard-specific data in parallel
  const [insurancePatientsRes, recentActivity] = await Promise.all([
    supabase.from("users").select("id, metadata").eq("clinic_id", clinicId).eq("role", "patient"),
    getRecentActivity(supabase, clinicId),
  ]);

  const insurancePatients = (insurancePatientsRes.data ?? []) as { id: string; metadata: { insurance?: boolean } | null }[];
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
    logger.warn("Failed to fetch recent activity", { context: "data/server", error });
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

export async function getDoctorDashboardData(clinicId: string, doctorId: string): Promise<DoctorDashboardData> {
  const supabase = await createClient();

  // Fetch doctor's appointments, patients, waiting room, invoices in parallel
  const today = getLocalDateStr();
  const [apptsRes, patientsRes, waitingRes, invoicesRes] = await Promise.all([
    supabase.from("appointments")
      .select("id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, status, is_first_visit, insurance_flag, is_emergency, notes, recurrence_group_id, recurrence_pattern")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .order("appointment_date", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("users")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .order("name", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("appointments")
      .select("id, patient_id, service_id, start_time, status, is_emergency")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
      .in("status", ["confirmed", "checked_in", "checked-in"])
      .order("start_time", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("payments")
      .select("id, appointment_id, amount, status, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
  ]);

  type ApptRaw = {
    id: string; patient_id: string; doctor_id: string; service_id: string | null;
    appointment_date: string; start_time: string; status: string;
    is_first_visit: boolean; insurance_flag: boolean; is_emergency: boolean;
    notes: string | null; recurrence_group_id: string | null; recurrence_pattern: string | null;
  };
  const apptRows = (apptsRes.data ?? []) as ApptRaw[];

  type WaitRaw = { id: string; patient_id: string; service_id: string | null; start_time: string; status: string; is_emergency: boolean };
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
      ? supabase.from("users").select("id, name, phone, email").eq("clinic_id", clinicId).in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string; email: string }[] }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, name, price").eq("clinic_id", clinicId).in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number }[] }),
  ]);
  const userMap = new Map(
    ((usersRes.data ?? []) as { id: string; name: string; phone: string; email: string }[]).map((u) => [
      u.id,
      { name: u.name, phone: u.phone ?? "", email: u.email ?? "" },
    ]),
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
    serviceName: raw.service_id ? (serviceMap.get(raw.service_id)?.name ?? "Consultation") : "Consultation",
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

  const patients: DoctorPatientView[] = ((patientsRes.data ?? []) as { id: string; name: string; phone: string | null }[]).map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? "",
  }));

  const waitingRoom: DoctorWaitingRoomEntry[] = waitRows.map((r) => ({
    id: r.id,
    patientName: userMap.get(r.patient_id)?.name ?? "Patient",
    scheduledTime: r.start_time?.slice(0, 5) ?? "",
    serviceName: r.service_id ? (serviceMap.get(r.service_id)?.name ?? "Consultation") : "Consultation",
    status: "waiting",
    priority: r.is_emergency ? "urgent" : "normal",
  }));

  type InvRaw = { id: string; appointment_id: string | null; amount: number; status: string; created_at: string };
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

export async function getPatientDashboardData(clinicId: string, userId: string, userName: string): Promise<PatientDashboardData> {
  const supabase = await createClient();

  // Resolve clinic currency from DB config (DAL-04: was hardcoded to "MAD")
  const { getClinicConfig } = await import("@/lib/tenant");
  const clinicCfg = await getClinicConfig(clinicId);

  const [apptsRes, rxRes, invoicesRes, notifsRes] = await Promise.all([
    supabase.from("appointments")
      .select("id, doctor_id, service_id, appointment_date, start_time, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .order("appointment_date", { ascending: true })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("prescriptions")
      .select("id, patient_id, doctor_id, items, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("payments")
      .select("id, amount, status, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
    supabase.from("notifications")
      .select("id, is_read")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(DEFAULT_QUERY_LIMIT),
  ]);

  type ApptRaw = { id: string; doctor_id: string; service_id: string | null; appointment_date: string; start_time: string; status: string };
  type RxRaw = { id: string; patient_id: string; doctor_id: string; items: { name: string; dosage: string; duration: string }[] | null; created_at: string };
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

  type InvRaw = { id: string; amount: number; status: string; created_at: string };
  const invoices: PatientInvoiceView[] = ((invoicesRes.data ?? []) as InvRaw[]).map((r) => ({
    id: r.id,
    amount: r.amount,
    currency: clinicCfg.currency,
    status: r.status === "completed" ? "paid" : r.status,
    date: r.created_at?.split("T")[0] ?? "",
  }));

  type NotifRaw = { id: string; is_read: boolean };
  const notifications: PatientNotificationView[] = ((notifsRes.data ?? []) as NotifRaw[]).map((r) => ({
    id: r.id,
    read: r.is_read ?? false,
  }));

  return { userName, appointments, prescriptions, invoices, notifications };
}
