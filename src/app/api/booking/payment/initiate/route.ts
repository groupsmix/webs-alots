import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";
import type { UserRole } from "@/lib/types/database";

export const runtime = "edge";

const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];

/**
 * POST /api/booking/payment/initiate
 *
 * Initiate a payment for an appointment.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
    }

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

    // Find or create patient
    let patientId = body.patientId;
    if (patientId.startsWith("patient-")) {
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", clinicConfig.clinicId)
        .eq("name", body.patientName)
        .eq("role", "patient")
        .limit(1)
        .single();

      if (existing) {
        patientId = existing.id;
      } else {
        const { data: newPatient } = await supabase
          .from("users")
          .insert({
            clinic_id: clinicConfig.clinicId,
            name: body.patientName,
            role: "patient",
          })
          .select("id")
          .single();
        if (newPatient) patientId = newPatient.id;
      }
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
      return NextResponse.json({ error: insertError?.message ?? "Failed to initiate payment" }, { status: 500 });
    }

    return NextResponse.json({
      status: "initiated",
      message: "Payment initiated",
      paymentId: payment.id,
      gatewaySessionId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}
