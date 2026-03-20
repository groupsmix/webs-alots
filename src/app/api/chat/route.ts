import { NextRequest, NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";

export const runtime = "edge";

interface ChatRequestBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  clinicId?: string;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for ${clinicConfig.name}, a ${clinicConfig.type} clinic.
You help patients and staff with questions about appointments, services, clinic information, and general health guidance.

Clinic details:
- Name: ${clinicConfig.name}
- Type: ${clinicConfig.type}
- Currency: ${clinicConfig.currency}
- Locale: ${clinicConfig.locale}

Guidelines:
- Be concise, friendly, and professional.
- For appointment booking, direct users to the booking page.
- Never provide medical diagnoses or specific medical advice.
- If you don't know something specific about the clinic, say so and suggest contacting the clinic directly.
- Respond in the same language the user writes in (French, Arabic, or English).`;

/**
 * Built-in fallback responses when no AI API key is configured.
 * Provides basic responses without requiring an external API.
 */
function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes("rendez-vous") || msg.includes("appointment") || msg.includes("book") || msg.includes("réserv")) {
    return "Pour prendre un rendez-vous, veuillez utiliser notre page de réservation en ligne ou appeler le cabinet directement. Puis-je vous aider avec autre chose ?";
  }
  if (msg.includes("horaire") || msg.includes("hours") || msg.includes("ouvert") || msg.includes("open")) {
    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const hours = Object.entries(clinicConfig.workingHours)
      .filter(([, h]) => h.enabled)
      .map(([d, h]) => `${days[Number(d)]}: ${h.open} - ${h.close}`)
      .join("\n");
    return `Voici nos horaires d'ouverture :\n${hours}`;
  }
  if (msg.includes("contact") || msg.includes("téléphone") || msg.includes("phone") || msg.includes("email")) {
    const parts: string[] = [];
    if (clinicConfig.contact.phone) parts.push(`Téléphone : ${clinicConfig.contact.phone}`);
    if (clinicConfig.contact.email) parts.push(`Email : ${clinicConfig.contact.email}`);
    if (clinicConfig.contact.address) parts.push(`Adresse : ${clinicConfig.contact.address}`);
    if (clinicConfig.contact.whatsapp) parts.push(`WhatsApp : ${clinicConfig.contact.whatsapp}`);
    return parts.length > 0
      ? `Voici nos coordonnées :\n${parts.join("\n")}`
      : "Les coordonnées du cabinet ne sont pas encore configurées. Veuillez réessayer plus tard.";
  }
  if (msg.includes("bonjour") || msg.includes("hello") || msg.includes("hi") || msg.includes("salut")) {
    return `Bonjour ! Bienvenue chez ${clinicConfig.name}. Comment puis-je vous aider aujourd'hui ?`;
  }
  if (msg.includes("merci") || msg.includes("thank")) {
    return "Je vous en prie ! N'hésitez pas si vous avez d'autres questions.";
  }

  return `Merci pour votre message. Je suis l'assistant virtuel de ${clinicConfig.name}. Je peux vous aider avec :\n- Les rendez-vous et réservations\n- Les horaires d'ouverture\n- Les coordonnées du cabinet\n\nComment puis-je vous aider ?`;
}

/**
 * POST /api/chat
 *
 * Handles chat messages. Uses OpenAI-compatible API if configured,
 * otherwise falls back to rule-based responses.
 */
export async function POST(request: NextRequest) {
  try {
    if (!clinicConfig.features.chatbot) {
      return NextResponse.json(
        { error: "Chatbot feature is not enabled" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as ChatRequestBody;

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

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // If no API key is configured, use fallback responses
    if (!apiKey) {
      const fallbackReply = getFallbackResponse(lastMessage.content);
      return NextResponse.json({
        message: {
          role: "assistant" as const,
          content: fallbackReply,
        },
      });
    }

    // Call OpenAI-compatible API with streaming
    const apiMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...body.messages,
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
      // Fall back to rule-based if API fails
      const fallbackReply = getFallbackResponse(lastMessage.content);
      return NextResponse.json({
        message: {
          role: "assistant" as const,
          content: fallbackReply,
        },
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
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
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
  } catch {
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 },
    );
  }
}
