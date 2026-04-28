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

// Rate limit: tokens are cheap but enumeration could probe valid (email, domain)
// pairs, so cap at 30 requests per hour per IP — comfortably above legitimate
// retry/refresh use but well below abuse thresholds.
const tokenLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

const requestSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  website_domain: z.string().min(1, "Domain is required").max(255),
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
