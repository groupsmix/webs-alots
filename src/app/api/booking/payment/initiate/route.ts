import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { clinicConfig } from "@/config/clinic.config";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";

export const runtime = "edge";

/**
 * POST /api/booking/payment/initiate
 *
 * Initiate a payment for an appointment.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const body = (await request.json()) as {
      appointmentId: string;
      patientId: string;
      patientName: string;
      amount: number;
      paymentType: "deposit" | "full";
      method?: "cash" | "card" | "online" | "insurance";
    };

    if (!body.appointmentId || !body.patientId || !body.patientName || !body.paymentType) {
      return NextResponse.json(
        { error: "appointmentId, patientId, patientName, amount, and paymentType are required" },
        { status: 400 },
      );
    }

    // Input length validation to prevent DoS via oversized payloads
    if (body.patientName.length > 200) {
      return NextResponse.json({ error: "Patient name exceeds maximum allowed length" }, { status: 400 });
    }

    // Validate payment amount is a positive finite number
    if (
      typeof body.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 },
      );
    }

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
      console.error("[POST /api/booking/payment/initiate] Insert error:", insertError?.message);
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
    console.error("[POST /api/booking/payment/initiate] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}, STAFF_ROLES);
