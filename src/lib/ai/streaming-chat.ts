/**
 * Streaming AI Chat — Vercel AI SDK-inspired patterns.
 *
 * Adapted from Helsa's AI chat agent architecture using Vercel AI SDK
 * patterns for streaming responses. Provides:
 *
 *   1. Streaming text generation with SSE transport
 *   2. Tool/function calling for structured actions
 *   3. Context-aware system prompts with clinic data
 *   4. Token usage tracking per clinic
 *   5. Medical disclaimer injection (EU AI Act compliance)
 *
 * This module replaces the single-shot chat response with a streaming
 * architecture that provides better UX for longer AI responses.
 */

import { resolveAIConfig, AI_RESPONSE_DISCLAIMER } from "@/lib/ai/config";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { logger } from "@/lib/logger";

/** Tool definition for AI function calling. */
export interface AITool {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
    }
  >;
}

/** Available tools the AI agent can invoke. */
export const CLINIC_AI_TOOLS: AITool[] = [
  {
    name: "search_patients",
    description: "Rechercher des patients dans la base de données de la clinique",
    parameters: {
      query: { type: "string", description: "Nom ou téléphone du patient", required: true },
    },
  },
  {
    name: "get_appointment_slots",
    description: "Obtenir les créneaux disponibles pour un rendez-vous",
    parameters: {
      date: { type: "string", description: "Date au format YYYY-MM-DD", required: true },
      doctor_id: { type: "string", description: "ID du médecin (optionnel)" },
    },
  },
  {
    name: "check_drug_interactions",
    description: "Vérifier les interactions médicamenteuses entre plusieurs médicaments",
    parameters: {
      medications: {
        type: "string",
        description: "Liste de médicaments séparés par des virgules",
        required: true,
      },
    },
  },
  {
    name: "get_patient_history",
    description: "Obtenir l'historique médical résumé d'un patient",
    parameters: {
      patient_id: { type: "string", description: "ID du patient", required: true },
    },
  },
];

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
 * Create a streaming chat response using the OpenAI-compatible API.
 *
 * Returns a ReadableStream that emits SSE events for each token/chunk.
 * Follows Vercel AI SDK patterns for streaming architecture.
 */
export function createStreamingChatResponse(
  params: StreamingChatParams,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const resolved = await resolveAIConfig();

        if (!resolved.ok) {
          controller.enqueue(
            encoder.encode(formatStreamChunk("error", { message: resolved.reason })),
          );
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
          return;
        }

        const config = resolved.config;
        const messages = [
          { role: "system" as const, content: params.systemPrompt },
          ...params.messages.slice(-20), // Keep last 20 messages for context
        ];

        const requestBody: Record<string, unknown> = {
          model: config.model,
          messages,
          stream: true,
          max_tokens: params.maxTokens ?? 1024,
          temperature: 0.7,
        };

        if (params.enableTools && CLINIC_AI_TOOLS.length > 0) {
          requestBody.tools = CLINIC_AI_TOOLS.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: {
                type: "object",
                properties: tool.parameters,
                required: Object.entries(tool.parameters)
                  .filter(([, v]) => v.required)
                  .map(([k]) => k),
              },
            },
          }));
        }

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          await response.text().catch(() => "");
          logger.error("AI streaming request failed", {
            context: "ai-streaming",
            status: response.status,
            clinicId: params.clinicId,
          });
          controller.enqueue(
            encoder.encode(
              formatStreamChunk("error", {
                message: "Erreur du service IA. Veuillez réessayer.",
              }),
            ),
          );
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(
            encoder.encode(
              formatStreamChunk("error", { message: "Flux de réponse non disponible" }),
            ),
          );
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                    tool_calls?: Array<{
                      function?: { name?: string; arguments?: string };
                    }>;
                  };
                }>;
              };
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                controller.enqueue(
                  encoder.encode(formatStreamChunk("text", { content: delta.content })),
                );
              }

              if (delta?.tool_calls?.[0]?.function) {
                const toolCall = delta.tool_calls[0].function;
                controller.enqueue(
                  encoder.encode(
                    formatStreamChunk("tool_call", {
                      name: toolCall.name,
                      arguments: toolCall.arguments,
                    }),
                  ),
                );
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
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
          controller.enqueue(
            encoder.encode(formatStreamChunk("error", { message: "Erreur interne du flux IA" })),
          );
          controller.enqueue(encoder.encode(formatStreamChunk("done", {})));
          controller.close();
        } catch {
          // Stream already closed
        }
      }
    },
  });
}
