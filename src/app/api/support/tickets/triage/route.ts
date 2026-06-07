import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { mapSupportPriorityToAiPriority, maybeGenerateSupportTriage } from "@/lib/support/ai";
import { requireTenant } from "@/lib/tenant";

const triageRequestSchema = z.object({
  ticketId: z.string().uuid(),
});

type TriageRequest = z.infer<typeof triageRequestSchema>;

export const POST = withAuthValidation(
  triageRequestSchema,
  async (data: TriageRequest, _request, auth) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const admin = createUntypedAdminClient("super_admin");

    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, clinic_id, subject, patient_name, patient_phone, language, priority, metadata")
      .eq("id", data.ticketId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!ticket) {
      return apiError("Ticket not found", 404, "NOT_FOUND");
    }

    const { data: messages } = await admin
      .from("support_messages")
      .select("sender_type, content, created_at")
      .eq("ticket_id", data.ticketId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true })
      .limit(10);

    const compiledText = [
      `Subject: ${ticket.subject ?? ""}`,
      ...(messages ?? []).map(
        (message: Record<string, unknown>) =>
          `${String(message.sender_type ?? "unknown")}: ${String(message.content ?? "")}`,
      ),
    ].join("\n");

    const triage = await maybeGenerateSupportTriage(compiledText);
    const metadata = {
      ...((ticket.metadata as Record<string, unknown> | null) ?? {}),
      ai_triage: {
        confidence: triage.confidence,
        summary: triage.summary,
        isDataPrivacyRequest: triage.isDataPrivacyRequest,
        estimatedResolutionHours: triage.estimatedResolutionHours,
        triagedAt: new Date().toISOString(),
      },
    };

    const { data: updated } = await admin
      .from("support_tickets")
      .update({
        priority: triage.priority,
        ai_category: triage.category,
        ai_priority: mapSupportPriorityToAiPriority(triage.priority),
        ai_draft_response: triage.suggestedReply,
        triaged_at: new Date().toISOString(),
        metadata,
      })
      .eq("id", data.ticketId)
      .eq("clinic_id", clinicId)
      .select("id, priority, ai_category, ai_priority, ai_draft_response, triaged_at, metadata")
      .single();

    await logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_triaged",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Support ticket ${data.ticketId} triaged`,
      metadata: {
        ticketId: data.ticketId,
        aiCategory: triage.category,
        aiPriority: triage.priority,
        confidence: triage.confidence,
      },
    });

    return apiSuccess({
      ticket: updated,
      triage,
    });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
