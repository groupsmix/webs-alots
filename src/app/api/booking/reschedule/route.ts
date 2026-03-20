import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

/**
 * POST /api/booking/reschedule
 *
 * Reschedule an existing appointment to a new date/time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      appointmentId: string;
      newDate: string;
      newTime: string;
    };

    if (!body.appointmentId || !body.newDate || !body.newTime) {
      return NextResponse.json(
        { error: "appointmentId, newDate, and newTime are required" },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.newDate)) {
      return NextResponse.json({ error: "Invalid date format (expected YYYY-MM-DD)" }, { status: 400 });
    }

    if (!/^\d{2}:\d{2}$/.test(body.newTime)) {
      return NextResponse.json({ error: "Invalid time format (expected HH:MM)" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get the existing appointment
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", body.appointmentId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Update the existing appointment with new date/time
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        appointment_date: body.newDate,
        start_time: body.newTime,
        status: "confirmed",
      })
      .eq("id", body.appointmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "rescheduled",
      message: "Appointment rescheduled successfully",
      newAppointmentId: body.appointmentId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
  }
}
