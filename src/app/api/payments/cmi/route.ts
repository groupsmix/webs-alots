import { createCmiPayment, isCmiConfigured } from "@/lib/cmi";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { cmiPaymentSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";

/**
 * Validate that a redirect URL is same-origin to prevent open redirects.
 * Falls back to a safe default if the URL is invalid or cross-origin.
 */
function validateRedirectUrl(
  url: string | undefined,
  origin: string,
  type: "success" | "failed",
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
 * POST /api/payments/cmi
 *
 * Creates a CMI payment session and returns form data needed
 * to redirect the customer to CMI's hosted payment page.
 *
 * Body:
 *   - amount: number (in MAD, e.g., 200.00)
 *   - description: string
 *   - patientId?: string
 *   - appointmentId?: string
 *   - successUrl?: string
 *   - failUrl?: string
 *
 * Requires: CMI_MERCHANT_ID, CMI_SECRET_KEY env vars
 */
export const POST = withAuthValidation(cmiPaymentSchema, async (body, request, { user }) => {
  if (!isCmiConfigured()) {
    return apiError("CMI payment gateway is not configured. Set CMI_MERCHANT_ID and CMI_SECRET_KEY.", 503);
  }

    const {
      amount,
      description = "Paiement",
      patientId,
      appointmentId,
      successUrl,
      failUrl,
    } = body;

    const origin = request.nextUrl.origin;
    const orderId = `ord_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const result = await createCmiPayment({
      amount,
      orderId,
      description,
      customerEmail: user.email,
      successUrl: validateRedirectUrl(successUrl, origin, "success"),
      failUrl: validateRedirectUrl(failUrl, origin, "failed"),
      callbackUrl: `${origin}/api/payments/cmi/callback`,
      metadata: {
        patient_id: patientId || "",
        appointment_id: appointmentId || "",
        user_id: user.id,
      },
    });

    if (!result.success) {
      return apiInternalError(result.error || "Failed to create CMI payment");
    }

    return apiSuccess({
      orderId,
      formUrl: result.formUrl,
      formFields: result.formFields,
    });
}, STAFF_ROLES);
