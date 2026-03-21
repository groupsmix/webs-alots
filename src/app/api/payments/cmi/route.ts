import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createCmiPayment, isCmiConfigured } from "@/lib/cmi";

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
export async function POST(request: NextRequest) {
  if (!isCmiConfigured()) {
    return NextResponse.json(
      { error: "CMI payment gateway is not configured. Set CMI_MERCHANT_ID and CMI_SECRET_KEY." },
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

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const orderId = `ord_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const result = await createCmiPayment({
      amount,
      orderId,
      description,
      customerEmail: user.email,
      successUrl: successUrl || `${origin}/patient/dashboard?payment=success`,
      failUrl: failUrl || `${origin}/patient/dashboard?payment=failed`,
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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CMI] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
