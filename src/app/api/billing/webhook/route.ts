import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { getPlanByPriceId, type PlanSlug } from "@/lib/config/subscription-plans";
import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import type { Json } from "@/lib/types/database";
import { subscriptionWebhookEventSchema } from "@/lib/validations";
import type { SubscriptionWebhookEvent } from "@/lib/validations";

/**
 * Q-01: Stripe API timeout. If Stripe is degraded, an unbounded fetch here
 * holds the Worker handler open until Stripe times out the connection,
 * which combines with Stripe's retry policy to amplify load. 10 s is well
 * under the Worker request budget but long enough to cover Stripe's
 * normal p99.
 */
const STRIPE_API_TIMEOUT_MS = 10_000;

type ClinicConfig = { [key: string]: Json | undefined };

/**
 * Q-01: Merge a subset of subscription-related keys into a clinic's
 * existing `config` jsonb without clobbering unrelated fields
 * (`timezone`, `workingHours`, `slotDuration`, …).
 *
 * Postgres replaces `jsonb` columns wholesale on UPDATE — every Stripe
 * event used to nuke per-clinic operational config. We now read the
 * current value first, spread it, and write the merged object back.
 *
 * Uses the admin client (service role) — webhook requests do not carry
 * a user session.
 */
async function mergeClinicConfig(
  supabase: ReturnType<typeof createAdminClient>,
  clinicId: string,
  patch: ClinicConfig,
): Promise<{ error: unknown }> {
  const { data: existing, error: readError } = await supabase
    .from("clinics")
    .select("config")
    .eq("id", clinicId)
    .maybeSingle();

  if (readError) {
    return { error: readError };
  }

  const currentConfig: ClinicConfig =
    existing?.config && typeof existing.config === "object" && !Array.isArray(existing.config)
      ? (existing.config as ClinicConfig)
      : {};

  const merged: ClinicConfig = { ...currentConfig, ...patch };

  const { error: updateError } = await supabase
    .from("clinics")
    .update({ config: merged })
    .eq("id", clinicId);

  return { error: updateError };
}

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler for subscription lifecycle events.
 * Verifies the webhook signature and processes subscription changes.
 *
 * Supported events:
 *   - checkout.session.completed  — activate subscription after checkout
 *   - invoice.paid               — extend / renew subscription period
 *   - invoice.payment_failed     — notify admin, apply grace period
 *   - customer.subscription.deleted — downgrade clinic to free plan
 *
 * Requires:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET (for signature verification)
 *
 * NOTE: This route uses the admin client (service role) because webhook
 * requests come from Stripe, not from an authenticated user session.
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

    let event: SubscriptionWebhookEvent;
    try {
      const parsed = JSON.parse(rawBody);
      const result = subscriptionWebhookEventSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn("Subscription webhook event failed validation", {
          context: "billing/webhook",
          error: result.error.issues,
        });
        return apiError("Invalid webhook event payload");
      }
      event = result.data;
    } catch {
      return apiError("Invalid JSON in webhook body");
    }

    // Use admin client — webhook requests bypass user auth
    const supabase = createAdminClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const clinicId = session.metadata?.clinic_id;
        const planId = session.metadata?.plan_id as PlanSlug | undefined;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (!clinicId || !planId) {
          logger.warn("Missing clinic_id or plan_id in checkout metadata", {
            context: "billing/webhook",
            metadata: session.metadata,
          });
          break;
        }

        logger.info("Subscription checkout completed", {
          context: "billing/webhook",
          clinicId,
          planId,
          stripeCustomerId,
          stripeSubscriptionId,
        });

        // Q-01: merge subscription keys into existing config jsonb instead of
        // replacing the whole column (which would wipe `timezone`,
        // `workingHours`, `slotDuration`, etc.).
        const { error: updateError } = await mergeClinicConfig(supabase, clinicId, {
          subscription_plan: planId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: "active",
          subscription_updated_at: new Date().toISOString(),
        });

        if (updateError) {
          logger.error("Failed to update clinic subscription", {
            context: "billing/webhook",
            clinicId,
            error: updateError,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        // Retrieve subscription to get clinic_id from metadata.
        // P-04: bound the outbound fetch — Stripe latency must not block the
        // webhook handler past Cloudflare's request budget.
        const subResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
          {
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
            signal: AbortSignal.timeout(STRIPE_API_TIMEOUT_MS),
          },
        );

        if (!subResponse.ok) {
          logger.error("Failed to fetch subscription from Stripe", {
            context: "billing/webhook",
            subscriptionId,
          });
          break;
        }

        const subscription = await subResponse.json();
        const clinicId = subscription.metadata?.clinic_id;

        if (!clinicId) break;

        // Determine plan from the subscription's price
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = priceId ? getPlanByPriceId(priceId) : undefined;

        logger.info("Subscription invoice paid", {
          context: "billing/webhook",
          clinicId,
          planId: plan?.slug,
          periodEnd: subscription.current_period_end,
        });

        // Q-01: merge — see mergeClinicConfig.
        const { error: renewError } = await mergeClinicConfig(supabase, clinicId, {
          subscription_plan: plan?.slug ?? subscription.metadata?.plan_id,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
          subscription_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : undefined,
          subscription_updated_at: new Date().toISOString(),
        });

        if (renewError) {
          logger.error("Failed to renew clinic subscription", {
            context: "billing/webhook",
            clinicId,
            error: renewError,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        // Retrieve subscription to get clinic_id.
        // P-04: bound the outbound fetch (see comment above).
        const subResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
          {
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
            signal: AbortSignal.timeout(STRIPE_API_TIMEOUT_MS),
          },
        );

        if (!subResponse.ok) break;

        const subscription = await subResponse.json();
        const clinicId = subscription.metadata?.clinic_id;

        if (!clinicId) break;

        logger.warn("Subscription payment failed", {
          context: "billing/webhook",
          clinicId,
          subscriptionId,
        });

        // Mark subscription as past_due — grace period (Stripe retries automatically).
        // Q-01: merge — see mergeClinicConfig.
        const { error: failError } = await mergeClinicConfig(supabase, clinicId, {
          subscription_plan: subscription.metadata?.plan_id,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscriptionId,
          subscription_status: "past_due",
          subscription_updated_at: new Date().toISOString(),
        });

        if (failError) {
          logger.error("Failed to mark subscription as past_due", {
            context: "billing/webhook",
            clinicId,
            error: failError,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const clinicId = subscription.metadata?.clinic_id;

        if (!clinicId) break;

        logger.warn("Subscription cancelled / deleted", {
          context: "billing/webhook",
          clinicId,
          subscriptionId: subscription.id,
        });

        // Downgrade to free plan.
        // Q-01: merge — see mergeClinicConfig.
        const { error: cancelError } = await mergeClinicConfig(supabase, clinicId, {
          subscription_plan: "free",
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: null,
          subscription_status: "cancelled",
          subscription_updated_at: new Date().toISOString(),
        });

        if (cancelError) {
          logger.error("Failed to downgrade clinic to free plan", {
            context: "billing/webhook",
            clinicId,
            error: cancelError,
          });
        }
        break;
      }

      default:
        // Unhandled event type — acknowledged without processing
        logger.info("Unhandled billing webhook event", {
          context: "billing/webhook",
          eventType: event.type,
        });
    }

    return apiSuccess({ received: true });
  } catch (err) {
    logger.warn("Operation failed", { context: "billing/webhook", error: err });
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
    logger.warn("Signature verification failed", { context: "billing/webhook", error: err });
    return false;
  }
}
