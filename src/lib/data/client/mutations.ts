"use client";

import { clearLookupCache, type MutationResult } from "./_core";
export type { MutationResult } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────


export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
): Promise<MutationResult<{ id: string; status: string }>> {
  const supabase = createClient();
  // Explicit mapping from UI status names to DB column values (Issue 40).
  // Using a lookup object instead of fragile string replace.
  const STATUS_MAP: Record<string, string> = {
    "no-show": "no_show",
    "in-progress": "in_progress",
    "checked-in": "checked_in",
    "follow-up": "follow_up",
  };
  const dbStatus = STATUS_MAP[status] ?? status;
  const updateData: Database["public"]["Tables"]["appointments"]["Update"] = { status: dbStatus };
  if (dbStatus === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }
  // Issue 45: Return updated entity data via .select()
  const { data: updated, error } = await supabase
    .from("appointments")
    .update(updateData)
    .eq("id", appointmentId)
    .select("id, status")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  clearLookupCache();
  return { success: true, data: { id: updated.id, status: updated.status } };
}

export async function createPayment(data: {
  clinic_id: string;
  patient_id: string;
  appointment_id?: string;
  amount: number;
  method?: string;
  status?: string;
}): Promise<MutationResult<{ id: string }>> {
  const supabase = createClient();
  const { data: created, error } = await supabase.from("payments").insert({
    ...data,
    status: data.status ?? "completed",
    payment_type: "full",
    refunded_amount: 0,
  }).select("id").single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  clearLookupCache();
  return { success: true, data: { id: created.id } };
}

export async function upsertReview(data: {
  clinic_id: string;
  patient_id: string;
  stars: number;
  comment?: string;
}): Promise<MutationResult<{ id: string }>> {
  const supabase = createClient();
  const { data: created, error } = await supabase.from("reviews").insert(data).select("id").single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  clearLookupCache();
  return { success: true, data: { id: created.id } };
}

export async function updateReviewResponse(reviewId: string, response: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("reviews").update({ response }).eq("id", reviewId);
  if (!error) clearLookupCache();
  return !error;
}

export async function createPrescription(data: {
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  items: { name: string; dosage: string; duration: string }[];
  notes?: string;
  appointment_id?: string;
}): Promise<MutationResult<{ id: string }>> {
  const supabase = createClient();
  // Issue 45: Return created entity data via .select()
  const { data: created, error } = await supabase.from("prescriptions").insert(data).select("id").single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  return { success: true, data: { id: created.id } };
}

export async function updatePrescription(
  id: string,
  data: {
    items?: { name: string; dosage: string; duration: string }[];
    notes?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("prescriptions").update(data).eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Consultation Notes Mutations
// ─────────────────────────────────────────────

export async function createConsultationNote(data: {
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_id: string;
  diagnosis?: string;
  notes?: string;
  content?: Record<string, unknown>;
  is_private?: boolean;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("consultation_notes")
    .insert(data as Database["public"]["Tables"]["consultation_notes"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateConsultationNote(
  id: string,
  data: {
    diagnosis?: string;
    notes?: string;
    content?: Record<string, unknown>;
    is_private?: boolean;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("consultation_notes")
    .update({ ...data, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["consultation_notes"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteConsultationNote(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("consultation_notes").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Odontogram Mutations
// ─────────────────────────────────────────────

export async function upsertOdontogramEntry(data: {
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  status: string;
  notes?: string;
  dentition?: "adult" | "child";
}): Promise<MutationResult<{ id: string }>> {
  const supabase = createClient();
  // Issue 45: Return created/updated entity data via .select()
  const { data: created, error } = await supabase.from("odontogram").upsert(data, {
    onConflict: "clinic_id,patient_id,tooth_number",
  }).select("id").single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  return { success: true, data: { id: created.id } };
}

export async function deleteOdontogramEntry(
  clinicId: string,
  patientId: string,
  toothNumber: number,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("odontogram")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("tooth_number", toothNumber);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Treatment Plan Mutations
// ─────────────────────────────────────────────

export async function createTreatmentPlan(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: { step: number; description: string; status: string; date: string | null; cost: number; toothNumbers?: number[] }[];
  total_cost: number;
  status?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("treatment_plans")
    .insert({ ...data, status: data.status ?? "planned" })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateTreatmentPlan(
  id: string,
  data: {
    title?: string;
    steps?: { step: number; description: string; status: string; date: string | null; cost: number; toothNumbers?: number[] }[];
    total_cost?: number;
    status?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("treatment_plans")
    .update({ ...data, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["treatment_plans"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Sterilization Log Mutations
// ─────────────────────────────────────────────

export async function createSterilizationEntry(data: {
  clinic_id: string;
  tool_name: string;
  sterilized_by?: string;
  method?: string;
  notes?: string;
  next_due?: string;
  batch_number?: string;
  cycle_number?: number;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("sterilization_log")
    .insert({ ...data, sterilized_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateSterilizationEntry(
  id: string,
  data: {
    tool_name?: string;
    method?: string;
    notes?: string;
    next_due?: string;
    batch_number?: string;
    cycle_number?: number;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("sterilization_log").update(data as Database["public"]["Tables"]["sterilization_log"]["Update"]).eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Before/After Photo Mutations
// ─────────────────────────────────────────────

export async function createBeforeAfterPhoto(data: {
  clinic_id: string;
  patient_id: string;
  treatment_plan_id?: string;
  description?: string;
  category?: string;
  before_image_url?: string;
  after_image_url?: string;
  before_date?: string;
  after_date?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("before_after_photos")
    .insert(data)
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateBeforeAfterPhoto(
  id: string,
  data: {
    description?: string;
    category?: string;
    before_image_url?: string;
    after_image_url?: string;
    after_date?: string;
  },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("before_after_photos")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteBeforeAfterPhoto(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("before_after_photos").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

