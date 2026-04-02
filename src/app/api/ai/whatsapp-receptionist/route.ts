/**
 * AI WhatsApp Receptionist — POST /api/ai/whatsapp-receptionist
 *
 * Receives incoming WhatsApp messages (via Meta webhook) and responds
 * with AI-generated replies using clinic context (services, hours,
 * doctors). Supports:
 *   - Appointment booking intent → interactive quick-reply buttons
 *   - FAQ / general questions → plain text AI response
 *   - Webhook verification (GET) for Meta WhatsApp Business API
 *
 * Rate limited to 200 req / 60s per clinic to prevent abuse.
 * Feature flag: "whatsapp_receptionist" (Professional+ plan).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  apiRateLimited,
} from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { webhookLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase-server";
import {
  sendTextMessage,
  sendInteractiveMessage,
} from "@/lib/whatsapp";

// ── Schemas ──────────────────────────────────────────────────────────

/** Incoming Meta WhatsApp Cloud API webhook payload (simplified). */
const whatsappWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal("whatsapp"),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z
              .array(
                z.object({
                  profile: z.object({ name: z.string() }).optional(),
                  wa_id: z.string(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.enum(["text", "interactive", "button", "image", "document", "audio", "video", "location", "sticker", "reaction"]),
                  text: z.object({ body: z.string() }).optional(),
                  interactive: z
                    .object({
                      type: z.string(),
                      button_reply: z
                        .object({ id: z.string(), title: z.string() })
                        .optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          }),
          field: z.literal("messages"),
        }),
      ),
    }),
  ),
});

// ── Intent detection ─────────────────────────────────────────────────

type Intent = "booking" | "hours" | "services" | "contact" | "general";

const INTENT_KEYWORDS: Record<Exclude<Intent, "general">, RegExp> = {
  booking:
    /\b(rendez[ -]?vous|rdv|réserv|book|appointment|prendre|disponib|créneau|slot)\b/i,
  hours:
    /\b(horaire|heure|ouvert|fermé|ouvrir|fermer|hours|open|close|schedule)\b/i,
  services:
    /\b(service|prestation|soin|traitement|consultation|treatment|offr|tarif|prix|price)\b/i,
  contact:
    /\b(adresse|address|téléphone|phone|email|contact|localisation|location|map)\b/i,
};

function detectIntent(text: string): Intent {
  for (const [intent, regex] of Object.entries(INTENT_KEYWORDS)) {
    if (regex.test(text)) return intent as Intent;
  }
  return "general";
}

// ── Clinic context fetcher ───────────────────────────────────────────

interface ClinicContext {
  name: string;
  phone: string;
  address: string | null;
  services: string[];
  doctors: string[];
  openingHours: string | null;
}

async function fetchClinicContext(
  clinicId: string,
): Promise<ClinicContext | null> {
  try {
    const supabase = createAdminClient();

    const [clinicRes, servicesRes, doctorsRes] = await Promise.all([
      supabase
        .from("clinics")
        .select("name, phone, address, config")
        .eq("id", clinicId)
        .single(),
      supabase
        .from("services")
        .select("name")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .limit(20),
      supabase
        .from("users")
        .select("name")
        .eq("clinic_id", clinicId)
        .eq("role", "doctor")
        .limit(20),
    ]);

    if (clinicRes.error || !clinicRes.data) return null;

    const clinic = clinicRes.data;
    const cfg = clinic.config as Record<string, unknown> | null;

    return {
      name: clinic.name ?? "Clinic",
      phone: clinic.phone ?? "",
      address: clinic.address ?? null,
      services: (servicesRes.data ?? []).map((s) => s.name).filter(Boolean) as string[],
      doctors: (doctorsRes.data ?? []).map((d) => d.name).filter(Boolean) as string[],
      openingHours: (cfg?.opening_hours as string) ?? null,
    };
  } catch (err) {
    logger.error("Failed to fetch clinic context for WhatsApp receptionist", {
      context: "whatsapp-receptionist",
      clinicId,
      error: err,
    });
    return null;
  }
}

// ── Clinic lookup by phone number ID ─────────────────────────────────

