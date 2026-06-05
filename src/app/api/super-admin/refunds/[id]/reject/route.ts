/**
 * PATCH /api/super-admin/refunds/:id/reject
 *
 * Reject a refund that is in 'pending_second' state.
 * Requires a reason of at least 10 characters.
 */

import { z } from "zod";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";

const rejectSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const PATCH = withAuthValidation(
  rejectSchema,
  async (body, request, { supabase, profile }) => {
    // Extract id from URL: .../refunds/{id}/reject
    const id = new URL(request.url).pathname.split("/").at(-2) ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiNotFound();

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant
    const { data: refund } = await supabase
      .from("refund_approvals")
      .select("id, status, clinic_id")
      .eq("id", id)
      .maybeSingle();

    if (!refund) return apiNotFound("Refund not found");

    if (refund.status !== "pending_second") {
      return apiError("Refund is not awaiting approval", 409, "WRONG_STATE");
    }

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
    const { error } = await supabase
      .from("refund_approvals")
      .update({
        status: "rejected",
        rejection_reason: body.reason,
        approver_id: profile.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return apiError("Failed to reject refund", 500);

    await logAuditEvent({
      supabase,
      action: "refund_rejected",
      type: "payment",
      clinicId: refund.clinic_id,
      description: `Refund ${id} rejected: ${body.reason}`,
      metadata: { refundId: id, reason: body.reason, rejectorId: profile.id },
    });

    return apiSuccess({ rejected: true });
  },
  ["super_admin"],
);
