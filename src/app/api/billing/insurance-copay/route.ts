import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { calculateInsuranceCoPay } from "@/lib/billing/insurance-copay";
import { insuranceCoPaySchema } from "@/lib/validations/billing";

/**
 * POST /api/billing/insurance-copay
 *
 * Calculate the patient co-pay and insurance-covered portions for a
 * Moroccan clinic invoice. Supports CNSS, CNOPS, CMIM, AMO and RAMED.
 *
 * Body:
 *   - total_amount: number (in MAD, e.g. 250.00)
 *   - policy_number: string
 *   - insurance_type: "CNSS" | "CNOPS" | "CMIM" | "AMO" | "RAMED" | "private" | "none"
 */
export const POST = withAuthValidation(
  insuranceCoPaySchema,
  async (body, _request, { profile }) => {
    if (!profile.clinic_id) {
      return apiError("Clinic context required", 403);
    }

    const result = await calculateInsuranceCoPay({
      totalAmount: body.total_amount,
      policyNumber: body.policy_number,
      insuranceType: body.insurance_type,
      clinicId: profile.clinic_id,
    });

    return apiSuccess(result);
  },
  STAFF_ROLES,
);
