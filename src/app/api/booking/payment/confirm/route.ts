import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

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

    const supabase = await createClient();

    // Fetch the payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, appointment_id")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Payment is not in pending state" }, { status: 400 });
    }

    // Mark payment as completed
    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: "completed" })
      .eq("id", body.paymentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also confirm the associated appointment if it is still scheduled
    if (payment.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", payment.appointment_id)
        .in("status", ["pending", "scheduled"]);
    }

    return NextResponse.json({ status: "confirmed", message: "Payment confirmed" });
  } catch {
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
