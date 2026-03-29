/**
 * POST /api/radiology/orders — Create a new radiology order
 * PATCH /api/radiology/orders — Update order status or save report
 *
 * POST body: { patientId, modality, bodyPart?, clinicalIndication?, priority?, scheduledAt?, orderingDoctorId? }
 * clinic_id is derived from the authenticated user's profile.
 * PATCH body (status update): { orderId, action: "status", status }
 * PATCH body (save report): { orderId, action: "report", findings, impression, reportText, templateId?, radiologistId? }
 */

import { NextResponse } from "next/server";
import {
  createRadiologyOrder,
  updateRadiologyOrderStatus,
  saveRadiologyReport,
} from "@/lib/data/server";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { radiologyOrderCreateSchema, radiologyOrderPatchSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";

export const POST = withAuthValidation(radiologyOrderCreateSchema, async (body, request, { profile }) => {
    const { patientId, modality, bodyPart, clinicalIndication, priority, scheduledAt, orderingDoctorId } = body;
    // Derive clinic_id from the authenticated user's profile — never from the request body
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return NextResponse.json(
        { error: "User must belong to a clinic" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 },
      );
    }

    return NextResponse.json(result, { status: 201 });
}, STAFF_ROLES);

export const PATCH = withAuthValidation(radiologyOrderPatchSchema, async (body, request) => {
    const { orderId, action } = body;

    if (action === "status") {
      const { status } = body;
      const success = await updateRadiologyOrderStatus(orderId, status);
      if (!success) {
        return NextResponse.json(
          { error: "Failed to update status" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === "report") {
      const { findings, impression, reportText, templateId, radiologistId } = body;
      if (!findings && !impression && !reportText) {
        return NextResponse.json(
          { error: "At least one of findings, impression, or reportText is required" },
          { status: 400 },
        );
      }
      const success = await saveRadiologyReport(orderId, {
        findings: findings ?? "",
        impression: impression ?? "",
        report_text: reportText ?? "",
        report_template_id: templateId,
        radiologist_id: radiologistId,
      });
      if (!success) {
        return NextResponse.json(
          { error: "Failed to save report" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
}, STAFF_ROLES);
