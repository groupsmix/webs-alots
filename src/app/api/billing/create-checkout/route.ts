import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { SUBSCRIPTION_PLANS, type PlanSlug } from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";
import { subscriptionCheckoutSchema } from "@/lib/validations";

/**
 * HIGH-03: Validate that a redirect URL is same-origin to prevent open redirects.
 */
function validateRedirectUrl(
  url: string | undefined,
  origin: string,
  fallbackPath: string,
): string {
  const fallback = `${origin}${fallbackPath}`;
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== origin) return fallback;
    return url;
  } catch {
    return fallback;
  }
}

/**
 * POST /api/billing/create-checkout
 *
 * Creates a Stripe Checkout Session for a subscription plan upgrade.
 * Uses the Stripe API directly via fetch — no SDK required.
 *
 * Body:
 *   - planId: "starter" | "professional" | "enterprise"
 *   - successUrl?: string (same-origin redirect after success)
 *   - cancelUrl?: string (same-origin redirect on cancel)
 *
 * Requires: STRIPE_SECRET_KEY env var
 */
export const POST = withAuthValidation(subscriptionCheckoutSchema, async (body, request, { user, profile }) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return apiError("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.", 503);
  }

  const { planId, successUrl, cancelUrl } = body;
  const plan = SUBSCRIPTION_PLANS[planId as PlanSlug];

  if (!plan) {
    return apiError("Invalid plan selected", 400, "INVALID_PLAN");
  }

  if (!plan.stripePriceId) {
    return apiError(
      "This plan is not available for purchase. Please contact support.",
      400,
      "PLAN_NOT_CONFIGURED",
    );
  }

  const clinicId = profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with your account", 400, "NO_CLINIC");
  }

  const origin = request.nextUrl.origin;
  const validatedSuccessUrl = validateRedirectUrl(
    successUrl,
    origin,
    "/admin/billing?subscription=success",
  );
  const validatedCancelUrl = validateRedirectUrl(
    cancelUrl,
    origin,
    "/admin/billing?subscription=cancelled",
  );

  // Create Stripe Checkout Session for subscription via API
  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("payment_method_types[0]", "card");
  params.append("line_items[0][price]", plan.stripePriceId);
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", validatedSuccessUrl);
  params.append("cancel_url", validatedCancelUrl);

  // Attach metadata for webhook processing
  params.append("metadata[clinic_id]", clinicId);
  params.append("metadata[user_id]", user.id);
  params.append("metadata[plan_id]", planId);
  params.append("subscription_data[metadata][clinic_id]", clinicId);
  params.append("subscription_data[metadata][plan_id]", planId);

  // Set customer email for Stripe to pre-fill
  if (user.email) {
    params.append("customer_email", user.email);
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await stripeResponse.json();

  if (!stripeResponse.ok) {
    logger.error("Stripe checkout session creation failed", {
      context: "billing/create-checkout",
      clinicId,
      planId,
      stripeError: session.error?.message,
    });
    return apiError("Failed to create checkout session");
  }

  return apiSuccess({
    sessionId: session.id,
    url: session.url,
  });
}, ["clinic_admin"]);
