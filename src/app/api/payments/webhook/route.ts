import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { assertClinicId } from "@/lib/assert-tenant";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";

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
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature — webhook secret MUST be configured
    if (!webhookSecret) {
      // STRIPE_WEBHOOK_SECRET not configured
      return NextResponse.json(
        { error: "Webhook signature verification not configured" },
        { status: 503 },
      );
    }

    if (!signature) {
      // Missing stripe-signature header
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 },
      );
    }

    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      // Invalid webhook signature
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      type: string;
      data: {
        object: {
          id: string;
          metadata?: Record<string, string>;
          amount_total?: number;
          currency?: string;
          payment_status?: string;
          customer_email?: string;
        };
      };
    };

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
          await supabase.from("payments").insert({
            clinic_id: failedClinicId,
            patient_id: failedPatientId,
            appointment_id: failedAppointmentId || null,
            amount: (intent.amount_total || 0) / 100,
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

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.warn("Operation failed", { context: "payments/webhook", error: err });
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
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
