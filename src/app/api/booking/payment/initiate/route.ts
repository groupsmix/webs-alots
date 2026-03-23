import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { clinicConfig } from "@/config/clinic.config";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { paymentInitiateSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

/**
 * POST /api/booking/payment/initiate
 *
 * Initiate a payment for an appointment.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(paymentInitiateSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    // Verify the appointment exists
    const { data: appt, error: apptError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check for existing active payment on this appointment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("appointment_id", body.appointmentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .not("status", "in", '("refunded","failed")')
      .limit(1)
      .single();

    if (existingPayment) {
      return NextResponse.json({ error: "A payment already exists for this appointment" }, { status: 400 });
    }

    // Find or create patient using shared utility (prefers phone-based lookup
    // over name-based to avoid assigning payments to the wrong patient).
    const patientId = await findOrCreatePatient(
      supabase, clinicConfig.clinicId, body.patientId, body.patientName,
    );
    if (!patientId) {
      return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
    }

    const method = body.method ?? "online";
    const gatewaySessionId = method === "online" ? crypto.randomUUID() : null;

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        clinic_id: clinicConfig.clinicId,
        appointment_id: body.appointmentId,
        patient_id: patientId,
        amount: body.amount,
        method,
        status: "pending",
        payment_type: body.paymentType,
        gateway_session_id: gatewaySessionId,
        refunded_amount: 0,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      // Handle unique constraint violation (duplicate active payment)
      if (insertError?.code === "23505") {
        return NextResponse.json(
          { error: "A payment already exists for this appointment" },
          { status: 409 },
        );
      }
      void insertError;
      return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
    }

    await logAuditEvent({
      supabase,
      action: "payment_initiated",
      type: "payment",
      clinicId: clinicConfig.clinicId,
      description: `Payment initiated: ${body.paymentType} ${body.amount} via ${method} for appointment ${body.appointmentId}`,
    });

    return NextResponse.json({
      status: "initiated",
      message: "Payment initiated",
      paymentId: payment.id,
      gatewaySessionId,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}, STAFF_ROLES);
