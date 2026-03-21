import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

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
export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      currency = "mad",
      description = "Payment",
      patientId,
      appointmentId,
      successUrl,
      cancelUrl,
      metadata = {},
    } = body as {
      amount: number;
      currency?: string;
      description?: string;
      patientId?: string;
      appointmentId?: string;
      successUrl?: string;
      cancelUrl?: string;
      metadata?: Record<string, string>;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const origin = request.nextUrl.origin;

    // Create Stripe Checkout Session via API
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[0]", "card");
    params.append("line_items[0][price_data][currency]", currency.toLowerCase());
    params.append("line_items[0][price_data][product_data][name]", description);
    params.append("line_items[0][price_data][unit_amount]", String(amount));
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", successUrl || `${origin}/patient/dashboard?payment=success`);
    params.append("cancel_url", cancelUrl || `${origin}/patient/dashboard?payment=cancelled`);

    // Attach metadata for webhook processing
    if (patientId) params.append("metadata[patient_id]", patientId);
    if (appointmentId) params.append("metadata[appointment_id]", appointmentId);
    params.append("metadata[user_id]", user.id);
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
      console.error("[Stripe] Checkout session error:", session.error?.message);
      return NextResponse.json(
        { error: session.error?.message || "Failed to create checkout session" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Payments] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
