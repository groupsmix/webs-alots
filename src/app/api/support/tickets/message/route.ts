import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { ticketMessageSchema } from "@/lib/validations/support";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * GET /api/support/tickets/message?ticket_id=<uuid>
 * List all messages for a specific support ticket.
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const ticketId = new URL(request.url).searchParams.get("ticket_id");

    if (!ticketId) {
      return apiError("ticket_id query parameter is required", 400, "VALIDATION_ERROR");
    }

    // Verify ticket belongs to this clinic
    const { data: ticket, error: ticketError } = await auth.supabase
      .from("support_tickets")
      .select("id")
      .eq("id", ticketId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return apiError("Ticket not found", 404, "NOT_FOUND");
    }

    const { data: messages, error } = await auth.supabase
      .from("support_messages")
      .select("id, ticket_id, sender_type, sender_id, content, created_at")
      .eq("ticket_id", ticketId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch messages", {
        context: "support/tickets/message",
        error,
        clinicId,
      });
      return apiError("Failed to fetch messages", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({ messages: messages ?? [] });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

/**
 * POST /api/support/tickets/message
 * Add a message to a support ticket.
 */
export const POST = withAuthValidation(
  ticketMessageSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Verify ticket belongs to this clinic
    const { data: ticket, error: ticketError } = await auth.supabase
      .from("support_tickets")
      .select("id, status")
      .eq("id", data.ticket_id)
      .eq("clinic_id", clinicId)
      .single();

    if (ticketError || !ticket) {
      return apiError("Ticket not found", 404, "NOT_FOUND");
    }

    if (ticket.status === "closed") {
      return apiError("Cannot add messages to a closed ticket", 400, "TICKET_CLOSED");
    }

    const { error: insertError, data: message } = await auth.supabase
      .from("support_messages")
      .insert({
        clinic_id: clinicId,
        ticket_id: data.ticket_id,
        sender_type: data.sender_type,
        sender_id: auth.user.id,
        content: data.content,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to add message", {
        context: "support/tickets/message",
        error: insertError,
        clinicId,
      });
      return apiError("Failed to add message", 500, "INTERNAL_ERROR");
    }

    // Auto-update ticket to in_progress if it's open and a staff member replies
    if (ticket.status === "open" && data.sender_type === "staff") {
      await auth.supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", data.ticket_id)
        .eq("clinic_id", clinicId);
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "support_message_added",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Message added to ticket ${data.ticket_id}`,
      metadata: { ticketId: data.ticket_id, senderType: data.sender_type },
    });

    return apiSuccess({ message }, 201);
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
