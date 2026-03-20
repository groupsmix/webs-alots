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
