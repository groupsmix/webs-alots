/**
 * Have I Been Pwned (HIBP) k-anonymity password check.
 *
 * A154: Checks whether a password appears in known data breaches using the
 * HIBP Pwned Passwords API v3 with k-anonymity. Only the first 5 characters
 * of the SHA-1 hash are sent to the API, so the full password never leaves
 * the server.
 *
 * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * Feature flag: `HIBP_CHECK_ENABLED` (default: "true").
 * Set to "false" to disable in environments without outbound internet.
 *
 * Timeout: 3 seconds. On timeout or network error the check is skipped
 * (fail-open) to avoid blocking logins when the HIBP API is unreachable.
 * A structured log warning is emitted so ops can detect prolonged outages.
 */

import { logger } from "@/lib/logger";

const HIBP_API_URL = "https://api.pwnedpasswords.com/range/";

/** Timeout for HIBP API requests (ms). */
const HIBP_TIMEOUT_MS = 3_000;

/**
 * Whether the HIBP check is enabled. Defaults to true.
 * Set HIBP_CHECK_ENABLED=false to disable (e.g. air-gapped environments).
 */
function isHibpEnabled(): boolean {
  return process.env.HIBP_CHECK_ENABLED !== "false";
}

/**
 * Compute the SHA-1 hash of a string using the Web Crypto API.
 * Returns the hex-encoded uppercase digest.
 */
async function sha1Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export interface HibpCheckResult {
  /** Whether the password was found in a breach. */
  breached: boolean;
  /** How many times the password appeared in breaches (0 if not found). */
  count: number;
  /** Whether the check was actually performed (false on timeout/error/disabled). */
  checked: boolean;
}

/**
 * Check whether a password appears in the HIBP Pwned Passwords database
 * using k-anonymity (only the first 5 chars of the SHA-1 hash are sent).
 *
 * Returns `{ breached: false, checked: false }` if the check is disabled,
 * times out, or encounters a network error. This is intentionally fail-open
 * to avoid blocking authentication.
 */
export async function checkBreachedPassword(password: string): Promise<HibpCheckResult> {
  if (!isHibpEnabled()) {
    return { breached: false, count: 0, checked: false };
  }

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`${HIBP_API_URL}${prefix}`, {
      headers: {
        "User-Agent": "OltigoHealth-SecurityAudit/1.0",
        "Add-Padding": "true",
      },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("HIBP API returned non-OK status", {
        context: "hibp",
        status: response.status,
      });
      return { breached: false, count: 0, checked: false };
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10) || 0;
        return { breached: count > 0, count, checked: true };
      }
    }

    return { breached: false, count: 0, checked: true };
  } catch (err) {
    // Fail-open: log the error but don't block authentication
    logger.warn("HIBP password check failed (fail-open)", {
      context: "hibp",
      error: err instanceof Error ? err.message : String(err),
    });
    return { breached: false, count: 0, checked: false };
  }
}
