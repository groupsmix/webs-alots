import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyCmiCallback } from "@/lib/cmi";
import { APPOINTMENT_STATUS } from "@/lib/types/database";

/**
 * POST /api/payments/cmi/callback
 *
 * Server-to-server callback from CMI after payment processing.
 * Verifies the HMAC hash and updates the payment status in Supabase.
 *
 * Also handles the customer redirect (GET) after payment.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const callbackData = await verifyCmiCallback(params);

    if (!callbackData) {
      console.error("[CMI Callback] Invalid hash or missing data");
      return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
    }

    const supabase = await createClient();

    if (callbackData.status === "approved") {
      // Find the payment by order ID (stored as gateway_session_id)
      // Only process if not already completed (idempotency check)
      const { data: payment } = await supabase
        .from("payments")
        .select("id, appointment_id, status")
        .eq("gateway_session_id", callbackData.orderId)
        .single();

      if (payment && payment.status !== "completed") {
        // Mark payment as completed
        await supabase
          .from("payments")
          .update({
            status: "completed",
            reference: callbackData.transactionId || callbackData.orderId,
          })
          .eq("id", payment.id);

        // Confirm the appointment if applicable
        if (payment.appointment_id) {
          await supabase
            .from("appointments")
            .update({ status: APPOINTMENT_STATUS.CONFIRMED })
            .eq("id", payment.appointment_id)
            .in("status", [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SCHEDULED]);
        }
      }

      console.log(`[CMI Callback] Payment approved: ${callbackData.orderId}`);
    } else {
      // Mark payment as failed
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("gateway_session_id", callbackData.orderId);

      console.log(`[CMI Callback] Payment ${callbackData.status}: ${callbackData.orderId} (code: ${callbackData.responseCode})`);
    }

    // CMI expects "ACTION=POSTAUTH" response for successful processing
    return new NextResponse("ACTION=POSTAUTH", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CMI Callback] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
