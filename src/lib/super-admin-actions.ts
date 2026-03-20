"use client";

/**
 * Super Admin Supabase actions — CRUD operations for onboarding clinics.
 * All operations require the authenticated user to have role = "super_admin".
 */

import { createClient } from "@/lib/supabase-client";
import type {
  ClinicType,
  ClinicTier,
} from "@/lib/types/database";

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

export async function createClinic(input: CreateClinicInput) {
  const supabase = createClient();
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
  return data;
}

export async function fetchClinics() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch clinics: ${error.message}`);
  return data;
}

export async function updateClinicStatus(
  clinicId: string,
  status: "active" | "inactive" | "suspended",
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ status })
    .eq("id", clinicId);

  if (error)
    throw new Error(`Failed to update clinic status: ${error.message}`);
}

// ---------- User CRUD ----------

export async function createUser(input: CreateUserInput) {
  const supabase = createClient();
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
  return data;
}

export async function fetchClinicUsers(clinicId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);
  return data;
}

// ---------- Service CRUD ----------

export async function createService(input: CreateServiceInput) {
  const supabase = createClient();
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
  return data;
}

export async function fetchClinicServices(clinicId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to fetch services: ${error.message}`);
  return data;
}

// ---------- Time Slot CRUD ----------

export async function createTimeSlot(input: CreateTimeSlotInput) {
  const supabase = createClient();
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
  return data;
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
) {
  const supabase = createClient();
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
  return data;
}

// ---------- Dashboard Stats ----------

export async function fetchDashboardStats() {
  const supabase = createClient();

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

  const clinics = clinicsRes.data ?? [];
  const patients = usersRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

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
