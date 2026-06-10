import { NextRequest } from "next/server";
import { triageTicket, applyTriageToTicket, escalateUrgentTicket } from "@/lib/ai/triage";
import { apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { sanitizeIlike } from "@/lib/sanitize-ilike";
import { createClient } from "@/lib/supabase-server";
import { detectLanguage } from "@/lib/support/language-detect";
import { requireTenant } from "@/lib/tenant";
import { whatsappInboundSchema } from "@/lib/validations/support";

const MAX_AUTO_RESPONSES = 5;

/**
 * POST /api/support/whatsapp
 * Handle inbound WhatsApp support messages.
 * Auto-responds with FAQ matches; escalates to human when no match found.
 */
export const POST = withValidation(whatsappInboundSchema, async (data, _request: NextRequest) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const supabase = await createClient();

  const detectedLanguage = detectLanguage(data.message);

  // Find or create an active session for this phone number
  const { data: existingSession } = await supabase
    .from("whatsapp_support_sessions")
    .select("id, ticket_id, session_status, auto_responses_count")
    .eq("clinic_id", clinicId)
    .eq("phone_number", data.phone_number)
    .eq("session_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId = existingSession?.id;
  let ticketId = existingSession?.ticket_id;
  const autoCount = existingSession?.auto_responses_count ?? 0;

  if (!sessionId) {
    // Create a new support ticket
    const { data: ticket } = await supabase
      .from("support_tickets")
      .insert({
        clinic_id: clinicId,
        subject: `WhatsApp: ${data.message.slice(0, 100)}`,
        channel: "whatsapp",
        patient_phone: data.phone_number,
        language: detectedLanguage,
        status: "open",
        priority: "normal",
      })
      .select("id")
      .single();

    ticketId = ticket?.id ?? null;

    // D1: Auto-triage new WhatsApp ticket (fail-open)
    if (ticketId) {
      const subject = `WhatsApp: ${data.message.slice(0, 100)}`;
      const msgs = [{ senderType: "patient", content: data.message }];
      void (async () => {
        try {
          const triage = await triageTicket(subject, msgs);
          await applyTriageToTicket(ticketId as string, clinicId, triage);
          await escalateUrgentTicket(ticketId as string, clinicId, triage);
        } catch (err) {
          logger.warn("Auto-triage failed for WhatsApp ticket", {
            context: "support/whatsapp",
            ticketId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }

    // Create a new WhatsApp session
    const { data: session } = await supabase
      .from("whatsapp_support_sessions")
      .insert({
        clinic_id: clinicId,
        ticket_id: ticketId,
        phone_number: data.phone_number,
        wa_message_id: data.wa_message_id ?? null,
        session_status: "active",
        auto_responses_count: 0,
      })
      .select("id")
      .single();

    sessionId = session?.id;
  }

  // Log inbound message
  if (ticketId) {
    await supabase.from("support_messages").insert({
      clinic_id: clinicId,
      ticket_id: ticketId,
      sender_type: "patient",
      sender_id: data.phone_number,
      content: data.message,
      language: detectedLanguage,
      is_auto_reply: false,
    });
  }

  // Search FAQs for a match
  const { data: faqMatches } = await supabase
    .from("chatbot_faqs")
    .select("id, question, answer, language")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .or(
      `question.ilike.%${sanitizeIlike(data.message.split(" ").slice(0, 3).join(" "))}%,answer.ilike.%${sanitizeIlike(data.message.split(" ").slice(0, 3).join(" "))}%`,
    )
    .limit(3);

  const shouldAutoRespond = autoCount < MAX_AUTO_RESPONSES;
  let autoReply: string | null = null;
  let escalated = false;

  if (faqMatches && faqMatches.length > 0 && shouldAutoRespond) {
    // Return the best FAQ match as auto-reply
    const bestMatch = faqMatches[0];
    autoReply = bestMatch.answer;

    // Log auto-reply
    if (ticketId) {
      await supabase.from("support_messages").insert({
        clinic_id: clinicId,
        ticket_id: ticketId,
        sender_type: "bot",
        content: autoReply,
        language: bestMatch.language,
        is_auto_reply: true,
      });
    }

    // Update auto-response count
    if (sessionId) {
      await supabase
        .from("whatsapp_support_sessions")
        .update({
          auto_responses_count: autoCount + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("clinic_id", clinicId);
    }
  } else {
    // No FAQ match or max auto-responses reached — escalate to human
    escalated = true;

    if (sessionId) {
      await supabase
        .from("whatsapp_support_sessions")
        .update({
          session_status: "escalated",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("clinic_id", clinicId);
    }

    if (ticketId) {
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress", priority: "high" })
        .eq("id", ticketId)
        .eq("clinic_id", clinicId);
    }

    // Provide a language-appropriate escalation message
    const escalationMessages: Record<string, string> = {
      fr: "Merci pour votre message. Un membre de notre équipe va vous répondre rapidement.",
      ar: "شكراً على رسالتكم. سيتواصل معكم أحد أعضاء فريقنا قريباً.",
      en: "Thank you for your message. A team member will get back to you shortly.",
    };
    autoReply = escalationMessages[detectedLanguage] ?? escalationMessages.fr;
  }

  void logAuditEvent({
    supabase,
    action: "whatsapp_support_message",
    type: "admin",
    clinicId,
    description: escalated ? "WhatsApp message escalated to human" : "WhatsApp auto-reply sent",
    metadata: {
      sessionId,
      ticketId,
      escalated,
      language: detectedLanguage,
    },
  });

  return apiSuccess({
    reply: autoReply,
    escalated,
    ticket_id: ticketId,
    session_id: sessionId,
    language: detectedLanguage,
  });
});
