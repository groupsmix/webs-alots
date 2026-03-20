import { NextRequest, NextResponse } from "next/server";
import { rescheduleAppointment } from "@/lib/demo-data";

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

    const result = rescheduleAppointment(body.appointmentId, body.newDate, body.newTime);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      status: "rescheduled",
      message: "Appointment rescheduled successfully",
      newAppointmentId: result.newAppointmentId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
  }
}