async function findClinicByPhoneNumberId(
  phoneNumberId: string,
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    // The WhatsApp phone number ID is stored in the clinic's metadata
    // as metadata->whatsapp_phone_number_id. We query all clinics and
    // filter in-app since Supabase JSONB containment is more reliable.
    const { data } = await supabase
      .from("clinics")
      .select("id, config")
      .not("config", "is", null);

    if (!data) return null;

    for (const clinic of data) {
      const cfg = clinic.config as Record<string, unknown> | null;
      if (cfg?.whatsapp_phone_number_id === phoneNumberId) {
        return clinic.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── AI response builder ──────────────────────────────────────────────

function buildSystemPrompt(ctx: ClinicContext): string {
  return `Tu es un réceptionniste IA pour "${ctx.name}".
Tu réponds aux patients sur WhatsApp de manière professionnelle, chaleureuse et concise.

INFORMATIONS DE LA CLINIQUE:
- Nom: ${ctx.name}
- Téléphone: ${ctx.phone}
${ctx.address ? `- Adresse: ${ctx.address}` : ""}
${ctx.openingHours ? `- Horaires: ${ctx.openingHours}` : ""}
${ctx.services.length > 0 ? `- Services: ${ctx.services.join(", ")}` : ""}
${ctx.doctors.length > 0 ? `- Médecins: ${ctx.doctors.join(", ")}` : ""}

RÈGLES:
1. Réponds TOUJOURS en français.
2. Sois concis — les messages WhatsApp doivent être courts (max 300 caractères).
3. Si le patient veut un rendez-vous, indique-lui qu'il peut appeler ou répondre "OUI" pour être rappelé.
4. Ne donne JAMAIS de conseil médical. Redirige vers un médecin.
5. Sois poli et utilise le vouvoiement.
6. Si tu ne connais pas la réponse, propose d'appeler la clinique.`;
}

async function generateAIResponse(
  message: string,
  ctx: ClinicContext,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return `Merci pour votre message. Notre équipe vous répondra bientôt. Vous pouvez aussi nous appeler au ${ctx.phone}.`;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(ctx) },
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      logger.warn("AI API returned non-OK for WhatsApp receptionist", {
        context: "whatsapp-receptionist",
        status: response.status,
      });
      return `Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais. Appelez-nous au ${ctx.phone} pour un besoin urgent.`;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return `Merci de nous avoir contactés. Appelez-nous au ${ctx.phone} pour plus d'informations.`;
    }
    return content;
  } catch (err) {
    logger.error("AI response generation failed", {
      context: "whatsapp-receptionist",
      error: err,
    });
    return `Merci pour votre message. Appelez-nous au ${ctx.phone} pour assistance immédiate.`;
  }
}

// ── Response dispatcher ──────────────────────────────────────────────

async function handleIncomingMessage(
  from: string,
  text: string,
  contactName: string,
  clinicId: string,
): Promise<void> {
  const ctx = await fetchClinicContext(clinicId);
  if (!ctx) {
    await sendTextMessage(
      from,
      "Merci pour votre message. Notre système est temporairement indisponible. Veuillez réessayer plus tard.",
    );
    return;
  }

  const intent = detectIntent(text);

  if (intent === "booking") {
    // Send interactive quick-reply for booking intent
    await sendInteractiveMessage({
      to: from,
      header: `Bonjour ${contactName} 👋`,
      body: `Vous souhaitez prendre rendez-vous chez ${ctx.name} ? Choisissez une option :`,
      footer: ctx.name,
      buttons: [
        { id: "btn_book_call", title: "📞 Être rappelé(e)" },
        { id: "btn_book_online", title: "🗓 RDV en ligne" },
        { id: "btn_book_info", title: "ℹ️ Plus d'infos" },
      ],
    });
    return;
  }

  // For all other intents, generate an AI response
  const aiReply = await generateAIResponse(text, ctx);
  await sendTextMessage(from, aiReply);

  // Log the interaction for analytics
  try {
    const supabase = createAdminClient();
    await supabase.from("activity_logs").insert({
      action: "whatsapp_receptionist.message",
      type: "admin",
      clinic_id: clinicId,
      description: `WhatsApp AI reply to ${contactName} (intent: ${intent})`,
      metadata: {
        from,
        intent,
        contact_name: contactName,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (logErr) {
    logger.warn("Failed to log WhatsApp receptionist interaction", {
      context: "whatsapp-receptionist",
      error: logErr,
    });
  }
}

// ── GET: Webhook verification ────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    logger.info("WhatsApp webhook verified", {
      context: "whatsapp-receptionist",
    });
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: "Verification failed" },
    { status: 403 },
  );
}

// ── POST: Incoming messages ──────────────────────────────────────────

export const POST = withValidation(
  whatsappWebhookSchema,
  async (data, _request) => {
    // Rate limit per phone number ID
    const phoneNumberId =
      data.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;
    if (phoneNumberId) {
      const allowed = await webhookLimiter.check(
        `wa-receptionist:${phoneNumberId}`,
      );
      if (!allowed) {
        return apiRateLimited("Too many WhatsApp messages. Please try again later.");
      }
    }

    // Process each entry
    for (const entry of data.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;
        if (!messages || messages.length === 0) continue;

        const waPhoneId = change.value.metadata.phone_number_id;

        // Resolve clinic from the WhatsApp phone number ID
        const clinicId = await findClinicByPhoneNumberId(waPhoneId);
        if (!clinicId) {
          logger.warn("No clinic found for WhatsApp phone number ID", {
            context: "whatsapp-receptionist",
            phoneNumberId: waPhoneId,
          });
          continue;
        }

        for (const msg of messages) {
          // Only process text messages and interactive button replies
          let messageText: string | null = null;

          if (msg.type === "text" && msg.text?.body) {
            messageText = msg.text.body;
          } else if (
            msg.type === "interactive" &&
            msg.interactive?.button_reply
          ) {
            messageText = msg.interactive.button_reply.title;
          }

          if (!messageText) continue;

          const contactName =
            change.value.contacts?.[0]?.profile?.name ?? "Patient";

          // Fire-and-forget: don't block the webhook response
          void handleIncomingMessage(
            msg.from,
            messageText,
            contactName,
            clinicId,
          ).catch((err) =>
            logger.error("WhatsApp receptionist message handling failed", {
              context: "whatsapp-receptionist",
              error: err,
              from: msg.from,
            }),
          );
        }
      }
    }

    // Always return 200 to acknowledge the webhook
    return apiSuccess({ received: true });
  },
);
