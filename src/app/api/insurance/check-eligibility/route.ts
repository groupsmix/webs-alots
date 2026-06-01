/**
 * POST /api/insurance/check-eligibility
 *
 * Verify a patient's insurance coverage before treatment.
 *
 * Body: {
 *   patient_id: string,
 *   policy_number: string,
 *   insurance_type: "AMO" | "CNOPS" | "CNSS" | "RAMED" | "private"
 * }
 */

import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuthValidation } from "@/lib/api-validate";
import { checkEligibility, type MoroccanInsuranceType } from "@/lib/insurance/client";

const eligibilitySchema = z.object({
  patient_id: z.string().uuid(),
  policy_number: z.string().min(3).max(50),
  insurance_type: z.enum(["AMO", "CNOPS", "CNSS", "RAMED", "private"]),
});

export const POST = withAuthValidation(
  eligibilitySchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const { patient_id, policy_number, insurance_type } = body;

    // Verify patient belongs to this clinic
    const { data: patient, error: patientError } = await supabase
      // nosemgrep: tenant-scoping
      .from("users")
      .select("id, clinic_id")
      .eq("id", patient_id)
      .eq("clinic_id", clinicId)
      .single();

    if (patientError || !patient) {
      return apiError("Patient non trouvé", 404, "NOT_FOUND");
    }

    const result = await checkEligibility(policy_number, insurance_type as MoroccanInsuranceType);

    await logAuditEvent({
      supabase,
      action: "insurance.eligibility_check",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Vérification éligibilité assurance ${insurance_type} pour patient ${patient_id}`,
      metadata: {
        patient_id,
        insurance_type,
        eligible: result.eligible,
        coverage_pct: result.coveragePercentage,
      },
    });

    return apiSuccess({ eligibility: result });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);
