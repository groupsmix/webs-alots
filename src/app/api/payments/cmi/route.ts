import { NextResponse } from "next/server";
import { createCmiPayment, isCmiConfigured } from "@/lib/cmi";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";

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
export const POST = withAuth(async (request, { user }) => {
  if (!isCmiConfigured()) {
    return NextResponse.json(
      { error: "CMI payment gateway is not configured. Set CMI_MERCHANT_ID and CMI_SECRET_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const {
      amount,
      description = "Paiement",
      patientId,
      appointmentId,
      successUrl,
      failUrl,
    } = body as {
      amount: number;
      description?: string;
      patientId?: string;
      appointmentId?: string;
      successUrl?: string;
      failUrl?: string;
    };

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (description && typeof description === "string" && description.length > 500) {
      return NextResponse.json({ error: "Description exceeds maximum length" }, { status: 400 });
    }

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
      return NextResponse.json(
        { error: result.error || "Failed to create CMI payment" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      orderId,
      formUrl: result.formUrl,
      formFields: result.formFields,
    });
  } catch (err) {
    void err;
    return NextResponse.json({ error: "Failed to create CMI payment" }, { status: 500 });
  }
}, STAFF_ROLES);
