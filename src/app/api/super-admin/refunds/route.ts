/**
 * POST /api/super-admin/refunds
 *
 * Initiate a refund request.
 * - amount ≤ 5 000 MAD → auto-approved (status = 'approved')
 * - amount > 5 000 MAD → requires second sign-off (status = 'pending_second')
 */

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";

const initiateSchema = z.object({
  clinicId: z.string().uuid("clinicId must be a UUID"),
  paymentOrderId: z.string().min(1, "paymentOrderId is required"),
  amountMad: z.number().positive("amountMad must be positive"),
});

export const POST = withAuthValidation(
  initiateSchema,
  async (body, _request, { supabase, profile }) => {
    const status = body.amountMad > 5_000 ? "pending_second" : "approved";
    const resolvedAt = status === "approved" ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from("refund_approvals")
      .insert({
        clinic_id: body.clinicId,
        payment_order_id: body.paymentOrderId,
        amount_mad: body.amountMad,
        initiator_id: profile.id,
        status,
        resolved_at: resolvedAt,
      })
      .select("id, status")
      .single();

    if (error) return apiError("Failed to initiate refund", 500);

    await logAuditEvent({
      supabase,
      action: "refund_initiated",
      type: "payment",
      clinicId: body.clinicId,
      description: `Refund initiated: ${body.amountMad} MAD for order ${body.paymentOrderId}`,
      metadata: { refundId: data.id, status, amountMad: body.amountMad },
    });

    return apiSuccess({ refundId: data.id, status }, 201);
  },
  ["super_admin"],
);
