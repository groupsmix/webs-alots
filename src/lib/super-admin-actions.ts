"use client";

/**
 * Super Admin Supabase actions — CRUD operations for onboarding clinics.
 * All operations require the authenticated user to have role = "super_admin".
 */

import { createBrowserClient } from "@supabase/ssr";
import type {
  ClinicType,
  ClinicTier,
} from "@/lib/types/database";
import type { Announcement, ActivityLog, BillingRecord, FeatureDefinition } from "./super-admin-data";
import type { ClientSubscription, FeatureToggle, PricingTier } from "./pricing-data";

/** Untyped Supabase client so we can work with raw column names from the SQL schema
 *  without conflicting with the typed Database interface. */
function rawClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Row shapes returned by raw queries (match SQL schema, not the TS Database type)
interface ClinicRow {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  tier: string | null;
  status: string | null;
  created_at: string | null;
}

interface UserRow {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  created_at: string | null;
}

interface ServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  category: string | null;
}

interface TimeSlotRow {
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

// ---------- Types ----------

export interface CreateClinicInput {
  name: string;
  type: ClinicType;
  tier: ClinicTier;
  config?: Record<string, unknown>;
  status?: "active" | "inactive" | "suspended";
}

export interface CreateUserInput {
  clinic_id: string;
  role: "clinic_admin" | "receptionist" | "doctor";
  name: string;
  phone?: string;
  email?: string;
}

export interface CreateServiceInput {
  clinic_id: string;
  name: string;
  price?: number;
  duration_minutes: number;
  category?: string;
}

export interface CreateTimeSlotInput {
  doctor_id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
  max_capacity?: number;
  buffer_minutes?: number;
}

// ---------- Clinic CRUD ----------

export async function createClinic(input: CreateClinicInput): Promise<ClinicRow> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("clinics")
    .insert({
      name: input.name,
      type: input.type,
      tier: input.tier,
      config: input.config ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create clinic: ${error.message}`);
  return data as ClinicRow;
}

export async function fetchClinics(): Promise<ClinicRow[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch clinics: ${error.message}`);
  return (data ?? []) as ClinicRow[];
}

export async function updateClinicStatus(
  clinicId: string,
  status: "active" | "inactive" | "suspended",
): Promise<void> {
  const supabase = rawClient();
  const { error } = await supabase
    .from("clinics")
    .update({ status })
    .eq("id", clinicId);

  if (error)
    throw new Error(`Failed to update clinic status: ${error.message}`);
}

// ---------- User CRUD ----------

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      clinic_id: input.clinic_id,
      role: input.role,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as UserRow;
}

export async function fetchClinicUsers(clinicId: string): Promise<UserRow[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);
  return (data ?? []) as UserRow[];
}

// ---------- Service CRUD ----------

export async function createService(input: CreateServiceInput): Promise<ServiceRow> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      clinic_id: input.clinic_id,
      name: input.name,
      price: input.price ?? null,
      duration_minutes: input.duration_minutes,
      category: input.category ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create service: ${error.message}`);
  return data as ServiceRow;
}

export async function fetchClinicServices(clinicId: string): Promise<ServiceRow[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to fetch services: ${error.message}`);
  return (data ?? []) as ServiceRow[];
}

// ---------- Time Slot CRUD ----------

export async function createTimeSlot(input: CreateTimeSlotInput): Promise<TimeSlotRow> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("time_slots")
    .insert({
      doctor_id: input.doctor_id,
      clinic_id: input.clinic_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_available: input.is_available ?? true,
      max_capacity: input.max_capacity ?? 1,
      buffer_minutes: input.buffer_minutes ?? 10,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create time slot: ${error.message}`);
  return data as TimeSlotRow;
}

export async function createTimeSlotsForDoctor(
  doctorId: string,
  clinicId: string,
  slots: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    max_capacity?: number;
    buffer_minutes?: number;
  }[],
): Promise<TimeSlotRow[]> {
  const supabase = rawClient();
  const rows = slots.map((s) => ({
    doctor_id: doctorId,
    clinic_id: clinicId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    is_available: true,
    max_capacity: s.max_capacity ?? 1,
    buffer_minutes: s.buffer_minutes ?? 10,
  }));

  const { data, error } = await supabase
    .from("time_slots")
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to create time slots: ${error.message}`);
  return (data ?? []) as TimeSlotRow[];
}

// ---------- Dashboard Stats ----------

interface DashboardStats {
  clinics: ClinicRow[];
  totalClinics: number;
  activeClinics: number;
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = rawClient();

  const [clinicsRes, usersRes, appointmentsRes, paymentsRes] =
    await Promise.all([
      supabase.from("clinics").select("id, name, type, tier, status, config, created_at"),
      supabase
        .from("users")
        .select("id, clinic_id, role")
        .in("role", ["patient"]),
      supabase
        .from("appointments")
        .select("id, clinic_id, status"),
      supabase
        .from("payments")
        .select("id, clinic_id, amount, status"),
    ]);

  const clinics = (clinicsRes.data ?? []) as ClinicRow[];
  const patients = (usersRes.data ?? []) as { id: string; clinic_id: string; role: string }[];
  const appointments = (appointmentsRes.data ?? []) as { id: string; clinic_id: string; status: string }[];
  const payments = (paymentsRes.data ?? []) as { id: string; clinic_id: string; amount: number; status: string }[];

  const totalClinics = clinics.length;
  const activeClinics = clinics.filter((c) => c.status === "active").length;
  const totalPatients = patients.length;
  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalRevenue = completedPayments.reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  );

  return {
    clinics,
    totalClinics,
    activeClinics,
    totalPatients,
    totalAppointments: appointments.length,
    totalRevenue,
  };
}

