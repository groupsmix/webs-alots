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
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import {
  generateDnsVerificationToken,
  isDnsVerificationConfigured,
  normalizeDomain,
} from "@/lib/dns-verification";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { safeParse } from "@/lib/validations";
import { handlePreflight } from "@/lib/cors";

/** Handle CORS preflight requests. */
export function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

// Rate limit: identical to the main registration endpoint to prevent
// abuse and enumeration attempts.
const tokenLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 2 });

const requestSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  website_domain: z.string().min(1, "Domain is required").max(255),
  turnstile_token: z.string().min(1, "Turnstile verification required").optional(),
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
  if (!(await tokenLimiter.check(`reg_token_${clientIp}`))) {
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

  const { email, website_domain } = result.data;
  const hostname = normalizeDomain(website_domain);
  if (!hostname) {
    return apiError("Invalid website domain.", 400, "INVALID_DOMAIN");
  }

  // F-28: Verify Cloudflare Turnstile token if configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!result.data.turnstile_token) {
      return apiError("Turnstile verification is required", 400);
    }
    try {
      const verifyRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: result.data.turnstile_token,
            remoteip: clientIp,
          }),
        },
      );
      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        logger.warn("Turnstile verification failed", {
          context: "register-clinic-verification-token",
          ip: clientIp,
        });
        return apiError("Bot verification failed. Please try again.", 403);
      }
    } catch (err) {
      logger.error("Turnstile verification request failed", {
        context: "register-clinic-verification-token",
        error: err,
      });
      // Fail open on Turnstile service outage to avoid blocking all registrations
    }
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
