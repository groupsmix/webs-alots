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
 * Strips common prompt-injection markers while keeping normal punctuation.
 */
function sanitizeUserInput(text: string): string {
  return text
    // Strip attempts to impersonate system/assistant roles
    .replace(/^\s*(system|assistant)\s*:/gi, "")
    // Remove markdown-style "instruction" fences that could confuse the model
    .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
    // Collapse excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
                } catch {
                  // Skip malformed JSON chunks
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
    console.error("[POST /api/chat] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 },
    );
  }
}
