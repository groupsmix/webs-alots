import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";
import type { UserRole } from "@/lib/types/database";

export const runtime = "edge";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    if (!profile || !ADMIN_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 admin only" }, { status: 403 });
    }

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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "refunded", message: "Payment refunded" });
  } catch {
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 });
  }
}
