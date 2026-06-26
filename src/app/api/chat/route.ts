import { NextRequest } from "next/server";
import { fetchWithAICircuitBreaker } from "@/lib/ai/circuit-breaker";
import { resolveAIConfig, AI_RESPONSE_DISCLAIMER } from "@/lib/ai/config";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { getAIDisclaimer } from "@/lib/ai-disclaimer";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { apiSuccess, apiError, apiRateLimited } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { fetchChatbotContext, buildSystemPrompt, getBasicResponse } from "@/lib/chatbot-data";
import { getWorkerBinding } from "@/lib/cf-bindings";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { detectLanguage } from "@/lib/support/language-detect";
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

interface AuthenticatedChatUser {
  id: string;
  email?: string | null;
  [key: string]: unknown;
}

type ChatAuthCapableSupabaseClient = Awaited<ReturnType<typeof createClient>> & {
  auth: {
    getUser: () => Promise<{ data: { user: AuthenticatedChatUser | null } }>;
  };
};

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
      // WP-01: Filter "ignore previous instructions" style injection
      // attempts using substring checks instead of a regex. The original
      // regex had nested optional quantifiers (\s+(all\s+)?) that caused
      // catastrophic backtracking (ReDoS) on crafted input.
      .replace(/[^\n]+/g, (line) => {
        const lower = line.toLowerCase();
        if (!lower.includes("ignore")) return line;
        const hasTarget = ["previous", "prior", "above", "earlier"].some((w) => lower.includes(w));
        if (!hasTarget) return line;
        const hasObject = ["instruction", "prompt", "context"].some((w) => lower.includes(w));
        return hasObject ? "[filtered]" : line;
      })
      // Collapse excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * AI-002 / AUDIT P0-2: Increment monthly AI token usage for the clinic.
 *
 * Uses the atomic `increment_clinic_ai_usage` RPC (migration 00181). The
 * previous upsert OVERWROTE the monthly row with the latest request's token
 * counts instead of incrementing, so usage never accumulated and the
 * AI_MONTHLY_TOKEN_LIMIT budget check never triggered. Errors are now logged
 * instead of silently swallowed so degraded tracking is observable.
 */
