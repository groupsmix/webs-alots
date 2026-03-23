import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { paymentConfirmSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

/**
 * POST /api/booking/payment/confirm
 *
 * Confirm a pending payment.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(paymentConfirmSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Fetch the payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, appointment_id")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicId)
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
      void updateError;
      return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
    }

    // Also confirm the associated appointment if it is still scheduled
    if (payment.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: APPOINTMENT_STATUS.CONFIRMED })
        .eq("id", payment.appointment_id)
        .in("status", [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SCHEDULED]);
    }

    await logAuditEvent({
      supabase,
      action: "payment_confirmed",
      type: "payment",
      clinicId,
      description: `Payment ${body.paymentId} confirmed`,
    });

    return NextResponse.json({ status: "confirmed", message: "Payment confirmed" });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/payment/confirm", error: err });
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}, STAFF_ROLES);
