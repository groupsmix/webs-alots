import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { paymentRefundSchema } from "@/lib/validations";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/** Inferred shape from paymentRefundSchema (A169-01 additions) */
interface RefundBody {
  paymentId: string;
  amount?: number;
  idempotencyKey?: string;
  expectedVersion?: number;
  reason?: string;
}

/** Shape returned by the payments SELECT (includes version from migration 00077) */
interface PaymentRow {
  id: string;
  status: string;
  amount: number;
  refunded_amount: number | null;
  version: number;
}

/** Shape returned by idempotency key lookups */
interface IdempotencyKeyRow {
  result_status: string;
  refund_amount: number;
}

/**
 * Helper: query the refund_idempotency_keys table.
 *
 * Table added in migration 00077 and typed in database-extended.ts, but the
 * generated database.ts hasn't been regenerated yet. Use an explicit cast
 * so tsc is happy until the next `supabase gen types` run.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idempotencyTable(supabase: any) {
  return supabase.from("refund_idempotency_keys");
}

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 *
 * A169-01: Supports idempotency keys and optimistic concurrency control
 * to prevent double-refund race conditions.
 */
export const POST = withAuthValidation(paymentRefundSchema, async (body: RefundBody, request, { supabase }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // ── A169-01: Idempotency check ──────────────────────────────────────
    // If the client supplied an idempotency key, check if this refund was
    // already processed. Return the cached result instead of double-refunding.
    if (body.idempotencyKey) {
      const { data: existingKey } = (await idempotencyTable(supabase)
        .select("result_status, refund_amount")
        .eq("idempotency_key", body.idempotencyKey)
        .eq("clinic_id", clinicId)
        .single()) as { data: IdempotencyKeyRow | null };

      if (existingKey) {
        if (existingKey.result_status === "completed") {
          return apiSuccess({
            status: "refunded",
            message: "Refund already processed (idempotent)",
            idempotent: true,
          });
        }
        if (existingKey.result_status === "processing") {
          return apiError("Refund is currently being processed", 409, "REFUND_IN_PROGRESS");
        }
        // If failed, allow retry by falling through
      }
    }

    // Fetch the payment with version for optimistic concurrency
    // A169-01: version column added in migration 00077
    const { data: rawPayment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, amount, refunded_amount, version")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !rawPayment) {
      return apiNotFound("Payment not found");
    }

    // Cast to include the version column (added in migration 00077)
    const payment = rawPayment as unknown as PaymentRow;

    if (payment.status !== "completed" && payment.status !== "partially_refunded") {
      return apiError("Only completed or partially refunded payments can be refunded");
    }

    // ── A169-01: Optimistic concurrency check ───────────────────────────
    // If the client supplied an expectedVersion, verify it matches. This
    // prevents two concurrent refund requests from both reading the same
    // state and both succeeding.
    if (body.expectedVersion !== undefined && body.expectedVersion !== payment.version) {
      return apiError(
        "Payment has been modified since you last read it. Please refresh and retry.",
        409,
        "VERSION_CONFLICT",
      );
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

    const alreadyRefunded = payment.refunded_amount ?? 0;
    const remaining = payment.amount - alreadyRefunded;

    if (refundAmount > remaining) {
      return apiError(`Refund amount (${refundAmount}) exceeds remaining refundable amount (${remaining})`);
    }

    // ── A169-01: Record idempotency key before mutation ─────────────────
    if (body.idempotencyKey) {
      const { error: idemError } = await idempotencyTable(supabase)
        .upsert({
          idempotency_key: body.idempotencyKey,
          clinic_id: clinicId,
          payment_id: body.paymentId,
          refund_amount: refundAmount,
          result_status: "processing",
        }, { onConflict: "idempotency_key,clinic_id" });

      if (idemError) {
        return apiInternalError("Failed to record idempotency key");
      }
    }

    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedTotal >= payment.amount;

    // ── A169-01: Optimistic concurrency via version column ──────────────
    // The WHERE clause includes version = current version, so if another
    // request incremented it first, this UPDATE will match 0 rows.
    const currentVersion = payment.version ?? 1;
    const { data: updated, error: updateError } = await supabase
      .from("payments")
      .update({
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        refunded_amount: newRefundedTotal,
        version: currentVersion + 1,
      } as Record<string, unknown>)
      .eq("id", body.paymentId)
      .eq("version" as string, currentVersion)
      .select("id")
      .single();

    if (updateError || !updated) {
      // Mark idempotency key as failed if we recorded one
      if (body.idempotencyKey) {
        await idempotencyTable(supabase)
          .update({ result_status: "failed" })
          .eq("idempotency_key", body.idempotencyKey)
          .eq("clinic_id", clinicId);
      }

      if (!updated && !updateError) {
        return apiError(
          "Payment was modified concurrently. Please refresh and retry.",
          409,
          "VERSION_CONFLICT",
        );
      }
      void updateError;
      return apiInternalError("Failed to refund payment");
    }

    // ── Mark idempotency key as completed ───────────────────────────────
    if (body.idempotencyKey) {
      await idempotencyTable(supabase)
        .update({ result_status: "completed" })
        .eq("idempotency_key", body.idempotencyKey)
        .eq("clinic_id", clinicId);
    }

    await logAuditEvent({
      supabase,
      action: "payment_refunded",
      type: "payment",
      clinicId,
      description: `Payment ${body.paymentId} refunded: ${refundAmount} of ${payment.amount}`,
      metadata: {
        payment_id: body.paymentId,
        refund_amount: refundAmount,
        new_refunded_total: newRefundedTotal,
        is_fully_refunded: isFullyRefunded,
        idempotency_key: body.idempotencyKey ?? null,
        reason: body.reason ?? null,
      },
    });

    return apiSuccess({ status: "refunded", message: "Payment refunded" });
}, ADMIN_ROLES);
