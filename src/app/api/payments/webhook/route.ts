import { NextRequest } from "next/server";
import { apiError, apiRateLimited, apiSuccess, apiInternalError } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { verifyStripeSignature } from "@/lib/stripe-signature";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { stripeWebhookEventSchema } from "@/lib/validations";
import type { StripeWebhookEvent } from "@/lib/validations";
import { readWebhookBody } from "@/lib/webhook-body";
import { checkWebhookSenderRateLimit } from "@/lib/webhook-rate-limit";

/**
 * POST /api/payments/webhook
 *
 * Stripe webhook handler for payment events.
 * Verifies the webhook signature and processes payment completion.
 *
 * Supported events:
 *   - checkout.session.completed — marks payment as completed in Supabase
 *   - payment_intent.payment_failed — logs failed payment
 *
 * Requires:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET (for signature verification)
 */
/** AUDIT FINDING #24: Max webhook payload size (1 MB). */
const MAX_WEBHOOK_BYTES = 1 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    logger.error("Stripe webhook not configured", {
      context: "payments/webhook",
      alert: "payment_gateway_misconfigured",
      traceId,
    });
    return apiError("Stripe not configured", 503);
  }

  try {
    // S0-11-05: Stream-based body cap replaces Content-Length-only check.
    const rawBody = await readWebhookBody(request, MAX_WEBHOOK_BYTES);
    if (rawBody === null) {
      return apiError("Payload too large", 413);
    }
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature — webhook secret MUST be configured
    if (!webhookSecret) {
      logger.error("Stripe webhook secret not configured", {
        context: "payments/webhook",
        alert: "payment_gateway_misconfigured",
        traceId,
      });
      return apiError("Webhook signature verification not configured", 503);
    }

    if (!signature) {
      logger.warn("Stripe webhook missing signature", { context: "payments/webhook", traceId });
      return apiError("Missing stripe-signature header");
    }

    const senderAllowed = await checkWebhookSenderRateLimit("stripe-payments", signature);
    if (!senderAllowed) {
      logger.warn("Stripe webhook rate limit exceeded", { context: "payments/webhook", traceId });
      return apiRateLimited("Stripe webhook sender rate limit exceeded.");
    }

    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.warn("Stripe webhook invalid signature", { context: "payments/webhook", traceId });
      return apiError("Invalid signature");
    }

    let event: StripeWebhookEvent;
    try {
      const parsed = JSON.parse(rawBody);
      const result = stripeWebhookEventSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn("Stripe webhook event failed validation", {
          context: "payments/webhook",
          traceId,
          error: result.error.issues,
        });
        return apiError("Invalid webhook event payload");
      }
      event = result.data;
    } catch {
      logger.warn("Stripe webhook invalid JSON", { context: "payments/webhook", traceId });
      return apiError("Invalid JSON in webhook body");
    }

    const supabase = await createClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const appointmentId = session.metadata?.appointment_id;
        const patientId = session.metadata?.patient_id;
        const clinicId = session.metadata?.clinic_id;

        // Record payment in Supabase (idempotent via upsert on reference)
        if (clinicId && patientId) {
          try {
            assertClinicId(clinicId, "payments/webhook:checkout.completed");
            await setTenantContext(supabase, clinicId);
          } catch (tenantErr) {
            logger.error("Invalid tenant context in Stripe webhook", {
              context: "payments/webhook",
              alert: "payment_callback_failure",
              traceId,
              correlationId: session.id,
              clinicId,
              error: tenantErr,
            });
            break;
          }
          logTenantContext(clinicId, "payments/webhook:checkout.completed");

          // A10-04: Redundant existence check removed. The upsert below
          // uses onConflict: "reference" so concurrent webhooks for the
          // same session.id are idempotent at the DB level.

          // API-002 / SEC-014: Verify that the appointment actually belongs
          // to the clinic specified in metadata. A forged or replayed webhook
          // with a mismatched clinic_id must not attribute payments incorrectly.
          if (appointmentId) {
            const { data: appt } = await supabase
              .from("appointments")
              .select("clinic_id")
              .eq("id", appointmentId)
              .maybeSingle();
            if (appt && appt.clinic_id !== clinicId) {
              logger.error(
                "Stripe webhook: appointment.clinic_id does not match metadata.clinic_id",
                {
                  context: "payments/webhook",
                  alert: "payment_tampering",
                  traceId,
                  correlationId: session.id,
                  appointmentClinicId: appt.clinic_id,
                  metadataClinicId: clinicId,
                  appointmentId,
                  sessionId: session.id,
                },
              );
              return apiError("Appointment does not belong to the specified clinic", 422);
            }
          }

          await supabase.from("payments").upsert(
            {
              clinic_id: clinicId,
              patient_id: patientId,
              appointment_id: appointmentId || null,
              amount: Math.round(session.amount_total || 0) / 100, // A29-01: integer-safe centimes→MAD
              method: "online",
              status: PAYMENT_STATUS.COMPLETED,
              reference: session.id,
              payment_type: "full",
            },
            { onConflict: "reference" },
          );
        }

        // Update appointment payment status if applicable — scoped to
        // clinic_id to prevent cross-tenant appointment state mutation.
        if (appointmentId && clinicId) {
          await supabase
            .from("appointments")
            .update({ status: APPOINTMENT_STATUS.CONFIRMED })
            .eq("id", appointmentId)
            .eq("clinic_id", clinicId)
            .eq("status", APPOINTMENT_STATUS.PENDING);
        }

        // AUDIT: Record Stripe event_id so we have an immutable receipt
        // of every processed webhook keyed to the Stripe event ID.
        if (clinicId) {
          try {
            await logAuditEvent({
              supabase,
              action: "payment_completed",
              type: "payment",
              clinicId,
              description: `Stripe checkout.session.completed (event: ${event.id}, session: ${session.id})`,
              metadata: {
                stripe_event_id: event.id,
                stripe_session_id: session.id,
                appointment_id: appointmentId ?? null,
                patient_id: patientId ?? null,
                amount_total: session.amount_total ?? null,
              },
            });
          } catch (auditErr) {
            logger.warn("Failed to write payment_completed audit event", {
              context: "payments/webhook",
              stripeEventId: event.id,
              error: auditErr,
            });
          }
        }

        if (clinicId) {
          logger.info("Stripe payment completed", {
            context: "payments/webhook",
            traceId,
            correlationId: session.id,
            clinicId,
            sessionId: session.id,
            appointmentId,
            amount: session.amount_total,
            stripeEventId: event.id,
          });
        }

        // Payment completed — recorded in DB above
        break;
      }

      case "payment_intent.payment_failed": {
        // FIX (MED-06): Record failed payment in the database and log
        // details instead of only logging to console.
        const intent = event.data.object;
        const failedClinicId = intent.metadata?.clinic_id;
        const failedPatientId = intent.metadata?.patient_id;
        const failedAppointmentId = intent.metadata?.appointment_id;

        if (failedClinicId && failedPatientId) {
          try {
            assertClinicId(failedClinicId, "payments/webhook:payment_failed");
            await setTenantContext(supabase, failedClinicId);
          } catch (tenantErr) {
            logger.error("Invalid tenant context in Stripe webhook (failed payment)", {
              context: "payments/webhook",
              alert: "payment_callback_failure",
              traceId,
              correlationId: intent.id,
              clinicId: failedClinicId,
              error: tenantErr,
            });
            break;
          }
          logTenantContext(failedClinicId, "payments/webhook:payment_failed");
          // AUDIT-10: Deduplicate failed payment inserts by checking if this
          // exact Stripe event has already been processed (same pattern as
          // checkout.session.completed above).
          const { data: existingFailed } = await supabase
            .from("payments")
            .select("id")
            .eq("reference", intent.id)
            .maybeSingle();

          if (existingFailed) {
            logger.info("Stripe failed payment event already processed", {
              context: "payments/webhook",
              traceId,
              correlationId: intent.id,
              intentId: intent.id,
            });
            break;
          }

          // AUDIT-05: PaymentIntent objects use `amount`, not `amount_total`
          // (which exists only on Checkout Session objects). Using
          // `amount_total` always yielded 0 for failed payment records.
          // Source the amount only from authoritative Stripe fields — never
          // from `metadata`, which the checkout route accepts as arbitrary
          // user-supplied key/values (`z.record(z.string(), z.string())`)
          // and forwards to Stripe verbatim. Trusting `metadata.amount`
          // would let a caller poison the failed-payment audit row with
          // any value they choose. Guard with Number.isFinite() for the
          // unlikely case that Stripe returns a non-numeric field.
          const rawAmount = intent.amount ?? intent.amount_total ?? 0;
          const intentAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
          await supabase.from("payments").insert({
            clinic_id: failedClinicId,
            patient_id: failedPatientId,
            appointment_id: failedAppointmentId || null,
            amount: intentAmount / 100,
            method: "online",
            status: PAYMENT_STATUS.FAILED,
            reference: intent.id,
            payment_type: "full",
          });
        }

        // AUDIT: Record the failed payment event with Stripe event_id.
        if (failedClinicId) {
          try {
            await logAuditEvent({
              supabase,
              action: "payment_failed",
              type: "payment",
              clinicId: failedClinicId,
              description: `Stripe payment_intent.payment_failed (event: ${event.id}, intent: ${intent.id})`,
              metadata: {
                stripe_event_id: event.id,
                stripe_intent_id: intent.id,
                appointment_id: failedAppointmentId ?? null,
                patient_id: failedPatientId ?? null,
              },
            });
          } catch (auditErr) {
            logger.warn("Failed to write payment_failed audit event", {
              context: "payments/webhook",
              stripeEventId: event.id,
              error: auditErr,
            });
          }
        }

        if (failedClinicId) {
          logger.info("Stripe payment failed", {
            context: "payments/webhook",
            traceId,
            correlationId: intent.id,
            clinicId: failedClinicId,
            intentId: intent.id,
            appointmentId: failedAppointmentId,
            amount: intent.amount,
            stripeEventId: event.id,
          });
        }

        // Payment failed — recorded in DB above
        break;
      }

      default:
      // Unhandled event type — acknowledged without processing
    }

    return apiSuccess({ received: true });
  } catch (err) {
    // F-A93-03: Webhook processing failure is an error, not a warning
    logger.error("Stripe webhook processing failed", {
      context: "payments/webhook",
      alert: "payment_callback_failure",
      traceId,
      error: err,
    });
    return apiInternalError("Failed to process webhook");
  }
}
