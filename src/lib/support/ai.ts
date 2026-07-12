import { z } from "zod";
import { routeAIRequest, loadProviderConfigs } from "@/lib/ai/router";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

export const SUPPORT_TRIAGE_CATEGORIES = [
  "billing_payment",
  "technical_bug",
  "kyc_onboarding",
  "whatsapp_notifications",
  "account_access",
  "feature_request",
  "data_privacy",
  "other",
] as const;

const supportTriageSchema = z.object({
  category: z.enum(SUPPORT_TRIAGE_CATEGORIES),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(500),
  suggestedReply: z.string().min(1).max(2000),
  isDataPrivacyRequest: z.boolean(),
  estimatedResolutionHours: z.number().min(1).max(168),
});

const supportAssistSchema = z.object({
  canAutoRespond: z.boolean(),
  confidence: z.number().min(0).max(1),
  answer: z.string().min(1).max(2000),
  suggestTicket: z.boolean(),
});

const URGENT_KEYWORDS = [
  "urgent",
  "immediately",
  "critical",
  "down",
  "panne",
  "bloqué",
  "can't access",
  "cannot access",
  "fail",
  "incident",
];

const CATEGORY_KEYWORDS: Array<{
  category: z.infer<typeof supportTriageSchema>["category"];
  terms: string[];
}> = [
  {
    category: "billing_payment",
    terms: [
      "invoice",
      "facture",
      "payment",
      "paiement",
      "refund",
      "remboursement",
      "stripe",
      "cmi",
    ],
  },
  {
    category: "technical_bug",
    terms: ["bug", "error", "erreur", "crash", "broken", "timeout", "500", "slow"],
  },
  {
    category: "kyc_onboarding",
    terms: ["onboarding", "kyc", "verification", "documents", "setup"],
  },
  {
    category: "whatsapp_notifications",
    terms: ["whatsapp", "message", "template", "delivery", "notification"],
  },
  {
    category: "account_access",
    terms: ["login", "password", "access", "account", "connexion", "otp", "mfa"],
  },
  {
    category: "feature_request",
    terms: ["feature", "request", "suggest", "would like", "amélioration", "wishlist"],
  },
  {
    category: "data_privacy",
    terms: [
      "privacy",
      "gdpr",
      "09-08",
      "delete my data",
      "export my data",
      "personal data",
      "portability",
      "effacement",
      "données",
    ],
  },
];

function safeJsonSlice(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

export function heuristicSupportTriage(input: string) {
  const lower = input.toLowerCase();
  const category =
    CATEGORY_KEYWORDS.find((entry) => entry.terms.some((term) => lower.includes(term)))?.category ??
    "other";
  const isDataPrivacyRequest = category === "data_privacy";
  const priority = URGENT_KEYWORDS.some((term) => lower.includes(term))
    ? "urgent"
    : category === "technical_bug" || category === "account_access"
      ? "high"
      : category === "feature_request"
        ? "low"
        : "normal";
  const estimatedResolutionHours =
    priority === "urgent" ? 4 : priority === "high" ? 8 : priority === "normal" ? 24 : 72;

  const suggestedReply = isDataPrivacyRequest
    ? "Merci pour votre demande. Nous avons identifié une requête liée à la protection des données. Notre équipe conformité va vérifier votre identité et revenir vers vous dans les meilleurs délais."
    : priority === "urgent"
      ? "Merci pour votre signalement. Nous avons classé ce ticket comme prioritaire et un membre de l'équipe va intervenir rapidement."
      : "Merci pour votre message. Nous avons bien reçu votre demande et notre équipe support va vous répondre prochainement.";

  return supportTriageSchema.parse({
    category,
    priority,
    confidence: 0.58,
    summary: input.slice(0, 220),
    suggestedReply,
    isDataPrivacyRequest,
    estimatedResolutionHours,
  });
}

export async function maybeGenerateSupportTriage(input: string) {
  if (!(await isAIEnabled())) {
    return heuristicSupportTriage(input);
  }

  try {
    const supabase = createUntypedAdminClient("ai-route");
    const configs = await loadProviderConfigs(supabase);
    const response = await routeAIRequest(
      {
        task: "classify",
        complexity: "medium",
        prompt: `Support ticket content:\n${input}\n\nReturn strict JSON only.`,
        systemPrompt:
          "You triage SaaS healthcare support tickets for Moroccan clinics. Return JSON with keys: category, priority, confidence, summary, suggestedReply, isDataPrivacyRequest, estimatedResolutionHours. Categories must be one of billing_payment, technical_bug, kyc_onboarding, whatsapp_notifications, account_access, feature_request, data_privacy, other. Priorities must be one of low, normal, high, urgent. Keep summary under 300 chars and suggestedReply under 500 chars.",
        maxTokens: 500,
        temperature: 0.2,
      },
      configs,
      supabase,
    );

    return supportTriageSchema.parse(JSON.parse(safeJsonSlice(response.text)));
  } catch (error) {
    logger.warn("Support triage AI fallback to heuristic", {
      context: "support-ai",
      error,
    });
    return heuristicSupportTriage(input);
  }
}

export async function maybeGenerateSupportAssistAnswer(input: {
  subject: string;
  description: string;
  faqContext: Array<{
    question: string;
    answer: string;
    category?: string | null;
    language?: string | null;
  }>;
}) {
  const fallbackAnswer =
    input.faqContext[0]?.answer ??
    "Merci pour votre message. Notre équipe support reviendra vers vous rapidement.";

  if (!(await isAIEnabled())) {
    return supportAssistSchema.parse({
      canAutoRespond: input.faqContext.length > 0,
      confidence: input.faqContext.length > 0 ? 0.6 : 0.2,
      answer: fallbackAnswer,
      suggestTicket: input.faqContext.length === 0,
    });
  }

  try {
    const supabase = createUntypedAdminClient("ai-route");
    const configs = await loadProviderConfigs(supabase);
    const response = await routeAIRequest(
      {
        task: "summarize",
        complexity: "medium",
        prompt: `Subject: ${input.subject}\nDescription: ${input.description}\n\nFAQ context:\n${JSON.stringify(input.faqContext)}`,
        systemPrompt:
          "You answer support requests using only the provided FAQ context when possible. Return strict JSON with keys: canAutoRespond, confidence, answer, suggestTicket. If the FAQ context is insufficient, set canAutoRespond=false and suggestTicket=true.",
        maxTokens: 500,
        temperature: 0.2,
      },
      configs,
      supabase,
    );

    return supportAssistSchema.parse(JSON.parse(safeJsonSlice(response.text)));
  } catch (error) {
    logger.warn("Support assist AI fallback to FAQ match", {
      context: "support-ai",
      error,
    });
    return supportAssistSchema.parse({
      canAutoRespond: input.faqContext.length > 0,
      confidence: input.faqContext.length > 0 ? 0.6 : 0.2,
      answer: fallbackAnswer,
      suggestTicket: input.faqContext.length === 0,
    });
  }
}

export function mapSupportPriorityToAiPriority(priority: "low" | "normal" | "high" | "urgent") {
  switch (priority) {
    case "urgent":
      return "critical";
    case "high":
      return "high";
    case "normal":
      return "medium";
    case "low":
    default:
      return "low";
  }
}
