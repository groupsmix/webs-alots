/**
 * POST /api/chat/stream
 *
 * Streaming AI chat endpoint using Vercel AI SDK patterns.
 * Returns Server-Sent Events for real-time token streaming.
 *
 * Access: all authenticated roles
 * Tenant-scoped: system prompt includes clinic-specific context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createStreamingChatResponse } from "@/lib/ai/streaming-chat";
import { apiError } from "@/lib/api-response";
import { buildSystemPrompt, fetchChatbotContext } from "@/lib/chatbot-data";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/** Maximum number of messages in the conversation history. */
const MAX_HISTORY = 20;

/** Maximum length of a single message. */
const MAX_MESSAGE_LENGTH = 2000;

export const POST = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    // F-AI-01: Early kill switch (checks both env var AND KV flag)
    if (!(await isAIEnabled())) {
      return apiError("AI features are disabled", 503, "AI_DISABLED");
    }

    const tenant = await requireTenant();

    let body: { messages?: Array<{ role: string; content: string }>; enable_tools?: boolean };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return apiError("Corps JSON invalide", 400, "INVALID_JSON");
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return apiError("Le champ 'messages' est requis", 400, "MISSING_MESSAGES");
    }

    // Validate and sanitize messages
    const messages = body.messages.slice(-MAX_HISTORY).map((msg) => ({
      role: (msg.role === "user" || msg.role === "assistant" ? msg.role : "user") as
        | "user"
        | "assistant",
      content: typeof msg.content === "string" ? msg.content.slice(0, MAX_MESSAGE_LENGTH) : "",
    }));

    // Build clinic-aware system prompt
    const chatContext = await fetchChatbotContext(tenant.clinicId);
    const systemPrompt = buildSystemPrompt(chatContext);

    logger.info("Streaming chat request", {
      context: "chat-stream",
      clinicId: tenant.clinicId,
      messageCount: messages.length,
    });

    const stream = createStreamingChatResponse({
      messages,
      clinicId: tenant.clinicId,
      systemPrompt,
      enableTools: body.enable_tools ?? false,
      maxTokens: 1024,
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"],
);
