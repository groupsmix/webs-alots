/**
 * Cloudflare Turnstile CAPTCHA Verification
 * 
 * Provides a reusable helper for verifying Turnstile tokens across the application.
 * Used to protect public endpoints from bot abuse.
 */

import { logger } from "@/lib/logger";

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  challengeTimestamp?: string;
  hostname?: string;
}

/**
 * Verify a Cloudflare Turnstile token.
 * 
 * @param token - The Turnstile response token from the client
 * @param clientIp - The client's IP address (optional, for additional validation)
 * @param failOpen - If true, verification failures due to service outages will be treated as success (default: false)
 * @returns Verification result with success status
 */
export async function verifyTurnstile(
  token: string,
  clientIp?: string,
  failOpen: boolean = false
): Promise<TurnstileVerificationResult> {
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

  if (!turnstileSecret) {
    logger.warn("Turnstile verification requested but no secret key configured", {
      context: "turnstile-verify",
    });
    // If no secret is configured, fail closed (reject) by default
    return {
      success: false,
      error: "Turnstile verification is not configured",
    };
  }

  if (!token || token.trim().length === 0) {
    return {
      success: false,
      error: "Turnstile token is required",
    };
  }

  try {
    const params = new URLSearchParams({
      secret: turnstileSecret,
      response: token,
    });

    if (clientIp) {
      params.append("remoteip", clientIp);
    }

    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      }
    );

    if (!verifyRes.ok) {
      logger.error("Turnstile verification API returned non-200 status", {
        context: "turnstile-verify",
        status: verifyRes.status,
      });

      if (failOpen) {
        logger.warn("Turnstile verification failed but failing open", {
          context: "turnstile-verify",
        });
        return { success: true };
      }

      return {
        success: false,
        error: "Turnstile verification service unavailable",
      };
    }

    const verifyData = (await verifyRes.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
    };

    if (!verifyData.success) {
      logger.warn("Turnstile verification failed", {
        context: "turnstile-verify",
        errorCodes: verifyData["error-codes"],
        ip: clientIp,
      });

      return {
        success: false,
        error: "Turnstile verification failed",
      };
    }

    logger.info("Turnstile verification succeeded", {
      context: "turnstile-verify",
      hostname: verifyData.hostname,
      ip: clientIp,
    });

    return {
      success: true,
      challengeTimestamp: verifyData.challenge_ts,
      hostname: verifyData.hostname,
    };
  } catch (err) {
    logger.error("Turnstile verification request failed", {
      context: "turnstile-verify",
      error: err,
    });

    if (failOpen) {
      logger.warn("Turnstile verification error but failing open", {
        context: "turnstile-verify",
      });
      return { success: true };
    }

    return {
      success: false,
      error: "Turnstile verification request failed",
    };
  }
}

/**
 * Check if Turnstile verification is configured.
 * 
 * @returns True if TURNSTILE_SECRET_KEY is set
 */
export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}
