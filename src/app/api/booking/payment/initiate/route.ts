import { NextRequest, NextResponse } from "next/server";
import { initiatePayment } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/payment/initiate
 *
 * Initiate a payment for an appointment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      appointmentId: string;
      patientId: string;
      patientName: string;
      amount: number;
      paymentType: "deposit" | "full";
      method?: "cash" | "card" | "online" | "insurance";
    };

    if (!body.appointmentId || !body.patientId || !body.patientName || !body.amount || !body.paymentType) {
      return NextResponse.json(
        { error: "appointmentId, patientId, patientName, amount, and paymentType are required" },
        { status: 400 },
      );
    }

    const result = initiatePayment(
      body.appointmentId,
      body.patientId,
      body.patientName,
      body.amount,
      body.paymentType,
      body.method,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      status: "initiated",
      message: "Payment initiated",
      paymentId: result.paymentId,
      gatewaySessionId: result.gatewaySessionId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}
