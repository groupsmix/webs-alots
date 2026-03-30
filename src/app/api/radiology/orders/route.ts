/**
 * POST /api/radiology/orders — Create a new radiology order
 * PATCH /api/radiology/orders — Update order status or save report
 *
 * POST body: { patientId, modality, bodyPart?, clinicalIndication?, priority?, scheduledAt?, orderingDoctorId? }
 * clinic_id is derived from the authenticated user's profile.
 * PATCH body (status update): { orderId, action: "status", status }
 * PATCH body (save report): { orderId, action: "report", findings, impression, reportText, templateId?, radiologistId? }
 */

import {
  createRadiologyOrder,
  updateRadiologyOrderStatus,
  saveRadiologyReport,
} from "@/lib/data/server";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { radiologyOrderCreateSchema, radiologyOrderPatchSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";

export const POST = withAuthValidation(radiologyOrderCreateSchema, async (body, request, { profile }) => {
    const { patientId, modality, bodyPart, clinicalIndication, priority, scheduledAt, orderingDoctorId } = body;
    // Derive clinic_id from the authenticated user's profile — never from the request body
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("User must belong to a clinic");
    }

    const result = await createRadiologyOrder({
      clinic_id: clinicId,
      patient_id: patientId,
      ordering_doctor_id: orderingDoctorId,
      modality,
      body_part: bodyPart,
      clinical_indication: clinicalIndication,
      priority,
      scheduled_at: scheduledAt,
    });

    if (!result) {
      return apiInternalError("Failed to create order");
    }

    return apiSuccess(result, 201);
}, STAFF_ROLES);

export const PATCH = withAuthValidation(radiologyOrderPatchSchema, async (body, _request) => {
    const { orderId, action } = body;

    if (action === "status") {
      const { status } = body;
      const success = await updateRadiologyOrderStatus(orderId, status);
      if (!success) {
        return apiInternalError("Failed to update status");
      }
      return apiSuccess({ success: true });
    }

    if (action === "report") {
      const { findings, impression, reportText, templateId, radiologistId } = body;
      if (!findings && !impression && !reportText) {
        return apiError("At least one of findings, impression, or reportText is required");
      }
      const success = await saveRadiologyReport(orderId, {
        findings: findings ?? "",
        impression: impression ?? "",
        report_text: reportText ?? "",
        report_template_id: templateId,
        radiologist_id: radiologistId,
      });
      if (!success) {
        return apiInternalError("Failed to save report");
      }
      return apiSuccess({ success: true });
    }

    return apiError(`Unknown action: ${action}`);
}, STAFF_ROLES);
