import { NextRequest, NextResponse } from "next/server";
import { createRecurringBooking, cancelRecurringSeries, doctors, services } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/recurring
 *
 * Create a recurring booking series or cancel one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "create" | "cancel";
      // Create fields
      patientId?: string;
      patientName?: string;
      doctorId?: string;
      serviceId?: string;
      date?: string;
      time?: string;
      pattern?: "weekly" | "biweekly" | "monthly";
      occurrences?: number;
      isFirstVisit?: boolean;
      hasInsurance?: boolean;
      // Cancel fields
      groupId?: string;
      cancelAll?: boolean;
      appointmentId?: string;
    };

    if (body.action === "create") {
      if (!body.patientId || !body.patientName || !body.doctorId || !body.date || !body.time || !body.pattern || !body.occurrences) {
        return NextResponse.json(
          { error: "patientId, patientName, doctorId, date, time, pattern, and occurrences are required" },
          { status: 400 },
        );
      }

      const doctor = doctors.find((d) => d.id === body.doctorId);
      const service = body.serviceId ? services.find((s) => s.id === body.serviceId) : undefined;

      const result = createRecurringBooking(
        {
          patientId: body.patientId,
          patientName: body.patientName,
          doctorId: body.doctorId,
          doctorName: doctor?.name ?? "Unknown",
          serviceId: body.serviceId ?? "",
          serviceName: service?.name ?? "General Consultation",
          date: body.date,
          time: body.time,
          status: "scheduled",
          isFirstVisit: body.isFirstVisit ?? false,
          hasInsurance: body.hasInsurance ?? false,
        },
        body.pattern,
        body.occurrences,
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        status: "created",
        message: `Recurring booking created (${result.appointmentIds.length} appointments)`,
        appointmentIds: result.appointmentIds,
        skippedDates: result.skippedDates,
      });
    }

    if (body.action === "cancel") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId is required" }, { status: 400 });
      }

      const result = cancelRecurringSeries(body.groupId, body.cancelAll ?? false, body.appointmentId);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        status: "cancelled",
        message: `${result.cancelledCount} appointment(s) cancelled`,
        cancelledCount: result.cancelledCount,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'cancel'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process recurring booking" }, { status: 500 });
  }
}
