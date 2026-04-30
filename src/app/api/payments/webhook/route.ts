import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import type { Database } from "@/lib/types/database";
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

          // T-2 (STRIDE): Stripe's signature only proves the event came
          // from Stripe — NOT that `session.metadata.*` is honest. A
          // malicious patient could create a Checkout Session with crafted
          // metadata (different clinic_id, someone else's patient_id, or
          // an appointment_id from another tenant) and the resulting
          // webhook would be cryptographically valid. Cross-check every
          // metadata reference against the database before mutating any
          // payment or appointment row.
          const metadataValid = await verifyStripeMetadata(supabase, {
            clinicId,
            patientId,
            appointmentId,
            context: "payments/webhook:checkout.completed",
          });
          if (!metadataValid) {
            // Already logged inside verifyStripeMetadata. Skip processing
            // rather than ack — returning 200 lets Stripe stop retrying
            // an event we will never accept.
            break;
          }
          
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
          // T-2 (STRIDE): cross-check metadata against DB before writing
          // a failed-payment audit row.
          const failedMetadataValid = await verifyStripeMetadata(supabase, {
            clinicId: failedClinicId,
            patientId: failedPatientId,
            appointmentId: failedAppointmentId,
            context: "payments/webhook:payment_failed",
          });
          if (!failedMetadataValid) {
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
            logger.info(`Stripe failed payment event already processed: ${intent.id}`, { context: "payments/webhook" });
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

/**
 * T-2 (STRIDE): Cross-check Stripe webhook metadata against the database.
 *
 * Stripe's signature header proves only that the event came from Stripe.
 * The values inside `session.metadata` / `payment_intent.metadata` are
 * arbitrary key/value pairs that any party who can create a Checkout
 * Session (including a malicious patient who briefly authenticated to
 * a clinic's checkout endpoint) can set to whatever they like \u2014 a
 * different `clinic_id`, somebody else's `patient_id`, or an
 * `appointment_id` from another tenant.
 *
 * This helper rejects the event when:
 *   1. patient_id does not refer to a row in `users` belonging to the
 *      claimed clinic_id.
 *   2. appointment_id (if present) does not belong to the claimed
 *      clinic_id, OR its patient_id does not match the claimed
 *      patient_id.
 *
 * Each rejection is logged at warn level (with the offending IDs) so
 * operators can trace replay attempts without surfacing PHI.
 */
async function verifyStripeMetadata(
  supabase: SupabaseClient<Database>,
  params: {
    clinicId: string;
    patientId: string;
    appointmentId: string | null | undefined;
    context: string;
  },
): Promise<boolean> {
  const { clinicId, patientId, appointmentId, context } = params;

  // 1. Confirm the patient belongs to the claimed clinic.
  const { data: patientRow, error: patientErr } = await supabase
    .from("users")
    .select("id, clinic_id, role")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (patientErr || !patientRow) {
    logger.warn("Stripe metadata rejected: patient_id does not belong to clinic_id", {
      context,
      clinicId,
      patientId,
      error: patientErr ?? undefined,
    });
    return false;
  }

  // 2. If an appointment is referenced, confirm it is for this clinic
  //    and this patient.
  if (appointmentId) {
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("id, clinic_id, patient_id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (apptErr || !appt) {
      logger.warn("Stripe metadata rejected: appointment_id not in clinic_id", {
        context,
        clinicId,
        appointmentId,
        error: apptErr ?? undefined,
      });
      return false;
    }

    if (appt.patient_id !== patientId) {
      logger.warn("Stripe metadata rejected: appointment.patient_id mismatch", {
        context,
        clinicId,
        appointmentId,
        claimedPatientId: patientId,
        actualPatientId: appt.patient_id,
      });
      return false;
    }
  }

  return true;
}
