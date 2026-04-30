import { NextRequest, NextResponse } from "next/server";
import { apiError, apiInternalError } from "@/lib/api-response";
import { verifyCmiCallback } from "@/lib/cmi";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import { APPOINTMENT_STATUS, PAYMENT_STATUS } from "@/lib/types/database";
import { cmiCallbackFieldsSchema } from "@/lib/validations";

/**
 * POST /api/payments/cmi/callback
 *
 * Server-to-server callback from CMI after payment processing.
 * Verifies the HMAC hash and updates the payment status in Supabase.
 *
 * Also handles the customer redirect (GET) after payment.
 */
/** S-15: Max body size for CMI callback (10 KB). CMI callbacks are small
 *  form-encoded payloads; anything larger is suspicious. */
const MAX_CMI_CALLBACK_BYTES = 10 * 1024;

/**
 * A39.5: CMI (Centre Monétique Interbancaire) publishes a known set of
 * callback source IPs. When `CMI_ALLOWED_IPS` env var is set (comma-
 * separated), we enforce an IP allowlist as defense-in-depth alongside
 * the HMAC verification.
 *
 * When unset, the check is skipped (HMAC-only, backward compatible).
 * On Cloudflare, `CF-Connecting-IP` is authoritative; we fall back to
 * X-Forwarded-For for non-CF environments (dev/staging).
 */
function isCmiSourceAllowed(request: NextRequest): boolean {
  const raw = process.env.CMI_ALLOWED_IPS;
  if (!raw) return true; // IP allowlist not configured — rely on HMAC only

  const allowedIps = new Set(raw.split(",").map((ip) => ip.trim()).filter(Boolean));
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  if (!clientIp) {
    logger.warn("CMI callback: no client IP available for allowlist check", {
      context: "payments/cmi/callback",
    });
    return false; // Fail closed when IP is unknown and allowlist is configured
  }

  return allowedIps.has(clientIp);
}

/**
 * S-15: Read the request body while enforcing a hard byte cap. Returns null
 * if the body exceeds the limit. Works even when the client omits the
 * Content-Length header (e.g. chunked transfer encoding) because we stream
 * the body and abort as soon as the cumulative byte count exceeds the cap.
 */
async function readBodyWithLimit(
  request: NextRequest,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // best effort
      }
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    // A39.5: Source IP allowlist — defense-in-depth alongside HMAC.
    if (!isCmiSourceAllowed(request)) {
      logger.warn("CMI callback rejected: source IP not in allowlist", {
        context: "payments/cmi/callback",
        ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown",
      });
      return apiError("Forbidden", 403);
    }

    // S-15: Enforce a body size cap before parsing formData to prevent
    // memory exhaustion from an attacker-controlled payload. We check
    // Content-Length first for a cheap early reject, but also enforce the
    // cap on the actual bytes read — Content-Length is optional and a
    // client using chunked transfer encoding can omit it entirely.
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_CMI_CALLBACK_BYTES) {
      return apiError("Payload too large", 413);
    }

    const body = await readBodyWithLimit(request, MAX_CMI_CALLBACK_BYTES);
    if (body === null) {
      return apiError("Payload too large", 413);
    }

    const contentType =
      request.headers.get("content-type") || "application/x-www-form-urlencoded";
    // Re-parse the size-limited body as formData. TextDecoder is safe here
    // because CMI callbacks are form-urlencoded (ASCII).
    const bodyText = new TextDecoder().decode(body);
    const formData = await new Response(bodyText, {
      headers: { "content-type": contentType },
    }).formData();
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
      // F-16: Include amount and currency for validation against callback data.
      const { data: payment } = await supabase
        .from("payments")
        .select("id, appointment_id, clinic_id, status, amount")
        .eq("gateway_session_id", callbackData.orderId)
        .single();

      if (payment && payment.status !== PAYMENT_STATUS.COMPLETED) {
        // F-16: Validate amount/currency match between gateway and DB.
        // CMI uses currency code "504" for MAD. Amount must match exactly.
        const callbackAmount = parseFloat(callbackData.amount ?? "0");
        // CMI uses currency code "504" for MAD. Extract from raw params if available.
        const callbackCurrency = (params as Record<string, string>).currency || "504";
        if (
          payment.amount !== null &&
          (Number.isNaN(callbackAmount) ||
            Math.abs(callbackAmount - payment.amount) > 0.01 ||
            callbackCurrency !== "504")
        ) {
          logger.error("CMI callback amount/currency mismatch — potential tampering", {
            context: "payments/cmi/callback",
            paymentId: payment.id,
            expectedAmount: payment.amount,
            callbackAmount,
            callbackCurrency,
            clinicId: payment.clinic_id,
          });
          // Mark as tampered, do NOT complete the payment
          await supabase
            .from("payments")
            .update({ status: "tampered" as never })
            .eq("id", payment.id)
            .eq("clinic_id", payment.clinic_id);

          try {
            const Sentry = await import("@sentry/nextjs");
            Sentry.captureException(
              new Error("CMI payment amount/currency mismatch"),
              {
                tags: { compliance: "payment_tampering", clinicId: payment.clinic_id },
                extra: { paymentId: payment.id, expectedAmount: payment.amount, callbackAmount, callbackCurrency },
              },
            );
          } catch {
            // Sentry unavailable
          }

          return new NextResponse("ACTION=POSTAUTH", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }

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
    // F-A93-03: Payment callback failure is an error, not a warning
    logger.error("CMI payment callback processing failed", { context: "payments/cmi/callback", error: err });
    return apiInternalError("Failed to process payment callback");
  }
}
