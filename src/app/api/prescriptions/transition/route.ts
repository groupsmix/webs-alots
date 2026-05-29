/**
 * POST /api/prescriptions/transition
 *
 * Transition a prescription through its lifecycle workflow.
 * Validates the transition is allowed, updates the status, and
 * logs the change to the audit trail.
 *
 * Access: clinic_admin, doctor, pharmacist roles
 * Tenant-scoped via requireTenant().
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { requireTenant } from "@/lib/tenant";
import { prescriptionTransitionSchema } from "@/lib/validations/fhir";
import type { AuthContext } from "@/lib/with-auth";
import { transitionPrescription } from "@/modules/prescription/workflow";
import type { PrescriptionStatus } from "@/modules/prescription/workflow";

export const POST = withAuthValidation(
  prescriptionTransitionSchema,
  async (
    data: {
      prescription_id: string;
      new_status: string;
      reason?: string;
      pharmacist_notes?: string;
    },
    _request: NextRequest,
    auth: AuthContext,
  ) => {
    const tenant = await requireTenant();

    const result = await transitionPrescription(auth.supabase, {
      clinicId: tenant.clinicId,
      prescriptionId: data.prescription_id,
      newStatus: data.new_status as PrescriptionStatus,
      actorId: auth.user.id,
      reason: data.reason,
      pharmacistNotes: data.pharmacist_notes,
    });

    if (!result.ok) {
      return apiError(result.error ?? "Erreur de transition", 422, "TRANSITION_FAILED");
    }

    return apiSuccess({ transitioned: true, new_status: data.new_status });
  },
  ["super_admin", "clinic_admin", "doctor"],
);
