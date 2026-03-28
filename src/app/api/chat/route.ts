import { NextRequest, NextResponse } from "next/server";
import { fetchChatbotContext, buildSystemPrompt, getBasicResponse } from "@/lib/chatbot-data";
import { requireTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase-server";
import { chatLimiter, extractClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { chatRequestSchema, safeParse } from "@/lib/validations";
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
 * Defence-in-depth: this is NOT a substitute for proper output
 * filtering / guardrails on the LLM response, but it raises the
 * bar against common injection patterns.
 */
function sanitizeUserInput(text: string): string {
  return (
    text
      // Normalize Unicode to NFKC to defeat homoglyph / compatibility-char
      // bypasses (e.g. fullwidth "ｓｙｓｔｅｍ" → "system")
      .normalize("NFKC")
      // Strip zero-width / invisible characters often used to evade filters
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
      // Strip attempts to impersonate system/assistant roles
      // (covers whitespace/zero-width tricks between characters)
      .replace(/^\s*(s\s*y\s*s\s*t\s*e\s*m|a\s*s\s*s\s*i\s*s\s*t\s*a\s*n\s*t)\s*:/gi, "")
      // Remove markdown-style "instruction" fences
      .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
      // Strip ChatML-style markers (e.g. <|im_start|>system)
      .replace(/<\|im_(start|end)\|>\s*(system|assistant)?/gi, "")
      // Strip XML-style role tags
      .replace(/<\/?(system|assistant|instruction)[^>]*>/gi, "")
      // Strip "ignore all previous instructions" style attacks
      .replace(/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi, "[filtered]")
      // Collapse excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export async function POST(request: NextRequest) {
  try {
    // Defence-in-depth: per-IP rate limit for the chat endpoint.
    // The middleware also applies chatLimiter, but checking here guards
    // against deployment configs that skip the middleware layer.
    const clientIp = extractClientIp(request);
    const allowed = await chatLimiter.check(`chat:${clientIp}`);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    // Resolve clinic ID strictly from tenant context (middleware headers)
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const raw = await request.json();
    const parsed = safeParse(chatRequestSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const lastMessage = body.messages[body.messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
      return NextResponse.json(
        { error: "Last message must be a non-empty user message" },
        { status: 400 },
      );
    }

    // Sanitize and truncate user messages; limit conversation history length
    const sanitizedMessages = body.messages
      .slice(-MAX_HISTORY_LENGTH)
      .map((m) => ({
        ...m,
        content:
          m.role === "user"
            ? sanitizeUserInput(m.content).slice(0, MAX_MESSAGE_LENGTH)
            : m.content,
      }));

    // Fetch clinic context from Supabase
    const ctx = await fetchChatbotContext(clinicId);

    // Check if chatbot is enabled for this clinic
    if (ctx.chatbotConfig && !ctx.chatbotConfig.enabled) {
      return NextResponse.json(
        { error: "Chatbot is not enabled for this clinic" },
        { status: 403 },
      );
    }

    // Determine intelligence level
    const intelligence = ctx.chatbotConfig?.intelligence ?? "basic";

    // --- BASIC: keyword matching, no AI ---
    // Basic tier is allowed without authentication since it uses no AI
    // API and is purely keyword-based. This allows public visitors to
    // interact with the chatbot quick-reply buttons.
    if (intelligence === "basic") {
      const reply = getBasicResponse(lastMessage.content, ctx);
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    // SEC-01: Require authentication for AI-powered tiers (smart / advanced)
    // to prevent bot-driven abuse of Cloudflare Workers AI quota and OpenAI API.
    const supabaseForAuth = await createClient();
    const { data: { user: chatUser } } = await supabaseForAuth.auth.getUser();
    if (!chatUser) {
      // Fall back to basic keyword matching for unauthenticated users
      const reply = getBasicResponse(lastMessage.content, ctx);
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    // --- SMART: Cloudflare Workers AI (free) ---
    if (intelligence === "smart") {
      const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const cfApiToken = process.env.CLOUDFLARE_AI_API_TOKEN;

      if (!cfAccountId || !cfApiToken) {
        const reply = getBasicResponse(lastMessage.content, ctx);
        return NextResponse.json({
          message: { role: "assistant" as const, content: reply },
        });
      }

      const systemPrompt = buildSystemPrompt(ctx);
      const cfMessages = [
        { role: "system" as const, content: systemPrompt },
        ...sanitizedMessages,
      ];

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
        const content = cfData.result?.response;
        if (content) {
          return NextResponse.json({
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
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    // --- ADVANCED: OpenAI-compatible API (paid) ---
    // Authentication is already enforced above (SEC-01) for all tiers.
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      const reply = getBasicResponse(lastMessage.content, ctx);
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    const systemPrompt = buildSystemPrompt(ctx);
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...sanitizedMessages,
    ];

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
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

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
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
                    );
                  }
                } catch (parseErr) {
                  logger.warn("Malformed SSE chunk skipped", { context: "chat/stream", error: parseErr });
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
  } catch (err) {
    logger.warn("Operation failed", { context: "chat", error: err });
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 },
    );
  }
}