async function trackAIUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  // The generated DB types may lag behind the migration; call the RPC
  // through a narrow untyped signature.
  const rpc = supabase.rpc.bind(supabase) as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;

  const { error } = await rpc("increment_clinic_ai_usage", {
    p_clinic_id: clinicId,
    p_tokens_in: Math.max(0, Math.ceil(tokensIn)),
    p_tokens_out: Math.max(0, Math.ceil(tokensOut)),
  });

  if (error) {
    logger.warn("increment_clinic_ai_usage RPC failed — AI budget tracking degraded", {
      context: "chat/usage-tracking",
      clinicId,
      error: error.message,
    });
  }
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
  // F-AI-01: Global AI kill switch (checks both env var AND KV flag)
  if (!(await isAIEnabled())) {
    return apiError("AI features are disabled", 503, "AI_DISABLED");
  }

  // Resolve clinic ID strictly from tenant context (middleware headers)
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  const lastMessage = body.messages[body.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
    return apiError("Last message must be a non-empty user message");
  }

  // TF-03: Strip caller-supplied assistant turns — only accept user-role
  // messages from clients. Attacker-controlled assistant turns can fabricate
  // conversation history and manipulate the LLM.
  const userOnlyMessages = body.messages.filter((m) => m.role === "user");

  // WP-03: Truncate each message BEFORE calling sanitizeUserInput so the
  // O(n²) regex inside sanitize operates on bounded input (≤2000 chars).
  const sanitizedMessages = userOnlyMessages.slice(-MAX_HISTORY_LENGTH).map((m) => ({
    ...m,
    content: sanitizeUserInput(m.content.slice(0, MAX_MESSAGE_LENGTH)),
  }));

  // AA-02: Authenticate BEFORE fetching clinic config to avoid leaking
  // tenant configuration to unauthenticated callers on non-basic tiers.
  // Basic tier is resolved after the config fetch since it needs no auth.
  const supabaseForAuth = (await createClient()) as ChatAuthCapableSupabaseClient;
  const {
    data: { user: chatUser },
  } = await supabaseForAuth.auth.getUser();

  // Fetch clinic context from Supabase
  const ctx = await fetchChatbotContext(clinicId);

  // Check if chatbot is enabled for this clinic
  if (ctx.chatbotConfig && !ctx.chatbotConfig.enabled) {
    return apiError("Chatbot is not enabled for this clinic", 403, "FORBIDDEN");
  }

  // Determine intelligence level
  const intelligence = ctx.chatbotConfig?.intelligence ?? "smart";

  // --- BASIC: keyword matching, no AI ---
  // Basic tier is allowed without authentication since it uses no AI
  // API and is purely keyword-based. This allows public visitors to
  // interact with the chatbot quick-reply buttons.
  if (intelligence === "basic") {
    const reply = getBasicResponse(lastMessage.content, ctx);
    const detectedLang = detectLanguage(lastMessage.content);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
      disclaimer: getAIDisclaimer(),
      language: detectedLang,
    });
  }

  // SEC-01: Require authentication for AI-powered tiers (smart / advanced)
  // to prevent bot-driven abuse of Cloudflare Workers AI quota and OpenAI API.
  if (!chatUser) {
    // Fall back to basic keyword matching for unauthenticated users
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
      disclaimer: getAIDisclaimer(),
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
    // In the Cloudflare Workers runtime (via @opennextjs/cloudflare), secrets
    // are stored on getCloudflareContext().env, NOT on process.env. Using
    // process.env here ALWAYS returned undefined in production, silently
    // disabling the smart tier and falling back to keyword matching for every
    // chatbot message. Use getWorkerBinding() with a process.env fallback for
    // local dev — same pattern as router.ts isWorkersAIConfigured().
    const cfAccountId =
      (await getWorkerBinding<string>("CLOUDFLARE_ACCOUNT_ID"))
      ?? process.env.CLOUDFLARE_ACCOUNT_ID; // nosemgrep: semgrep.env-access — local dev fallback
    const cfApiToken =
      (await getWorkerBinding<string>("CLOUDFLARE_AI_API_TOKEN"))
      ?? (await getWorkerBinding<string>("CLOUDFLARE_AI_TOKEN"))
      ?? process.env.CLOUDFLARE_AI_API_TOKEN // nosemgrep: semgrep.env-access — local dev fallback
      ?? process.env.CLOUDFLARE_AI_TOKEN;

    if (!cfAccountId || !cfApiToken) {
      const reply = getBasicResponse(lastMessage.content, ctx);
      return apiSuccess({
        message: { role: "assistant" as const, content: reply },
        disclaimer: getAIDisclaimer(),
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
            disclaimer: getAIDisclaimer(),
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
          ...AI_RESPONSE_DISCLAIMER,
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
      disclaimer: getAIDisclaimer(),
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
      disclaimer: getAIDisclaimer(),
    });
  }
  const { apiKey, baseUrl, model, seed } = aiResult.config;

  const systemPrompt = buildSystemPrompt(ctx);
  const apiMessages = [{ role: "system" as const, content: systemPrompt }, ...sanitizedMessages];

  const doFetch = (withExtras: boolean) =>
    fetchWithAICircuitBreaker(
      `${baseUrl}/chat/completions`,
      {
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
          ...(withExtras
            ? {
                // AUDIT P1-6: ask for exact token usage in the final SSE chunk
                // instead of estimating (the old hardcoded estimate of 125
                // output tokens undercounted by up to 4x).
                stream_options: { include_usage: true },
                // F-AI-14 / AUDIT P1-11: reproducibility seed — also logged in
                // the audit event below so outputs can be reproduced.
                seed,
              }
            : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: aiResult.config.provider },
    );

  // Some OpenAI-compatible servers reject unknown params (stream_options /
  // seed). Retry once without the extras before degrading to basic tier.
  let apiResponse = await doFetch(true);
  if (!apiResponse.ok && apiResponse.status >= 400 && apiResponse.status < 500) {
    apiResponse = await doFetch(false);
  }

  if (!apiResponse.ok) {
    const reply = getBasicResponse(lastMessage.content, ctx);
    return apiSuccess({
      message: { role: "assistant" as const, content: reply },
      disclaimer: getAIDisclaimer(),
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
    metadata: { tier: "advanced", model, seed },
  }).catch(() => {});

  /**
   * AUDIT P0-4: Stream the response back to the client WITH output
   * validation. The previous implementation piped raw model deltas straight
   * to the client — no PII redaction, no role-elevation check, no
   * [AI-Generated] prefix — so the paid "advanced" tier had weaker
   * guardrails than the free "smart" tier.
   *
   * Strategy: accumulate the raw text, run the shared validator over the
   * full accumulated text on every delta, and only flush the validated
   * prefix minus a holdback window. The redaction patterns match tokens
   * < ~50 chars, so a 160-char holdback guarantees already-flushed text can
   * never be retroactively affected by a match completing later.
   *
   * Also fixed here (AUDIT P1-6): SSE lines split across network chunks were
   * previously dropped (chunk.split("\n") without cross-read buffering).
   */
  const HOLDBACK_CHARS = 160;
  let rawContent = "";
  let emittedLen = 0;
  let rejected = false;
  let streamUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const reader = apiResponse.body?.getReader();
      const encoder = new TextEncoder();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();

      const flush = (final: boolean): void => {
        const validated = validateAndPrefixAIOutput(rawContent);
        if (validated === null) {
          // Role-elevation language detected — stop and retract.
          rejected = true;
          logger.warn("AI output rejected by safety validator (advanced tier)", {
            context: "chat/output-safety",
            clinicId,
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                content: "\n\n[Réponse retirée — contenu rejeté par le validateur de sécurité]",
              })}\n\n`,
            ),
          );
          return;
        }
        const stableLen = final
          ? validated.length
          : Math.max(emittedLen, validated.length - HOLDBACK_CHARS);
        if (stableLen > emittedLen) {
          const delta = validated.slice(emittedLen, stableLen);
          emittedLen = stableLen;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
        }
      };

      let lineBuffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          // Keep the (possibly partial) last line for the next read.
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: ")) {
              continue;
            }
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.usage) streamUsage = json.usage;
              const content = json.choices?.[0]?.delta?.content;
              if (content && !rejected) {
                rawContent += content;
                flush(false);
              }
            } catch (parseErr) {
              logger.warn("Malformed SSE chunk skipped", {
                context: "chat/stream",
                error: parseErr,
              });
            }
          }
          if (rejected) break;
        }
        if (!rejected) flush(true);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        reader.releaseLock();
        try {
          controller.close();
        } catch {
          // already closed
        }
        // AUDIT P1-6: exact token accounting after the stream completes;
        // falls back to a length-based estimate of the ACTUAL output.
        const tokensIn =
          streamUsage?.prompt_tokens ??
          Math.ceil(apiMessages.reduce((a, m) => a + m.content.length, 0) / 4);
        const tokensOut = streamUsage?.completion_tokens ?? Math.ceil(rawContent.length / 4);
        void trackAIUsage(supabaseForAuth, clinicId, tokensIn, tokensOut);
      }
    },
  });

  // A109-01: Include AI disclaimer in streaming response header.
  // AUDIT P2-12: HTTP header values must be ByteString (Latin-1). The French
  // and Arabic disclaimers contain non-Latin-1 characters which throw a
  // TypeError in the Workers runtime — URI-encode the header value. No
  // client currently reads this header; clients should decodeURIComponent.
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-AI-Generated": "true",
      "X-AI-Disclaimer": encodeURIComponent(getAIDisclaimer()),
    },
  });
});
