/**
 * POST /api/insurance/submit-claim
 *
 * Submit an insurance claim for a completed appointment.
 * Records the claim in the insurance_claims table and submits to the insurer.
 *
 * Body: {
 *   appointment_id: string,
 *   policy_number: string,
 *   insurance_type: "AMO" | "CNOPS" | "CNSS" | "RAMED" | "private",
 *   amount_centimes: number,       — total billed amount in MAD centimes
 *   diagnosis_code?: string,       — ICD-10 diagnosis code
 *   procedure_codes?: string[]
 * }
 */

import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { submitClaim, type MoroccanInsuranceType } from "@/lib/insurance/client";
import { logger } from "@/lib/logger";

const submitClaimSchema = z.object({
  appointment_id: z.string().uuid(),
  policy_number: z.string().min(3).max(50),
  insurance_type: z.enum(["AMO", "CNOPS", "CNSS", "RAMED", "private"]),
  amount_centimes: z.number().int().positive().max(10_000_000_00), // 10M MAD max
  diagnosis_code: z.string().max(20).optional(),
  procedure_codes: z.array(z.string().max(20)).max(20).optional(),
});

export const POST = withAuthValidation(
  submitClaimSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const {
      appointment_id,
      policy_number,
      insurance_type,
      amount_centimes,
      diagnosis_code,
      procedure_codes,
    } = body;

    // Fetch appointment details — scoped to clinic
    const { data: appointment, error: apptError } = await supabase
      // nosemgrep: tenant-scoping
      .from("appointments")
      .select("id, patient_id, doctor_id, status, slot_start")
      .eq("clinic_id", clinicId)
      .eq("id", appointment_id)
      .single();

    if (apptError || !appointment) {
      return apiError("Rendez-vous non trouvé", 404, "NOT_FOUND");
    }

    if (appointment.status !== "completed") {
      return apiError(
        "La demande ne peut être soumise que pour des rendez-vous complétés",
        400,
        "INVALID_APPOINTMENT_STATUS",
      );
    }

    // Fetch doctor and patient names for the claim
    const [{ data: doctor }, { data: patient }] = await Promise.all([
      supabase
        // nosemgrep: tenant-scoping
        .from("users")
        .select("full_name")
        .eq("id", appointment.doctor_id)
        .eq("clinic_id", clinicId)
        .single(),
      supabase
        // nosemgrep: tenant-scoping
        .from("users")
        .select("full_name")
        .eq("id", appointment.patient_id)
        .eq("clinic_id", clinicId)
        .single(),
    ]);

    // Submit to insurer
    const claimResult = await submitClaim({
      policyNumber: policy_number,
      insuranceType: insurance_type as MoroccanInsuranceType,
      amountCentimes: amount_centimes,
      diagnosisCode: diagnosis_code,
      procedureCodes: procedure_codes,
      appointmentDate: appointment.slot_start,
      doctorName: (doctor as { full_name?: string | null } | null)?.full_name ?? "Médecin",
      patientName: (patient as { full_name?: string | null } | null)?.full_name ?? "Patient",
    });

    if (!claimResult.success) {
      return apiError(
        claimResult.rejectionReason ?? "Échec de soumission de la demande",
        502,
        "CLAIM_REJECTED",
      );
    }

    // Persist the claim in our database
    const { data: claim, error: insertError } = await supabase
      .from("insurance_claims")
      .insert({
        clinic_id: clinicId,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        appointment_id,
        insurance_type,
        policy_number,
        claim_number: claimResult.claimNumber ?? null,
        amount_claimed: amount_centimes,
        amount_approved: claimResult.approvedAmountCentimes ?? null,
        currency: "MAD",
        status: "submitted",
      })
      .select()
      .single();

    if (insertError) {
      // Log but don't fail — the claim WAS submitted to the insurer
      logger.error("Failed to persist insurance claim to DB", {
        context: "insurance/submit-claim",
        error: insertError,
        claim_number: claimResult.claimNumber,
      });
    }

    await logAuditEvent({
      supabase,
      action: "insurance.claim_submitted",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Demande ${insurance_type} soumise — ${claimResult.claimNumber}`,
      metadata: {
        appointment_id,
        insurance_type,
        claim_number: claimResult.claimNumber,
        amount_claimed: amount_centimes,
        amount_approved: claimResult.approvedAmountCentimes,
      },
    });

    return apiSuccess(
      {
        claim: {
          ...claimResult,
          db_record: claim ?? null,
        },
      },
      201,
    );
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
