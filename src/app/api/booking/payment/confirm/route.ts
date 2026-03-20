import { NextRequest, NextResponse } from "next/server";
import { confirmPayment } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/payment/confirm
 *
 * Confirm a pending payment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { paymentId: string };

    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const result = confirmPayment(body.paymentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ status: "confirmed", message: "Payment confirmed" });
  } catch {
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
