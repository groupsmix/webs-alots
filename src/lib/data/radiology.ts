"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/lib/types/database";

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
  // Explicit field mapping (no `...data` spread) to prevent mass-assignment of
  // unintended columns — AGENTS.md rule #7. clinic_id is set from the validated
  // tenant context passed in by the caller.
  const { data: row, error } = await supabase
    .from("radiology_orders")
    .insert({
      clinic_id: data.clinic_id,
      patient_id: data.patient_id,
      ordering_doctor_id: data.ordering_doctor_id,
      modality: data.modality,
      body_part: data.body_part,
      clinical_indication: data.clinical_indication,
      scheduled_at: data.scheduled_at,
      order_number: orderNumber,
      status: "pending",
      priority: data.priority ?? "normal",
    })
    .select("id, order_number")
    .single();
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
    return null;
  }
  return row as { id: string; order_number: string };
}

export async function updateRadiologyOrderStatus(
  orderId: string,
  status: string,
  clinicId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "in_progress") {
    updateData.performed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("radiology_orders")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updateData as any)
    .eq("clinic_id", clinicId)
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
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
  clinicId: string,
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
    .eq("clinic_id", clinicId)
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
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
  // Explicit field mapping (no `...data` spread) to prevent mass-assignment of
  // unintended columns — AGENTS.md rule #7. clinic_id is included from the
  // validated tenant context.
  const { data: row, error } = await supabase
    .from("radiology_images")
    .insert({
      order_id: data.order_id,
      clinic_id: data.clinic_id,
      file_url: data.file_url,
      file_name: data.file_name,
      file_size: data.file_size,
      content_type: data.content_type,
      modality: data.modality,
      is_dicom: data.is_dicom ?? false,
      dicom_metadata: data.dicom_metadata ?? {},
      thumbnail_url: data.thumbnail_url,
      description: data.description,
      uploaded_by: data.uploaded_by,
    } as Database["public"]["Tables"]["radiology_images"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
    return null;
  }
  return row as { id: string };
}

export async function updateRadiologyOrderPdfUrl(
  orderId: string,
  pdfUrl: string,
  clinicId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("radiology_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
    return false;
  }
  return true;
}
