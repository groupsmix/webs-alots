import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
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

    // Fetch the payment (include refunded_amount to track cumulative refunds)
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, amount, refunded_amount")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "completed" && payment.status !== "partially_refunded") {
      return NextResponse.json({ error: "Only completed or partially refunded payments can be refunded" }, { status: 400 });
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

    const alreadyRefunded = (payment.refunded_amount as number) ?? 0;
    const remaining = payment.amount - alreadyRefunded;

    if (refundAmount > remaining) {
      return NextResponse.json(
        { error: `Refund amount (${refundAmount}) exceeds remaining refundable amount (${remaining})` },
        { status: 400 },
      );
    }

    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedTotal >= payment.amount;

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        refunded_amount: newRefundedTotal,
      })
      .eq("id", body.paymentId);

    if (updateError) {
      console.error("[POST /api/booking/payment/refund] Update error:", updateError.message);
      return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
    }

    await logAuditEvent({
      supabase,
      action: "payment_refunded",
      type: "payment",
      clinicId: clinicConfig.clinicId,
      description: `Payment ${body.paymentId} refunded: ${refundAmount} of ${payment.amount}`,
    });

    return NextResponse.json({ status: "refunded", message: "Payment refunded" });
  } catch (err) {
    console.error("[POST /api/booking/payment/refund] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
  }
}, ADMIN_ROLES);