// ---------- Announcements ----------

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return data.map((a: Record<string, unknown>) => ({
    id: a.id as string,
    title: (a.title as string) ?? "",
    message: (a.message as string) ?? "",
    type: (a.type as Announcement["type"]) ?? "info",
    target: (a.target as string) ?? "all",
    targetLabel: (a.target_label as string) ?? "All Clinics",
    publishedAt: ((a.published_at as string) ?? "").split("T")[0],
    expiresAt: a.expires_at ? (a.expires_at as string).split("T")[0] : undefined,
    active: (a.active as boolean) ?? true,
    createdBy: (a.created_by as string) ?? "",
  }));
}

// ---------- Activity Logs ----------

export async function fetchActivityLogs(limit: number = 10): Promise<ActivityLog[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((l: Record<string, unknown>) => ({
    id: l.id as string,
    action: (l.action as string) ?? "",
    description: (l.description as string) ?? "",
    clinicId: l.clinic_id as string | undefined,
    clinicName: l.clinic_name as string | undefined,
    timestamp: (l.timestamp as string) ?? "",
    actor: (l.actor as string) ?? "",
    type: (l.type as ActivityLog["type"]) ?? "clinic",
  }));
}

// ---------- Billing Records ----------

export async function fetchBillingRecords(): Promise<BillingRecord[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("billing_records")
    .select("*")
    .order("due_date", { ascending: false });

  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    clinicId: (r.clinic_id as string) ?? "",
    clinicName: (r.clinic_name as string) ?? "",
    plan: (r.plan as string) ?? "",
    amountDue: (r.amount_due as number) ?? 0,
    amountPaid: (r.amount_paid as number) ?? 0,
    currency: (r.currency as string) ?? "MAD",
    status: (r.status as BillingRecord["status"]) ?? "pending",
    invoiceDate: ((r.invoice_date as string) ?? "").split("T")[0],
    dueDate: ((r.due_date as string) ?? "").split("T")[0],
    paidDate: r.paid_date ? (r.paid_date as string).split("T")[0] : undefined,
    paymentMethod: r.payment_method as string | undefined,
  }));
}

// ---------- Feature Definitions ----------

export async function fetchFeatureDefinitions(): Promise<FeatureDefinition[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("feature_definitions")
    .select("*")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data.map((f: Record<string, unknown>) => ({
    id: f.id as string,
    name: (f.name as string) ?? "",
    description: (f.description as string) ?? "",
    key: (f.key as string) ?? "",
    category: (f.category as FeatureDefinition["category"]) ?? "core",
    availableTiers: (f.available_tiers as string[]) ?? [],
    globalEnabled: (f.global_enabled as boolean) ?? false,
  }));
}

// ---------- Client Subscriptions ----------

export async function fetchClientSubscriptions(): Promise<ClientSubscription[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    clinicId: (s.clinic_id as string) ?? "",
    clinicName: (s.clinic_name as string) ?? "",
    systemType: (s.system_type as ClientSubscription["systemType"]) ?? "doctor",
    tierSlug: (s.tier_slug as ClientSubscription["tierSlug"]) ?? "cabinet",
    tierName: (s.tier_name as string) ?? "",
    status: (s.status as ClientSubscription["status"]) ?? "active",
    currentPeriodStart: ((s.current_period_start as string) ?? "").split("T")[0],
    currentPeriodEnd: ((s.current_period_end as string) ?? "").split("T")[0],
    billingCycle: (s.billing_cycle as ClientSubscription["billingCycle"]) ?? "monthly",
    amount: (s.amount as number) ?? 0,
    currency: (s.currency as string) ?? "MAD",
    paymentMethod: (s.payment_method as string) ?? "",
    autoRenew: (s.auto_renew as boolean) ?? false,
    trialEndsAt: s.trial_ends_at as string | undefined,
    cancelledAt: s.cancelled_at as string | undefined,
    invoices: (s.invoices as ClientSubscription["invoices"]) ?? [],
  }));
}

// ---------- Feature Toggles ----------

export async function fetchFeatureToggles(): Promise<FeatureToggle[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("feature_toggles")
    .select("*")
    .order("label", { ascending: true });

  if (error || !data) return [];
  return data.map((f: Record<string, unknown>) => ({
    id: f.id as string,
    key: (f.key as string) ?? "",
    label: (f.label as string) ?? "",
    description: (f.description as string) ?? "",
    category: (f.category as FeatureToggle["category"]) ?? "core",
    systemTypes: (f.system_types as FeatureToggle["systemTypes"]) ?? [],
    tiers: (f.tiers as FeatureToggle["tiers"]) ?? [],
    enabled: (f.enabled as boolean) ?? false,
  }));
}

// ---------- Pricing Tiers ----------

export async function fetchPricingTiers(): Promise<PricingTier[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map((t: Record<string, unknown>) => ({
    id: t.id as string,
    slug: (t.slug as PricingTier["slug"]) ?? "cabinet",
    name: (t.name as string) ?? "",
    description: (t.description as string) ?? "",
    popular: (t.popular as boolean) ?? false,
    pricing: (t.pricing as PricingTier["pricing"]) ?? {
      doctor: { monthly: 0, yearly: 0 },
      dentist: { monthly: 0, yearly: 0 },
      pharmacy: { monthly: 0, yearly: 0 },
    },
    features: (t.features as PricingTier["features"]) ?? [],
    limits: (t.limits as PricingTier["limits"]) ?? {
      maxDoctors: 0,
      maxPatients: 0,
      maxAppointmentsPerMonth: 0,
      storageGB: 0,
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
    },
  }));
}
