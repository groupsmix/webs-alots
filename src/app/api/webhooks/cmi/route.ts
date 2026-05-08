import { NextRequest, NextResponse } from "next/server";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCmiCallback } from "@/lib/cmi";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";

/**
 * POST /api/webhooks/cmi
 *
 * CMI (Centre Monétique Interbancaire) webhook endpoint for payment callbacks.
 * This is separate from /api/payments/cmi/callback to follow the webhook
 * routing pattern established by /api/webhooks (WhatsApp).
 *
 * A39.2: IP Allowlisting
 * ----------------------
 * CMI publishes a known set of callback source IPs. We enforce an IP allowlist
 * as defense-in-depth alongside HMAC verification. When `CMI_IP_RANGES` env
 * var is set (comma-separated CIDR ranges), we reject requests from non-CMI IPs.
 *
 * Morocco IP ranges for CMI (Centre Monétique Interbancaire):
 * - 196.200.0.0/16 (primary CMI network)
 * - 41.140.0.0/16 (backup CMI network)
 *
 * When unset, the check is skipped (HMAC-only, backward compatible).
 */

/**
 * A39.2: CMI IP allowlist. These are the known IP ranges for CMI callbacks.
 * Configured via CMI_IP_RANGES env var (comma-separated CIDR ranges).
 *
 * Example: CMI_IP_RANGES="196.200.0.0/16,41.140.0.0/16"
 */
const CMI_IP_RANGES = process.env.CMI_IP_RANGES?.split(",").map((r) => r.trim()).filter(Boolean) ?? [];

/**
 * Check if an IP address is within a CIDR range.
 * Supports IPv4 only (CMI uses IPv4).
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
    const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * A39.2: Check if the request source IP is in the CMI allowlist.
 * Returns true if the IP is allowed or if no allowlist is configured.
 * On Cloudflare, CF-Connecting-IP is authoritative; we fall back to
 * X-Forwarded-For for non-CF environments (dev/staging).
 */
function isCmiSourceAllowed(request: NextRequest): boolean {
  // If no allowlist is configured, skip the check (HMAC-only)
  if (CMI_IP_RANGES.length === 0) return true;

  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  if (!clientIp) {
    logger.warn("CMI webhook: no client IP available for allowlist check", {
      context: "webhooks/cmi",
    });
    return false; // Fail closed when IP is unknown and allowlist is configured
  }

  // Check if the client IP is in any of the allowed CIDR ranges
  for (const cidr of CMI_IP_RANGES) {
    if (isIpInCidr(clientIp, cidr)) {
      return true;
    }
  }

  return false;
}

/**
 * Max body size for CMI webhook (10 KB). CMI callbacks are small
 * form-encoded payloads; anything larger is suspicious.
 */
const MAX_CMI_WEBHOOK_BYTES = 10 * 1024;

/**
 * Read the request body while enforcing a hard byte cap. Returns null
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
    // A39.2: Source IP allowlist — defense-in-depth alongside HMAC
    if (!isCmiSourceAllowed(request)) {
      logger.warn("CMI webhook rejected: source IP not in allowlist", {
        context: "webhooks/cmi",
        ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown",
      });
      return apiError("Forbidden", 403);
    }

    // Enforce body size cap before parsing formData to prevent memory exhaustion
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_CMI_WEBHOOK_BYTES) {
      return apiError("Payload too large", 413);
    }

    const body = await readBodyWithLimit(request, MAX_CMI_WEBHOOK_BYTES);
    if (body === null) {
      return apiError("Payload too large", 413);
    }

    const contentType =
      request.headers.get("content-type") || "application/x-www-form-urlencoded";
    const bodyText = new TextDecoder().decode(body);
    const formData = await new Response(bodyText, {
      headers: { "content-type": contentType },
    }).formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    // Verify CMI HMAC signature
    const callbackData = await verifyCmiCallback(params);
    if (!callbackData) {
      logger.warn("CMI webhook: invalid signature", {
        context: "webhooks/cmi",
      });
      return apiError("Invalid webhook signature", 401);
    }

    const supabase = await createClient();

    // Find the payment by order ID
    const { data: payment } = await supabase
      .from("payments")
      .select("id, appointment_id, clinic_id, status, amount")
      .eq("gateway_session_id", callbackData.orderId)
      .single();

    if (!payment) {
      logger.warn("CMI webhook: payment not found", {
        context: "webhooks/cmi",
        orderId: callbackData.orderId,
      });
      return apiError("Payment not found", 404);
    }

    // Set tenant context for defense-in-depth RLS enforcement
    if (payment.clinic_id) {
      try {
        await setTenantContext(supabase, payment.clinic_id);
        logTenantContext(payment.clinic_id, "webhooks/cmi", {
          orderId: callbackData.orderId,
          status: callbackData.status,
        });
      } catch (tenantErr) {
        logger.error("Failed to set tenant context for CMI webhook", {
          context: "webhooks/cmi",
          clinicId: payment.clinic_id,
          error: tenantErr,
        });
        return apiInternalError("Failed to process webhook");
      }
    }

    // Process the payment based on status
    if (callbackData.status === "approved") {
      // Validate amount matches (defense against tampering)
      const callbackAmount = parseFloat(callbackData.amount ?? "0");
      if (
        payment.amount !== null &&
        (Number.isNaN(callbackAmount) || Math.abs(callbackAmount - payment.amount) > 0.01)
      ) {
        logger.error("CMI webhook: amount mismatch — potential tampering", {
          context: "webhooks/cmi",
          paymentId: payment.id,
          expectedAmount: payment.amount,
          callbackAmount,
          clinicId: payment.clinic_id,
        });

        // Mark as tampered, do NOT complete the payment
        await supabase
          .from("payments")
          .update({ status: "tampered" as never })
          .eq("id", payment.id)
          .eq("clinic_id", payment.clinic_id);

        return apiError("Payment amount mismatch", 400);
      }

      // Mark payment as completed (idempotent)
      if (payment.status !== "completed") {
        await supabase
          .from("payments")
          .update({
            status: "completed" as never,
            reference: callbackData.transactionId || callbackData.orderId,
          })
          .eq("id", payment.id)
          .eq("clinic_id", payment.clinic_id);

        // Confirm the appointment if applicable
        if (payment.appointment_id) {
          await supabase
            .from("appointments")
            .update({ status: "confirmed" as never })
            .eq("id", payment.appointment_id)
            .eq("clinic_id", payment.clinic_id)
            .in("status", ["pending", "scheduled"]);
        }
      }
    } else {
      // Mark payment as failed
      await supabase
        .from("payments")
        .update({ status: "failed" as never })
        .eq("id", payment.id)
        .eq("clinic_id", payment.clinic_id);
    }

    return apiSuccess({ status: "ok" });
  } catch (err) {
    logger.error("CMI webhook processing failed", {
      context: "webhooks/cmi",
      error: err,
    });
    return apiInternalError("Failed to process webhook");
  }
}
