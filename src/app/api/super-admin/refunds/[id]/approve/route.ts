/**
 * PATCH /api/super-admin/refunds/:id/approve
 *
 * Second-admin approval for a refund in 'pending_second' state.
 *
 * State transition + dual-control guard are enforced by the
 * `approve_refund(refund_id, approver_id)` SECURITY DEFINER RPC
 * defined in migration 00151. The RLS policy on refund_approvals
 * is SELECT-only for super_admin, so this route cannot bypass the
 * dual-control invariant by issuing a direct UPDATE — even if the
 * route itself were compromised.
 */

import { type NextRequest } from "next/server";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, { supabase, profile }: AuthContext, routeCtx) => {
    const { id } = await routeCtx!.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiNotFound();

    // All validation, locking, audit logging happens inside the RPC.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("approve_refund", {
      p_refund_id: id,
      p_approver_id: profile.id,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.startsWith("NOT_FOUND")) return apiNotFound("Refund not found");
      if (msg.startsWith("WRONG_STATE"))
        return apiError("Refund is not awaiting second approval", 409, "WRONG_STATE");
      if (msg.startsWith("SELF_APPROVAL"))
        return apiError(
          "Le même administrateur ne peut pas approuver les deux étapes",
          403,
          "SELF_APPROVAL",
        );
      if (msg.startsWith("NOT_AUTHORIZED")) return apiError("Not authorized", 403, "FORBIDDEN");
      return apiError("Failed to approve refund", 500);
    }

    return apiSuccess({ approved: true, refund: data });
  },
  ["super_admin"],
);
