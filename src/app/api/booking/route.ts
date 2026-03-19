import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * POST /api/booking
 *
 * Creates a new appointment booking.
 * Validates slot availability and sends confirmation via WhatsApp.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Validate request body
    // TODO: Check slot availability in Supabase
    // TODO: Create appointment record
    // TODO: Send WhatsApp confirmation to patient
    // TODO: Notify doctor and receptionist

    console.log("Booking request:", JSON.stringify(body));

    return NextResponse.json({
      status: "created",
      message: "Appointment booked successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/booking
 *
 * Returns available time slots for a given doctor and date.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json(
      { error: "doctorId and date are required" },
      { status: 400 },
    );
  }

  // TODO: Fetch available slots from Supabase
  // TODO: Apply working hours, buffer time, max capacity rules

  return NextResponse.json({ slots: [] });
}
