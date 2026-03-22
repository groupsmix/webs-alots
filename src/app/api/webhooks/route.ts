import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  dispatchNotification,
  type TemplateVariables,
} from "@/lib/notifications";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";

export const runtime = "edge";

/**
 * Verifies the Meta webhook signature (X-Hub-Signature-256) using HMAC-SHA256.
 * Returns true if the signature is valid, false otherwise.
 */
async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const receivedSignature = signatureHeader.slice(expectedPrefix.length);
  const computedSignature = await hmacSha256Hex(appSecret, rawBody);

  return timingSafeEqual(computedSignature, receivedSignature);
}

/**
 * Extracts the message text and sender phone from a WhatsApp webhook payload.
 */
function extractMessageInfo(entry: Record<string, unknown>): { text: string; senderPhone: string } | null {
  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (!changes) return null;
  for (const change of changes) {
    const value = change.value as Record<string, unknown> | undefined;
    if (!value) continue;
    const messages = value.messages as Array<Record<string, unknown>> | undefined;
    if (!messages) continue;
    for (const msg of messages) {
      const text = msg.text as Record<string, unknown> | undefined;
      const from = msg.from as string | undefined;
      if (text && typeof text.body === "string" && from) {
        return { text: text.body, senderPhone: from };
      }
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
    const rawBody = await request.text();

    // Verify Meta webhook signature
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const entries = (body.entry || []) as Array<Record<string, unknown>>;

    const supabase = await createClient();

    // MED-04: Process webhook entries in parallel using Promise.allSettled.
    // Each entry is independent (different sender/message), so there is no
    // ordering dependency. This reduces total latency from O(n) to O(1) for
    // batched webhooks with multiple entries.
    await Promise.allSettled(entries.map(async (entry) => {
      const msgInfo = extractMessageInfo(entry);
      if (!msgInfo) return;

      const upperText = msgInfo.text.trim().toUpperCase();

      // Resolve the clinic context from the webhook entry's WhatsApp Business
      // Account ID (WABA). Each clinic has its own WABA linked via phone_number_id.
      const changes = entry.changes as Array<Record<string, unknown>> | undefined;
      const firstChangeValue = changes?.[0]?.value as Record<string, unknown> | undefined;
      const wabaPhoneNumberId = firstChangeValue?.metadata
        ? (firstChangeValue.metadata as Record<string, unknown>)?.phone_number_id as string | undefined
        : undefined;

      // Look up which clinic owns this WhatsApp phone number ID
      let clinicId: string | undefined;
      let clinicName = "Clinic";
      if (wabaPhoneNumberId) {
        const { data: clinic } = await supabase
          .from("clinics")
          .select("id, name")
          .eq("whatsapp_phone_number_id", wabaPhoneNumberId)
          .single();
        clinicId = clinic?.id;
        if (clinic?.name) clinicName = clinic.name;
      }

      // FIX (CRITICAL-01): If we cannot resolve the clinic, we must NOT
      // query patients across all tenants. Acknowledge the webhook but
      // skip processing to maintain tenant isolation.
      if (!clinicId) {
        console.warn(
          `[Webhook] Cannot resolve clinic for WABA phone_number_id=${wabaPhoneNumberId}. ` +
          `Skipping message from ${msgInfo.senderPhone} to prevent cross-tenant access.`
        );
        return;
      }

      // Patient lookup is now always scoped to the resolved clinic
      const { data: patient } = await supabase
        .from("users")
        .select("id, name, clinic_id")
        .eq("phone", msgInfo.senderPhone)
        .eq("role", "patient")
        .eq("clinic_id", clinicId)
        .limit(1)
        .single();

      const patientName = patient?.name ?? "Patient";
      const patientId = patient?.id ?? null;

      // Find the next upcoming appointment for this patient
      let recipientId = patientId;
      if (patient) {
        const { data: appt } = await supabase
          .from("appointments")
          .select("id, doctor_id, status")
          .eq("patient_id", patient.id)
          .eq("clinic_id", clinicId)
          .in("status", ["confirmed", "pending", "scheduled"])
          .order("appointment_date", { ascending: true })
          .limit(1)
          .single();

        if (upperText === "CONFIRM" && appt) {
          await supabase
            .from("appointments")
            .update({ status: "confirmed" })
            .eq("id", appt.id);
        } else if (upperText === "CANCEL" && appt) {
          await supabase
            .from("appointments")
            .update({ status: "cancelled", cancellation_reason: "Cancelled via WhatsApp" })
            .eq("id", appt.id);
        }

        // Notify the relevant staff member (doctor assigned to the appointment)
        recipientId = appt?.doctor_id ?? patientId;
      }

      // FIX (CRITICAL-03): Only dispatch if we have a valid UUID recipient.
      // "receptionist" is not a valid user ID and would cause silent failures.
      if (recipientId) {
        if (upperText === "CONFIRM") {
          await dispatchNotification(
            "booking_confirmation",
            { patient_name: patientName, clinic_name: clinicName } as TemplateVariables,
            recipientId,
            ["in_app"],
          );
        } else if (upperText === "CANCEL") {
          await dispatchNotification(
            "cancellation",
            { patient_name: patientName, clinic_name: clinicName } as TemplateVariables,
            recipientId,
            ["in_app"],
          );
        }
      } else {
        console.warn(
          `[Webhook] No valid recipient for ${upperText} from ${msgInfo.senderPhone} ` +
          `(clinic=${clinicId}). Notification skipped.`
        );
      }
      // Other messages are logged for receptionist review
    }));

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[POST /api/webhooks] Error:", err instanceof Error ? err.message : "Unknown error");
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

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token && timingSafeEqual(token, verifyToken)) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
