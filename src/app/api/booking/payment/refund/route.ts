import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import type { UserRole } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";

export const runtime = "edge";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const body = (await request.json()) as { paymentId: string; amount?: number };

    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

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

    // Validate refund amount
    if (
      typeof refundAmount !== "number" ||
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0
    ) {
      return NextResponse.json(
        { error: "Refund amount must be a positive number" },
        { status: 400 },
      );
    }

    if (refundAmount > payment.amount) {
      return NextResponse.json(
        { error: `Refund amount cannot exceed original payment amount (${payment.amount})` },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        refunded_amount: refundAmount,
      })
      .eq("id", body.paymentId);

    if (updateError) {
      console.error("[POST /api/booking/payment/refund] Update error:", updateError.message);
      return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
    }

    return NextResponse.json({ status: "refunded", message: "Payment refunded" });
  } catch (err) {
    console.error("[POST /api/booking/payment/refund] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
  }
}, ADMIN_ROLES);
