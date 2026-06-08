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
  const { data: row, error } = await supabase
    .from("radiology_orders")
    .insert({
      ...data,
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
): Promise<boolean> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "in_progress") {
    updateData.performed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("radiology_orders")
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    .update(updateData)
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
  const { data: row, error } = await supabase
    .from("radiology_images")
    .insert({
      ...data,
      is_dicom: data.is_dicom ?? false,
      dicom_metadata: data.dicom_metadata ?? {},
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
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("radiology_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/radiology", error });
    return false;
  }
  return true;
}
