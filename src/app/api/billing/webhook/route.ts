import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { getPlanByPriceId, type PlanSlug } from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import { subscriptionWebhookEventSchema } from "@/lib/validations";
import type { SubscriptionWebhookEvent } from "@/lib/validations";
import { verifyStripeWebhook } from "@/lib/stripe-webhook";

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

    const verifyResult = await verifyStripeWebhook(rawBody, signature, webhookSecret, "billing/webhook");
    if (verifyResult === "expired") {
      return apiError("Webhook timestamp too old — possible replay attack", 400);
    }
    if (verifyResult === "invalid") {
      return apiError("Invalid webhook signature", 400);
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

        // HIGH-06: Verify the Stripe customer in the webhook actually belongs
        // to the clinic in the metadata. Without this check, an attacker who
        // controls a Stripe account could craft a checkout session with an
        // arbitrary clinic_id in metadata and upgrade any clinic for free.
        if (stripeCustomerId) {
          const { data: clinicRecord } = await supabase
            .from("clinics")
            .select("config")
            .eq("id", clinicId)
            .single();

          const storedCustomerId = clinicRecord?.config?.stripe_customer_id as string | undefined;
          // Allow if no customer is stored yet (first checkout) OR if it matches
          if (storedCustomerId && storedCustomerId !== stripeCustomerId) {
            logger.error("Stripe customer mismatch in billing webhook — possible metadata injection", {
              context: "billing/webhook",
              clinicId,
              expectedCustomer: storedCustomerId,
              receivedCustomer: stripeCustomerId,
            });
            break;
          }
        }

        logger.info("Subscription checkout completed", {
          context: "billing/webhook",
          clinicId,
          planId,
          stripeCustomerId,
          stripeSubscriptionId,
        });

        // Update clinic's subscription plan and Stripe customer ID
        const { error: updateError } = await supabase
          .from("clinics")
          .update({
            config: {
              subscription_plan: planId,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              subscription_status: "active",
              subscription_updated_at: new Date().toISOString(),
            },
          })
          .eq("id", clinicId);

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

        // Retrieve subscription to get clinic_id from metadata
        const subResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
          {
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
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

        // Extend subscription period and ensure status is active
        const { error: renewError } = await supabase
          .from("clinics")
          .update({
            config: {
              subscription_plan: plan?.slug ?? subscription.metadata?.plan_id,
              stripe_customer_id: subscription.customer,
              stripe_subscription_id: subscriptionId,
              subscription_status: "active",
              subscription_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : undefined,
              subscription_updated_at: new Date().toISOString(),
            },
          })
          .eq("id", clinicId);

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

        // Retrieve subscription to get clinic_id
        const subResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
          {
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
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

        // Mark subscription as past_due — grace period (Stripe retries automatically)
        const { error: failError } = await supabase
          .from("clinics")
          .update({
            config: {
              subscription_plan: subscription.metadata?.plan_id,
              stripe_customer_id: subscription.customer,
              stripe_subscription_id: subscriptionId,
              subscription_status: "past_due",
              subscription_updated_at: new Date().toISOString(),
            },
          })
          .eq("id", clinicId);

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

        // Downgrade to free plan
        const { error: cancelError } = await supabase
          .from("clinics")
          .update({
            config: {
              subscription_plan: "free",
              stripe_customer_id: subscription.customer,
              stripe_subscription_id: null,
              subscription_status: "cancelled",
              subscription_updated_at: new Date().toISOString(),
            },
          })
          .eq("id", clinicId);

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
