/**
 * A154-01: HIBP Pwned Passwords integration.
 *
 * Uses the k-anonymity range API (api.pwnedpasswords.com/range/{prefix})
 * to check whether a password has appeared in a data breach without ever
 * sending the full password hash over the network.
 *
 * Non-blocking: if the HIBP API is unreachable or slow (>3s), the check
 * is skipped silently — we never block login/registration on an external
 * service failure. The caller decides how to handle a positive match
 * (warn, soft-block, or hard-block).
 */

import { logger } from "@/lib/logger";

/**
 * Check if a password has appeared in known data breaches via HIBP.
 *
 * Returns the number of times the password was seen in breaches,
 * or `0` if it was not found (or if the API is unreachable).
 */
export async function checkPasswordBreached(password: string): Promise<number> {
  try {
    // SHA-1 hash the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return 0;
    }

    const body = await response.text();

    // Each line is: SUFFIX:COUNT
    for (const line of body.split("\n")) {
      const [lineSuffix, countStr] = line.trim().split(":");
      if (lineSuffix === suffix) {
        return parseInt(countStr, 10) || 1;
      }
    }

    return 0;
  } catch (err) {
    // Non-blocking: if HIBP is down, skip the check
    logger.warn("HIBP check failed (non-blocking)", { context: "hibp", error: err });
    return 0;
  }
}
