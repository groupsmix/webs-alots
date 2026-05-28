import { NextRequest } from "next/server";
import { resolveAIConfig } from "@/lib/ai/config";
import { validateAIOutput } from "@/lib/ai/validate-output";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { apiSuccess, apiError, apiRateLimited } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { fetchChatbotContext, buildSystemPrompt, getBasicResponse } from "@/lib/chatbot-data";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { chatRequestSchema } from "@/lib/validations";
/**
 * POST /api/chat
 *
 * Tenant-aware chatbot endpoint. Supports 3 intelligence levels:
 *   - basic:    Keyword matching against DB data + custom FAQs (no AI)
 *   - smart:    Cloudflare Workers AI (free tier)
 *   - advanced: OpenAI-compatible API (paid)
 *
 * The clinic is resolved from the tenant context (set by middleware from subdomain).
 * clinicId in the request body is ignored — tenant MUST come from request context.
 */
/** Max number of conversation history messages sent to the LLM. */
const MAX_HISTORY_LENGTH = 20;

/** Max length of a single user message (characters). */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Sanitize user-supplied text before it reaches the LLM.
 *
 * F-36: DEFENCE-IN-DEPTH ONLY — this regex-based filter is NOT a
 * security boundary. It can be bypassed by Unicode confusables,
 * homoglyphs, right-to-left overrides, and novel prompt structures.
 *
 * Primary protection comes from:
 *   1. Labelling user content as a "user" turn at the model-call boundary
 *   2. The system prompt's instruction-following directives
 *   3. Output guardrails / content filtering on the response
 *
 * This sanitiser provides a lightweight first pass that catches the
 * most common copy-paste injection attempts. Keep it, but do not
 * rely on it as the sole defense.
 */
function sanitizeUserInput(text: string): string {
  return (
    text
      // Normalize Unicode to NFKC to defeat homoglyph / compatibility-char
      // bypasses (e.g. fullwidth "ｓｙｓｔｅｍ" → "system")
      .normalize("NFKC")
      // A101-02: Strip bidi overrides (RLO/LRO/RLE/LRE/PDF/RLI/LRI/FSI/PDI)
      // that can reorder visible text to smuggle injections past visual review
      .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, "")
      // Strip zero-width / invisible characters often used to evade filters
      .replace(/[\u200B-\u200D\u2028-\u202F\uFEFF\u00AD]/g, "")
      // Strip attempts to impersonate system/assistant roles
      // (covers whitespace/zero-width tricks between characters)
      // PERF-01: ^-anchored so .replace is O(n); safe from ReDoS.
      .replace(/^\s*(s\s*y\s*s\s*t\s*e\s*m|a\s*s\s*s\s*i\s*s\s*t\s*a\s*n\s*t)\s*:/gi, "")
      // Remove markdown-style "instruction" fences
      .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
      // Strip ChatML-style markers (e.g. <|im_start|>system)
      .replace(/<\|im_(start|end)\|>\s*(system|assistant)?/gi, "")
      // Strip XML-style role tags
      .replace(/<\/?(system|assistant|instruction)[^>]*>/gi, "")
      // Strip "ignore all previous instructions" style attacks
      .replace(
        /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi,
        "[filtered]",
      )
      // Collapse excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * AI-002: Increment monthly AI token usage for the clinic.
 * Uses upsert so the first call in a month creates the row.
 * Note: ai_usage table is created by migration 00083.
 */
async function trackAIUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  await supabase
    .from("ai_usage")
    .upsert(
      {
        clinic_id: clinicId,
        month,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        request_count: 1,
      },
      { onConflict: "clinic_id,month" },
    )
    .then(
      () => {},
      () => {},
    );
}

/**
 * A72-03/A108-03: Wrap the shared validator with the EU AI Act
 * transparency prefix required on chat responses.
 */
