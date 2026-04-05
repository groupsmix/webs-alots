import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { assertClinicId } from "@/lib/assert-tenant";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { stripeWebhookEventSchema } from "@/lib/validations";
import type { StripeWebhookEvent } from "@/lib/validations";
import { verifyStripeWebhook } from "@/lib/stripe-webhook";

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

    const verifyResult = await verifyStripeWebhook(rawBody, signature, webhookSecret, "payments/webhook");
    if (verifyResult === "expired") {
      return apiError("Webhook timestamp too old — possible replay attack", 400);
    }
    if (verifyResult === "invalid") {
      return apiError("Invalid webhook signature", 400);
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

          // MED-07: Validate currency before converting from centimes.
          // Only MAD (Moroccan Dirham) amounts are stored in centimes; other
          // currencies (USD, EUR) are already in the major unit.
          const rawAmount = session.amount_total || 0;
          const currency = (session.currency ?? "").toLowerCase();
          const amount = currency === "mad" ? rawAmount / 100 : rawAmount;

          await supabase.from("payments").upsert(
            {
              clinic_id: clinicId,
              patient_id: patientId,
              appointment_id: appointmentId || null,
                  amount,
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
          const failedRawAmount = intent.amount_total || 0;
          const failedCurrency = (intent.currency ?? "").toLowerCase();
          const failedAmount = failedCurrency === "mad" ? failedRawAmount / 100 : failedRawAmount;
          await supabase.from("payments").insert({
            clinic_id: failedClinicId,
            patient_id: failedPatientId,
            appointment_id: failedAppointmentId || null,
            amount: failedAmount,
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
