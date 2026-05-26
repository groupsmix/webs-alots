/**
 * F-A154-a: HaveIBeenPwned k-Anonymity password check.
 *
 * Uses the HIBP Passwords API v3 range endpoint to check if a password
 * has appeared in known data breaches without sending the full password
 * hash to the HIBP API.
 *
 * Protocol:
 * 1. SHA-1 hash the password
 * 2. Send the first 5 characters of the hash to the HIBP API
 * 3. Receive all suffixes that match
 * 4. Check if the full hash suffix appears in the response
 *
 * This k-Anonymity model ensures HIBP never sees enough of the hash
 * to identify the password.
 *
 * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

import { logger } from "@/lib/logger";

const HIBP_API_URL = "https://api.pwnedpasswords.com/range";
const HIBP_TIMEOUT_MS = 3_000;

/**
 * Check if a password has appeared in known data breaches.
 *
 * Returns the number of times the password was seen in breaches,
 * or 0 if not found. Returns -1 on error (fail-open: caller should
 * still allow the password but may warn the user).
 */
export async function checkPwnedPassword(password: string): Promise<number> {
  try {
    // SHA-1 hash the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`${HIBP_API_URL}/${prefix}`, {
      headers: {
        "User-Agent": "Oltigo-Health-PasswordCheck",
        "Add-Padding": "true",
      },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("HIBP API returned non-OK status", {
        context: "hibp",
        status: response.status,
      });
      return -1;
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) {
        return parseInt(count, 10) || 0;
      }
    }

    return 0;
  } catch (err) {
    logger.warn("HIBP password check failed", {
      context: "hibp",
      error: err,
    });
    return -1;
  }
}

/**
 * Returns true if the password is compromised (found in breaches).
 * Returns false if not found or on error (fail-open).
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  const count = await checkPwnedPassword(password);
  return count > 0;
}
