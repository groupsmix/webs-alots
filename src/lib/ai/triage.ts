/**
 * AI auto-triage pipeline — Phase D1.
 *
 * Uses AI SDK v6 `generateObject` with Zod schema for structured triage:
 * - Language detection (fr/ar/darija)
 * - Medical red-flag urgency escalation
 * - Fixed taxonomy tags
 * - One-line summary
 * - Draft reply in patient's language using clinic RAG context
 *
 * Pseudonymises ticket content before the AI call; depseudonymises
 * the draft reply before storing.
 *
 * Fail-open: triage failure must never block ticket creation.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { loadProviderConfigs, selectAvailableProvider } from "@/lib/ai/router";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { createModel } from "./providers";
import { createPseudonymMap, depseudonymise, pseudonymise } from "./pseudonymise";

// ── Triage output schema ──

const TRIAGE_TAGS = [
  "billing",
  "technical",
  "onboarding",
  "whatsapp",
  "account_access",
  "appointment",
  "prescription",
  "lab_results",
  "medical_urgent",
  "data_privacy",
  "feature_request",
  "general",
] as const;

const TRIAGE_URGENCY = ["low", "normal", "high", "urgent"] as const;

const TRIAGE_LANGUAGES = ["fr", "ar", "darija", "en"] as const;

export const triageOutputSchema = z.object({
  language: z.enum(TRIAGE_LANGUAGES),
  urgency: z.enum(TRIAGE_URGENCY),
  tags: z.array(z.enum(TRIAGE_TAGS)).min(1).max(5),
  summary: z.string().min(1).max(300),
  draftReply: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
});

export type TriageOutput = z.infer<typeof triageOutputSchema>;

// ── Medical red-flag keywords ──

const RED_FLAG_PATTERNS = [
  /douleur.*thorac|chest.*pain|ألم.*صدر/i,
  /saignement|bleeding|نزيف/i,
  /fièvre.*(?:enfant|bébé)|(?:enfant|bébé).*fièvre|infant.*fever|baby.*fever|حمى.*طفل|طفل.*حمى/i,
  /difficul.*respir|can'?t.*breath|shortness.*breath|ضيق.*تنفس/i,
  /perte.*consc|perdu.*consc|unconscious|فقدان.*وعي/i,
  /réaction.*allerg|allergic.*reaction|حساسية.*شديدة/i,
  /convuls|seizure|تشنج/i,
  /overdose|surdosage|جرعة.*زائدة/i,
  /suicide|suicid|انتحار/i,
];

export function hasRedFlag(text: string): boolean {
  return RED_FLAG_PATTERNS.some((pattern) => pattern.test(text));
}

// ── Heuristic fallback ──

export function heuristicTriage(text: string): TriageOutput {
  const isRedFlag = hasRedFlag(text);
  return {
    language: "fr",
    urgency: isRedFlag ? "urgent" : "normal",
    tags: isRedFlag ? ["medical_urgent"] : ["general"],
    summary: text.slice(0, 200),
    draftReply:
      "Merci pour votre message. Notre équipe va traiter votre demande dans les meilleurs délais.",
    confidence: 0.3,
  };
}

// ── System prompt ──

const TRIAGE_SYSTEM_PROMPT = `You triage support tickets for Moroccan healthcare clinics (Oltigo Health platform).

Given a ticket's subject and conversation, return a structured triage decision:
- language: detect the ticket language (fr, ar, darija, en)
- urgency: low / normal / high / urgent
  * "urgent" MUST be used for any medical red-flag: chest pain, bleeding, infant fever, breathing difficulty, loss of consciousness, severe allergic reaction, seizure, overdose, or suicidal ideation
  * "high" for account access issues, technical bugs blocking clinic operations, billing disputes
  * "normal" for general questions, feature requests, routine inquiries
  * "low" for positive feedback, non-urgent follow-ups
- tags: 1-5 tags from the fixed taxonomy
- summary: one-line summary (max 300 chars)
- draftReply: helpful reply IN THE PATIENT'S LANGUAGE (French for 'fr', Arabic for 'ar', Darija for 'darija', English for 'en'). The reply is a draft for a human to review before sending — never promise specific medical actions.
- confidence: 0.0-1.0 your confidence in the triage

CRITICAL: If you detect a medical red-flag keyword, urgency MUST be "urgent" regardless of other context.
CRITICAL: The draft reply must NEVER contain medical advice. It should acknowledge the message and indicate a human will respond.
CRITICAL: Never include patient names or personal details in the summary or draft reply.`;

// ── Main triage function ──

export async function triageTicket(
  ticketSubject: string,
  messages: Array<{ senderType: string; content: string }>,
  _ragContext?: string,
): Promise<TriageOutput> {
  const compiledText = [
    `Subject: ${ticketSubject}`,
    ...messages.map((m) => `${m.senderType}: ${m.content}`),
  ].join("\n");

  // Red-flag override: even if AI is disabled, detect urgent medical flags
  const isRedFlag = hasRedFlag(compiledText);

  if (!(await isAIEnabled())) {
    const fallback = heuristicTriage(compiledText);
    if (isRedFlag) fallback.urgency = "urgent";
    return fallback;
  }

  try {
    const supabase = createUntypedAdminClient("ai-triage");
    const configs = await loadProviderConfigs(supabase);
    const provider = await selectAvailableProvider(configs);

    if (!provider) {
      logger.warn("No AI provider available for triage", { context: "ai-triage" });
      return heuristicTriage(compiledText);
    }

    const config = configs.get(provider);
    if (!config) {
      return heuristicTriage(compiledText);
    }

    // Pseudonymise ticket content before AI call
    const pMap = createPseudonymMap();
    const pseudoMessages = messages.map((m) => {
      const p = pseudonymise({ content: m.content, senderType: m.senderType }, pMap);
      return `${String(p.senderType)}: ${String(p.content)}`;
    });
    const pseudoSubject = String(pseudonymise({ subject: ticketSubject }, pMap).subject);
    const pseudoText = [`Subject: ${pseudoSubject}`, ...pseudoMessages].join("\n");

    const model = createModel(provider, config.apiKey);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15_000);

    try {
      const { object } = await generateObject({
        model,
        schema: triageOutputSchema,
        prompt: `Triage this support ticket:\n\n${pseudoText}`,
        system: TRIAGE_SYSTEM_PROMPT,
        temperature: 0.1,
        abortSignal: abortController.signal,
      });

      // Depseudonymise the draft reply
      const result: TriageOutput = {
        ...object,
        draftReply: depseudonymise(object.draftReply, pMap),
      };

      // Red-flag override: AI may miss keywords, so enforce urgency
      if (isRedFlag && result.urgency !== "urgent") {
        result.urgency = "urgent";
        if (!result.tags.includes("medical_urgent")) {
          result.tags = [...result.tags.slice(0, 4), "medical_urgent"];
        }
      }

      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    logger.warn("AI triage failed, falling back to heuristic", {
      context: "ai-triage",
      error: error instanceof Error ? error.message : String(error),
    });
    const fallback = heuristicTriage(compiledText);
    if (isRedFlag) fallback.urgency = "urgent";
    return fallback;
  }
}

// ── Apply triage result to a ticket ──

export async function applyTriageToTicket(
  ticketId: string,
  clinicId: string,
  triage: TriageOutput,
): Promise<void> {
  const admin = createUntypedAdminClient("ai-triage");

  const { error } = await admin
    .from("support_tickets")
    .update({
      ai_urgency: triage.urgency,
      ai_tags: triage.tags,
      ai_summary: triage.summary,
      ai_draft_reply: triage.draftReply,
      ai_triage_at: new Date().toISOString(),
      ai_confidence: triage.confidence,
    })
    .eq("id", ticketId)
    .eq("clinic_id", clinicId);

  if (error) {
    logger.error("Failed to apply triage to ticket", {
      context: "ai-triage",
      ticketId,
      clinicId,
      error,
    });
  }
}

// ── Escalate urgent tickets ──

export async function escalateUrgentTicket(
  ticketId: string,
  clinicId: string,
  triage: TriageOutput,
): Promise<void> {
  if (triage.urgency !== "urgent") return;

  const admin = createUntypedAdminClient("ai-triage");

  // Update ticket priority to urgent
  await admin
    .from("support_tickets")
    .update({ priority: "urgent" })
    .eq("id", ticketId)
    .eq("clinic_id", clinicId);

  // Create a platform alert for the urgent ticket
  await admin.from("platform_alerts").insert({
    clinic_id: clinicId,
    alert_type: "urgent_ticket",
    severity: "critical",
    title: `Ticket urgent détecté: ${triage.summary.slice(0, 100)}`,
    description: `AI triage a identifié un ticket nécessitant une intervention immédiate. Tags: ${triage.tags.join(", ")}`,
    metadata: { ticketId, tags: triage.tags, confidence: triage.confidence },
  });

  logger.warn("Urgent ticket escalated", {
    context: "ai-triage",
    ticketId,
    clinicId,
    tags: triage.tags,
  });
}
