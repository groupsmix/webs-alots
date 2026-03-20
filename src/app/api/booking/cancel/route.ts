import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

export const runtime = "edge";

/**
 * POST /api/booking/cancel
 *
 * Cancel an appointment if within the cancellation window.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { appointmentId: string; reason?: string };

    if (!body.appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the appointment
    const { data: appt, error: fetchError } = await supabase
      .from("appointments")
      .select("id, doctor_id, appointment_date, start_time, status")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (appt.status === "cancelled" || appt.status === "completed" || appt.status === "rescheduled") {
      return NextResponse.json(
        { error: "Appointment cannot be cancelled in its current state" },
        { status: 400 },
      );
    }

    // Check cancellation window
    const appointmentDateTime = new Date(`${appt.appointment_date}T${appt.start_time}`);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const cancellationWindowHours = clinicConfig.booking.cancellationHours;

    if (hoursUntilAppt < cancellationWindowHours) {
      return NextResponse.json(
        {
          error: `Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`,
        },
        { status: 400 },
      );
    }

    // Cancel the appointment
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: body.reason ?? "Cancelled by patient",
      })
      .eq("id", body.appointmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Promote the first waiting-list entry for the freed slot
    const { data: candidate } = await supabase
      .from("waiting_list")
      .select("id")
      .eq("clinic_id", clinicConfig.clinicId)
      .eq("doctor_id", appt.doctor_id)
      .eq("preferred_date", appt.appointment_date)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (candidate) {
      await supabase
        .from("waiting_list")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", candidate.id);
    }

    return NextResponse.json({ status: "cancelled", message: "Appointment cancelled successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
  }
}

/**
 * GET /api/booking/cancel?appointmentId=...
 *
 * Check if an appointment can be cancelled.
 */
export async function GET(request: NextRequest) {
  const appointmentId = request.nextUrl.searchParams.get("appointmentId");

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicConfig.clinicId)
    .single();

  if (error || !appt) {
    return NextResponse.json({ canCancel: false, reason: "Appointment not found" });
  }

  if (appt.status === "cancelled" || appt.status === "completed" || appt.status === "rescheduled") {
    return NextResponse.json({
      canCancel: false,
      reason: "Appointment cannot be cancelled in its current state",
    });
  }

  const appointmentDateTime = new Date(`${appt.appointment_date}T${appt.start_time}`);
  const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const cancellationWindowHours = clinicConfig.booking.cancellationHours;

  if (hoursUntilAppt < cancellationWindowHours) {
    return NextResponse.json({
      canCancel: false,
      reason: `Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppt),
    });
  }

  return NextResponse.json({ canCancel: true, hoursRemaining: hoursUntilAppt });
}
