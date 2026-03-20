import { NextRequest, NextResponse } from "next/server";
import { cancelAppointment, canCancelAppointment } from "@/lib/demo-data";

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

    const result = cancelAppointment(body.appointmentId, body.reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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

  const result = canCancelAppointment(appointmentId);
  return NextResponse.json(result);
}
