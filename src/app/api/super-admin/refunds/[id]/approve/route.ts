/**
 * PATCH /api/super-admin/refunds/:id/approve
 *
 * Second-admin approval for a refund in 'pending_second' state.
 * Self-approval (same admin who initiated) is blocked.
 */

import { type NextRequest } from "next/server";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const PATCH = withAuth(
  async (
    _request: NextRequest,
    { supabase, profile }: AuthContext,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiNotFound();

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant
    const { data: refund } = await supabase
      .from("refund_approvals")
      .select("id, status, initiator_id, clinic_id")
      .eq("id", id)
      .maybeSingle();

    if (!refund) return apiNotFound("Refund not found");

    if (refund.status !== "pending_second") {
      return apiError("Refund is not awaiting second approval", 409, "WRONG_STATE");
    }

    if (refund.initiator_id === profile.id) {
      return apiError(
        "Le même administrateur ne peut pas approuver les deux étapes",
        403,
        "SELF_APPROVAL",
      );
    }

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
    const { error } = await supabase
      .from("refund_approvals")
      .update({
        status: "approved",
        approver_id: profile.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return apiError("Failed to approve refund", 500);

    await logAuditEvent({
      supabase,
      action: "refund_second_approved",
      type: "payment",
      clinicId: refund.clinic_id,
      description: `Refund ${id} approved by second admin ${profile.id}`,
      metadata: { refundId: id, approverId: profile.id },
    });

    return apiSuccess({ approved: true });
  },
  ["super_admin"],
);
