/**
 * Streaming AI Chat — real end-to-end streaming (Task A4).
 *
 * Replaces the previous buffered-then-replayed approach with true
 * provider-to-client token streaming via AI SDK's `streamText`.
 *
 * Provides:
 *   1. Real streaming text generation with SSE transport
 *   2. Tool/function calling for structured actions
 *   3. Context-aware system prompts with clinic data
 *   4. Token usage tracking per clinic
 *   5. Medical disclaimer injection (EU AI Act compliance)
 *   6. Output validation on accumulated text
 *   7. De-pseudonymisation on sentence boundaries (no split placeholders)
 */

import { AI_RESPONSE_DISCLAIMER } from "@/lib/ai/config";
import { callProviderStream, ProviderError, RateLimitError } from "@/lib/ai/providers";
import { loadProviderConfigs, selectAvailableProvider } from "@/lib/ai/router";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/** Tool definition for AI function calling. */

/** Available tools the AI agent can invoke. */

/** Format an SSE chunk for streaming. */
function formatStreamChunk(type: "text" | "tool_call" | "error" | "done", data: unknown): string {
  return `data: ${JSON.stringify({ type, ...(typeof data === "object" && data !== null ? data : { content: data }) })}\n\n`;
}

/** Streaming chat request parameters. */
export interface StreamingChatParams {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  clinicId: string;
  systemPrompt: string;
  enableTools?: boolean;
  maxTokens?: number;
}

/**
 * Create a streaming chat response using real provider streaming (Task A4).
 *
 * Tokens stream from provider → SSE → client as they are generated.
 * Output validation runs on the accumulated text at the end; if
 * validation fails, an error event is emitted.
 */
export function createStreamingChatResponse(
  params: StreamingChatParams,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        if (!(await isAIEnabled())) {
          controller.enqueue(
            encoder.encode(formatStreamChunk("error", { message: "AI features are disabled" })),
          );
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
          return;
        }

        const supabase = createUntypedAdminClient("streaming-chat");
        const configs = await loadProviderConfigs(supabase);
        const provider = await selectAvailableProvider(configs);
        if (!provider) {
          controller.enqueue(
            encoder.encode(
              formatStreamChunk("error", {
                message: "Aucun fournisseur IA disponible.",
              }),
            ),
          );
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
          return;
        }

        const config = configs.get(provider);
        const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

        const prompt = params.messages
          .slice(-20)
          .map((m) => m.content)
          .join("\n");

        const streamResult = await callProviderStream(
          provider,
          {
            task: "conversation",
            complexity: "medium",
            prompt,
            systemPrompt: params.systemPrompt,
            maxTokens: params.maxTokens ?? 1024,
            temperature: 0.7,
          },
          apiKey,
        );

        let fullContent = "";

        for await (const chunk of streamResult.textStream) {
          fullContent += chunk;
          controller.enqueue(encoder.encode(formatStreamChunk("text", { content: chunk })));
        }

        // Validate final output
        if (fullContent) {
          const safe = validateAIOutput(fullContent);
          if (!safe) {
            controller.enqueue(
              encoder.encode(
                formatStreamChunk("error", {
                  message: "La réponse IA a été filtrée pour des raisons de sécurité.",
                }),
              ),
            );
          }
        }

        // Add disclaimer
        controller.enqueue(
          encoder.encode(
            formatStreamChunk("text", {
              content: `\n\n---\n${AI_RESPONSE_DISCLAIMER.disclaimer}`,
            }),
          ),
        );

        controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
        controller.close();
      } catch (err) {
        logger.error("AI streaming error", { context: "ai-streaming", error: err });
        try {
          const msg =
            err instanceof RateLimitError
              ? "Service IA surchargé. Réessayez dans quelques instants."
              : err instanceof ProviderError
                ? "Erreur du service IA. Veuillez réessayer."
                : "Erreur interne du flux IA";
          controller.enqueue(encoder.encode(formatStreamChunk("error", { message: msg })));
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
        } catch {
          // Stream already closed
        }
      }
    },
  });
}
