import { NextRequest, NextResponse } from "next/server";
import { fetchChatbotContext, buildSystemPrompt, getBasicResponse } from "@/lib/chatbot-data";
import { TENANT_HEADERS } from "@/lib/tenant";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

interface ChatRequestBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  clinicId?: string;
}

/**
 * POST /api/chat
 *
 * Tenant-aware chatbot endpoint. Supports 3 intelligence levels:
 *   - basic:    Keyword matching against DB data + custom FAQs (no AI)
 *   - smart:    Cloudflare Workers AI (free tier)
 *   - advanced: OpenAI-compatible API (paid)
 *
 * The clinic is resolved from:
 *   1. x-tenant-clinic-id header (set by middleware from subdomain)
 *   2. clinicId in request body (fallback)
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
    // Resolve clinic ID from tenant headers or request body
    const tenantClinicId = request.headers.get(TENANT_HEADERS.clinicId);
    const body = (await request.json()) as ChatRequestBody;
    const clinicId = tenantClinicId || body.clinicId;

    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic context. Please access via a clinic subdomain." },
        { status: 400 },
      );
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 },
      );
    }

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
    if (intelligence === "basic") {
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
      }

      const reply = getBasicResponse(lastMessage.content, ctx);
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    // --- ADVANCED: OpenAI-compatible API (paid) ---
    // The advanced tier consumes paid API credits. Require authentication
    // to prevent unauthenticated abuse.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required for advanced AI chat" },
        { status: 401 },
      );
    }

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
    });

    if (!apiResponse.ok) {
      console.error("AI API error:", apiResponse.status, apiResponse.statusText);
      const reply = getBasicResponse(lastMessage.content, ctx);
      return NextResponse.json({
        message: { role: "assistant" as const, content: reply },
      });
    }

    // MED-10: Set a timeout for the upstream SSE stream to prevent
    // holding the worker/connection indefinitely if the AI provider hangs.
    const STREAM_TIMEOUT_MS = 30_000;

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

        // MED-10: Abort the stream if no data arrives within the timeout
        let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          console.warn("[chat] SSE stream timed out after", STREAM_TIMEOUT_MS, "ms");
          reader.cancel().catch(() => {});
        }, STREAM_TIMEOUT_MS);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Reset timeout on each chunk received
            if (timeoutId) { clearTimeout(timeoutId); }
            timeoutId = setTimeout(() => {
              console.warn("[chat] SSE stream timed out after", STREAM_TIMEOUT_MS, "ms");
              reader.cancel().catch(() => {});
            }, STREAM_TIMEOUT_MS);

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
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          }
        } finally {
          if (timeoutId) { clearTimeout(timeoutId); }
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
    console.error("[POST /api/chat] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 },
    );
  }
}
