import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  dispatchNotification,
  type TemplateVariables,
} from "@/lib/notifications";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { apiForbidden, apiInternalError, apiSuccess, apiUnauthorized } from "@/lib/api-response";

// ── WhatsApp Webhook payload types ──

interface WaTextMessage {
  body: string;
}

interface WaButtonReply {
  id: string;
  title?: string;
}

interface WaInteractive {
  type: string;
  button_reply?: WaButtonReply;
}

interface WaMessage {
  from?: string;
  type?: string;
  text?: WaTextMessage;
  interactive?: WaInteractive;
}

interface WaStatus {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WaMetadata {
  phone_number_id?: string;
  display_phone_number?: string;
}

interface WaChangeValue {
  messaging_product?: string;
  metadata?: WaMetadata;
  messages?: WaMessage[];
  statuses?: WaStatus[];
}

interface WaChange {
  field?: string;
  value?: WaChangeValue;
}

interface WaEntry {
  id?: string;
  changes?: WaChange[];
}

interface WaWebhookBody {
  object?: string;
  entry?: WaEntry[];
}
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
 * Supports both regular text messages and interactive button replies.
 */
function extractMessageInfo(entry: WaEntry): { text: string; senderPhone: string } | null {
  const changes = entry.changes;
  if (!changes) return null;
  for (const change of changes) {
    const value = change.value;
    if (!value) continue;
    const messages = value.messages;
    if (!messages) continue;
    for (const msg of messages) {
      const from = msg.from;
      if (!from) continue;

      // Handle interactive button replies (quick replies from reminders)
      const interactive = msg.interactive;
      if (interactive?.type === "button_reply") {
        const buttonReply = interactive.button_reply;
        if (buttonReply && typeof buttonReply.id === "string") {
          return { text: buttonReply.id, senderPhone: from };
        }
      }

      // Handle regular text messages
      const text = msg.text;
      if (text && typeof text.body === "string") {
        return { text: text.body, senderPhone: from };
      }
    }
  }
  return null;
}

/**
 * Extracts delivery/read status updates from a WhatsApp webhook payload.
 */
function extractStatusUpdates(entry: WaEntry): Array<{
  messageId: string;
  status: string;
  timestamp: string;
  recipientPhone: string;
  errors?: Array<{ code: number; title: string }>;
}> {
  const results: Array<{
    messageId: string;
    status: string;
    timestamp: string;
    recipientPhone: string;
    errors?: Array<{ code: number; title: string }>;
  }> = [];
  const changes = entry.changes;
  if (!changes) return results;
  for (const change of changes) {
    const value = change.value;
    if (!value) continue;
    const statuses = value.statuses;
    if (!statuses) continue;
    for (const status of statuses) {
      if (typeof status.id === "string" && typeof status.status === "string") {
        results.push({
          messageId: status.id,
          status: status.status,
          timestamp: typeof status.timestamp === "string" ? status.timestamp : new Date().toISOString(),
          recipientPhone: typeof status.recipient_id === "string" ? status.recipient_id : "",
          errors: status.errors,
        });
      }
    }
  }
  return results;
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
      return apiUnauthorized("Invalid webhook signature");
    }

    const body = JSON.parse(rawBody) as WaWebhookBody;
    const entries = body.entry ?? [];

    const supabase = await createClient();

    for (const entry of entries) {
      // ── Process delivery/read status updates ──────────────────────
      const statusUpdates = extractStatusUpdates(entry);
      if (statusUpdates.length > 0) {
        for (const statusUpdate of statusUpdates) {
          try {
            const updateData: Record<string, string> = {
              status: statusUpdate.status,
            };
            if (statusUpdate.status === "delivered") {
              updateData.delivered_at = new Date(
                parseInt(statusUpdate.timestamp) * 1000 || Date.now(),
              ).toISOString();
            } else if (statusUpdate.status === "read") {
              updateData.read_at = new Date(
                parseInt(statusUpdate.timestamp) * 1000 || Date.now(),
              ).toISOString();
            }

            await supabase
              .from("notification_log")
              .update(updateData)
              .eq("message_id", statusUpdate.messageId);
          } catch (err) {
            logger.warn("Failed to update message status", {
              context: "webhooks/status",
              messageId: statusUpdate.messageId,
              error: err,
            });
          }
        }
      }

      const msgInfo = extractMessageInfo(entry);
      if (!msgInfo) continue;

      const rawText = msgInfo.text.trim();
      const upperText = rawText.toUpperCase();

      // Resolve the clinic context from the webhook entry's WhatsApp Business
      // Account ID (WABA). Each clinic has its own WABA linked via phone_number_id.
      const changes = entry.changes;
      const firstChangeValue = changes?.[0]?.value;
      const wabaPhoneNumberId = firstChangeValue?.metadata?.phone_number_id;

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
        // Cannot resolve clinic — skip to maintain tenant isolation
        continue;
      }

