import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { ticketCreateSchema, ticketUpdateSchema } from "@/lib/validations/support";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * GET /api/support/tickets
 * List support tickets for the current clinic with optional filters.
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("per_page") ?? "20", 10) || 20),
    );
    const offset = (page - 1) * perPage;

    let query = auth.supabase
      .from("support_tickets")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch tickets", { context: "support/tickets", error, clinicId });
      return apiError("Failed to fetch tickets", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({
      tickets: data ?? [],
      pagination: { page, per_page: perPage, total: count ?? 0 },
    });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

/**
 * POST /api/support/tickets
 * Create a new support ticket.
 */
export const POST = withAuthValidation(
  ticketCreateSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const { error: insertError, data: ticket } = await auth.supabase
      .from("support_tickets")
      .insert({
        clinic_id: clinicId,
        subject: data.subject,
        channel: data.channel,
        priority: data.priority,
        language: data.language,
        patient_phone: data.patient_phone ?? null,
        patient_name: data.patient_name ?? null,
        status: "open",
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create ticket", {
        context: "support/tickets",
        error: insertError,
        clinicId,
      });
      return apiError("Failed to create ticket", 500, "INTERNAL_ERROR");
    }

    // If an initial message was provided, create it
    if (data.message && ticket) {
      await auth.supabase.from("support_messages").insert({
        clinic_id: clinicId,
        ticket_id: ticket.id,
        sender_type: "patient",
        content: data.message,
        language: data.language,
      });
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_created",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Ticket created: ${data.subject.slice(0, 100)}`,
      metadata: { ticketId: ticket?.id, channel: data.channel, priority: data.priority },
    });

    return apiSuccess({ ticket }, 201);
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

/**
 * PUT /api/support/tickets
 * Update a support ticket (status, priority, assignment).
 */
export const PUT = withAuthValidation(
  ticketUpdateSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const { id, ...updates } = data;

    const resolvedAt = updates.status === "resolved" ? new Date().toISOString() : undefined;

    const { error: updateError, data: ticket } = await auth.supabase
      .from("support_tickets")
      .update({
        status: updates.status,
        priority: updates.priority,
        assigned_to: updates.assigned_to,
        resolved_at: resolvedAt,
      })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to update ticket", {
        context: "support/tickets",
        error: updateError,
        clinicId,
      });
      return apiError("Failed to update ticket", 500, "INTERNAL_ERROR");
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_updated",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Ticket updated: ${id}`,
      metadata: { ticketId: id },
    });

    return apiSuccess({ ticket });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
