/**
 * POST /api/v1/register-clinic/verification-token
 *
 * Returns the DNS TXT verification token for a given (email, website_domain)
 * pair so that the registrant can publish it on their domain before calling
 * the registration endpoint.
 *
 * R-12 Fix: The token is server-derived via HMAC with a secret the client
 * does not have, so registrants cannot bypass verification by supplying their
 * own token. The same (email, domain) always yields the same token to support
 * refresh / retry without forcing the user to re-publish DNS.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import {
  generateDnsVerificationToken,
  isDnsVerificationConfigured,
  normalizeDomainWithSSRFProtection,
} from "@/lib/dns-verification";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { safeParse } from "@/lib/validations";

// A1-02 Fix: Strengthen rate limiting to match main registration endpoint
// - Per-IP: 10 req/hour (down from 30) to prevent DoS
// - Per-email: 5 req/hour to prevent enumeration attacks
const tokenLimiterIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const tokenLimiterEmail = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

const requestSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  website_domain: z.string().min(1, "Domain is required").max(255),
  // A1-02 Fix: Require Turnstile CAPTCHA token
  turnstile_token: z.string().min(1, "Turnstile verification required"),
  // A1-02 Fix: Require email confirmation code
  confirmation_code: z.string().length(6, "Confirmation code must be 6 digits"),
});

export async function POST(request: NextRequest) {
  if (process.env.SELF_SERVICE_REGISTRATION_ENABLED !== "true") {
    return apiError("Self-service registration is currently disabled.", 403);
  }

  if (!isDnsVerificationConfigured()) {
    logger.warn("DNS verification token requested but no secret is configured", {
      context: "register-clinic-verification-token",
    });
    return apiError("DNS verification is not available. Please contact support.", 503);
  }

  const clientIp = extractClientIp(request);

  // A1-02 Fix: Enforce stricter rate limiting (10 req/hour per IP)
  if (!(await tokenLimiterIp.check(`reg_token_ip_${clientIp}`))) {
    logger.warn("Verification token rate limit exceeded (IP)", {
      context: "register-clinic-verification-token",
      ip: clientIp,
    });
    return apiError("Too many verification token requests. Please try again later.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = safeParse(requestSchema, body);
  if (!result.success) {
    return apiValidationError(result.error);
  }

  const { email, website_domain, turnstile_token, confirmation_code } = result.data;

  // A1-02 Fix: Enforce per-email rate limiting (5 req/hour)
  const emailKey = email.toLowerCase().trim();
  if (!(await tokenLimiterEmail.check(`reg_token_email_${emailKey}`))) {
    logger.warn("Verification token rate limit exceeded (email)", {
      context: "register-clinic-verification-token",
      ip: clientIp,
    });
    return apiError("Too many verification token requests for this email. Please try again later.", 429);
  }

  // A1-02 Fix: Verify Turnstile CAPTCHA token
  const turnstileResult = await verifyTurnstile(turnstile_token, clientIp, false);
  if (!turnstileResult.success) {
    logger.warn("Turnstile verification failed for verification token request", {
      context: "register-clinic-verification-token",
      ip: clientIp,
      error: turnstileResult.error,
    });
    return apiError("CAPTCHA verification failed. Please try again.", 403, "TURNSTILE_FAILED");
  }

  // A1-02 Fix: Verify email confirmation code
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
  }

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

  const { data: verification, error: verifyError } = await supabase
    .from("email_verifications")
    .select("code, expires_at, verified")
    .eq("email", emailKey)
    .maybeSingle();

  if (verifyError || !verification) {
    logger.warn("Email confirmation not found for verification token request", {
      context: "register-clinic-verification-token",
      ip: clientIp,
    });
    return apiError(
      "Email confirmation required. Please verify your email first by requesting a confirmation code.",
      400,
      "EMAIL_NOT_CONFIRMED"
    );
  }

  if (!verification.verified) {
    // Check if code matches and is not expired
    if (new Date(verification.expires_at) < new Date()) {
      return apiError("Email confirmation code expired. Please request a new one.", 410, "CODE_EXPIRED");
    }

    if (!timingSafeEqual(verification.code, confirmation_code)) {
      logger.warn("Invalid email confirmation code for verification token request", {
        context: "register-clinic-verification-token",
        ip: clientIp,
      });
      return apiError("Invalid confirmation code.", 403, "INVALID_CODE");
    }

    // Mark email as verified
    await supabase
      .from("email_verifications")
      .update({ verified: true })
      .eq("email", emailKey);
  }

  // A1-02 Fix: Use SSRF-protected domain normalization
  const hostname = normalizeDomainWithSSRFProtection(website_domain);
  if (!hostname) {
    logger.warn("Invalid or blocked domain for verification token request", {
      context: "register-clinic-verification-token",
      domain: website_domain,
      ip: clientIp,
    });
    return apiError(
      "Invalid website domain. Private IP addresses and internal domains are not allowed.",
      400,
      "INVALID_DOMAIN"
    );
  }

  const token = generateDnsVerificationToken(email, hostname);
  if (!token) {
    return apiError("DNS verification is not available.", 503);
  }

  logger.info("Issued DNS verification token", {
    context: "register-clinic-verification-token",
    hostname,
    ip: clientIp,
  });

  return apiSuccess({
    token,
    record_name: hostname,
    record_value: `oltigo-verify=${token}`,
    instructions:
      `Add a DNS TXT record on '${hostname}' (or '_oltigo.${hostname}') with value 'oltigo-verify=${token}', then call POST /api/v1/register-clinic with the same email and website_domain.`,
  });
}
