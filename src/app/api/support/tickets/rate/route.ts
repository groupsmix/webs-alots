import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { ticketRatingSchema } from "@/lib/validations/support";
import { type AuthContext } from "@/lib/with-auth";

/**
 * POST /api/support/tickets/rate
 * Rate a resolved support ticket (patient satisfaction).
 */
export const POST = withAuthValidation(
  ticketRatingSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Verify ticket exists and is resolved
    const { data: ticket, error: ticketError } = await auth.supabase
      .from("support_tickets")
      .select("id, status")
      .eq("id", data.id)
      .eq("clinic_id", clinicId)
      .single();

    if (ticketError || !ticket) {
      return apiError("Ticket not found", 404, "NOT_FOUND");
    }

    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      return apiError("Can only rate resolved or closed tickets", 400, "INVALID_STATUS");
    }

    const { error: updateError, data: updated } = await auth.supabase
      .from("support_tickets")
      .update({
        satisfaction_rating: data.satisfaction_rating,
        satisfaction_comment: data.satisfaction_comment ?? null,
      })
      .eq("id", data.id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to rate ticket", {
        context: "support/tickets/rate",
        error: updateError,
        clinicId,
      });
      return apiError("Failed to rate ticket", 500, "INTERNAL_ERROR");
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_rated",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Ticket ${data.id} rated: ${data.satisfaction_rating}/5`,
      metadata: { ticketId: data.id, rating: data.satisfaction_rating },
    });

    return apiSuccess({ ticket: updated });
  },
  null,
);
