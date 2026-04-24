/**
 * Email Verification API for Patient Bookings
 *
 * Sends a 6-digit verification code to the patient's email before
 * confirming a booking. Prevents spam bookings and ensures reachability.
 *
 * POST /api/verify-email — Send verification code
 * PUT  /api/verify-email — Verify the code
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { logger } from "@/lib/logger";
import { verifyEmailSendSchema, verifyEmailConfirmSchema } from "@/lib/validations";

/**
 * Generate a cryptographically secure 6-digit numeric verification code.
 *
 * Uses crypto.getRandomValues() instead of Math.random() because Math.random()
 * uses xorshift128+ on V8, which is predictable if an attacker can observe
 * enough outputs. For security-sensitive codes this is unacceptable.
 */
function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(100000 + (num % 900000));
}

/**
 * POST — Send a verification code to the provided email.
 */
export const POST = withValidation(verifyEmailSendSchema, async (data, request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
  }

  const { email } = data;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  // Store verification code in database
  const { error } = await supabase.from("email_verifications").upsert(
    {
      email: email.toLowerCase().trim(),
      code,
      expires_at: expiresAt,
      verified: false,
    },
    { onConflict: "email" },
  );

  if (error) {
    // Table may not exist yet — log but provide graceful fallback
    logger.error("Failed to store verification code", { context: "verify-email", error: error.message });
    return apiError("Verification service temporarily unavailable", 503);
  }

  // SECURITY: Never log verification codes — they are sensitive credentials.
  logger.info("Email verification code generated", { context: "verify-email", email });

  // Audit 6.1 — Send the verification code via the configured email provider
  // (Resend or HTTP relay). Falls back gracefully when no provider is set.
  const safeCode = escapeHtml(code);
  const emailResult = await sendEmail({
    to: email,
    subject: "Your verification code — Oltigo",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="margin:0 0 16px;color:#1e293b;">Email Verification</h2>
        <p style="color:#475569;font-size:14px;line-height:1.6;">
          Your verification code is:
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
          <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;">${safeCode}</span>
        </div>
        <p style="color:#94a3b8;font-size:12px;">
          This code expires in 10 minutes. If you did not request this, please ignore this email.
        </p>
      </div>
    `.trim(),
  });

  return apiSuccess({
    ok: true,
    message: emailResult.success
      ? "Verification code sent. Check your email."
      : "Verification code stored but email delivery failed. Contact support.",
    expiresInMinutes: 10,
    _emailDelivered: emailResult.success,
  });
});

/**
 * PUT — Verify a code submitted by the patient.
 */
export const PUT = withValidation(verifyEmailConfirmSchema, async (data, request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
  }

  const { email, code } = data;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  const { data: verification, error } = await supabase
    .from("email_verifications")
    .select("code, expires_at, verified")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !verification) {
    return apiNotFound("No verification found for this email. Request a new code.");
  }

  if (verification.verified) {
    return apiSuccess({ ok: true, message: "Email already verified" });
  }

  if (new Date(verification.expires_at) < new Date()) {
    return apiError("Verification code expired. Request a new one.", 410);
  }

  if (!timingSafeEqual(verification.code, code)) {
    return apiError("Invalid verification code");
  }

  // Mark as verified
  await supabase
    .from("email_verifications")
    .update({ verified: true })
    .eq("email", email.toLowerCase().trim());

  return apiSuccess({
    ok: true,
    message: "Email verified successfully",
  });
});
