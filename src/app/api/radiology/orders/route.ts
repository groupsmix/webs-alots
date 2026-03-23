/**
 * POST /api/radiology/orders — Create a new radiology order
 * PATCH /api/radiology/orders — Update order status or save report
 *
 * POST body: { clinicId, patientId, modality, bodyPart?, clinicalIndication?, priority?, scheduledAt?, orderingDoctorId? }
 * PATCH body (status update): { orderId, action: "status", status }
 * PATCH body (save report): { orderId, action: "report", findings, impression, reportText, templateId?, radiologistId? }
 */

import { NextResponse } from "next/server";
import {
  createRadiologyOrder,
  updateRadiologyOrderStatus,
  saveRadiologyReport,
} from "@/lib/data/server";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { radiologyOrderCreateSchema, radiologyOrderPatchSchema, safeParse } from "@/lib/validations";

export const POST = withAuth(async (request) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(radiologyOrderCreateSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { clinicId, patientId, modality, bodyPart, clinicalIndication, priority, scheduledAt, orderingDoctorId } = parsed.data;

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
  } catch (err) {
    logger.warn("Operation failed", { context: "radiology/orders", error: err });
    return NextResponse.json({ error: "Failed to create radiology order" }, { status: 500 });
  }
}, STAFF_ROLES);

export const PATCH = withAuth(async (request) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(radiologyOrderPatchSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
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
  } catch (err) {
    logger.warn("Operation failed", { context: "radiology/orders", error: err });
    return NextResponse.json({ error: "Failed to update radiology order" }, { status: 500 });
  }
}, STAFF_ROLES);
