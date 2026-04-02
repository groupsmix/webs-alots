import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { subscriptionPortalSchema } from "@/lib/validations";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the clinic admin can
 * manage their subscription, update payment methods, or cancel.
 *
 * Body:
 *   - returnUrl?: string (same-origin URL to return to after portal)
 *
 * Requires: STRIPE_SECRET_KEY env var
 */
export const POST = withAuthValidation(subscriptionPortalSchema, async (body, request, { profile }) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return apiError("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.", 503);
  }

  const clinicId = profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with your account", 400, "NO_CLINIC");
  }

  // Fetch the clinic's Stripe customer ID from the database.
  // Use a dynamic import so this module stays edge-compatible.
  const { createClient } = await import("@/lib/supabase-server");
  const supabase = await createClient();

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("config")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    logger.error("Failed to fetch clinic for portal session", {
      context: "billing/portal",
      clinicId,
      error: clinicError,
    });
    return apiError("Clinic not found", 404, "CLINIC_NOT_FOUND");
  }

  const config = clinic.config as Record<string, unknown> | null;
  const stripeCustomerId = config?.stripe_customer_id as string | undefined;

  if (!stripeCustomerId) {
    return apiError(
      "No active subscription found. Please subscribe to a plan first.",
      400,
      "NO_SUBSCRIPTION",
    );
  }

  const origin = request.nextUrl.origin;
  const returnUrl = body.returnUrl || `${origin}/admin/billing`;

  // Validate return URL is same-origin
  let validatedReturnUrl = `${origin}/admin/billing`;
  try {
    const parsed = new URL(returnUrl);
    if (parsed.origin === origin) {
      validatedReturnUrl = returnUrl;
    }
  } catch {
    // Use default
  }

  // Create Stripe Customer Portal session via API
  const params = new URLSearchParams();
  params.append("customer", stripeCustomerId);
  params.append("return_url", validatedReturnUrl);

  const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await stripeResponse.json();

  if (!stripeResponse.ok) {
    logger.error("Stripe portal session creation failed", {
      context: "billing/portal",
      clinicId,
      stripeError: session.error?.message,
    });
    return apiError("Failed to create portal session");
  }

  return apiSuccess({
    url: session.url,
  });
}, ["clinic_admin"]);
