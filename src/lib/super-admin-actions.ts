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

  // Use count-only queries instead of fetching all rows into memory.
  // This reduces data transfer from O(n) rows to O(1) counts.
  const [clinicsRes, patientsCountRes, appointmentsCountRes, revenueRes] =
    await Promise.all([
      supabase.from("clinics").select("id, name, type, tier, status, config, created_at"),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .in("role", ["patient"]),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed"),
    ]);

  const clinics = (clinicsRes.data ?? []) as ClinicRow[];
  const completedPayments = (revenueRes.data ?? []) as { amount: number }[];
  const totalRevenue = completedPayments.reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  );

  const totalClinics = clinics.length;
  const activeClinics = clinics.filter((c) => c.status === "active").length;

  return {
    clinics,
    totalClinics,
    activeClinics,
    totalPatients: patientsCountRes.count ?? 0,
    totalAppointments: appointmentsCountRes.count ?? 0,
    totalRevenue,
  };
}

// ---------- Billing Records ----------

export interface BillingRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  plan: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
}

export async function fetchBillingRecords(): Promise<BillingRecord[]> {
  const supabase = rawClient();

  const [paymentsRes, clinicsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, clinic_id, amount, status, payment_type, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("clinics").select("id, name, tier"),
  ]);

  const payments = (paymentsRes.data ?? []) as {
    id: string;
    clinic_id: string;
    amount: number;
    status: string;
    payment_type: string | null;
    created_at: string;
  }[];
  const clinics = (clinicsRes.data ?? []) as { id: string; name: string; tier: string | null }[];
  const clinicMap = new Map(clinics.map((c) => [c.id, c]));

  return payments.map((p) => {
    const clinic = clinicMap.get(p.clinic_id);
    const createdDate = p.created_at?.split("T")[0] ?? "";
    const isPaid = p.status === "completed";
    return {
      id: p.id,
      clinicId: p.clinic_id,
      clinicName: clinic?.name ?? "Unknown Clinic",
      plan: clinic?.tier ?? "pro",
      amountDue: p.amount ?? 0,
      amountPaid: isPaid ? (p.amount ?? 0) : 0,
      currency: "MAD",
      status: (isPaid ? "paid" : p.status === "pending" ? "pending" : "overdue") as BillingRecord["status"],
      invoiceDate: createdDate,
      dueDate: createdDate,
      paidDate: isPaid ? createdDate : undefined,
      paymentMethod: p.payment_type ?? undefined,
    };
  });
}

// ---------- Announcements ----------

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  target: string;
  targetLabel: string;
  publishedAt: string;
  expiresAt?: string;
  active: boolean;
  createdBy: string;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    title: (row.title as string) ?? "",
    message: (row.message as string) ?? "",
    type: ((row.type as string) ?? "info") as Announcement["type"],
    target: (row.target as string) ?? "all",
    targetLabel: (row.target_label as string) ?? "All Clinics",
    publishedAt: ((row.published_at ?? row.created_at) as string)?.split("T")[0] ?? "",
    expiresAt: row.expires_at ? (row.expires_at as string).split("T")[0] : undefined,
    active: (row.active as boolean) ?? true,
    createdBy: (row.created_by as string) ?? "System",
  }));
}

// ---------- Activity Logs ----------

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  clinicId?: string;
  clinicName?: string;
  timestamp: string;
  actor: string;
  type: "clinic" | "billing" | "feature" | "announcement" | "template" | "auth";
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    action: (row.action as string) ?? "",
    description: (row.description as string) ?? "",
    clinicId: row.clinic_id as string | undefined,
    clinicName: row.clinic_name as string | undefined,
    timestamp: (row.created_at as string) ?? "",
    actor: (row.actor as string) ?? "System",
    type: ((row.type as string) ?? "clinic") as ActivityLog["type"],
  }));
}

// ---------- Feature Definitions ----------

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  key: string;
  category: "core" | "communication" | "integration" | "advanced";
  availableTiers: string[];
  globalEnabled: boolean;
}

export async function fetchFeatureDefinitions(): Promise<FeatureDefinition[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("feature_definitions")
    .select("*")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "",
    description: (row.description as string) ?? "",
    key: (row.key as string) ?? "",
    category: ((row.category as string) ?? "core") as FeatureDefinition["category"],
    availableTiers: (row.available_tiers as string[]) ?? [],
    globalEnabled: (row.global_enabled as boolean) ?? true,
  }));
}

// ---------- Pricing Tiers ----------

export interface PricingTierRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  popular: boolean;
  pricing: Record<string, { monthly: number; yearly: number }>;
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
}

