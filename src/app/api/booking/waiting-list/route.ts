import { NextRequest, NextResponse } from "next/server";
import { addToWaitingList, removeFromWaitingList, getPatientWaitingList, getWaitingListForSlot } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/waiting-list
 *
 * Add a patient to the waiting list.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      patientId: string;
      patientName: string;
      doctorId: string;
      preferredDate: string;
      preferredTime?: string;
      serviceId?: string;
    };

    if (!body.patientId || !body.patientName || !body.doctorId || !body.preferredDate) {
      return NextResponse.json(
        { error: "patientId, patientName, doctorId, and preferredDate are required" },
        { status: 400 },
      );
    }

    const result = addToWaitingList(
      body.patientId,
      body.patientName,
      body.doctorId,
      body.preferredDate,
      body.preferredTime,
      body.serviceId,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      status: "added",
      message: "Added to waiting list",
      entryId: result.entryId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to add to waiting list" }, { status: 500 });
  }
}

/**
 * GET /api/booking/waiting-list?patientId=...  OR  ?doctorId=...&date=...
 *
 * Get waiting list entries.
 */
export async function GET(request: NextRequest) {
  const patientId = request.nextUrl.searchParams.get("patientId");
  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const date = request.nextUrl.searchParams.get("date");
  const time = request.nextUrl.searchParams.get("time");

  if (patientId) {
    const entries = getPatientWaitingList(patientId);
    return NextResponse.json({ entries });
  }

  if (doctorId && date) {
    const entries = getWaitingListForSlot(doctorId, date, time ?? undefined);
    return NextResponse.json({ entries });
  }

  return NextResponse.json(
    { error: "patientId, or doctorId and date are required" },
    { status: 400 },
  );
}

/**
 * DELETE /api/booking/waiting-list
 *
 * Remove a patient from the waiting list.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { entryId: string };

    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const result = removeFromWaitingList(body.entryId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ status: "removed", message: "Removed from waiting list" });
  } catch {
    return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 500 });
  }
}
