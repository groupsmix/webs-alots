import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { requireTenantWithConfig } from "@/lib/tenant";
import { APPOINTMENT_STATUS, WAITING_LIST_STATUS } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
import { clinicDateTime } from "@/lib/timezone";
import { logger } from "@/lib/logger";
import { bookingCancelSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

/**
 * POST /api/booking/cancel
 *
 * Cancel an appointment if within the cancellation window.
 */
export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(bookingCancelSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    // Fetch the appointment
    const { data: appt, error: fetchError } = await supabase
      .from("appointments")
      .select("id, doctor_id, appointment_date, start_time, status")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicId)
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

    const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time, tenantConfig.timezone);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const cancellationWindowHours = tenantConfig.booking.cancellationHours;

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
      return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
    }

    // Promote the first waiting-list entry for the freed slot
    const { data: candidate } = await supabase
      .from("waiting_list")
      .select("id")
      .eq("clinic_id", clinicId)
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
      clinicId: profile.clinic_id ?? clinicId,
      description: `Appointment ${body.appointmentId} cancelled. Reason: ${body.reason ?? "Cancelled by patient"}`,
    });

    return NextResponse.json({ status: APPOINTMENT_STATUS.CANCELLED, message: "Appointment cancelled successfully" });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/cancel", error: err });
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

  const { tenant, config: tenantCfg } = await requireTenantWithConfig();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status")
    .eq("id", appointmentId)
    .eq("clinic_id", tenant.clinicId)
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

  const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time, tenantCfg.timezone);
  const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const cancellationWindowHours = tenantCfg.booking.cancellationHours;

  if (hoursUntilAppt < cancellationWindowHours) {
    return NextResponse.json({
      canCancel: false,
      reason: `Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppt),
    });
  }

  return NextResponse.json({ canCancel: true, hoursRemaining: hoursUntilAppt });
}, null);
