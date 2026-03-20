import { NextRequest, NextResponse } from "next/server";
import { refundPayment } from "@/lib/demo-data";

export const runtime = "edge";

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { paymentId: string; amount?: number };

    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const result = refundPayment(body.paymentId, body.amount);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ status: "refunded", message: "Payment refunded" });
  } catch {
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
  }
}
