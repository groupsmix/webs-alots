import { NextRequest, NextResponse } from "next/server";
import { createEmergencySlot, getEmergencySlots, bookEmergencySlot } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/emergency-slot
 *
 * Create an emergency slot (doctor only) or book an existing one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "create" | "book";
      // Create fields
      doctorId?: string;
      date?: string;
      startTime?: string;
      durationMin?: number;
      reason?: string;
      // Book fields
      slotId?: string;
      patientId?: string;
      patientName?: string;
      serviceId?: string;
    };

    if (body.action === "create") {
      if (!body.doctorId || !body.date || !body.startTime || !body.durationMin) {
        return NextResponse.json(
          { error: "doctorId, date, startTime, and durationMin are required" },
          { status: 400 },
        );
      }

      const result = createEmergencySlot(
        body.doctorId,
        body.date,
        body.startTime,
        body.durationMin,
        body.reason,
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        status: "created",
        message: "Emergency slot created",
        slotId: result.slotId,
      });
    }

    if (body.action === "book") {
      if (!body.slotId || !body.patientId || !body.patientName) {
        return NextResponse.json(
          { error: "slotId, patientId, and patientName are required" },
          { status: 400 },
        );
      }

      const result = bookEmergencySlot(body.slotId, body.patientId, body.patientName, body.serviceId);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        status: "booked",
        message: "Emergency slot booked",
        appointmentId: result.appointmentId,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'book'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process emergency slot request" }, { status: 500 });
  }
}

/**
 * GET /api/booking/emergency-slot?doctorId=...&date=...
 *
 * Get available emergency slots.
 */
export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get("doctorId") ?? undefined;
  const date = request.nextUrl.searchParams.get("date") ?? undefined;

  const slots = getEmergencySlots(doctorId, date);
  return NextResponse.json({ slots });
}
