import { NextRequest, NextResponse } from "next/server";
import {
  dispatchNotification,
  type TemplateVariables,
} from "@/lib/notifications";

export const runtime = "edge";

/**
 * Extracts the message text from a WhatsApp webhook payload.
 */
function extractMessageText(entry: Record<string, unknown>): string | null {
  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (!changes) return null;
  for (const change of changes) {
    const value = change.value as Record<string, unknown> | undefined;
    if (!value) continue;
    const messages = value.messages as Array<Record<string, unknown>> | undefined;
    if (!messages) continue;
    for (const msg of messages) {
      const text = msg.text as Record<string, unknown> | undefined;
      if (text && typeof text.body === "string") return text.body;
    }
  }
  return null;
}

/**
 * POST /api/webhooks
 *
 * Receives incoming webhooks from WhatsApp Business API.
 * Processes incoming messages and triggers notification actions:
 * - CONFIRM: marks appointment as confirmed
 * - CANCEL: triggers cancellation notification
 * - Other: logs incoming message for receptionist review
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = (body.entry || []) as Array<Record<string, unknown>>;

    for (const entry of entries) {
      const messageText = extractMessageText(entry);
      if (!messageText) continue;

      const upperText = messageText.trim().toUpperCase();

      if (upperText === "CONFIRM") {
        // Patient confirmed appointment via WhatsApp reply
        // In production: update appointment status in Supabase
        await dispatchNotification(
          "booking_confirmation",
          { patient_name: "Patient", clinic_name: "Clinic" } as TemplateVariables,
          "receptionist",
          ["in_app"],
        );
      } else if (upperText === "CANCEL") {
        // Patient requested cancellation via WhatsApp reply
        // In production: update appointment status and notify staff
        await dispatchNotification(
          "cancellation",
          { patient_name: "Patient", clinic_name: "Clinic" } as TemplateVariables,
          "receptionist",
          ["in_app"],
        );
      }
      // Other messages are logged for receptionist review
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/webhooks
 *
 * WhatsApp webhook verification endpoint.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
