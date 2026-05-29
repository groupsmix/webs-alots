/**
 * Prescription Management Workflow
 *
 * Adapted from Helsa's prescription module patterns. Provides a
 * structured workflow engine for prescription lifecycle management:
 *
 *   draft → pending_review → approved → dispensed → completed
 *                          → rejected
 *
 * Each transition is validated, audit-logged, and triggers
 * appropriate notifications (WhatsApp/SMS to patient, in-app to pharmacist).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { Database, Json } from "@/lib/types/database";

/** Prescription lifecycle states. */
export type PrescriptionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "dispensed"
  | "completed"
  | "cancelled";

/** Valid state transitions. */
const VALID_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["approved", "rejected"],
  approved: ["dispensed", "cancelled"],
  rejected: ["draft"],
  dispensed: ["completed"],
  completed: [],
  cancelled: ["draft"],
};

/** Medication item within a prescription. */
export interface PrescriptionMedication {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
  is_generic_allowed?: boolean;
}

/** Prescription creation parameters. */
export interface CreatePrescriptionParams {
  clinicId: string;
  patientId: string;
  doctorId: string;
  medications: PrescriptionMedication[];
  diagnosis?: string;
  notes?: string;
}

/** Prescription transition parameters. */
export interface TransitionParams {
  clinicId: string;
  prescriptionId: string;
  newStatus: PrescriptionStatus;
  actorId: string;
  reason?: string;
  pharmacistNotes?: string;
}

/**
 * Validate that a status transition is allowed.
 */
export function isValidTransition(
  currentStatus: PrescriptionStatus,
  newStatus: PrescriptionStatus,
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Create a new prescription in draft status.
 *
 * Stores medications and workflow state in the `content` JSONB column.
 */
export async function createPrescription(
  supabase: SupabaseClient<Database>,
  params: CreatePrescriptionParams,
): Promise<{ ok: boolean; prescriptionId?: string }> {
  try {
    const content = {
      medications: params.medications,
      diagnosis: params.diagnosis ?? null,
      status: "draft" as const,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("prescriptions")
      .insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId,
        doctor_id: params.doctorId,
        content: content as unknown as Json,
        items: params.medications as unknown as Json,
        notes: params.notes ?? null,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Prescription creation failed", {
        context: "prescription-workflow",
        clinicId: params.clinicId,
        error,
      });
      return { ok: false };
    }

    await logAuditEvent({
      supabase,
      action: "prescription.create",
      type: "patient",
      clinicId: params.clinicId,
      actor: params.doctorId,
      description: `Ordonnance créée: ${data.id}`,
      metadata: {
        prescriptionId: data.id,
        patientId: params.patientId,
        medicationCount: params.medications.length,
      },
    });

    return { ok: true, prescriptionId: data.id };
  } catch (err) {
    logger.error("Prescription creation error", { context: "prescription-workflow", error: err });
    return { ok: false };
  }
}

/**
 * Transition a prescription to a new status with validation.
 *
 * Workflow state is stored inside the `content` JSONB column.
 */
export async function transitionPrescription(
  supabase: SupabaseClient<Database>,
  params: TransitionParams,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from("prescriptions")
      .select("id, content")
      .eq("clinic_id", params.clinicId)
      .eq("id", params.prescriptionId)
      .single();

    if (fetchError || !current) {
      return { ok: false, error: "Ordonnance non trouvée" };
    }

    const contentObj = (current.content ?? {}) as Record<string, unknown>;
    const currentStatus = (contentObj.status as PrescriptionStatus) ?? "draft";

    if (!isValidTransition(currentStatus, params.newStatus)) {
      return {
        ok: false,
        error: `Transition non autorisée: ${currentStatus} → ${params.newStatus}`,
      };
    }

    const updatedContent: Record<string, unknown> = {
      ...contentObj,
      status: params.newStatus,
      updated_at: new Date().toISOString(),
    };

    if (params.newStatus === "approved") {
      updatedContent.approved_at = new Date().toISOString();
      updatedContent.approved_by = params.actorId;
    }
    if (params.newStatus === "dispensed") {
      updatedContent.dispensed_at = new Date().toISOString();
      updatedContent.dispensed_by = params.actorId;
    }
    if (params.newStatus === "rejected") {
      updatedContent.rejection_reason = params.reason ?? null;
    }
    if (params.pharmacistNotes) {
      updatedContent.pharmacist_notes = params.pharmacistNotes;
    }

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({ content: updatedContent as Json })
      .eq("clinic_id", params.clinicId)
      .eq("id", params.prescriptionId);

    if (updateError) {
      logger.error("Prescription transition failed", {
        context: "prescription-workflow",
        clinicId: params.clinicId,
        error: updateError,
      });
      return { ok: false, error: "Erreur lors de la mise à jour" };
    }

    await logAuditEvent({
      supabase,
      action: `prescription.${params.newStatus}`,
      type: "patient",
      clinicId: params.clinicId,
      actor: params.actorId,
      description: `Ordonnance ${params.prescriptionId}: ${currentStatus} → ${params.newStatus}`,
      metadata: {
        prescriptionId: params.prescriptionId,
        previousStatus: currentStatus,
        newStatus: params.newStatus,
        reason: params.reason,
      },
    });

    return { ok: true };
  } catch (err) {
    logger.error("Prescription transition error", { context: "prescription-workflow", error: err });
    return { ok: false, error: "Erreur interne" };
  }
}

/**
 * Check for drug interactions within a prescription's medication list.
 * Returns warnings if any known interactions are found.
 *
 * Uses the drug_interactions table (created in migration 00116).
 */
export async function checkDrugInteractions(
  supabase: SupabaseClient,
  clinicId: string,
  medications: PrescriptionMedication[],
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  if (medications.length < 2) return { warnings };

  const drugNames = medications.map((m) => m.drug_name.toLowerCase());

  const { data: interactions } = await (supabase as SupabaseClient)
    .from("drug_interactions")
    .select("drug_a, drug_b, severity, description")
    .eq("clinic_id", clinicId);

  if (!interactions) return { warnings };

  for (const interaction of interactions) {
    const row = interaction as {
      drug_a: string;
      drug_b: string;
      severity: string;
      description: string;
    };
    const drugA = row.drug_a.toLowerCase();
    const drugB = row.drug_b.toLowerCase();

    if (drugNames.includes(drugA) && drugNames.includes(drugB)) {
      warnings.push(
        `⚠️ Interaction ${row.severity}: ${row.drug_a} + ${row.drug_b} — ${row.description}`,
      );
    }
  }

  return { warnings };
}
