"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

// Analysis Lab — Test Catalog
// ─────────────────────────────────────────────

export interface LabTestCatalogView {
  id: string;
  name: string;
  nameAr?: string;
  code?: string;
  category: string;
  sampleType: string;
  description?: string;
  price: number;
  currency: string;
  turnaroundHours: number;
  referenceRanges: { parameter: string; unit: string; min: number | null; max: number | null }[];
  isActive: boolean;
  sortOrder: number;
}

interface LabTestCatalogRaw {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  category: string;
  sample_type: string;
  description: string | null;
  price: number | null;
  currency: string;
  turnaround_hours: number;
  reference_ranges: { parameter: string; unit: string; min: number | null; max: number | null }[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

function mapLabTestCatalog(raw: LabTestCatalogRaw): LabTestCatalogView {
  return {
    id: raw.id,
    name: raw.name,
    nameAr: raw.name_ar ?? undefined,
    code: raw.code ?? undefined,
    category: raw.category,
    sampleType: raw.sample_type ?? "blood",
    description: raw.description ?? undefined,
    price: raw.price ?? 0,
    currency: raw.currency ?? "MAD",
    turnaroundHours: raw.turnaround_hours ?? 24,
    referenceRanges: raw.reference_ranges ?? [],
    isActive: raw.is_active ?? true,
    sortOrder: raw.sort_order ?? 0,
  };
}

export async function fetchLabTestCatalog(clinicId: string): Promise<LabTestCatalogView[]> {
  const rows = await fetchRows<LabTestCatalogRaw>("lab_test_catalog", {
    eq: [["clinic_id", clinicId]],
    order: ["sort_order", { ascending: true }],
  });
  return rows.map(mapLabTestCatalog);
}

// ─────────────────────────────────────────────
// Analysis Lab — Test Orders
// ─────────────────────────────────────────────

export interface LabTestOrderView {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorName?: string;
  assignedTechnicianName?: string;
  orderNumber: string;
  status: string;
  priority: string;
  clinicalNotes?: string;
  fastingRequired: boolean;
  sampleCollectedAt?: string;
  completedAt?: string;
  validatedAt?: string;
  pdfUrl?: string;
  tests: { id: string; testId: string; testName: string; status: string }[];
  testCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LabTestOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  assigned_technician_id: string | null;
  order_number: string;
  status: string;
  priority: string;
  clinical_notes: string | null;
  fasting_required: boolean;
  sample_collected_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

interface LabTestItemRaw {
  id: string;
  order_id: string;
  test_id: string;
  test_name: string;
  status: string;
}

export async function fetchLabTestOrders(clinicId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let items: LabTestItemRaw[] = [];
  if (orderIds.length > 0) {
    items = await fetchRows<LabTestItemRaw>("lab_test_items", {
      inFilter: ["order_id", orderIds],
    });
  }
  const itemsByOrder = new Map<string, LabTestItemRaw[]>();
  for (const item of items) {
    const arr = itemsByOrder.get(item.order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_activeUserMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    assignedTechnicianName: r.assigned_technician_id ? (_activeUserMap?.get(r.assigned_technician_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    status: r.status,
    priority: r.priority,
    clinicalNotes: r.clinical_notes ?? undefined,
    fastingRequired: r.fasting_required ?? false,
    sampleCollectedAt: r.sample_collected_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    validatedAt: r.validated_at ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    tests: (itemsByOrder.get(r.id) ?? []).map((ti) => ({
      id: ti.id,
      testId: ti.test_id,
      testName: ti.test_name,
      status: ti.status,
    })),
    testCount: (itemsByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

export async function fetchPatientLabOrders(clinicId: string, patientId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let items: LabTestItemRaw[] = [];
  if (orderIds.length > 0) {
    items = await fetchRows<LabTestItemRaw>("lab_test_items", {
      inFilter: ["order_id", orderIds],
    });
  }
  const itemsByOrder = new Map<string, LabTestItemRaw[]>();
  for (const item of items) {
    const arr = itemsByOrder.get(item.order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_activeUserMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    assignedTechnicianName: r.assigned_technician_id ? (_activeUserMap?.get(r.assigned_technician_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    status: r.status,
    priority: r.priority,
    clinicalNotes: r.clinical_notes ?? undefined,
    fastingRequired: r.fasting_required ?? false,
    sampleCollectedAt: r.sample_collected_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    validatedAt: r.validated_at ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    tests: (itemsByOrder.get(r.id) ?? []).map((ti) => ({
      id: ti.id,
      testId: ti.test_id,
      testName: ti.test_name,
      status: ti.status,
    })),
    testCount: (itemsByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Analysis Lab — Test Results
// ─────────────────────────────────────────────

export interface LabTestResultView {
  id: string;
  orderId: string;
  testItemId: string;
  testName: string;
  parameterName: string;
  value: string;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: string | null;
  notes?: string;
  enteredBy?: string;
  enteredAt: string;
}

interface LabTestResultRaw {
  id: string;
  order_id: string;
  test_item_id: string;
  parameter_name: string;
  value: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  flag: string | null;
  notes: string | null;
  entered_by: string | null;
  entered_at: string;
}

export async function fetchLabTestResults(orderId: string): Promise<LabTestResultView[]> {
  const rows = await fetchRows<LabTestResultRaw>("lab_test_results", {
    eq: [["order_id", orderId]],
    order: ["entered_at", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    testItemId: r.test_item_id,
    testName: r.parameter_name,
    parameterName: r.parameter_name,
    value: r.value ?? "",
    unit: r.unit ?? "",
    referenceMin: r.reference_min,
    referenceMax: r.reference_max,
    flag: r.flag,
    notes: r.notes ?? undefined,
    enteredBy: r.entered_by ?? undefined,
    enteredAt: r.entered_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Analysis Lab — Mutations
// ─────────────────────────────────────────────

export async function createLabTestOrder(data: {
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id?: string;
  assigned_technician_id?: string;
  priority?: string;
  clinical_notes?: string;
  fasting_required?: boolean;
  test_ids?: string[];
}): Promise<string | null> {
  const supabase = createClient();
  const orderNumber = `LAB-${Date.now().toString(36).toUpperCase()}`;
  const { data: result, error } = await supabase.from("lab_test_orders")
    .insert({
      clinic_id: data.clinic_id,
      patient_id: data.patient_id,
      ordering_doctor_id: data.ordering_doctor_id ?? null,
      assigned_technician_id: data.assigned_technician_id ?? null,
      order_number: orderNumber,
      status: "pending",
      priority: data.priority ?? "normal",
      clinical_notes: data.clinical_notes ?? null,
      fasting_required: data.fasting_required ?? false,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  const orderId = result?.id as string;
  // Insert test items if provided
  if (data.test_ids && data.test_ids.length > 0 && orderId) {
    const catalog = await fetchLabTestCatalog(data.clinic_id);
    const catalogMap = new Map(catalog.map((c) => [c.id, c.name]));
    const items = data.test_ids.map((testId) => ({
      order_id: orderId,
      test_id: testId,
      test_name: catalogMap.get(testId) ?? "Test",
      status: "pending",
    }));
    await supabase.from("lab_test_items").insert(items);
  }
  return orderId;
}

export async function updateLabOrderStatus(
  orderId: string,
  status: string,
): Promise<boolean> {
  const supabase = createClient();
  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "sample_collected") {
    updateData.sample_collected_at = new Date().toISOString();
  } else if (status === "completed") {
    updateData.completed_at = new Date().toISOString();
  } else if (status === "validated") {
    updateData.validated_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("lab_test_orders")
    .update(updateData)
    .eq("id", orderId);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function assignLabTechnician(
  orderId: string,
  technicianId: string | null,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lab_test_orders")
    .update({
      assigned_technician_id: technicianId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function saveLabTestResult(data: {
  order_id: string;
  test_item_id: string;
  parameter_name: string;
  value: string;
  unit?: string;
  reference_min?: number;
  reference_max?: number;
  flag?: string;
  notes?: string;
  entered_by?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("lab_test_results")
    .insert({
      order_id: data.order_id,
      test_item_id: data.test_item_id,
      parameter_name: data.parameter_name,
      value: data.value,
      unit: data.unit ?? null,
      reference_min: data.reference_min ?? null,
      reference_max: data.reference_max ?? null,
      flag: data.flag ?? "normal",
      notes: data.notes ?? null,
      entered_by: data.entered_by ?? null,
      entered_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateLabTestResult(
  resultId: string,
  data: Partial<{
    value: string;
    unit: string;
    reference_min: number | null;
    reference_max: number | null;
    flag: string;
    notes: string | null;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lab_test_results")
    .update(data as Database["public"]["Tables"]["lab_test_results"]["Update"])
    .eq("id", resultId);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function updateLabOrderPdfUrl(
  orderId: string,
  pdfUrl: string,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lab_test_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
