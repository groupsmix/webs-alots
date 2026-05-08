"use client";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// PEDIATRICIAN — Growth Measurements
// ─────────────────────────────────────────────

export interface GrowthMeasurementView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  measuredAt: string;
  ageMonths: number;
  weightKg: number | null;
  heightCm: number | null;
  headCircCm: number | null;
  bmi: number | null;
  notes: string;
}

interface GrowthMeasurementRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  measured_at: string;
  age_months: number;
  weight_kg: number | null;
  height_cm: number | null;
  head_circ_cm: number | null;
  bmi: number | null;
  notes: string | null;
}

export async function fetchGrowthMeasurements(clinicId: string, patientId?: string): Promise<GrowthMeasurementView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<GrowthMeasurementRaw>("growth_measurements", {
    eq,
    order: ["measured_at", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    measuredAt: r.measured_at,
    ageMonths: r.age_months,
    weightKg: r.weight_kg,
    heightCm: r.height_cm,
    headCircCm: r.head_circ_cm,
    bmi: r.bmi,
    notes: r.notes ?? "",
  }));
}

export async function createGrowthMeasurement(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  measured_at: string;
  age_months: number;
  weight_kg?: number;
  height_cm?: number;
  head_circ_cm?: number;
  bmi?: number;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("growth_measurements")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

// ─────────────────────────────────────────────
// PEDIATRICIAN — Vaccinations
// ─────────────────────────────────────────────

export interface VaccinationView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  vaccineName: string;
  doseNumber: number;
  scheduledDate: string;
  administeredDate: string | null;
  status: "scheduled" | "administered" | "overdue" | "skipped";
  lotNumber: string;
  site: string;
  notes: string;
}

interface VaccinationRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  vaccine_name: string;
  dose_number: number;
  scheduled_date: string;
  administered_date: string | null;
  status: string;
  lot_number: string | null;
  site: string | null;
  notes: string | null;
}

export async function fetchVaccinations(clinicId: string, patientId?: string): Promise<VaccinationView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<VaccinationRaw>("vaccinations", {
    eq,
    order: ["scheduled_date", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id ?? "",
    vaccineName: r.vaccine_name,
    doseNumber: r.dose_number,
    scheduledDate: r.scheduled_date,
    administeredDate: r.administered_date,
    status: r.status as VaccinationView["status"],
    lotNumber: r.lot_number ?? "",
    site: r.site ?? "",
    notes: r.notes ?? "",
  }));
}

export async function createVaccination(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id?: string;
  vaccine_name: string;
  dose_number: number;
  scheduled_date: string;
  administered_date?: string;
  status?: string;
  lot_number?: string;
  site?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase.from("vaccinations")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

export async function updateVaccination(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient();
  // @ts-expect-error -- Supabase generated types lag behind actual DB schema
  const { error } = await supabase.from("vaccinations").update(updates).eq("id", id);
  if (error) { logger.warn("Mutation failed", { context: "data/client", error }); return false; }
  return true;
}

// ─────────────────────────────────────────────
// PEDIATRICIAN — Developmental Milestones
// ─────────────────────────────────────────────

export interface MilestoneView {
  id: string;
  patientId: string;
  patientName: string;
  category: "motor" | "language" | "social" | "cognitive";
  milestone: string;
  expectedAgeMonths: number | null;
  achievedDate: string | null;
  status: "pending" | "achieved" | "delayed" | "concern";
  notes: string;
}

interface MilestoneRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  category: string;
  milestone: string;
  expected_age_months: number | null;
  achieved_date: string | null;
  status: string;
  notes: string | null;
}

export async function fetchMilestones(clinicId: string, patientId?: string): Promise<MilestoneView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<MilestoneRaw>("developmental_milestones", {
    eq,
    order: ["expected_age_months", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    category: r.category as MilestoneView["category"],
    milestone: r.milestone,
    expectedAgeMonths: r.expected_age_months,
    achievedDate: r.achieved_date,
    status: r.status as MilestoneView["status"],
    notes: r.notes ?? "",
  }));
}

export async function createMilestone(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id?: string;
  category: string;
  milestone: string;
  expected_age_months?: number;
  achieved_date?: string;
  status?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase.from("developmental_milestones")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

export async function updateMilestone(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient();
  // @ts-expect-error -- Supabase generated types lag behind actual DB schema
  const { error } = await supabase.from("developmental_milestones").update(updates).eq("id", id);
  if (error) { logger.warn("Mutation failed", { context: "data/client", error }); return false; }
  return true;
}

// ─────────────────────────────────────────────