export async function fetchPricingTiers(): Promise<PricingTierRow[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    slug: (row.slug as string) ?? "",
    name: (row.name as string) ?? "",
    description: (row.description as string) ?? "",
    popular: (row.popular as boolean) ?? false,
    pricing: (row.pricing as Record<string, { monthly: number; yearly: number }>) ?? {},
    features: (row.features as { key: string; label: string; included: boolean; limit?: string }[]) ?? [],
    limits: (row.limits as PricingTierRow["limits"]) ?? {
      maxDoctors: 1, maxPatients: 0, maxAppointmentsPerMonth: 0,
      storageGB: 1, customDomain: false, apiAccess: false, whiteLabel: false,
    },
  }));
}

// ---------- Feature Toggles ----------

export interface FeatureToggleRow {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "core" | "communication" | "integration" | "advanced" | "pharmacy";
  systemTypes: string[];
  tiers: string[];
  enabled: boolean;
}

export async function fetchFeatureToggles(): Promise<FeatureToggleRow[]> {
  const supabase = rawClient();
  const { data, error } = await supabase
    .from("feature_toggles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    key: (row.key as string) ?? "",
    label: (row.label as string) ?? "",
    description: (row.description as string) ?? "",
    category: ((row.category as string) ?? "core") as FeatureToggleRow["category"],
    systemTypes: (row.system_types as string[]) ?? [],
    tiers: (row.tiers as string[]) ?? [],
    enabled: (row.enabled as boolean) ?? true,
  }));
}

// ---------- Client Subscriptions ----------

export interface ClientInvoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paidDate?: string;
}

export type SystemType = "doctor" | "dentist" | "pharmacy";
export type TierSlug = "vitrine" | "cabinet" | "pro" | "premium" | "saas-monthly";

export interface ClientSubscription {
  id: string;
  clinicId: string;
  clinicName: string;
  systemType: SystemType;
  tierSlug: TierSlug;
  tierName: string;
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  trialEndsAt?: string;
  cancelledAt?: string;
  invoices: ClientInvoice[];
}

const TIER_NAMES: Record<string, string> = {
  vitrine: "Vitrine",
  cabinet: "Cabinet",
  pro: "Pro",
  premium: "Premium",
  "saas-monthly": "SaaS Monthly",
};

export async function fetchClientSubscriptions(): Promise<ClientSubscription[]> {
  const supabase = rawClient();

  const [clinicsRes, paymentsRes] = await Promise.all([
    supabase.from("clinics").select("id, name, type, tier, status, config, created_at"),
    supabase
      .from("payments")
      .select("id, clinic_id, amount, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const clinics = (clinicsRes.data ?? []) as ClinicRow[];
  const payments = (paymentsRes.data ?? []) as {
    id: string;
    clinic_id: string;
    amount: number;
    status: string;
    created_at: string;
  }[];

  const paymentsByClinic = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = paymentsByClinic.get(p.clinic_id) ?? [];
    list.push(p);
    paymentsByClinic.set(p.clinic_id, list);
  }

  return clinics.map((c) => {
    const tierSlug = (c.tier ?? "pro") as TierSlug;
    const clinicPayments = paymentsByClinic.get(c.id) ?? [];
    const invoices: ClientInvoice[] = clinicPayments.slice(0, 5).map((p) => ({
      id: p.id,
      date: p.created_at?.split("T")[0] ?? "",
      amount: p.amount ?? 0,
      status: (p.status === "completed" ? "paid" : p.status === "pending" ? "pending" : "overdue") as ClientInvoice["status"],
      paidDate: p.status === "completed" ? p.created_at?.split("T")[0] : undefined,
    }));

    const subStatus: ClientSubscription["status"] =
      c.status === "active" ? "active"
        : c.status === "suspended" ? "suspended"
        : c.status === "trial" ? "trial"
        : "cancelled";

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const latestPayment = clinicPayments[0];
    const amount = latestPayment?.amount ?? 0;

    return {
      id: `sub-${c.id}`,
      clinicId: c.id,
      clinicName: c.name,
      systemType: (c.type ?? "doctor") as SystemType,
      tierSlug,
      tierName: TIER_NAMES[tierSlug] ?? tierSlug,
      status: subStatus,
      currentPeriodStart: monthStart,
      currentPeriodEnd: monthEnd,
      billingCycle: "monthly" as const,
      amount,
      currency: "MAD",
      paymentMethod: "Carte bancaire",
      autoRenew: c.status === "active",
      invoices,
    };
  });
}
