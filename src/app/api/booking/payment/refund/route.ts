import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { paymentRefundSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { refundStripePayment } from "@/lib/stripe-webhook";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * Methods that use Stripe as the payment gateway and support programmatic
 * refunds via the Stripe Refunds API.
 */
const STRIPE_METHODS = new Set(["online"]);

/**
 * Methods that use CMI (Morocco's interbank gateway).
 * CMI does not expose a programmatic refund API — refunds must be processed
 * manually through the CMI merchant portal. The route records the intent
 * in the DB and returns a clear message so staff know what to do.
 */
const CMI_METHODS = new Set(["cmi"]);

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 *
 * Gateway behaviour:
 *  - Stripe (method = "online")  → programmatic refund via Stripe Refunds API
 *  - CMI   (method = "cmi")     → DB-only; manual refund required in CMI portal
 *  - Offline (cash, check, etc.) → DB-only; staff handles cash return manually
 */
export const POST = withAuthValidation(paymentRefundSchema, async (body, request, { supabase }) => {

  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  // Fetch the payment — include method and reference for gateway dispatch.
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, status, amount, refunded_amount, method, reference")
    .eq("id", body.paymentId)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !payment) {
    return apiNotFound("Payment not found");
  }

  if (payment.status !== "completed" && payment.status !== "partially_refunded") {
    return apiError("Only completed or partially refunded payments can be refunded");
  }

  const refundAmount = body.amount ?? payment.amount;

  // Validate refund amount
  if (
    typeof refundAmount !== "number" ||
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    return apiError("Refund amount must be a positive number");
  }

  const alreadyRefunded = (payment.refunded_amount as number) ?? 0;
  const remaining = payment.amount - alreadyRefunded;

  if (refundAmount > remaining) {
    return apiError(`Refund amount (${refundAmount}) exceeds remaining refundable amount (${remaining})`);
  }

  const newRefundedTotal = alreadyRefunded + refundAmount;
  const isFullyRefunded = newRefundedTotal >= payment.amount;
  const paymentMethod: string = payment.method ?? "";

  // ── Gateway Dispatch ───────────────────────────────────────────────
  // Attempt the real gateway refund before touching the DB, so a gateway
  // failure keeps the payment in its current state (no phantom refunds).

  let gatewayRefundId: string | null = null;
  let gatewayNote = "";

  if (STRIPE_METHODS.has(paymentMethod)) {
    // ——— Stripe: programmatic refund ———
    const sessionId = payment.reference;
    if (!sessionId) {
      logger.error("Stripe payment has no reference (session ID) — cannot refund", {
        context: "booking/payment/refund",
        paymentId: body.paymentId,
        clinicId,
      });
      return apiError("Payment has no gateway reference — contact support", 422);
    }

    const result = await refundStripePayment(
      sessionId,
      refundAmount,
      "requested_by_customer",
    );

    if (!result.ok) {
      logger.error("Stripe refund failed — DB not updated", {
        context: "booking/payment/refund",
        paymentId: body.paymentId,
        clinicId,
        stripeError: result.error,
      });
      return apiError(`Refund rejected by payment gateway: ${result.error}`, 502);
    }

    gatewayRefundId = result.refundId;
    gatewayNote = `Stripe refund ID: ${result.refundId}`;

  } else if (CMI_METHODS.has(paymentMethod)) {
    // ——— CMI: no programmatic refund API ———
    // Log the intent; staff must process the refund manually in the CMI
    // merchant portal. We still update the DB so the internal record is
    // consistent and the refund appears in the admin dashboard.
    logger.warn("CMI payment refund requires manual action in CMI merchant portal", {
      context: "booking/payment/refund",
      paymentId: body.paymentId,
      clinicId,
      refundAmount,
    });
    gatewayNote = "CMI refund must be processed manually in the CMI merchant portal";

  } else {
    // ——— Offline (cash, cheque, insurance, etc.) ———
    // No gateway to call. Staff handles cash/cheque return in person.
    gatewayNote = `Offline refund (${paymentMethod || "unknown method"}) — staff handles cash return`;
  }

  // ── DB Update (only reached if gateway succeeded or no gateway needed) ──
  // Update payment status — scoped to clinic_id to prevent
  // cross-tenant state mutation (CRITICAL: tenant isolation fix).
  const updatePayload: Record<string, unknown> = {
    status: isFullyRefunded ? "refunded" : "partially_refunded",
    refunded_amount: newRefundedTotal,
  };
  // Persist the gateway's refund ID so staff can cross-reference with
  // Stripe's dashboard without hunting through logs.
  if (gatewayRefundId) updatePayload.gateway_refund_id = gatewayRefundId;

  const { error: updateError } = await supabase
    .from("payments")
    .update(updatePayload)
    .eq("id", body.paymentId)
    .eq("clinic_id", clinicId);

  if (updateError) {
    logger.error("DB update failed after gateway refund — MANUAL RECONCILIATION REQUIRED", {
      context: "booking/payment/refund",
      paymentId: body.paymentId,
      clinicId,
      gatewayRefundId,
      error: updateError,
    });
    return apiInternalError("Refund was processed by gateway but DB update failed — contact support");
  }

  await logAuditEvent({
    supabase,
    action: "payment_refunded",
    type: "payment",
    clinicId,
    description: `Payment ${body.paymentId} refunded: ${refundAmount} of ${payment.amount}. ${gatewayNote}`,
  });

  const responsePayload: Record<string, unknown> = {
    status: isFullyRefunded ? "refunded" : "partially_refunded",
    message: "Payment refunded",
  };
  if (gatewayRefundId) responsePayload.gatewayRefundId = gatewayRefundId;
  if (CMI_METHODS.has(paymentMethod)) {
    responsePayload.manualActionRequired = true;
    responsePayload.note = "CMI refund must be processed manually in the CMI merchant portal";
  }

  return apiSuccess(responsePayload);
}, ADMIN_ROLES);
