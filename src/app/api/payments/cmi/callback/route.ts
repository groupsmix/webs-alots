import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyCmiCallback } from "@/lib/cmi";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { apiError, apiInternalError } from "@/lib/api-response";
import { cmiCallbackFieldsSchema } from "@/lib/validations";

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

    // Validate callback fields before HMAC verification
    const fieldResult = cmiCallbackFieldsSchema.safeParse(params);
    if (!fieldResult.success) {
      logger.warn("CMI callback fields failed validation", {
        context: "payments/cmi/callback",
        error: fieldResult.error.issues,
      });
      return apiError("Invalid callback fields");
    }

    const callbackData = await verifyCmiCallback(params);

    if (!callbackData) {
      return apiError("Invalid callback");
    }

    const supabase = await createClient();

    if (callbackData.status === "approved") {
      // Find the payment by order ID (stored as gateway_session_id)
      // Only process if not already completed (idempotency check)
      // Include clinic_id in SELECT to scope subsequent updates to the same tenant.
      const { data: payment } = await supabase
        .from("payments")
        .select("id, appointment_id, clinic_id, status")
        .eq("gateway_session_id", callbackData.orderId)
        .single();

      if (payment && payment.status !== PAYMENT_STATUS.COMPLETED) {
        // Set tenant context for defense-in-depth RLS enforcement
        if (payment.clinic_id) {
          try {
            await setTenantContext(supabase, payment.clinic_id);
            logTenantContext(payment.clinic_id, "payments/cmi/callback:approved");
          } catch (tenantErr) {
            logger.error("Failed to set tenant context for CMI callback", {
              context: "payments/cmi/callback",
              clinicId: payment.clinic_id,
              error: tenantErr,
            });
          }
        }

        // Mark payment as completed — scoped to the payment's clinic_id
        // to prevent any cross-tenant state mutation.
        await supabase
          .from("payments")
          .update({
            status: PAYMENT_STATUS.COMPLETED,
            reference: callbackData.transactionId || callbackData.orderId,
          })
          .eq("id", payment.id)
          .eq("clinic_id", payment.clinic_id);

        // Confirm the appointment if applicable — scoped to clinic_id
        if (payment.appointment_id && payment.clinic_id) {
          await supabase
            .from("appointments")
            .update({ status: APPOINTMENT_STATUS.CONFIRMED })
            .eq("id", payment.appointment_id)
            .eq("clinic_id", payment.clinic_id)
            .in("status", [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SCHEDULED]);
        }
      }

      // Payment approved — status updated in DB above
    } else {
      // Mark payment as failed — fetch clinic_id first to scope the update
      const { data: failedPayment } = await supabase
        .from("payments")
        .select("id, clinic_id")
        .eq("gateway_session_id", callbackData.orderId)
        .single();

      if (failedPayment) {
        // Set tenant context for defense-in-depth
        if (failedPayment.clinic_id) {
          try {
            await setTenantContext(supabase, failedPayment.clinic_id);
            logTenantContext(failedPayment.clinic_id, "payments/cmi/callback:failed");
          } catch (tenantErr) {
            logger.error("Failed to set tenant context for CMI callback (failed payment)", {
              context: "payments/cmi/callback",
              clinicId: failedPayment.clinic_id,
              error: tenantErr,
            });
          }
        }
        await supabase
          .from("payments")
          .update({ status: PAYMENT_STATUS.FAILED })
          .eq("id", failedPayment.id)
          .eq("clinic_id", failedPayment.clinic_id);
      }

      // Payment not approved — marked as failed in DB above
    }

    // CMI expects "ACTION=POSTAUTH" response for successful processing
    return new NextResponse("ACTION=POSTAUTH", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "payments/cmi/callback", error: err });
    return apiInternalError("Failed to process payment callback");
  }
}