      // Set tenant context on the Supabase client for defense-in-depth
      try {
        await setTenantContext(supabase, clinicId);
      } catch (tenantErr) {
        logger.error("Failed to set tenant context for webhook", {
          context: "webhooks",
          clinicId,
          error: tenantErr,
        });
        continue;
      }

      logTenantContext(clinicId, "webhooks/whatsapp", {
        senderPhone: msgInfo.senderPhone,
      });

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
          // Scope update to clinic_id to prevent cross-tenant mutation
          await supabase
            .from("appointments")
            .update({ status: "confirmed" })
            .eq("id", appt.id)
            .eq("clinic_id", clinicId);
        } else if (upperText === "CANCEL" && appt) {
          await supabase
            .from("appointments")
            .update({ status: "cancelled", cancellation_reason: "Cancelled via WhatsApp" })
            .eq("id", appt.id)
            .eq("clinic_id", clinicId);
        } else if (upperText === "RESCHEDULE" && appt) {
          // Mark appointment as needing reschedule — staff will follow up
          await supabase
            .from("appointments")
            .update({ status: "reschedule_requested" })
            .eq("id", appt.id)
            .eq("clinic_id", clinicId);
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
        } else if (upperText === "RESCHEDULE") {
          await dispatchNotification(
            "cancellation",
            { patient_name: patientName, clinic_name: clinicName, reschedule: "true" } as TemplateVariables,
            recipientId,
            ["in_app"],
          );
        }
      } else {
        // No valid recipient found — notification skipped
      }
      // ── Handle rebooking button replies (Feature 16) ──
      if (rawText.startsWith("REBOOK_") && clinicId) {
        try {
          // Format: REBOOK_{appointmentId}_{optionIndex}
          const parts = rawText.split("_");
          if (parts.length >= 3) {
            const appointmentId = parts.slice(1, -1).join("_");
            const optionIndex = parseInt(parts[parts.length - 1], 10);

            // rebooking_requests not yet in generated types — cast through unknown
            type RebookRow = { id: string; alternatives: unknown; doctor_id: string };
            type RebookClient = {
              from(t: string): {
                select(s: string): {
                  eq(c: string, v: string): {
                    eq(c2: string, v2: string): {
                      eq(c3: string, v3: string): {
                        limit(n: number): { single(): Promise<{ data: RebookRow | null }> };
                      };
                    };
                  };
                };
                update(row: Record<string, unknown>): {
                  eq(c: string, v: string): Promise<void>;
                };
              };
            };
            const rbClient = supabase as unknown as RebookClient;

            // Find the rebooking request
            const { data: rebookReq } = await rbClient
              .from("rebooking_requests")
              .select("id, alternatives, doctor_id")
              .eq("appointment_id", appointmentId)
              .eq("clinic_id", clinicId)
              .eq("status", "pending")
              .limit(1)
              .single();

            if (rebookReq) {
              const alternatives = rebookReq.alternatives as Array<{
                option_index: number;
                date: string;
                time: string;
                slot_start: string;
                slot_end: string;
                label: string;
              }> | null;

              const chosen = alternatives?.find((a) => a.option_index === optionIndex);

              if (chosen && patientId) {
                // Create new appointment with the chosen slot
                await supabase.from("appointments").insert({
                  patient_id: patientId,
                  doctor_id: rebookReq.doctor_id,
                  clinic_id: clinicId,
                  appointment_date: chosen.date,
                  start_time: chosen.time + ":00",
                  slot_start: chosen.slot_start,
                  slot_end: chosen.slot_end,
                  status: "confirmed",
                  rescheduled_from: appointmentId,
                });

                // Cancel the original appointment
                await supabase
                  .from("appointments")
                  .update({
                    status: "cancelled",
                    cancellation_reason: "Rebooked due to doctor unavailability",
                    cancelled_at: new Date().toISOString(),
                  })
                  .eq("id", appointmentId)
                  .eq("clinic_id", clinicId);

                // Update rebooking request status
                await rbClient
                  .from("rebooking_requests")
                  .update({
                    status: "rebooked",
                    selected_option: optionIndex,
                    rebooked_at: new Date().toISOString(),
                  })
                  .eq("id", rebookReq.id);

                // Confirm to patient via WhatsApp
                const { sendTextMessage } = await import("@/lib/whatsapp");
                await sendTextMessage(
                  msgInfo.senderPhone,
                  `Your appointment has been rebooked to ${chosen.label}. Thank you!`,
                );
              }
            }
          }
        } catch (rebookErr) {
          logger.warn("Failed to process rebooking response", {
            context: "webhooks/rebooking",
            error: rebookErr,
          });
        }
      }

      // ── Handle feedback rating button replies (Feature 14) ──
      if (rawText.startsWith("RATING_") && patientId) {
        try {
          const { parseRatingFromButtonId, handleFeedbackResponse } = await import("@/lib/post-appointment-feedback");
          const rating = parseRatingFromButtonId(rawText);
          if (rating !== null) {
            // Find the pending feedback entry for this patient
            // patient_feedback & google_place_id added by migration 00055 — cast through unknown
            type FbRow = { id: string; appointment_id: string; doctor_id: string | null };
            type FbClient = { from(t: string): { select(s: string): { eq(c: string, v: string): { eq(c2: string, v2: string): { eq(c3: string, v3: number): { order(c4: string, o: { ascending: boolean }): { limit(n: number): { single(): Promise<{ data: FbRow | null }> } } } } } }; update(row: Record<string, unknown>): { eq(c: string, v: string): Promise<void> } } };
            const fbClient = supabase as unknown as FbClient;
            const { data: pendingFeedback } = await fbClient.from("patient_feedback")
              .select("id, appointment_id, doctor_id")
              .eq("clinic_id", clinicId)
              .eq("patient_id", patientId)
              .eq("rating", 0)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (pendingFeedback) {
              // Update the feedback entry with the rating
              const googleReviewSent = rating >= 4;
              await fbClient.from("patient_feedback")
                .update({
                  rating,
                  responded_at: new Date().toISOString(),
                  google_review_sent: googleReviewSent,
                })
                .eq("id", pendingFeedback.id);

              // Look up clinic's Google Place ID
              const { data: clinicData } = await supabase
                .from("clinics")
                .select("google_place_id")
                .eq("id", clinicId)
                .single();

              // Find the clinic admin for notifications
              const { data: adminUser } = await supabase
                .from("users")
                .select("id")
                .eq("clinic_id", clinicId)
                .eq("role", "clinic_admin")
                .limit(1)
                .single();

              const clinicRow = clinicData as unknown as { google_place_id?: string | null } | null;
              await handleFeedbackResponse({
                clinicId,
                clinicName,
                patientPhone: msgInfo.senderPhone,
                patientName: patientName,
                patientId,
                rating,
                googlePlaceId: clinicRow?.google_place_id ?? null,
                adminUserId: adminUser?.id ?? null,
              });
            }
          }
        } catch (feedbackErr) {
          logger.warn("Failed to process feedback rating", {
            context: "webhooks/feedback",
            error: feedbackErr,
          });
        }
      }

      // Other messages are logged for receptionist review
    }

    return apiSuccess({ status: "ok" });
  } catch (err) {
    logger.warn("Operation failed", { context: "webhooks", error: err });
    return apiInternalError("Failed to process webhook");
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

  return apiForbidden("Forbidden");
}
