"use client";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import type { Database } from "@/lib/types/database";
import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// ─────────────────────────────────────────────
// Medical Certificates
// ─────────────────────────────────────────────

export interface MedicalCertificateView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  type: "sick_leave" | "fitness" | "medical_report" | "disability" | "custom";
  content: Record<string, unknown>;
  pdfUrl?: string;
  issuedDate: string;
  createdAt: string;
}

interface MedicalCertificateRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  type: string;
  content: Record<string, unknown>;
  pdf_url: string | null;
  issued_date: string;
  created_at: string;
}

export async function fetchMedicalCertificates(
  clinicId: string,
  doctorId?: string,
): Promise<MedicalCertificateView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<MedicalCertificateRaw>("medical_certificates", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    type: r.type as MedicalCertificateView["type"],
    content: r.content ?? {},
    pdfUrl: r.pdf_url ?? undefined,
    issuedDate: r.issued_date,
    createdAt: r.created_at?.split("T")[0] ?? "",
  }));
}

export async function createMedicalCertificate(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  type: string;
  content: Record<string, unknown>;
  issued_date?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("medical_certificates")
    .insert(data as Database["public"]["Tables"]["medical_certificates"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateMedicalCertificate(
  id: string,
  data: {
    type?: string;
    content?: Record<string, unknown>;
    pdf_url?: string;
    issued_date?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("medical_certificates").update(data as Database["public"]["Tables"]["medical_certificates"]["Update"]).eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Dental: Odontogram
// ─────────────────────────────────────────────

export interface OdontogramView {
  toothNumber: number;
  status: string;
  notes?: string;
  lastUpdated?: string;
}

export async function fetchOdontogram(clinicId: string, patientId: string): Promise<OdontogramView[]> {
  const rows = await fetchRows<{ tooth_number: number; status: string; notes: string | null }>("odontogram", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["tooth_number", { ascending: true }],
  });
  return rows.map((r) => ({
    toothNumber: r.tooth_number,
    status: r.status,
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Dental: Treatment Plans
// ─────────────────────────────────────────────

export interface TreatmentPlanView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  title: string;
  steps: { step: number; description: string; status: "pending" | "in_progress" | "completed"; date: string | null; cost: number; toothNumbers?: number[] }[];
  totalCost: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

interface TreatmentPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null; cost?: number; toothNumbers?: number[] }[] | null;
  total_cost: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function fetchTreatmentPlans(clinicId: string, doctorId?: string): Promise<TreatmentPlanView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<TreatmentPlanRaw>("treatment_plans", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    title: r.title,
    steps: (r.steps ?? []).map((s) => ({ ...s, status: s.status as "pending" | "in_progress" | "completed", cost: s.cost ?? 0, toothNumbers: s.toothNumbers })),
    totalCost: r.total_cost ?? 0,
    status: r.status as "planned" | "in_progress" | "completed" | "cancelled",
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Dental: Lab Orders
// ─────────────────────────────────────────────

export interface LabOrderView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  labName: string;
  description: string;
  status: string;
  dueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface LabOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lab_name: string | null;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export async function fetchLabOrders(clinicId: string): Promise<LabOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabOrderRaw>("lab_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorId: r.doctor_id,
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    labName: r.lab_name ?? "",
    description: r.description,
    status: r.status,
    dueDate: r.due_date ?? null,
    notes: "",
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.created_at?.split("T")[0] ?? "",
  }));
}

export async function createLabOrder(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  details: string;
  lab_name?: string;
  status?: string;
  due_date?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("lab_orders")
    .insert({ ...data, status: data.status ?? "pending" } as Database["public"]["Tables"]["lab_orders"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

// ─────────────────────────────────────────────
// Dental: Sterilization Log
// ─────────────────────────────────────────────

export interface SterilizationView {
  id: string;
  toolName: string;
  sterilizedBy: string;
  sterilizedAt: string;
  nextDue: string | null;
  method: "autoclave" | "chemical" | "dry_heat";
  notes: string;
  batchNumber?: string;
  cycleNumber?: number;
}

export async function fetchSterilizationLog(clinicId: string): Promise<SterilizationView[]> {
  const rows = await fetchRows<{
    id: string;
    tool_name: string;
    sterilized_by: string | null;
    sterilized_at: string;
    next_due: string | null;
    method: string | null;
    notes: string | null;
    batch_number: string | null;
    cycle_number: number | null;
  }>("sterilization_log", {
    eq: [["clinic_id", clinicId]],
    order: ["sterilized_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    toolName: r.tool_name,
    sterilizedBy: r.sterilized_by ?? "",
    sterilizedAt: r.sterilized_at,
    nextDue: r.next_due ?? null,
    method: (r.method ?? "autoclave") as SterilizationView["method"],
    notes: r.notes ?? "",
    batchNumber: r.batch_number ?? undefined,
    cycleNumber: r.cycle_number ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Dental: Installments
// ─────────────────────────────────────────────

export interface InstallmentView {
  id: string;
  treatmentPlanId: string;
  patientId: string;
  patientName: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: string;
}

interface InstallmentRaw {
  id: string;
  clinic_id: string;
  treatment_plan_id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

export async function fetchInstallments(clinicId: string): Promise<InstallmentView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<InstallmentRaw>("installments", {
    eq: [["clinic_id", clinicId]],
    order: ["due_date", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    treatmentPlanId: r.treatment_plan_id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    amount: r.amount,
    dueDate: r.due_date,
    paidDate: r.paid_date ?? undefined,
    status: r.status,
  }));
}

// ─────────────────────────────────────────────
// Dental: Before/After Photos
// ─────────────────────────────────────────────

export interface BeforeAfterPhotoView {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  description: string;
  beforeDate: string;
  afterDate: string | null;
  category: string;
}

export async function fetchBeforeAfterPhotos(clinicId: string, patientId?: string): Promise<BeforeAfterPhotoView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string;
    patient_id: string;
    treatment_plan_id: string | null;
    description: string | null;
    before_date: string | null;
    after_date: string | null;
    category: string | null;
  }>("before_after_photos", {
    eq,
    order: ["before_date", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    treatmentPlanId: r.treatment_plan_id ?? "",
    description: r.description ?? "",
    beforeDate: r.before_date ?? "",
    afterDate: r.after_date ?? null,
    category: r.category ?? "General",
  }));
}

