import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { stripeWebhookEventSchema } from "@/lib/validations";
import type { StripeWebhookEvent } from "@/lib/validations";

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
export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    return apiError("Stripe not configured", 503);
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature — webhook secret MUST be configured
    if (!webhookSecret) {
      return apiError("Webhook signature verification not configured", 503);
    }

    if (!signature) {
      return apiError("Missing stripe-signature header");
    }

    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return apiError("Invalid signature");
    }

    let event: StripeWebhookEvent;
    try {
      const parsed = JSON.parse(rawBody);
      const result = stripeWebhookEventSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn("Stripe webhook event failed validation", {
          context: "payments/webhook",
          error: result.error.issues,
        });
        return apiError("Invalid webhook event payload");
      }
      event = result.data;
    } catch {
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
              clinicId,
              error: tenantErr,
            });
            break;
          }
          logTenantContext(clinicId, "payments/webhook:checkout.completed");
          
          // Audit 3.8 Fix: Webhook Deduplication / Replay Protection
          // We check if this exact Stripe event ID has already been processed to
          // prevent duplicate processing in case of Stripe retries.
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("reference", session.id)
            .maybeSingle();

          if (existingPayment) {
            logger.info(`Stripe webhook event already processed: ${session.id}`, { context: "payments/webhook" });
            break; // Skip processing since it's already handled
          }

          await supabase.from("payments").upsert(
            {
              clinic_id: clinicId,
              patient_id: patientId,
              appointment_id: appointmentId || null,
                  amount: (session.amount_total || 0) / 100, // Convert from centimes
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
              clinicId: failedClinicId,
              error: tenantErr,
            });
            break;
          }
          logTenantContext(failedClinicId, "payments/webhook:payment_failed");
          // FIX: PaymentIntent objects use `amount`, not `amount_total`
          // (which exists only on Checkout Session objects). Using
          // `amount_total` always yielded 0 for failed payment records.
          const intentAmount = intent.metadata?.amount
            ? parseFloat(intent.metadata.amount)
            : (intent.amount_total || 0);
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

        // Payment failed — recorded in DB above
        break;
      }

      default:
        // Unhandled event type — acknowledged without processing
    }

    return apiSuccess({ received: true });
  } catch (err) {
    logger.warn("Operation failed", { context: "payments/webhook", error: err });
    return apiInternalError("Failed to process webhook");
  }
}

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * Implements Stripe's signature verification without requiring the Stripe SDK.
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "v1") signature = value;
    }

    if (!timestamp || !signature) return false;

    // Check timestamp tolerance (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = await hmacSha256Hex(secret, signedPayload);

    return timingSafeEqual(expectedSignature, signature);
  } catch (err) {
    logger.warn("Operation failed", { context: "payments/webhook", error: err });
    return false;
  }
}
