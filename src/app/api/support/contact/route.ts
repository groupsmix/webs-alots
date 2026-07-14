import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { supportContactSchema } from "@/lib/validations/feedback";
import { type AuthContext } from "@/lib/with-auth";

/**
 * POST /api/support/contact
 * In-app "Contact support" for ANY authenticated role (patient, doctor,
 * pharmacist, receptionist, clinic_admin). Opens a support ticket scoped to the
 * caller's own clinic — taken from the authenticated profile, never the
 * request body — and threads the initial message. Distinct from
 * /api/support/tickets, which is the staff-facing management surface restricted
 * to super_admin/clinic_admin/receptionist.
 *
 * super_admin has no clinic and already owns the support-management surface, so
 * a clinic-scoped ticket is not applicable and returns a 400.
 */
export const POST = withAuthValidation(
  supportContactSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const clinicId = auth.profile.clinic_id;
    if (!clinicId) {
      return apiError("Support tickets require a clinic context", 400, "NO_CLINIC");
    }

    const senderType = auth.profile.role === "patient" ? "patient" : "staff";

    const { error: insertError, data: ticket } = await auth.supabase
      .from("support_tickets")
      .insert({
        clinic_id: clinicId,
        subject: data.subject,
        channel: "chat",
        priority: data.priority,
        language: data.language,
        status: "open",
      })
      .select("id")
      .single();

    if (insertError || !ticket) {
      logger.error("Failed to create support contact ticket", {
        context: "support/contact",
        error: insertError,
        clinicId,
      });
      return apiError("Failed to contact support", 500, "INTERNAL_ERROR");
    }

    const { error: messageError } = await auth.supabase.from("support_messages").insert({
      clinic_id: clinicId,
      ticket_id: ticket.id,
      sender_type: senderType,
      sender_id: auth.profile.id,
      content: data.message,
      language: data.language,
    });

    if (messageError) {
      logger.error("Failed to attach support contact message", {
        context: "support/contact",
        error: messageError,
        clinicId,
      });
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_created",
      type: "admin",
      clinicId,
      actor: auth.profile.id,
      description: `Support contact from ${auth.profile.role}: ${data.subject.slice(0, 100)}`,
      metadata: { ticketId: ticket.id, channel: "chat", source: "in_app_widget" },
    });

    return apiSuccess({ id: ticket.id });
  },
  null,
);