function validateAndPrefixAIOutput(text: string): string | null {
  const safe = validateAIOutput(text);
  if (!safe) return null;
  return `[AI‑Generated] ${safe}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const POST = withValidation(chatRequestSchema, async (body, request: NextRequest) => {
  // A107-03: Global AI kill switch
  if (process.env.AI_DISABLED === "true") {
    return apiError("AI features are temporarily disabled", 503, "AI_DISABLED");
  }

  // Resolve clinic ID strictly from tenant context (middleware headers)
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  const lastMessage = body.messages[body.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
    return apiError("Last message must be a non-empty user message");
  }

  // Sanitize and truncate messages; limit conversation history length.
  // V-01: Truncate assistant messages too — an attacker can fabricate
  // long assistant turns in the request body to inflate token cost.
  const sanitizedMessages = body.messages.slice(-MAX_HISTORY_LENGTH).map((m) => ({
    ...m,
    content:
      m.role === "user"
        ? sanitizeUserInput(m.content).slice(0, MAX_MESSAGE_LENGTH)
        : m.content.slice(0, MAX_MESSAGE_LENGTH),
  }));

  // Fetch clinic context from Supabase
  const ctx = await fetchChatbotContext(clinicId);

  // Check if chatbot is enabled for this clinic
  if (ctx.chatbotConfig && !ctx.chatbotConfig.enabled) {
    return apiError("Chatbot is not enabled for this clinic", 403, "FORBIDDEN");
  }

  // Determine intelligence level
  const intelligence = ctx.chatbotConfig?.intelligence ?? "basic";

  // --- BASIC: keyword matching, no AI ---
  // Basic tier is allowed without authentication since it uses no AI
  // API and is purely keyword-based. This allows public visitors to
  // interact with the chatbot quick-reply buttons.
  if (intelligence === "basic") {
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
    });
  }

  // SEC-01: Require authentication for AI-powered tiers (smart / advanced)
  // to prevent bot-driven abuse of Cloudflare Workers AI quota and OpenAI API.
  const supabaseForAuth = await createClient();
  const {
    data: { user: chatUser },
  } = await supabaseForAuth.auth.getUser();
  if (!chatUser) {
    // Fall back to basic keyword matching for unauthenticated users
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
    });
  }

  // AI-002: Check monthly AI token budget before making any AI call.
  // The ai_usage table tracks per-clinic monthly consumption.
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01"; // e.g., "2026-05-01"
  const { data: usage } = await supabaseForAuth
    .from("ai_usage")
    .select("tokens_in, tokens_out")
    .eq("clinic_id", clinicId)
    .eq("month", currentMonth)
    .maybeSingle();

  const AI_MONTHLY_TOKEN_LIMIT = 500_000;
  const totalTokens = (usage?.tokens_in ?? 0) + (usage?.tokens_out ?? 0);
  if (totalTokens >= AI_MONTHLY_TOKEN_LIMIT) {
    return apiError(
      "Monthly AI token budget exceeded. Please upgrade your plan or wait until next month.",
      429,
      "AI_BUDGET_EXCEEDED",
    );
  }

  // --- SMART: Cloudflare Workers AI (free) ---
  if (intelligence === "smart") {
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfApiToken = process.env.CLOUDFLARE_AI_API_TOKEN;

    if (!cfAccountId || !cfApiToken) {
      const reply = getBasicResponse(lastMessage.content, ctx);
      return apiSuccess({
        message: { role: "assistant" as const, content: reply },
      });
    }

    const systemPrompt = buildSystemPrompt(ctx);
    const cfMessages = [{ role: "system" as const, content: systemPrompt }, ...sanitizedMessages];

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: cfMessages,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (cfResponse.ok) {
      const cfData = (await cfResponse.json()) as { result?: { response?: string } };
      const rawContent = cfData.result?.response;
      if (rawContent) {
        // API-010: Validate AI output before returning to client
        const content = validateAndPrefixAIOutput(rawContent);
        if (!content) {
          logger.warn("AI output rejected by safety validator", {
            context: "chat/output-safety",
            clinicId,
          });
          const reply = getBasicResponse(lastMessage.content, ctx);
          return apiSuccess({
            message: { role: "assistant" as const, content: reply },
          });
        }
        // F-AI-08: Audit log AI invocation
        void logAuditEvent({
          supabase: supabaseForAuth,
          action: "ai_chat_invocation",
          type: "admin",
          clinicId,
          actor: chatUser.id,
          description: "Chatbot AI response (smart tier)",
          metadata: { tier: "smart", model: "llama-3.1-8b-instruct" },
        }).catch(() => {});
        // AI-002: Track estimated token usage (rough: 4 chars ≈ 1 token)
        void trackAIUsage(
          supabaseForAuth,
          clinicId,
          Math.ceil(lastMessage.content.length / 4),
          Math.ceil(content.length / 4),
        );
        return apiSuccess({
          message: { role: "assistant" as const, content },
        });
      }
    } else {
      // Log non-OK responses (including 429 rate-limit / quota exhaustion)
      logger.warn("Cloudflare AI request failed", {
        context: "chat/cloudflare-ai",
        status: cfResponse.status,
        clinicId,
        statusText: cfResponse.statusText,
      });
    }

    // Fallback to basic keyword matching when AI is unavailable
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
    });
  }

  // --- ADVANCED: OpenAI-compatible API (paid) ---
  // F-AI-01: Kill switch + F-AI-05: URL allowlist + F-AI-07: pinned model
  const aiResult = await resolveAIConfig();
  if (!aiResult.ok) {
    // Graceful fallback to basic matching when AI is unavailable
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
    });
  }
  const { apiKey, baseUrl, model } = aiResult.config;

  const systemPrompt = buildSystemPrompt(ctx);
  const apiMessages = [{ role: "system" as const, content: systemPrompt }, ...sanitizedMessages];

  const apiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      stream: true,
      max_tokens: 500,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!apiResponse.ok) {
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
    });
  }

  // F-AI-08: Audit log AI invocation (advanced tier)
  void logAuditEvent({
    supabase: supabaseForAuth,
    action: "ai_chat_invocation",
    type: "admin",
    clinicId,
    actor: chatUser.id,
    description: "Chatbot AI response (advanced tier)",
    metadata: { tier: "advanced", model },
  }).catch(() => {});
  // AI-002: Track estimated token usage for advanced tier.
  // Streaming prevents exact counts; estimate from input length + max_tokens.
  void trackAIUsage(
    supabaseForAuth,
    clinicId,
    Math.ceil(sanitizedMessages.reduce((a, m) => a + m.content.length, 0) / 4),
    125, // max_tokens=500 → ~125 estimated output tokens
  );

  // Stream the response back to the client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = apiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line === "data: [DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (parseErr) {
                logger.warn("Malformed SSE chunk skipped", {
                  context: "chat/stream",
                  error: parseErr,
                });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
