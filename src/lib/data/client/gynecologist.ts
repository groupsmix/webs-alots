"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

// GYNECOLOGIST — Pregnancies
// ─────────────────────────────────────────────

export interface PregnancyView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  lmpDate: string;
  eddDate: string;
  status: "active" | "delivered" | "miscarriage" | "ectopic" | "terminated";
  gravida: number | null;
  para: number | null;
  bloodType: string;
  rhFactor: string;
  riskFactors: string[];
  birthPlanNotes: string;
  deliveryDate: string | null;
  deliveryType: string | null;
  babyWeightKg: number | null;
  babyGender: string | null;
  notes: string;
  gestationalWeeks: number;
  gestationalDays: number;
  trimester: number;
}

interface PregnancyRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lmp_date: string;
  edd_date: string;
  status: string;
  gravida: number | null;
  para: number | null;
  blood_type: string | null;
  rh_factor: string | null;
  risk_factors: string[] | null;
  birth_plan_notes: string | null;
  delivery_date: string | null;
  delivery_type: string | null;
  baby_weight_kg: number | null;
  baby_gender: string | null;
  notes: string | null;
  created_at: string;
}

function calcGestationalAge(lmpDate: string): { weeks: number; days: number; trimester: number } {
  const lmp = new Date(lmpDate);
  const now = new Date();
  const diffMs = now.getTime() - lmp.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const trimester = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
  return { weeks, days, trimester };
}

export async function fetchPregnancies(clinicId: string, patientId?: string): Promise<PregnancyView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<PregnancyRaw>("pregnancies", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => {
    const ga = calcGestationalAge(r.lmp_date);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
      doctorId: r.doctor_id,
      lmpDate: r.lmp_date,
      eddDate: r.edd_date,
      status: r.status as PregnancyView["status"],
      gravida: r.gravida,
      para: r.para,
      bloodType: r.blood_type ?? "",
      rhFactor: r.rh_factor ?? "",
      riskFactors: (r.risk_factors ?? []) as string[],
      birthPlanNotes: r.birth_plan_notes ?? "",
      deliveryDate: r.delivery_date,
      deliveryType: r.delivery_type,
      babyWeightKg: r.baby_weight_kg,
      babyGender: r.baby_gender,
      notes: r.notes ?? "",
      gestationalWeeks: ga.weeks,
      gestationalDays: ga.days,
      trimester: ga.trimester,
    };
  });
}

export async function createPregnancy(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lmp_date: string;
  edd_date: string;
  gravida?: number;
  para?: number;
  blood_type?: string;
  rh_factor?: string;
  risk_factors?: string[];
  birth_plan_notes?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("pregnancies")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

export async function updatePregnancy(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("pregnancies").update(updates).eq("id", id);
  if (error) { logger.warn("Mutation failed", { context: "data/client", error }); return false; }
  return true;
}

// ─────────────────────────────────────────────
// GYNECOLOGIST — Ultrasound Records
// ─────────────────────────────────────────────

export interface UltrasoundView {
  id: string;
  pregnancyId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  scanDate: string;
  trimester: number;
  gestationalWeeks: number | null;
  gestationalDays: number | null;
  measurements: Record<string, unknown>;
  findings: string;
  imageUrls: string[];
  notes: string;
}

interface UltrasoundRaw {
  id: string;
  clinic_id: string;
  pregnancy_id: string;
  patient_id: string;
  doctor_id: string;
  scan_date: string;
  trimester: number;
  gestational_weeks: number | null;
  gestational_days: number | null;
  measurements: Record<string, unknown> | null;
  findings: string | null;
  image_urls: string[] | null;
  notes: string | null;
}

export async function fetchUltrasounds(clinicId: string, pregnancyId?: string): Promise<UltrasoundView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (pregnancyId) eq.push(["pregnancy_id", pregnancyId]);
  const rows = await fetchRows<UltrasoundRaw>("ultrasound_records", {
    eq,
    order: ["scan_date", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    pregnancyId: r.pregnancy_id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    scanDate: r.scan_date,
    trimester: r.trimester,
    gestationalWeeks: r.gestational_weeks,
    gestationalDays: r.gestational_days,
    measurements: r.measurements ?? {},
    findings: r.findings ?? "",
    imageUrls: (r.image_urls ?? []) as string[],
    notes: r.notes ?? "",
  }));
}

export async function createUltrasound(data: {
  clinic_id: string;
  pregnancy_id: string;
  patient_id: string;
  doctor_id: string;
  scan_date: string;
  trimester: number;
  gestational_weeks?: number;
  gestational_days?: number;
  measurements?: Record<string, unknown>;
  findings?: string;
  image_urls?: string[];
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase.from("ultrasound_records")
    .insert(data as Database["public"]["Tables"]["ultrasound_records"]["Insert"])
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

// ─────────────────────────────────────────────
