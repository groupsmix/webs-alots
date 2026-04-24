"use client";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// OPHTHALMOLOGIST — Vision Tests
// ─────────────────────────────────────────────

export interface VisionTestView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  testDate: string;
  odAcuity: string;
  osAcuity: string;
  odSphere: number | null;
  odCylinder: number | null;
  odAxis: number | null;
  osSphere: number | null;
  osCylinder: number | null;
  osAxis: number | null;
  odAdd: number | null;
  osAdd: number | null;
  pdMm: number | null;
  notes: string;
}

interface VisionTestRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  test_date: string;
  od_acuity: string | null;
  os_acuity: string | null;
  od_sphere: number | null;
  od_cylinder: number | null;
  od_axis: number | null;
  os_sphere: number | null;
  os_cylinder: number | null;
  os_axis: number | null;
  od_add: number | null;
  os_add: number | null;
  pd_mm: number | null;
  notes: string | null;
}

export async function fetchVisionTests(clinicId: string, patientId?: string): Promise<VisionTestView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<VisionTestRaw>("vision_tests", {
    eq,
    order: ["test_date", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    testDate: r.test_date,
    odAcuity: r.od_acuity ?? "",
    osAcuity: r.os_acuity ?? "",
    odSphere: r.od_sphere,
    odCylinder: r.od_cylinder,
    odAxis: r.od_axis,
    osSphere: r.os_sphere,
    osCylinder: r.os_cylinder,
    osAxis: r.os_axis,
    odAdd: r.od_add,
    osAdd: r.os_add,
    pdMm: r.pd_mm,
    notes: r.notes ?? "",
  }));
}

export async function createVisionTest(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  test_date: string;
  od_acuity?: string;
  os_acuity?: string;
  od_sphere?: number;
  od_cylinder?: number;
  od_axis?: number;
  os_sphere?: number;
  os_cylinder?: number;
  os_axis?: number;
  od_add?: number;
  os_add?: number;
  pd_mm?: number;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("vision_tests")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

// ─────────────────────────────────────────────
// OPHTHALMOLOGIST — IOP Measurements
// ─────────────────────────────────────────────

export interface IopMeasurementView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  measuredAt: string;
  odPressure: number;
  osPressure: number;
  method: string;
  notes: string;
}

interface IopMeasurementRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  measured_at: string;
  od_pressure: number;
  os_pressure: number;
  method: string | null;
  notes: string | null;
}

export async function fetchIopMeasurements(clinicId: string, patientId?: string): Promise<IopMeasurementView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<IopMeasurementRaw>("iop_measurements", {
    eq,
    order: ["measured_at", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    measuredAt: r.measured_at,
    odPressure: r.od_pressure,
    osPressure: r.os_pressure,
    method: r.method ?? "goldmann",
    notes: r.notes ?? "",
  }));
}

export async function createIopMeasurement(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  measured_at: string;
  od_pressure: number;
  os_pressure: number;
  method?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("iop_measurements")
    .insert(data)
    .select("id")
    .single();
  if (error) { logger.warn("Query failed", { context: "data/client", error }); return null; }
  return row?.id ?? null;
}

// ─────────────────────────────────────────────
