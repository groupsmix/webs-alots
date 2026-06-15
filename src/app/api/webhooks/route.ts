import { NextRequest, NextResponse } from "next/server";
import {
  apiForbidden,
  apiError,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
  apiUnauthorized,
} from "@/lib/api-response";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { dispatchNotification, type TemplateVariables } from "@/lib/notifications";
import { createClient, createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { readWebhookBody } from "@/lib/webhook-body";
import { checkWebhookSenderRateLimit } from "@/lib/webhook-rate-limit";
import { handleWhatsAppConversation } from "@/lib/whatsapp/conversation-handler";

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
  id?: string;
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
function extractMessageInfo(
  entry: WaEntry,
): { text: string; senderPhone: string; messageId: string } | null {
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

      const messageId = msg.id;
      if (!messageId) continue;

      // Handle interactive button replies (quick replies from reminders)
      const interactive = msg.interactive;
      if (interactive?.type === "button_reply") {
        const buttonReply = interactive.button_reply;
        if (buttonReply && typeof buttonReply.id === "string") {
          return { text: buttonReply.id, senderPhone: from, messageId };
        }
      }

      // Handle regular text messages
      const text = msg.text;
      if (text && typeof text.body === "string") {
        return { text: text.body, senderPhone: from, messageId };
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
  recipientPhone: string | null;
  errors?: Array<{ code: number; title: string }>;
}> {
  const results: Array<{
    messageId: string;
    status: string;
    timestamp: string;
    recipientPhone: string | null;
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
          timestamp:
            typeof status.timestamp === "string" ? status.timestamp : new Date().toISOString(),
          recipientPhone:
            typeof status.recipient_id === "string" && status.recipient_id
              ? status.recipient_id
              : null,
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
/** AUDIT FINDING #24: Max webhook payload size (1 MB). */
const MAX_WEBHOOK_BYTES = 1 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // DIFF-01: Stream-based body cap replaces Content-Length-only check.
    // Chunked Transfer-Encoding can bypass Content-Length validation,
    // allowing unbounded memory allocation before signature verification.
    const rawBody = await readWebhookBody(request, MAX_WEBHOOK_BYTES);
    if (rawBody === null) {
      return apiError("Payload too large", 413);
    }

    // Verify Meta webhook signature
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const senderAllowed = await checkWebhookSenderRateLimit("whatsapp", signatureHeader);
    if (!senderAllowed) {
      return apiRateLimited("WhatsApp webhook sender rate limit exceeded.");
    }
    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return apiUnauthorized("Invalid webhook signature");
    }

    const body = JSON.parse(rawBody) as WaWebhookBody;
    const entries = body.entry ?? [];

    const supabase = await createClient();
    // R-07: Use admin client for notification_log updates — webhooks have no
    // user session, so the anon client would silently match 0 rows under RLS.
    // nosemgrep: admin-client-guard
    const admin = createAdminClient("webhook");

    for (const entry of entries) {
      // ── Process delivery/read status updates ──────────────────────
      const statusUpdates = extractStatusUpdates(entry);
      if (statusUpdates.length > 0) {
        for (const statusUpdate of statusUpdates) {
          try {
            const updateData: Record<string, string> = {
              status: statusUpdate.status,
            };
            // FP-27: Use explicit isNaN check instead of falsy || for timestamp.
            // parseInt("0") returns 0 which is falsy, causing incorrect Date.now() fallback.
            const parsedTs = parseInt(statusUpdate.timestamp);
            const tsMs = isNaN(parsedTs) ? Date.now() : parsedTs * 1000;
            if (statusUpdate.status === "delivered") {
              updateData.delivered_at = new Date(tsMs).toISOString();
            } else if (statusUpdate.status === "read") {
              updateData.read_at = new Date(tsMs).toISOString();
            }

            await admin
              .from("notification_log")
              // @ts-expect-error -- Supabase generated types lag behind actual DB schema
              .update(updateData)
              // @ts-expect-error -- Supabase generated types lag behind actual DB schema
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
        // MA-04: exclude soft-deleted clinics
        const { data: clinic } = await supabase
          .from("clinics")
          .select("id, name")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq("whatsapp_phone_number_id" as any, wabaPhoneNumberId)
          .is("deleted_at", null)
          .single();
        clinicId = clinic?.id;
        if (clinic?.name) clinicName = clinic.name;
      }

      // FIX (CRITICAL-01): If we cannot resolve the clinic, we must NOT
      // query patients across all tenants. Acknowledge the webhook but
      // skip processing to maintain tenant isolation.
      if (!clinicId) {
        // B-06: Emit Sentry breadcrumb so unresolved clinics are visible
        // in the Sentry timeline without waiting for a downstream error.
        logger.warn("WhatsApp webhook: could not resolve clinic for phone number ID", {
          context: "webhooks/whatsapp",
          wabaPhoneNumberId,
        });
        try {
          const Sentry = await import("@sentry/nextjs");
          Sentry.addBreadcrumb({
            category: "webhook.clinic_resolution",
            message: `Unresolved clinic for WABA phone number ID: ${wabaPhoneNumberId}`,
            level: "warning",
            data: { wabaPhoneNumberId },
          });
        } catch {
          // Sentry unavailable
        }
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

      // R-16: Insert-on-conflict idempotency guard — same pattern as
      // processed_stripe_events in billing/webhook/route.ts.
      // If the message was already processed, skip it to prevent duplicate
      // appointments, notifications, and audit-log entries on Meta retries.
      const { error: dedupErr } = await (
        admin as never as {
          from(t: string): {
            insert(
              r: Record<string, unknown>,
            ): Promise<{ error: { code?: string; message: string } | null }>;
          };
        }
      )
        .from("processed_whatsapp_messages")
        .insert({
          message_id: msgInfo.messageId,
          clinic_id: clinicId,
        });

      if (dedupErr) {
        if (dedupErr.code === "23505") {
          logger.info("WhatsApp webhook replay detected — ignoring duplicate", {
            context: "webhooks/whatsapp",
            messageId: msgInfo.messageId,
            clinicId,
          });
          continue;
        }
        logger.warn("WhatsApp message dedup insert failed", {
          context: "webhooks/whatsapp",
          messageId: msgInfo.messageId,
          error: dedupErr.message,
        });
      }

      // Patient lookup is now always scoped to the resolved clinic.
      // C-05: Use .maybeSingle() instead of .single() to avoid crashing
      // when two patients share a phone (family WhatsApp). Order by
      // created_at DESC so the most recent patient record wins deterministically.
      // The migration 00071 adds a partial UNIQUE index to prevent new
      // duplicates, but this handles any legacy data.
      const { data: patient } = await supabase
        .from("users")
        .select("id, name, clinic_id")
        .eq("phone", msgInfo.senderPhone)
        .eq("role", "patient")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
            {
              patient_name: patientName,
              clinic_name: clinicName,
              reschedule: "true",
            } as TemplateVariables,
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
                  eq(
                    c: string,
                    v: string,
                  ): {
                    eq(
                      c2: string,
                      v2: string,
                    ): {
                      eq(
                        c3: string,
                        v3: string,
                      ): {
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
          const { parseRatingFromButtonId, handleFeedbackResponse } =
            await import("@/lib/post-appointment-feedback");
          const rating = parseRatingFromButtonId(rawText);
          if (rating !== null) {
            // Find the pending feedback entry for this patient
            // patient_feedback & google_place_id added by migration 00055 — cast through unknown
            type FbRow = { id: string; appointment_id: string; doctor_id: string | null };
            type FbClient = {
              from(t: string): {
                select(s: string): {
                  eq(
                    c: string,
                    v: string,
                  ): {
                    eq(
                      c2: string,
                      v2: string,
                    ): {
                      eq(
                        c3: string,
                        v3: number,
                      ): {
                        order(
                          c4: string,
                          o: { ascending: boolean },
                        ): { limit(n: number): { single(): Promise<{ data: FbRow | null }> } };
                      };
                    };
                  };
                };
                update(row: Record<string, unknown>): { eq(c: string, v: string): Promise<void> };
              };
            };
            const fbClient = supabase as unknown as FbClient;
            const { data: pendingFeedback } = await fbClient
              .from("patient_feedback")
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
              await fbClient
                .from("patient_feedback")
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

      // ── WhatsApp-first conversation handler ──────────────────────
      // Route unhandled messages through the conversational AI handler
      // for booking, cancellation, lab results, payments, FAQ, and
      // prescription renewal via natural language.
      if (
        upperText !== "CONFIRM" &&
        upperText !== "CANCEL" &&
        upperText !== "RESCHEDULE" &&
        !rawText.startsWith("REBOOK_") &&
        !rawText.startsWith("RATING_")
      ) {
        try {
          await handleWhatsAppConversation({
            supabase: supabase as never,
            clinicId,
            clinicName,
            senderPhone: msgInfo.senderPhone,
            patientId,
            patientName,
            messageText: rawText,
          });
        } catch (convErr) {
          logger.warn("WhatsApp conversation handler failed", {
            context: "webhooks/whatsapp-conversation",
            clinicId,
            error: convErr,
          });
        }
      }
    }

    return apiSuccess({ status: "ok" });
  } catch (err) {
    logger.warn("Failed to process WhatsApp webhook", { context: "webhooks", error: err });

    // Insert failed webhook into retry queue instead of silently dropping
    try {
      const adminForRetry = createUntypedAdminClient("webhook-retry");
      const rawBodyForRetry = await readWebhookBody(request.clone(), MAX_WEBHOOK_BYTES);
      let parsedPayload: unknown = {};
      try {
        if (rawBodyForRetry) parsedPayload = JSON.parse(rawBodyForRetry);
      } catch {
        // payload not parseable, store empty
      }

      // Attempt to extract clinic_id from the payload for scoping
      const payloadObj = parsedPayload as WaWebhookBody;
      const firstEntry = payloadObj?.entry?.[0];
      const phoneNumberId = firstEntry?.changes?.[0]?.value?.metadata?.phone_number_id;

      let retryClinicId: string | null = null;
      if (phoneNumberId) {
        // MA-04: exclude soft-deleted clinics
        const { data: clinic } = await adminForRetry
          .from("clinics")
          .select("id")
          .eq("whatsapp_phone_number_id", phoneNumberId)
          .is("deleted_at", null)
          .single();
        retryClinicId = (clinic as { id: string } | null)?.id ?? null;
      }

      if (retryClinicId) {
        await adminForRetry.from("webhook_retry_queue").insert({
          clinic_id: retryClinicId,
          provider: "whatsapp",
          event_type: "message",
          payload: parsedPayload,
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          next_retry_at: new Date().toISOString(),
        });
      }
    } catch (retryErr) {
      logger.warn("Failed to enqueue webhook for retry", {
        context: "webhooks/retry-queue",
        error: retryErr,
      });
    }

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
