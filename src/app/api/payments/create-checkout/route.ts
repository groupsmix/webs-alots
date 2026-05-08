import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { stripeCheckoutSchema } from "@/lib/validations";

/**
 * HIGH-03: Validate that a redirect URL is same-origin to prevent open redirects.
 * Falls back to a safe default if the URL is invalid or cross-origin.
 */
function validateRedirectUrl(
  url: string | undefined,
  origin: string,
  type: "success" | "cancelled",
): string {
  const fallback = `${origin}/patient/dashboard?payment=${type}`;
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
 * POST /api/payments/create-checkout
 *
 * Creates a Stripe Checkout Session for a clinic payment (appointment, subscription, etc.).
 * Uses the Stripe API directly via fetch — no SDK required.
 *
 * Body:
 *   - amount: number (in smallest currency unit, e.g., centimes for MAD)
 *   - currency: string (default: "mad")
 *   - description: string
 *   - patientId?: string
 *   - appointmentId?: string
 *   - successUrl?: string
 *   - cancelUrl?: string
 *   - metadata?: Record<string, string>
 *
 * Requires: STRIPE_SECRET_KEY env var
 */
export const POST = withAuthValidation(stripeCheckoutSchema, async (body, request, { user, profile }) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return apiError("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.", 503);
  }

    const {
      amount,
      currency = "mad",
      description = "Payment",
      patientId,
      appointmentId,
      successUrl,
      cancelUrl,
      metadata = {},
    } = body;

    // AUDIT-09: When an appointmentId is provided, verify the amount against
    // the trusted database record to prevent client-supplied price manipulation.
    // A staff user or compromised account could otherwise create a checkout
    // session with an arbitrarily low amount for a real appointment.
    if (appointmentId && profile.clinic_id) {
      const { createClient: createServiceClient } = await import("@/lib/supabase-server");
      const dbClient = await createServiceClient();
      const { data: appt } = await dbClient
        .from("appointments")
        .select("id, service_id, clinic_id")
        .eq("id", appointmentId)
        .eq("clinic_id", profile.clinic_id)
        .single();

      if (!appt) {
        return apiError("Appointment not found in this clinic", 404);
      }

      // If the appointment has a service, cross-check the expected price
      if (appt.service_id) {
        const { data: service } = await dbClient
          .from("services")
          .select("price")
          .eq("id", appt.service_id)
          .eq("clinic_id", profile.clinic_id)
          .single();

        if (service?.price != null) {
          // Service price is stored in main currency units; amount is in centimes
          const expectedCentimes = Math.round(service.price * 100);
          if (amount < expectedCentimes) {
            return apiError(
              `Payment amount (${amount}) is less than the service price (${expectedCentimes} centimes)`,
              400,
              "AMOUNT_BELOW_SERVICE_PRICE",
            );
          }
        }
      }
    }

    const origin = request.nextUrl.origin;

    // HIGH-03: Validate that success/cancel URLs are same-origin to prevent
    // open redirect attacks (e.g. redirecting to a phishing site after payment).
    const validatedSuccessUrl = validateRedirectUrl(successUrl, origin, "success");
    const validatedCancelUrl = validateRedirectUrl(cancelUrl, origin, "cancelled");

    // Create Stripe Checkout Session via API
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[0]", "card");
    params.append("line_items[0][price_data][currency]", currency.toLowerCase());
    params.append("line_items[0][price_data][product_data][name]", description);
    params.append("line_items[0][price_data][unit_amount]", String(amount));
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", validatedSuccessUrl);
    params.append("cancel_url", validatedCancelUrl);

    // Attach metadata for webhook processing
    if (patientId) params.append("metadata[patient_id]", patientId);
    if (appointmentId) params.append("metadata[appointment_id]", appointmentId);
    params.append("metadata[user_id]", user.id);
    // Always include clinic_id so the webhook handler can record the payment
    if (profile.clinic_id) {
      params.append("metadata[clinic_id]", profile.clinic_id);
    }
    for (const [key, value] of Object.entries(metadata)) {
      params.append(`metadata[${key}]`, value);
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
      void session;
      return apiError("Failed to create checkout session");
    }

    return apiSuccess({
      sessionId: session.id,
      url: session.url,
    });
}, STAFF_ROLES);
