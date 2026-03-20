import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

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

    const supabase = await createClient();

    // Fetch the payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, amount")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "completed") {
      return NextResponse.json({ error: "Only completed payments can be refunded" }, { status: 400 });
    }

    const refundAmount = body.amount ?? payment.amount;

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        refunded_amount: refundAmount,
      })
      .eq("id", body.paymentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "refunded", message: "Payment refunded" });
  } catch {
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
  }
}
