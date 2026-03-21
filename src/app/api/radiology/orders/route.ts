/**
 * POST /api/radiology/orders — Create a new radiology order
 * PATCH /api/radiology/orders — Update order status or save report
 *
 * POST body: { clinicId, patientId, modality, bodyPart?, clinicalIndication?, priority?, scheduledAt?, orderingDoctorId? }
 * PATCH body (status update): { orderId, action: "status", status }
 * PATCH body (save report): { orderId, action: "report", findings, impression, reportText, templateId?, radiologistId? }
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  createRadiologyOrder,
  updateRadiologyOrderStatus,
  saveRadiologyReport,
} from "@/lib/data/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinicId, patientId, modality, bodyPart, clinicalIndication, priority, scheduledAt, orderingDoctorId } = body;

    if (!clinicId || !patientId || !modality) {
      return NextResponse.json(
        { error: "clinicId, patientId, and modality are required" },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, action } = body;

    if (!orderId || !action) {
      return NextResponse.json(
        { error: "orderId and action are required" },
        { status: 400 },
      );
    }

    if (action === "status") {
      const { status } = body;
      if (!status) {
        return NextResponse.json(
          { error: "status is required for status update" },
          { status: 400 },
        );
      }
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
