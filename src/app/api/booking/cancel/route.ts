import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { withAuth } from "@/lib/with-auth";
import { APPOINTMENT_STATUS, WAITING_LIST_STATUS } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
import { clinicDateTime } from "@/lib/timezone";

export const runtime = "edge";

/**
 * POST /api/booking/cancel
 *
 * Cancel an appointment if within the cancellation window.
 */
export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const body = (await request.json()) as { appointmentId: string; reason?: string };

    if (!body.appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
    }

    // Input length validation to prevent DoS via oversized payloads
    if (body.reason && body.reason.length > 1000) {
      return NextResponse.json({ error: "Reason exceeds maximum allowed length" }, { status: 400 });
    }

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

    if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
      return NextResponse.json(
        { error: "Appointment cannot be cancelled in its current state" },
        { status: 400 },
      );
    }

    // Check cancellation window (timezone-aware)
    if (!appt.appointment_date || !appt.start_time) {
      return NextResponse.json(
        { error: "Appointment is missing date or time information" },
        { status: 400 },
      );
    }

    const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time);
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
        status: APPOINTMENT_STATUS.CANCELLED,
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
      .eq("status", WAITING_LIST_STATUS.WAITING)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (candidate) {
      await supabase
        .from("waiting_list")
        .update({ status: WAITING_LIST_STATUS.NOTIFIED, notified_at: new Date().toISOString() })
        .eq("id", candidate.id);
    }

    await logAuditEvent({
      supabase,
      action: "appointment.cancelled",
      type: "booking",
      actor: profile.id,
      clinicId: profile.clinic_id ?? clinicConfig.clinicId,
      description: `Appointment ${body.appointmentId} cancelled. Reason: ${body.reason ?? "Cancelled by patient"}`,
    });

    return NextResponse.json({ status: APPOINTMENT_STATUS.CANCELLED, message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("[cancel] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
  }
}, null);

/**
 * GET /api/booking/cancel?appointmentId=...
 *
 * Check if an appointment can be cancelled.
 */
export const GET = withAuth(async (request, { supabase }) => {
  const appointmentId = request.nextUrl.searchParams.get("appointmentId");

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicConfig.clinicId)
    .single();

  if (error || !appt) {
    return NextResponse.json({ canCancel: false, reason: "Appointment not found" });
  }

  if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
    return NextResponse.json({
      canCancel: false,
      reason: "Appointment cannot be cancelled in its current state",
    });
  }

  if (!appt.appointment_date || !appt.start_time) {
    return NextResponse.json({
      canCancel: false,
      reason: "Appointment is missing date or time information",
    });
  }

  const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time);
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
}, null);
